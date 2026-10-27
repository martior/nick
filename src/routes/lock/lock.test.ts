/**
 * Locking tests.
 * @module routes/lock/lock
 */

// External imports
import { createHmac } from 'crypto';
import request from 'supertest';
import { v4 as uuid } from 'uuid';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Internal imports
import app from '../../app';
import { addToken } from '../../helpers/auth/auth';
import config from '../../helpers/config/config';
import * as lock from '../../helpers/lock/lock';
import { createUser, testRequest } from '../../helpers/tests/tests';
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

/**
 * Get the lock of the test document
 * @method getLock
 * @returns {Promise<any>} Lock information
 */
async function getLock(): Promise<any> {
  const res = await request(app)
    .get(`${path}/@lock`)
    .set('Authorization', `Bearer ${adminToken}`)
    .expect(200);
  return res.body;
}

describe('Locking', () => {
  beforeEach(async () => {
    await testRequest(app, 'content/post');
  });
  // The test transaction is rolled back after each test, which removes the
  // document and its lock

  it('should lock an item', () => testRequest(app, 'locking/post'));

  it('should lock an item with options', () =>
    testRequest(app, 'locking/post_options'));

  it('should delete a lock', async () => {
    await testRequest(app, 'locking/post');
    await testRequest(app, 'locking/delete');
    return testRequest(app, 'locking/get_unlocked');
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

  it('should steal a stealable lock of another user with force', async () => {
    const token = await editorToken();
    await request(app)
      .post(`${path}/@lock`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    await testRequest(app, 'locking/delete_force');
    expect((await getLock()).locked).toBe(false);
  });

  it('should keep the lock of another user on unlock without force', async () => {
    const token = await editorToken();
    await request(app)
      .post(`${path}/@lock`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const res = await request(app)
      .delete(`${path}/@lock`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(res.body.locked).toBe(true);
    expect(res.body.creator).toBe('editor');
    expect(res.body.token).toBeUndefined();
    expect((await getLock()).locked).toBe(true);
  });

  it('should not steal a non-stealable lock', async () => {
    const token = await editorToken();
    await request(app)
      .post(`${path}/@lock`)
      .set('Authorization', `Bearer ${token}`)
      .send({ stealable: false })
      .expect(200);
    await request(app)
      .delete(`${path}/@lock`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ force: true })
      .expect(401);
    expect((await getLock()).locked).toBe(true);
  });

  it('should refresh a lock', async () => {
    await testRequest(app, 'locking/post');
    return testRequest(app, 'locking/patch');
  });

  it('should keep the token, timeout and stealable on refresh', async () => {
    await testRequest(app, 'locking/post_options');
    const res = await request(app)
      .patch(`${path}/@lock`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(res.body.token).toBe('a95388f2-e4b3-4292-98aa-62656cbd5b9c');
    expect(res.body.timeout).toBe(3600);
    expect(res.body.stealable).toBe(false);
  });

  it('should not lock an unlocked item on refresh', async () => {
    await testRequest(app, 'locking/patch_unlocked');
    expect((await getLock()).locked).toBe(false);
  });

  it('should get lock information', async () => {
    await testRequest(app, 'locking/post');
    return testRequest(app, 'locking/get');
  });

  it('should update a document which is locked', async () => {
    await testRequest(app, 'locking/post');
    return testRequest(app, 'locking/update');
  });

  it('should not update a locked document without the lock token', async () => {
    await testRequest(app, 'locking/post');
    return testRequest(app, 'locking/update_locked');
  });

  it('should not delete a locked document', async () => {
    await testRequest(app, 'locking/post');
    await testRequest(app, 'locking/delete_content_locked');
    await testRequest(app, 'locking/delete');
  });

  it('should keep the lock after an update with the lock token', async () => {
    await testRequest(app, 'locking/post');
    await testRequest(app, 'locking/update');
    expect((await getLock()).locked).toBe(true);
  });

  it('should not update a document locked by another user with the token', async () => {
    const token = await editorToken();
    await request(app)
      .post(`${path}/@lock`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const lockToken = (await getLock()).token;
    expect(lockToken).toBe('a95388f2-e4b3-4292-98aa-62656cbd5b9c');
    await request(app)
      .patch(path)
      .set('Authorization', `Bearer ${adminToken}`)
      .set('Lock-Token', lockToken)
      .send({ title: 'Changed' })
      .expect(403);
    await request(app)
      .patch(`${path}/@history`)
      .set('Authorization', `Bearer ${adminToken}`)
      .set('Lock-Token', lockToken)
      .send({ version: 0 })
      .expect(401);
    await request(app)
      .patch(path)
      .set('Authorization', `Bearer ${token}`)
      .set('Lock-Token', lockToken)
      .send({ title: 'Changed' })
      .expect(204);
  });

  it('should not move a document locked by another user with the token', async () => {
    const token = await editorToken();
    await request(app)
      .post(`${path}/@lock`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    await request(app)
      .post('/events/@move')
      .set('Accept', 'application/json')
      .set('Authorization', `Bearer ${adminToken}`)
      .set('Lock-Token', (await getLock()).token)
      .send({ source: path })
      .expect(423);
  });

  it('should not show the lock token to users who may only view', async () => {
    await testRequest(app, 'locking/post');
    const token = await createUser('viewer', ['Reader']);
    const lock = await request(app)
      .get(`${path}/@lock`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(lock.body.locked).toBe(true);
    expect(lock.body.creator).toBe('admin');
    expect(lock.body.token).toBeUndefined();
    const content = await request(app)
      .get(path)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(content.body.lock.locked).toBe(true);
    expect(content.body.lock.token).toBeUndefined();
    expect((await getLock()).token).toBe(
      'a95388f2-e4b3-4292-98aa-62656cbd5b9c',
    );
  });

  it('should not move a locked item', async () => {
    await testRequest(app, 'locking/post');
    await request(app)
      .post('/events/@move')
      .set('Accept', 'application/json')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ source: '/news/my-news-item' })
      .expect(423);
    return request(app)
      .get('/news/my-news-item')
      .set('Accept', 'application/json')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
  });

  it('should not copy the lock of an item', async () => {
    await testRequest(app, 'locking/post');
    let i = 10;
    vi.mocked(uuid).mockImplementation(
      (() => `6e0c1a2b-3d4e-4f5a-8b6c-7d8e9f0a1b${i++}`) as any,
    );
    await request(app)
      .post('/events/@copy')
      .set('Accept', 'application/json')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ source: '/news/my-news-item' })
      .expect(200);
    vi.mocked(uuid).mockReturnValue(
      'a95388f2-e4b3-4292-98aa-62656cbd5b9c' as any,
    );
    const res = await request(app)
      .get('/events/my-news-item')
      .set('Accept', 'application/json')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(res.body.lock.locked).toBe(false);
    expect(res.body.lock.token).toBeUndefined();
  });
});
