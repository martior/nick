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
import models from '../../models';

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

  it('should return the comments of workflow transitions', async () => {
    const Document = models.get('Document');
    const news = await Document.fetchOne({ path: '/news' }, {}, global.txn!);
    await news.update(
      {
        workflow_history: JSON.stringify([
          {
            action: 'publish',
            actor: 'admin',
            comments: 'Approved',
            review_state: 'published',
            state_title: 'Published',
            time: '2022-04-03T20:22:00.000Z',
            transition_title: 'Publish',
          },
        ]),
      },
      global.txn!,
    );

    const response = await request(app)
      .get('/news/@history')
      .set('Accept', 'application/json')
      .set('Authorization', `Bearer ${token}`);
    expect(
      response.body.find((item: any) => item.type === 'workflow').comments,
    ).toBe('Approved');
  });

  it('should require the view history permission', async () => {
    const member = await createUser('member');
    await request(app)
      .get('/news/@history')
      .set('Accept', 'application/json')
      .set('Authorization', `Bearer ${member}`)
      .expect(401);
    await request(app)
      .get('/news/@history/0')
      .set('Accept', 'application/json')
      .expect(401);
  });

  it('should require the revert permission', async () => {
    const Document = models.get('Document');
    const contributor = await createUser('contributor');
    const news = await Document.fetchOne({ path: '/news' }, {}, global.txn!);
    await news
      .$relatedQuery('_userRoles', global.txn!)
      .relate({ id: 'Contributor', user: 'contributor' });

    // A contributor may see the history but not revert
    const history = await request(app)
      .get('/news/@history')
      .set('Accept', 'application/json')
      .set('Authorization', `Bearer ${contributor}`)
      .expect(200);
    expect(
      history.body
        .filter((item: any) => item.type === 'versioning')
        .map((item: any) => item.may_revert),
    ).toEqual([false, false]);

    await request(app)
      .patch('/news/@history')
      .set('Accept', 'application/json')
      .set('Authorization', `Bearer ${contributor}`)
      .send({ version: 0 })
      .expect(401);
    await request(app)
      .patch('/news/@history')
      .set('Accept', 'application/json')
      .send({ version: 0 })
      .expect(401);
  });

  it('should require the modify permission in the current state', async () => {
    const editor = await createUser('editor', ['Editor']);
    await global.txn!('document')
      .where({ path: '/news' })
      .update({ workflow_state: 'pending' });

    // The workflow takes modify away from editors in the pending state
    const history = await request(app)
      .get('/news/@history')
      .set('Accept', 'application/json')
      .set('Authorization', `Bearer ${editor}`)
      .expect(200);
    expect(
      history.body
        .filter((item: any) => item.type === 'versioning')
        .map((item: any) => item.may_revert),
    ).toEqual([false, false]);
    await request(app)
      .patch('/news/@history')
      .set('Accept', 'application/json')
      .set('Authorization', `Bearer ${editor}`)
      .send({ version: 0 })
      .expect(401);
    const document = await global.txn!('document').where({ path: '/news' });
    expect(document[0].version).toBe(1);
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

  it('should return 404 for a version which is not a number', () =>
    request(app)
      .get('/news/@history/abc')
      .set('Accept', 'application/json')
      .set('Authorization', `Bearer ${token}`)
      .expect(404));

  it('should refuse a revert without a valid version', async () => {
    for (const body of [{}, { version: 'abc' }, { version: -1 }]) {
      await request(app)
        .patch('/news/@history')
        .set('Accept', 'application/json')
        .set('Authorization', `Bearer ${token}`)
        .send(body)
        .expect(400);
    }
    const document = await global.txn!('document').where({ path: '/news' });
    expect(document[0].version).toBe(1);
  });

  it('should return 404 for an unknown version', () =>
    request(app)
      .patch('/news/@history')
      .set('Accept', 'application/json')
      .set('Authorization', `Bearer ${token}`)
      .send({ version: 99 })
      .expect(404));

  it('should list the versions and the creation like plone.restapi', async () => {
    const get = (path: string) =>
      request(app)
        .get(path)
        .set('Accept', 'application/json')
        .set('Authorization', `Bearer ${token}`);
    const patch = (body: any) =>
      request(app)
        .patch('/news')
        .set('Accept', 'application/json')
        .set('Authorization', `Bearer ${token}`)
        .send(body)
        .expect(204);

    await patch({ title: 'v1', changeNote: 'Fixed a typo' });
    await patch({ title: 'v2' });
    await request(app)
      .patch('/news/@history')
      .set('Accept', 'application/json')
      .set('Authorization', `Bearer ${token}`)
      .send({ version: 2 })
      .expect(200);

    const history = (await get('/news/@history').expect(200)).body;
    const versions = history.filter((item: any) => item.type === 'versioning');
    expect(
      versions.map((item: any) => [item.version, item.comments]),
    ).toStrictEqual([
      [4, 'Reverted to revision 2'],
      [3, null],
      [2, 'Fixed a typo'],
      [1, 'Changed title'],
      [0, 'Initial version'],
    ]);
    await request(app)
      .post('/news')
      .set('Accept', 'application/json')
      .set('Authorization', `Bearer ${token}`)
      .send({ '@type': 'Page', id: 'created', title: 'Created' })
      .expect(201);
    const create = (await get('/news/created/@history').expect(200)).body.at(
      -1,
    );
    expect([create.type, create.action, create.transition_title]).toStrictEqual(
      ['workflow', 'Create', 'Create'],
    );
    expect(create.review_state).toBe('private');

    expect((await get('/news').expect(200)).body.version).toBe('current');
    expect((await get('/news/@history/1').expect(200)).body.version).toBe(1);
    await get('/news/@history/99').expect(404);
  });
});
