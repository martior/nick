/**
 * Locking tests.
 * @module routes/lock/lock
 */

// External imports
import { createHmac } from 'crypto';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Internal imports
import app from '../../app';
import { addToken } from '../../helpers/auth/auth';
import config from '../../helpers/config/config';
import * as lock from '../../helpers/lock/lock';
import { testRequest } from '../../helpers/tests/tests';
import { User } from '../../models/user/user';

// Mock lockExpired
vi.spyOn(lock, 'lockExpired').mockReturnValue(false);

const path = '/news/my-news-item';
const adminToken =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJhZG1pbiIsImZ1bGxuYW1lIjoiQWRtaW4iLCJpYXQiOjE2NDkzMTI0NDl9.RS1Ny_r0v7vIylFfK6q0JVJrkiDuTOh9iG9IL8xbzAk';

/**
 * Create an editor with a valid token
 * @method editorToken
 * @returns {Promise<string>} Token of the editor
 */
async function editorToken(): Promise<string> {
  const encode = (data: object) =>
    Buffer.from(JSON.stringify(data)).toString('base64url');
  const unsigned = `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({
    sub: 'editor',
    fullname: 'Editor',
    iat: 1649312449,
  })}`;
  const token = `${unsigned}.${createHmac('sha256', config.settings.secret)
    .update(unsigned)
    .digest('base64url')}`;
  const user = await User.create(
    {
      id: 'editor',
      fullname: 'Editor',
      email: 'editor@example.com',
      password: '',
      _roles: ['Editor'],
    },
    { related: ['_roles'] },
    global.txn!,
  );
  await addToken(user, token, global.txn!);
  return token;
}

describe('Locking', () => {
  beforeEach(async () => {
    await testRequest(app, 'content/post');
  });
  afterEach(async () => {
    await testRequest(app, 'content/delete');
  });

  it('should lock an item', () => testRequest(app, 'locking/post'));

  it('should lock an item with options', () =>
    testRequest(app, 'locking/post_options'));

  it('should delete a lock', async () => {
    await testRequest(app, 'locking/post');
    return testRequest(app, 'locking/delete');
  });

  it('should delete a lock with force', async () => {
    await testRequest(app, 'locking/post');
    return testRequest(app, 'locking/delete_force');
  });

  it('should return the lock of another user without the token', async () => {
    const token = await editorToken();
    await testRequest(app, 'locking/post');
    const res = await request(app)
      .post(`${path}/@lock`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(res.body.locked).toBe(true);
    expect(res.body.creator).toBe('admin');
    expect(res.body.token).toBeUndefined();
    return testRequest(app, 'locking/get');
  });

  it('should keep the lock of another user on unlock without force', async () => {
    const token = await editorToken();
    await testRequest(app, 'locking/post');
    const res = await request(app)
      .delete(`${path}/@lock`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(res.body.locked).toBe(true);
    expect(res.body.creator).toBe('admin');
    expect(res.body.token).toBeUndefined();
    return testRequest(app, 'locking/get');
  });

  it('should refresh a lock', async () => {
    await testRequest(app, 'locking/post');
    return testRequest(app, 'locking/patch');
  });

  it('should get lock information', async () => {
    await testRequest(app, 'locking/post');
    return testRequest(app, 'locking/get');
  });

  it('should update a document which is locked', async () => {
    await testRequest(app, 'locking/post');
    return testRequest(app, 'locking/update');
  });
});
