/**
 * Groups tests.
 * @module routes/groups/groups
 */

// External imports
import request from 'supertest';
import { afterEach, describe, expect, it } from 'vitest';

// Internal imports
import app from '../../app';
import { testRequest } from '../../helpers/tests/tests';

const auth =
  'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJhZG1pbiIsImZ1bGxuYW1lIjoiQWRtaW4iLCJpYXQiOjE2NDkzMTI0NDl9.RS1Ny_r0v7vIylFfK6q0JVJrkiDuTOh9iG9IL8xbzAk';

describe('Groups', () => {
  afterEach(async () => {
    // Remove the user or group of the examples if a test added it
    await request(app).delete('/@groups/nicks').set('Authorization', auth);
  });

  it('should get a list of groups', () => testRequest(app, 'groups/list'));

  it('should get a list of groups by query', () =>
    testRequest(app, 'groups/list_query'));

  it('should search groups case insensitive and limit the results', async () => {
    const res = await request(app)
      .get('/@groups?query=administ')
      .set('Authorization', auth)
      .expect(200);
    expect(res.body.map((group: any) => group.id)).toEqual(['Administrators']);
    for (const id of ['nicks1', 'nicks2']) {
      await request(app)
        .post('/@groups')
        .set('Authorization', auth)
        .send({ groupname: id, title: id })
        .expect(201);
    }
    const limited = await request(app)
      .get('/@groups?query=nicks&limit=1')
      .set('Authorization', auth)
      .expect(200);
    expect(limited.body).toHaveLength(1);
  });

  it('should get an error when not logged in', () =>
    testRequest(app, 'groups/list_anonymous'));

  it('should get an individual group', () => testRequest(app, 'groups/get'));

  it('should list the members of a group', async () => {
    await request(app)
      .post('/@groups')
      .set('Authorization', auth)
      .send({ groupname: 'nicks', title: 'Nicks', users: ['admin'] })
      .expect(201);
    const res = await request(app)
      .get('/@groups/nicks')
      .set('Authorization', auth)
      .expect(200);
    expect(res.body.members).toEqual({
      '@id': 'http://localhost:8080/@groups/nicks',
      items: ['admin'],
      items_total: 1,
    });
  });

  it('should not get a group when not logged in', () =>
    testRequest(app, 'groups/get_anonymous'));

  it('should not get a group when not found', () =>
    testRequest(app, 'groups/get_notfound'));

  it('should add a new group', () =>
    testRequest(app, 'groups/post').expect(
      'Location',
      'http://localhost:8080/@groups/nicks',
    ));

  it('should not add a group without a group name', () =>
    testRequest(app, 'groups/post_without_groupname'));

  it('should not add a group which already exists', () =>
    testRequest(app, 'groups/post_duplicate'));

  it('should not add a group with an unknown role', () =>
    testRequest(app, 'groups/post_unknown_role'));

  it('should update a group', async () => {
    await testRequest(app, 'groups/post');
    return testRequest(app, 'groups/patch');
  });

  it('should delete a group', async () => {
    await testRequest(app, 'groups/post');
    return testRequest(app, 'groups/delete');
  });

  it('should not delete a group which does not exist', () =>
    testRequest(app, 'groups/delete_notfound'));

  it('should not update a group which does not exist', () =>
    request(app)
      .patch('/@groups/doesnotexist')
      .set('Authorization', auth)
      .send({ title: 'Does not exist' })
      .expect(404));
});
