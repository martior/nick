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
import { adminToken, testRequest } from '../../helpers/tests/tests';

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
});
