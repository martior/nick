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

  it('should check the permissions on the sources of copy and move', async () => {
    const Document = models.get('Document');
    const events = await Document.fetchOne(
      { path: '/events' },
      {},
      global.txn!,
    );
    await createDocument(
      '0123abcd-0000-4000-8000-000000000003',
      events,
      'secret',
      'Page',
    );
    const contributor = await createUser('contributor');
    const news = await Document.fetchOne({ path: '/news' }, {}, global.txn!);
    await news
      .$relatedQuery('_userRoles', global.txn!)
      .relate({ id: 'Contributor', user: 'contributor' });

    // A private source that can't be viewed is skipped
    const copy = await request(app)
      .post('/news/@copy')
      .set('Accept', 'application/json')
      .set('Authorization', `Bearer ${contributor}`)
      .send({ source: '/events/secret' })
      .expect(200);
    expect(copy.body).toEqual([]);
    expect(
      await Document.fetchOne({ path: '/news/secret' }, {}, global.txn!),
    ).toBeUndefined();

    // Moving a viewable source requires the delete permission
    await request(app)
      .post('/news/@move')
      .set('Accept', 'application/json')
      .set('Authorization', `Bearer ${contributor}`)
      .send({ source: 'http://localhost:8080/events/event-1' })
      .expect(403);

    // An item can't be moved into itself
    await request(app)
      .post('/events/@move')
      .set('Accept', 'application/json')
      .set('Authorization', `Bearer ${token}`)
      .send({ source: '/events' })
      .expect(400);

    // Sources can be urls, paths or uuids
    const move = await request(app)
      .post('/news/@move')
      .set('Accept', 'application/json')
      .set('Authorization', `Bearer ${token}`)
      .send({
        source: [
          'http://localhost:8080/events/event-1',
          '0123abcd-0000-4000-8000-000000000003',
        ],
      })
      .expect(200);
    expect(move.body.map((item: any) => item.target)).toEqual([
      'http://localhost:8080/news/event-1',
      'http://localhost:8080/news/secret',
    ]);
  });
});
