/**
 * User tests.
 * @module routes/users/users
 */

// External imports
import request from 'supertest';
import { describe, it, afterEach } from 'vitest';

// Internal imports
import app from '../../app';
import { addToken } from '../../helpers/auth/auth';
import { testRequest } from '../../helpers/tests/tests';
import { User } from '../../models/user/user';

/**
 * Add the user of the examples and log it in with the token of the examples
 * @method addHeadlessNick
 */
async function addHeadlessNick(): Promise<void> {
  await testRequest(app, 'users/post');
  const user = await User.fetchById('headlessnick', {}, global.txn as any);
  await addToken(
    user,
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJoZWFkbGVzc25pY2siLCJmdWxsbmFtZSI6Ik5lYXJseSBIZWFkbGVzcyBOaWNrIiwiaWF0IjoxNjQ5Njk4MTUxfQ.K-NLonuCLqcv_hzq4d_vqEVGPLClwpry_HVYRSkJIf4',
    global.txn as any,
  );
}

describe('User', () => {
  afterEach(async () => {
    await testRequest(app, 'users/delete');
  });

  it('should get a list of users', () => testRequest(app, 'users/list'));

  it('should get a list of users by query', () =>
    testRequest(app, 'users/list_query'));

  it('should get an error when not logged in', () =>
    testRequest(app, 'users/list_anonymous'));

  it('should get an individual user', () => testRequest(app, 'users/get'));

  it('should not get a user when not logged in', () =>
    testRequest(app, 'users/get_anonymous'));

  it('should not get a user when not found', () =>
    testRequest(app, 'users/get_notfound'));

  it('should add a new user', () => testRequest(app, 'users/post'));

  it('should not add a user with a short password', () =>
    testRequest(app, 'users/post_short_password'));

  it('should not add a user without a password', () =>
    testRequest(app, 'users/post_without_password'));

  it('should update a user', async () => {
    await testRequest(app, 'users/post');
    return testRequest(app, 'users/patch');
  });

  it('should set the password of a user', async () => {
    await testRequest(app, 'users/post');
    await testRequest(app, 'users/patch_password');
    await request(app)
      .post('/@login')
      .send({ login: 'headlessnick', password: 'nearlyheadless' })
      .expect(401);
    return request(app)
      .post('/@login')
      .send({ login: 'headlessnick', password: 'headlessnick' })
      .expect(200);
  });

  it('should not set a password which is too short', async () => {
    await testRequest(app, 'users/post');
    return testRequest(app, 'users/patch_password_short');
  });

  it('should delete a user', async () => {
    await testRequest(app, 'users/post');
    return testRequest(app, 'users/delete');
  });

  it('should send a reset password mail', async () => {
    await testRequest(app, 'users/post');
    return testRequest(app, 'users/reset_password_mail');
  });

  it('should reset a password', async () => {
    await testRequest(app, 'users/post');
    return testRequest(app, 'users/reset_password_set');
  });

  it('should not set a password which is too short on reset', async () => {
    await testRequest(app, 'users/post');
    return testRequest(app, 'users/reset_password_short');
  });

  it('should set own password', async () => {
    await addHeadlessNick();
    await testRequest(app, 'users/reset_password_own');
    return request(app)
      .post('/@login')
      .send({ login: 'headlessnick', password: 'headless' })
      .expect(200);
  });

  it('should not set own password with a wrong old password', async () => {
    await addHeadlessNick();
    return testRequest(app, 'users/reset_password_own_wrong');
  });

  it('should not set the password of another user', async () => {
    await testRequest(app, 'users/post');
    return testRequest(app, 'users/reset_password_other');
  });
});
