/**
 * Comments tests.
 * @module routes/comments/comments
 */

// External imports
import request from 'supertest';
import { describe, it } from 'vitest';

// Internal imports
import app from '../../app';
import {
  adminToken,
  createUserWithToken,
  testRequest,
} from '../../helpers/tests/tests';

describe('Comments', () => {
  it('should return the comments', () => testRequest(app, 'comments/get'));

  it('should add a comment', () => testRequest(app, 'comments/post'));

  it('should reply to a comment', () =>
    testRequest(app, 'comments/post_reply'));

  it('should update a comment', () => testRequest(app, 'comments/patch'));

  it('should delete a comment', () => testRequest(app, 'comments/delete'));

  it('should not read or add comments without view', async () => {
    const admin = (req: request.Test) =>
      req
        .set('Accept', 'application/json')
        .set('Authorization', `Bearer ${adminToken}`);
    await admin(request(app).post('/'))
      .send({ '@type': 'Page', id: 'private-page', title: 'Private Page' })
      .expect(201);
    await admin(request(app).post('/private-page/@comments'))
      .send({ text: 'Secret comment' })
      .expect(204);

    // Anonymous can't read the comments
    await request(app)
      .get('/private-page/@comments')
      .set('Accept', 'application/json')
      .expect(401);

    // A member can't read or add comments
    const token = await createUserWithToken('member');
    const member = (req: request.Test) =>
      req
        .set('Accept', 'application/json')
        .set('Authorization', `Bearer ${token}`);
    await member(request(app).get('/private-page/@comments')).expect(403);
    await member(request(app).post('/private-page/@comments'))
      .send({ text: 'Comment' })
      .expect(403);

    // The admin can
    await admin(request(app).get('/private-page/@comments')).expect(200);
  });
});
