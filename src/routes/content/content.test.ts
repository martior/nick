/**
 * Content tests.
 * @module routes/content/content
 */

// External imports
import request from 'supertest';
import { v4 as uuid, validate } from 'uuid';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Internal imports
import app from '../../app';
import {
  adminToken,
  createDocument,
  createUser,
  createUserWithToken,
  testRequest,
} from '../../helpers/tests/tests';
import models from '../../models';

const token = adminToken;

// A 1x1 pixel png image
const png =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

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

  it('should only serve images of the document itself', async () => {
    // Add a private image, all uuids are mocked
    vi.mocked(validate).mockReturnValue(true);
    const imageUuid = uuid();
    await request(app)
      .post('/news')
      .set('Accept', 'application/json')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        '@type': 'Image',
        id: 'private-image',
        title: 'Private Image',
        image: {
          data: png,
          encoding: 'base64',
          'content-type': 'image/png',
          filename: 'private.png',
        },
      })
      .expect(201);

    // Not through a published item or the site root
    await request(app).get(`/news/@@images/${imageUuid}.png`).expect(404);
    await request(app).get(`/@@images/${imageUuid}.png`).expect(404);

    // Not for anonymous on the private image itself
    await request(app)
      .get(`/news/private-image/@@images/${imageUuid}.png`)
      .expect(401);

    // But for the admin on the image itself
    return request(app)
      .get(`/news/private-image/@@images/${imageUuid}.png`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
  });

  it('should not show uploaded html inline', async () => {
    vi.mocked(validate).mockReturnValue(true);
    const addFile = (id: string, contentType: string) =>
      request(app)
        .post('/news')
        .set('Accept', 'application/json')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          '@type': 'File',
          id,
          uuid: id === 'html' ? uuid() : '1f6bc2f4-4a0c-4c4e-9a3c-2b8c1b7d6e01',
          title: id,
          file: {
            data: Buffer.from('<script>alert(1)</script>').toString('base64'),
            encoding: 'base64',
            'content-type': contentType,
            filename: `${id}.txt`,
          },
        })
        .expect(201);

    // Html is always an attachment
    await addFile('html', 'text/html');
    const html = await request(app)
      .get('/news/html/@@download/file?disposition=inline')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(html.headers['content-disposition']).toBe(
      'attachment; filename="html.txt"',
    );
    expect(html.headers['x-content-type-options']).toBe('nosniff');

    // Plain text can be shown inline
    await addFile('text', 'text/plain');
    const text = await request(app)
      .get('/news/text/@@download/file?disposition=inline')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(text.headers['content-disposition']).toBe(
      'inline; filename="text.txt"',
    );
  });

  it('should only serialize related items the user can view', async () => {
    const events = '1a2123ba-14e8-4910-8e6b-c04a40d72a41';
    const privatePage = '7d2c4e6f-8a9b-4c1d-9e2f-3a4b5c6d7e01';
    const admin = (req: request.Test) =>
      req
        .set('Accept', 'application/json')
        .set('Authorization', `Bearer ${adminToken}`);

    // A private page and a published page relating to it and to events
    await admin(request(app).post('/news'))
      .send({
        '@type': 'Page',
        id: 'private-page',
        uuid: privatePage,
        title: 'Private Page',
      })
      .expect(201);
    await admin(request(app).post('/news'))
      .send({
        '@type': 'Page',
        id: 'page',
        uuid: '7d2c4e6f-8a9b-4c1d-9e2f-3a4b5c6d7e02',
        title: 'Page',
        relatedItems: [privatePage, events],
      })
      .expect(201);
    await admin(request(app).post('/news/page/@workflow/publish')).expect(200);
    const related = (res: request.Response) =>
      res.body.relatedItems.map((item: any) => item.UID).sort();

    // Anonymous only gets the published events folder
    const anonymous = await request(app)
      .get('/news/page')
      .set('Accept', 'application/json')
      .expect(200);
    expect(related(anonymous)).toEqual([events]);

    // Admin gets both
    const res = await admin(request(app).get('/news/page')).expect(200);
    expect(related(res)).toEqual([events, privatePage].sort());
  });

  it('should copy a folder into its own subfolder once', async () => {
    const admin = (req: request.Test) =>
      req
        .set('Accept', 'application/json')
        .set('Authorization', `Bearer ${adminToken}`);
    const add = (path: string, type: string, id: string, uid: string) =>
      admin(request(app).post(path))
        .send({ '@type': type, id, uuid: uid, title: id })
        .expect(201);
    await add('/news', 'Folder', 'f', '9a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c01');
    await add(
      '/news/f',
      'Folder',
      'sub',
      '9a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c02',
    );
    await add('/news/f', 'Page', 'c', '9a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c03');

    // Give every copy its own uuid
    let i = 10;
    vi.mocked(uuid).mockImplementation(
      (() => `9a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c${i++}`) as any,
    );

    await admin(request(app).post('/news/f/sub/@copy'))
      .send({ source: '/news/f' })
      .expect(200);
    vi.mocked(uuid).mockReturnValue(
      'a95388f2-e4b3-4292-98aa-62656cbd5b9c' as any,
    );

    // The copy has the original children, but not itself again
    const ids = (res: request.Response) =>
      res.body.items.map((item: any) => item.id).sort();
    expect(
      ids(await admin(request(app).get('/news/f/sub/f')).expect(200)),
    ).toEqual(['c', 'sub']);
    expect(
      ids(await admin(request(app).get('/news/f/sub/f/sub')).expect(200)),
    ).toEqual([]);
  });

  it('should not stream a private video to anonymous', async () => {
    vi.mocked(validate).mockReturnValue(true);
    await request(app)
      .post('/news')
      .set('Accept', 'application/json')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        '@type': 'Video',
        id: 'private-video',
        title: 'Private Video',
        video: {
          data: Buffer.from('video').toString('base64'),
          encoding: 'base64',
          'content-type': 'video/mp4',
          filename: 'private.mp4',
        },
      })
      .expect(201);
    await request(app)
      .get('/news/private-video/@@videos/video')
      .set('Accept', 'application/json')
      .expect(401);
    return request(app)
      .get('/news/private-video/@@videos/video')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
  });

  it('should check the permissions on the sources of copy and move', async () => {
    const admin = (req: request.Test) =>
      req
        .set('Accept', 'application/json')
        .set('Authorization', `Bearer ${adminToken}`);
    await admin(request(app).post('/'))
      .send({
        '@type': 'Page',
        id: 'private-page',
        uuid: '4f6a8c0e-2b4d-4f6a-8c0e-2b4d6f8a0c01',
        title: 'Private Page',
      })
      .expect(201);

    // A contributor of the events folder
    const token = await createUserWithToken('contributor');
    await admin(request(app).post('/events/@sharing'))
      .send({
        entries: [
          { id: 'contributor', type: 'user', roles: { Contributor: true } },
        ],
        inherit: true,
      })
      .expect(204);
    const contributor = (req: request.Test) =>
      req
        .set('Accept', 'application/json')
        .set('Authorization', `Bearer ${token}`);

    // A private item is not copied or moved
    const copy = await contributor(request(app).post('/events/@copy'))
      .send({ source: '/private-page' })
      .expect(200);
    expect(copy.body).toEqual([]);
    const move = await contributor(request(app).post('/events/@move'))
      .send({ source: '/private-page' })
      .expect(200);
    expect(move.body).toEqual([]);
    await admin(request(app).get('/private-page')).expect(200);
    await admin(request(app).get('/events/private-page')).expect(404);

    // A viewable item the contributor can't modify is not moved
    await contributor(request(app).post('/events/@move'))
      .send({ source: '/news' })
      .expect(403);
  });

  it('should serve an image with a non-ascii filename by uuid', async () => {
    vi.mocked(validate).mockReturnValue(true);
    const imageUuid = uuid();
    await request(app)
      .post('/news')
      .set('Accept', 'application/json')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        '@type': 'Image',
        id: 'image',
        title: 'Image',
        image: {
          data: png,
          encoding: 'base64',
          'content-type': 'image/png',
          filename: 'bild-æøå.png',
        },
      })
      .expect(201);
    return request(app)
      .get(`/news/image/@@images/${imageUuid}.png`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
  });
});
