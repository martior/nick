/**
 * Content tests.
 * @module routes/content/content
 */

// External imports
import request from 'supertest';
import { v4 as uuid } from 'uuid';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Internal imports
import app from '../../app';
import {
  createDocument,
  createUser,
  testRequest,
} from '../../helpers/tests/tests';
import models from '../../models';

const token =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJhZG1pbiIsImZ1bGxuYW1lIjoiQWRtaW4iLCJpYXQiOjE2NDkzMTI0NDl9.RS1Ny_r0v7vIylFfK6q0JVJrkiDuTOh9iG9IL8xbzAk';

describe('Content', () => {
  beforeEach(() => {
    const mockDate = new Date(Date.UTC(2022, 0, 1));
    vi.setSystemTime(mockDate);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should return a content object', () => testRequest(app, 'content/get'));

  it('should add a content object', () => testRequest(app, 'content/post'));

  it('should update a content object', async () => {
    await testRequest(app, 'content/post');
    return testRequest(app, 'content/patch');
  });

  it('should delete a content object', async () => {
    await testRequest(app, 'content/post');
    return testRequest(app, 'content/delete');
  });

  it('should return not found when content not found', () =>
    testRequest(app, 'content/get_notfound'));

  it('should return bad request when required field is missing', () =>
    testRequest(app, 'content/post_badrequest'));

  it('should be able to handle reordering of content', async () => {
    await testRequest(app, 'content/post');
    return testRequest(app, 'content/patch_reorder');
  });

  it('should copy a content object', () => testRequest(app, 'copymove/copy'));

  it('should move a content object', () => testRequest(app, 'copymove/move'));

  it('should update the catalog of the children of a moved folder', async () => {
    const headers = {
      Accept: 'application/json',
      Authorization:
        'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJhZG1pbiIsImZ1bGxuYW1lIjoiQWRtaW4iLCJpYXQiOjE2NDkzMTI0NDl9.RS1Ny_r0v7vIylFfK6q0JVJrkiDuTOh9iG9IL8xbzAk',
    };
    await request(app)
      .post('/news/@move')
      .set(headers)
      .send({ source: '/events' })
      .expect(200);
    const res = await request(app)
      .get('/@search?path.query=/news/events&path.depth=1&sort_on=getId')
      .set(headers)
      .expect(200);
    expect(res.body.items.map((item: any) => item['@id'])).toStrictEqual([
      'http://localhost:8080/news/events/event-1',
      'http://localhost:8080/news/events/event-2',
    ]);
  });

  /*
  it('should copy multiple content objects', () => {
    // Mock uuid
    let i = 0;
    // @ts-expect-error Mock implementation does not match type definition, but it is only used in tests
    vi.mocked(uuid).mockImplementation(() => {
      i = i + 1;
      return `a95388f2-e4b3-4292-98aa-62656cbd5b9${i}`;
    });

    return testRequest(app, 'copymove/copy_multiple');
  });
  */

  it('should export a content object', () =>
    testRequest(app, 'content/export'));

  it('should export a content object with an inline disposition', () =>
    testRequest(app, 'content/export_inline'));

  it('should export an ics file for a content object', () =>
    testRequest(app, 'content/ics'));

  it('should export an ics file for a folder object', () =>
    testRequest(app, 'content/ics_folder'));

  it('should export a rss file for a folder object', () =>
    testRequest(app, 'content/rss'));

  it('should export a markdown file for an object', () =>
    testRequest(app, 'content/markdown'));

  it('should ignore a workflow history sent on create', async () => {
    const Document = models.get('Document');
    await request(app)
      .post('/news')
      .set('Accept', 'application/json')
      .set('Authorization', `Bearer ${token}`)
      .send({
        '@type': 'Page',
        id: 'forged',
        title: 'Forged',
        workflow_history: [
          {
            action: 'publish',
            actor: 'mallory',
            review_state: 'published',
            time: '2001-01-01T00:00:00Z',
          },
        ],
      })
      .expect(201);
    const document = await Document.fetchOne(
      { path: '/news/forged' },
      {},
      global.txn!,
    );
    expect(document.workflow_history).toEqual([]);
  });

  it('should only allow site managers to set the uuid', async () => {
    const Document = models.get('Document');
    const contributor = await createUser('contributor');
    const news = await Document.fetchOne({ path: '/news' }, {}, global.txn!);
    await news
      .$relatedQuery('_userRoles', global.txn!)
      .relate({ id: 'Contributor', user: 'contributor' });
    const body = {
      '@type': 'Page',
      id: 'with-uuid',
      title: 'With uuid',
      uuid: '0123abcd-0000-4000-8000-000000000001',
    };

    await request(app)
      .post('/news')
      .set('Accept', 'application/json')
      .set('Authorization', `Bearer ${contributor}`)
      .send(body)
      .expect(403);

    const res = await request(app)
      .post('/news')
      .set('Accept', 'application/json')
      .set('Authorization', `Bearer ${token}`)
      .send(body)
      .expect(201);
    expect(res.body.UID).toBe(body.uuid);
  });

  it('should validate the type and the fields on create', async () => {
    const post = (body: any) =>
      request(app)
        .post('/news')
        .set('Accept', 'application/json')
        .set('Authorization', `Bearer ${token}`)
        .send(body);

    expect((await post({ title: 'No type' }).expect(400)).body.message).toBe(
      "Property '@type' is required.",
    );
    expect(
      (await post({ '@type': 'NoSuchType', title: 'x' }).expect(403)).body
        .message,
    ).toBe(
      "Invalid '@type' parameter. No content type with the name “NoSuchType” found.",
    );
    const errors = async (body: any) =>
      JSON.parse((await post(body).expect(400)).body.message);
    expect(await errors({ '@type': 'Page', title: 12345 })).toStrictEqual([
      {
        field: 'title',
        message: 'Object is of wrong type.',
        error: 'ValidationError',
      },
    ]);
    expect(
      (await errors({ '@type': 'Page', title: 'x', description: ['a'] }))[0]
        .field,
    ).toBe('description');
    expect(
      (await errors({ '@type': 'Page', title: 'line1\nline2' }))[0].message,
    ).toBe('Constraint not satisfied');
    expect(
      (await errors({ '@type': 'Page', title: 'x'.repeat(1025) }))[0].message,
    ).toBe('Value is too long');
    expect(
      (await errors({ '@type': 'Page', title: 'x', blocks: 'not-a-dict' }))[0]
        .field,
    ).toBe('blocks');
  });

  it('should validate explicit ids on create', async () => {
    const post = (id: string) =>
      request(app)
        .post('/news')
        .set('Accept', 'application/json')
        .set('Authorization', `Bearer ${token}`)
        .send({ '@type': 'Page', id, title: 'x' });

    for (const id of ['slash/inside', '_underscore', '..', 'aq_parent']) {
      await post(id).expect(400);
    }
    await post('has space').expect(201);
    expect((await post('has space').expect(400)).body.message).toBe(
      'The id “has space” is invalid - it is already in use.',
    );
  });

  it('should validate the fields on update', async () => {
    const patch = (body: any) =>
      request(app)
        .patch('/news')
        .set('Accept', 'application/json')
        .set('Authorization', `Bearer ${token}`)
        .send(body);

    expect(
      JSON.parse((await patch({ title: null }).expect(400)).body.message),
    ).toStrictEqual([
      {
        field: 'title',
        message: 'Required input is missing.',
        error: 'ValidationError',
      },
    ]);
    await patch({ title: { not: 'a string' } }).expect(400);
    await patch({ id: '_news' }).expect(400);
    await patch({ description: null }).expect(204);
  });

  it('should allow ids and titles longer than 255 characters', async () => {
    const res = await request(app)
      .post('/news')
      .set('Accept', 'application/json')
      .set('Authorization', `Bearer ${token}`)
      .send({ '@type': 'Page', id: 'a'.repeat(300), title: 'y'.repeat(1024) })
      .expect(201);
    expect(res.body.id).toBe('a'.repeat(300));
    expect(res.body.title).toBe('y'.repeat(1024));
  });

  it('should normalize text to the NFC form', async () => {
    const res = await request(app)
      .post('/news')
      .set('Accept', 'application/json')
      .set('Authorization', `Bearer ${token}`)
      .send({ '@type': 'Page', id: 'combining', title: 'e\u0301 acute' })
      .expect(201);
    expect(res.body.title).toBe('\u00e9 acute');
  });

  it('should accept the uuid as UID', async () => {
    const post = (UID: any) =>
      request(app)
        .post('/news')
        .set('Accept', 'application/json')
        .set('Authorization', `Bearer ${token}`)
        .send({ '@type': 'Page', title: 'With UID', UID });

    const res = await post('0123456789abcdef0123456789abcdef').expect(201);
    expect(res.body.UID).toBe('01234567-89ab-cdef-0123-456789abcdef');
    await post('0123456789abcdef0123456789abcdef').expect(400);
    await post('not-a-uuid').expect(400);
  });

  it('should require the delete permission', async () => {
    const Document = models.get('Document');
    const news = await Document.fetchOne({ path: '/news' }, {}, global.txn!);
    const pending = await createDocument(
      '0123abcd-0000-4000-8000-000000000002',
      news,
      'pending',
      'Page',
      { workflow_state: 'pending' },
    );
    const reviewer = await createUser('reviewer');
    const editor = await createUser('editor');
    await pending
      .$relatedQuery('_userRoles', global.txn!)
      .relate({ id: 'Reviewer', user: 'reviewer' });
    await pending
      .$relatedQuery('_userRoles', global.txn!)
      .relate({ id: 'Editor', user: 'editor' });

    // A reviewer may modify a pending item but not delete it
    await request(app)
      .patch('/news/pending')
      .set('Accept', 'application/json')
      .set('Authorization', `Bearer ${reviewer}`)
      .send({ title: 'Reviewed' })
      .expect(204);
    await request(app)
      .delete('/news/pending')
      .set('Accept', 'application/json')
      .set('Authorization', `Bearer ${reviewer}`)
      .expect(403);

    // An editor may delete it
    await request(app)
      .delete('/news/pending')
      .set('Accept', 'application/json')
      .set('Authorization', `Bearer ${editor}`)
      .expect(204);
  });
});
