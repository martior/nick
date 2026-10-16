/**
 * User tests.
 * @module routes/users/users
 */

// External imports
import request from 'supertest';
import { afterEach, describe, expect, it } from 'vitest';

// Internal imports
import app from '../../app';
import { addToken } from '../../helpers/auth/auth';
import {
  createDocument,
  createUser,
  testRequest,
} from '../../helpers/tests/tests';
import models from '../../models';
import { User } from '../../models/user/user';

const adminToken =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJhZG1pbiIsImZ1bGxuYW1lIjoiQWRtaW4iLCJpYXQiOjE2NDkzMTI0NDl9.RS1Ny_r0v7vIylFfK6q0JVJrkiDuTOh9iG9IL8xbzAk';

const nickToken =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJoZWFkbGVzc25pY2siLCJmdWxsbmFtZSI6Ik5lYXJseSBIZWFkbGVzcyBOaWNrIiwiaWF0IjoxNjQ5Njk4MTUxfQ.K-NLonuCLqcv_hzq4d_vqEVGPLClwpry_HVYRSkJIf4';

/**
 * Add the user of the examples and log it in with the token of the examples
 * @method addHeadlessNick
 */
async function addHeadlessNick(): Promise<void> {
  await testRequest(app, 'users/post');
  const user = await User.fetchById('headlessnick', {}, global.txn as any);
  await addToken(user, nickToken, global.txn as any);
}

describe('User', () => {
  afterEach(async () => {
    // Remove the user or group of the examples if a test added it
    await request(app)
      .delete('/@users/headlessnick')
      .set('Authorization', `Bearer ${adminToken}`);
  });

  it('should get a list of users', () => testRequest(app, 'users/list'));

  it('should get a list of users by query', () =>
    testRequest(app, 'users/list_query'));

  it('should search users by fullname', async () => {
    await testRequest(app, 'users/post');
    return testRequest(app, 'users/list_search');
  });

  it('should filter users by group and limit the results', async () => {
    const auth = `Bearer ${adminToken}`;
    for (const id of ['groupuser1', 'groupuser2', 'groupuser3']) {
      await request(app)
        .post('/@users')
        .set('Authorization', auth)
        .send({
          username: id,
          email: `${id}@example.com`,
          password: 'secret123',
          groups: id === 'groupuser3' ? [] : ['Administrators'],
        })
        .expect(201);
    }
    const all = await request(app)
      .get('/@users?groups-filter:list=Administrators')
      .set('Authorization', auth)
      .expect(200);
    expect(all.body.items.map((user: any) => user.id)).toEqual([
      'groupuser1',
      'groupuser2',
    ]);
    expect(all.body.items_total).toBe(2);
    const limited = await request(app)
      .get('/@users?groups-filter:list=Administrators&limit=1')
      .set('Authorization', auth)
      .expect(200);
    expect(limited.body.items).toHaveLength(1);
  });

  it('should get an error when not logged in', () =>
    testRequest(app, 'users/list_anonymous'));

  it('should get an individual user', () => testRequest(app, 'users/get'));

  it('should not get a user when not logged in', () =>
    testRequest(app, 'users/get_anonymous'));

  it('should not get a user when not found', () =>
    testRequest(app, 'users/get_notfound'));

  it('should add a new user', () =>
    testRequest(app, 'users/post').expect(
      'Location',
      'http://localhost:8080/@users/headlessnick',
    ));

  it('should not add a user with a short password', () =>
    testRequest(app, 'users/post_short_password'));

  it('should not add a user with an invalid email address', () =>
    testRequest(app, 'users/post_invalid_email'));

  it('should not add a user without a password', () =>
    testRequest(app, 'users/post_without_password'));

  it('should update a user', async () => {
    await testRequest(app, 'users/post');
    return testRequest(app, 'users/patch');
  });

  it('should update own properties but not own roles', async () => {
    await addHeadlessNick();
    await testRequest(app, 'users/patch_own');
    await request(app)
      .patch('/@users/headlessnick')
      .set('Authorization', `Bearer ${nickToken}`)
      .send({ roles: ['Administrator'] })
      .expect(204);
    const res = await request(app)
      .get('/@users/headlessnick')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(res.body.fullname).toBe('Headless Nick');
    expect(res.body.roles).toEqual(['Contributor']);
  });

  it('should not update another user', async () => {
    await addHeadlessNick();
    return request(app)
      .patch('/@users/admin')
      .set('Authorization', `Bearer ${nickToken}`)
      .send({ fullname: 'Hijacked' })
      .expect(403);
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

  it('should not delete a user which does not exist', () =>
    testRequest(app, 'users/delete_notfound'));

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

  it('should keep the content and versions of a deleted user', async () => {
    const Document = models.get('Document');
    const Version = models.get('Version');
    await createUser('jane');
    const news = await Document.fetchOne({ path: '/news' }, {}, global.txn!);
    const folder = await createDocument(
      '2b3c4d5e-0000-4000-8000-000000000001',
      news,
      'janes',
      'Folder',
      {
        owner: 'jane',
        workflow_history: JSON.stringify([
          {
            action: 'publish',
            actor: 'jane',
            review_state: 'published',
            time: '2022-04-08T16:00:00.000Z',
          },
        ]),
      },
    );
    await createDocument(
      '2b3c4d5e-0000-4000-8000-000000000002',
      folder,
      'deep',
      'Page',
      { owner: 'jane' },
    );
    await Version.create(
      {
        document: news.uuid,
        version: 2,
        id: 'news',
        created: '2022-04-08T16:00:00.000Z',
        actor: 'jane',
        json: { title: 'By Jane' },
      },
      {},
      global.txn!,
    );

    await request(app)
      .delete('/@users/jane')
      .set('Accept', 'application/json')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(204);

    const deep = await Document.fetchOne(
      { path: '/news/janes/deep' },
      {},
      global.txn!,
    );
    expect(deep.owner).toBeNull();
    const version = await Version.fetchOne(
      { document: news.uuid, version: 2 },
      {},
      global.txn!,
    );
    expect(version.actor).toBeNull();

    const history = await request(app)
      .get('/news/janes/@history')
      .set('Accept', 'application/json')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(
      history.body.find((item: any) => item.type === 'workflow').actor.id,
    ).toBe('jane');
    await request(app)
      .get('/news/@history')
      .set('Accept', 'application/json')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
  });
});
