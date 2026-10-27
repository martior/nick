/**
 * Content Rules tests.
 * @module routes/content_rules/content_rules.test
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

describe('Content Rules', () => {
  it('should return the content rules', () =>
    testRequest(app, 'content_rules/get'));

  it('should create a content rule', () =>
    testRequest(app, 'content_rules/post'));

  it('should enable a content rule', () =>
    testRequest(app, 'content_rules/patch_enable'));

  it('should disable a content rule', () =>
    testRequest(app, 'content_rules/patch_disable'));

  it('should bubble a content rule', () =>
    testRequest(app, 'content_rules/patch_bubble'));

  it('should not bubble a content rule', () =>
    testRequest(app, 'content_rules/patch_nobubble'));

  it('should delete a content rule', () =>
    testRequest(app, 'content_rules/delete'));

  it('should not allow a local editor to manage content rules', async () => {
    const token = await createUserWithToken('editor');
    await request(app)
      .post('/events/@sharing')
      .set('Accept', 'application/json')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        entries: [{ id: 'editor', type: 'user', roles: { Editor: true } }],
        inherit: true,
      })
      .expect(204);
    const editor = (req: request.Test) =>
      req
        .set('Accept', 'application/json')
        .set('Authorization', `Bearer ${token}`);
    await editor(request(app).get('/events/@content-rules')).expect(401);
    await editor(request(app).post('/events/@content-rules/rule-1')).expect(
      401,
    );
    await editor(request(app).patch('/events/@content-rules'))
      .send({ 'form.button.Disable': true, rule_ids: ['rule-1'] })
      .expect(401);
    await editor(request(app).delete('/events/@content-rules'))
      .send({ rule_ids: ['rule-1'] })
      .expect(401);
  });
});
