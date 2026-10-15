/**
 * History tests.
 * @module routes/history/history
 */

// External imports
import request from 'supertest';
import { describe, expect, it } from 'vitest';

// Internal imports
import app from '../../app';
import { createUser, testRequest } from '../../helpers/tests/tests';

const token =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJhZG1pbiIsImZ1bGxuYW1lIjoiQWRtaW4iLCJpYXQiOjE2NDkzMTI0NDl9.RS1Ny_r0v7vIylFfK6q0JVJrkiDuTOh9iG9IL8xbzAk';

describe('History', () => {
  it('should return the history', () => testRequest(app, 'history/get'));

  it('should return a content object of a specific version', () =>
    testRequest(app, 'history/get_version'));

  it('should revert to a specific version', async () => {
    await testRequest(app, 'content/post');
    await testRequest(app, 'content/patch');
    return testRequest(app, 'history/patch');
  });

  it('should require the revert permission', async () => {
    const member = await createUser('member');
    const history = await request(app)
      .get('/news/@history')
      .set('Accept', 'application/json')
      .set('Authorization', `Bearer ${member}`)
      .expect(200);
    expect(
      history.body
        .filter((item: any) => item.type === 'versioning')
        .map((item: any) => item.may_revert),
    ).toEqual([false, false]);

    await request(app)
      .patch('/news/@history')
      .set('Accept', 'application/json')
      .set('Authorization', `Bearer ${member}`)
      .send({ version: 0 })
      .expect(403);
    await request(app)
      .patch('/news/@history')
      .set('Accept', 'application/json')
      .send({ version: 0 })
      .expect(401);
  });

  it('should reindex after a revert', async () => {
    await request(app)
      .patch('/news/@history')
      .set('Accept', 'application/json')
      .set('Authorization', `Bearer ${token}`)
      .send({ version: 0 })
      .expect(200);
    const catalog = await global.txn!('catalog').where({ _path: '/news' });
    expect(catalog[0].Title).toBe('Old News');
    const document = await global.txn!('document').where({ id: 'news' });
    expect(document[0].path).toBe('/news');
  });

  it('should return 404 for an unknown version', () =>
    request(app)
      .patch('/news/@history')
      .set('Accept', 'application/json')
      .set('Authorization', `Bearer ${token}`)
      .send({ version: 99 })
      .expect(404));
});
