/**
 * Locking tests.
 * @module routes/lock/lock
 */

// External imports
import request from 'supertest';
import { v4 as uuid } from 'uuid';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Internal imports
import app from '../../app';
import * as lock from '../../helpers/lock/lock';
import { adminToken, testRequest } from '../../helpers/tests/tests';

// Mock lockExpired
vi.spyOn(lock, 'lockExpired').mockReturnValue(false);

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
