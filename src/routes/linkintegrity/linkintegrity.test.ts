/**
 * Linkintegrity tests.
 * @module routes/linkintegrity/linkintegrity
 */

// External imports
import request from 'supertest';
import { describe, expect, it } from 'vitest';

// Internal imports
import app from '../../app';
import {
  adminToken,
  createUserWithToken,
  testRequest,
} from '../../helpers/tests/tests';

describe('Linkintegrity', () => {
  it('should return the linkintegrity', () =>
    testRequest(app, 'linkintegrity/get'));

  it('should not disclose items the user can not view', async () => {
    const events = '1a2123ba-14e8-4910-8e6b-c04a40d72a41';
    const privatePage = '5c1f8a3e-2b7d-4e6a-9c0d-1e2f3a4b5c01';
    const admin = (req: request.Test) =>
      req
        .set('Accept', 'application/json')
        .set('Authorization', `Bearer ${adminToken}`);

    // A private page referencing the events folder
    await admin(request(app).post('/'))
      .send({
        '@type': 'Page',
        id: 'private-page',
        uuid: privatePage,
        title: 'Private Page',
        relatedItems: [events],
      })
      .expect(201);

    // An editor of the news folder only
    const token = await createUserWithToken('editor');
    await admin(request(app).post('/news/@sharing'))
      .send({
        entries: [{ id: 'editor', type: 'user', roles: { Editor: true } }],
        inherit: true,
      })
      .expect(204);
    const editor = (uids: string) =>
      request(app)
        .get(`/news/@linkintegrity?uids=${uids}`)
        .set('Accept', 'application/json')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

    // The private page is not listed as a breach nor as an item
    expect((await editor(events)).body).toEqual([]);
    expect((await editor(privatePage)).body).toEqual([]);

    // The admin sees the breach
    const res = await admin(
      request(app).get(`/news/@linkintegrity?uids=${events}`),
    ).expect(200);
    expect(res.body[0].breaches[0].uid).toBe(privatePage);
  });
});
