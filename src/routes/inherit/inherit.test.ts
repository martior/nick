/**
 * Inherit tests.
 * @module routes/inherit/inherit
 */

// External imports
import request from 'supertest';
import { validate } from 'uuid';
import { describe, expect, it, vi } from 'vitest';

// Internal imports
import app from '../../app';
import { adminToken, testRequest } from '../../helpers/tests/tests';

describe('Inherit', () => {
  it('should return the content item specified by the behavior', () =>
    testRequest(app, 'inherit/get'));

  it('should skip ancestors the user can not view', async () => {
    vi.mocked(validate).mockReturnValue(true);
    const admin = (req: request.Test) =>
      req
        .set('Accept', 'application/json')
        .set('Authorization', `Bearer ${adminToken}`);

    // Private page with a published file without blocks below it
    await admin(request(app).post('/news'))
      .send({
        '@type': 'Page',
        id: 'private-page',
        uuid: '0b8e7a52-6a43-4b8a-9d8e-6f0f0c1d2a01',
        title: 'Private Page',
        blocks: { secret: { '@type': 'text' } },
        blocks_layout: { items: ['secret'] },
      })
      .expect(201);
    await admin(request(app).post('/news/private-page'))
      .send({
        '@type': 'File',
        id: 'file',
        uuid: '0b8e7a52-6a43-4b8a-9d8e-6f0f0c1d2a02',
        title: 'File',
        file: {
          data: 'dGVzdA==',
          encoding: 'base64',
          'content-type': 'text/plain',
          filename: 'file.txt',
        },
      })
      .expect(201);
    await admin(
      request(app).post('/news/private-page/file/@workflow/publish'),
    ).expect(200);

    // Anonymous gets the blocks of the published news folder
    const anonymous = await request(app)
      .get('/news/private-page/file/@inherit?expand.inherit.behaviors=blocks')
      .set('Accept', 'application/json')
      .expect(200);
    expect(anonymous.body.blocks.from['@id']).toBe(
      'http://localhost:8080/news',
    );

    // Admin gets the blocks of the private page
    const res = await admin(
      request(app).get(
        '/news/private-page/file/@inherit?expand.inherit.behaviors=blocks',
      ),
    ).expect(200);
    expect(res.body.blocks.from['@id']).toBe(
      'http://localhost:8080/news/private-page',
    );
  });
});
