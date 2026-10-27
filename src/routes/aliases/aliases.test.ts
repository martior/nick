/**
 * Aliases tests.
 * @module routes/aliases/aliases
 */

// External imports
import request from 'supertest';
import { describe, it, afterEach } from 'vitest';

// Internal imports
import app from '../../app';
import {
  adminToken,
  createUserWithToken,
  testRequest,
} from '../../helpers/tests/tests';

describe('Aliases', () => {
  afterEach(async () => {
    await testRequest(app, 'aliases/delete');
  });

  it('should get a list of aliases', async () => {
    await testRequest(app, 'aliases/post_root');
    return testRequest(app, 'aliases/list');
  });

  it('should get a list of aliases in the root', async () => {
    await testRequest(app, 'aliases/post_root');
    return testRequest(app, 'aliases/list_root');
  });

  it('should get a list of aliases with a search query', async () => {
    await testRequest(app, 'aliases/post_root');
    return testRequest(app, 'aliases/list_query');
  });

  it('should add a new alias', () => testRequest(app, 'aliases/post'));

  it('should add a new alias in bulk', () =>
    testRequest(app, 'aliases/post_root'));

  it('should not add an alias of existing content', () =>
    testRequest(app, 'aliases/post_existing'));

  it('should delete an alias', async () => {
    await testRequest(app, 'aliases/post');
    return testRequest(app, 'aliases/delete');
  });

  it('should not list aliases to visitors', async () => {
    await testRequest(app, 'aliases/post');
    const token = await createUserWithToken('member');

    // Anonymous and members
    await request(app)
      .get('/news/@aliases')
      .set('Accept', 'application/json')
      .expect(401);
    await request(app)
      .get('/@aliases')
      .set('Accept', 'application/json')
      .expect(401);
    await request(app)
      .get('/news/@aliases')
      .set('Accept', 'application/json')
      .set('Authorization', `Bearer ${token}`)
      .expect(401);

    // An editor of the news folder lists its aliases, not those of the site
    await request(app)
      .post('/news/@sharing')
      .set('Accept', 'application/json')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        entries: [{ id: 'member', type: 'user', roles: { Editor: true } }],
        inherit: true,
      })
      .expect(204);
    await request(app)
      .get('/news/@aliases')
      .set('Accept', 'application/json')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    return request(app)
      .get('/@aliases')
      .set('Accept', 'application/json')
      .set('Authorization', `Bearer ${token}`)
      .expect(401);
  });
});
