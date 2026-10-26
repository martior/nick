/**
 * Search tests.
 * @module routes/search/search
 */

// External imports
import request from 'supertest';
import { describe, expect, it } from 'vitest';

// Internal imports
import app from '../../app';
import { adminToken, testRequest } from '../../helpers/tests/tests';

describe('Search', () => {
  it('should return all items', () => testRequest(app, 'search/get'));

  it('should find the news folder', () => testRequest(app, 'search/get_news'));

  it('should be able to sort results on title', () =>
    testRequest(app, 'search/get_sort_title'));

  it('should be able to sort results on date', () =>
    testRequest(app, 'search/get_sort_date'));

  it('should ignore sort when unknown sort is specified', () =>
    testRequest(app, 'search/get_sort_unknown'));

  it('should be able to sort results reverse', () =>
    testRequest(app, 'search/get_sort_reverse'));

  it('should be able to filter on depth', () =>
    testRequest(app, 'search/get_depth'));

  it('should be able to set batch size', () =>
    testRequest(app, 'search/get_batch'));

  it('should be able to set offset', () =>
    testRequest(app, 'search/get_offset'));

  it('should ignore unknown parameters', () =>
    testRequest(app, 'search/get_unknown'));

  it('should be able to do a querystring search', () =>
    testRequest(app, 'search/post'));

  it('should hide inactive items from users who can not edit', async () => {
    const admin = (req: request.Test) =>
      req
        .set('Accept', 'application/json')
        .set('Authorization', `Bearer ${adminToken}`);

    // Published pages which are expired and not yet effective
    const add = async (id: string, uid: string, dates: object) => {
      await admin(request(app).post('/news'))
        .send({ '@type': 'Page', id, uuid: uid, title: id, ...dates })
        .expect(201);
      await admin(request(app).post(`/news/${id}/@workflow/publish`)).expect(
        200,
      );
    };
    await add('expired', '2b4d6f8a-1c3e-4a5b-9d7f-0a2c4e6a8b01', {
      expires: '2000-01-01T00:00:00+00:00',
    });
    await add('embargoed', '2b4d6f8a-1c3e-4a5b-9d7f-0a2c4e6a8b02', {
      effective: '2999-01-01T00:00:00+00:00',
    });
    const ids = (res: request.Response) =>
      res.body.items.map((item: any) => item['@id']).sort();
    const inactive = [
      'http://localhost:8080/news/embargoed',
      'http://localhost:8080/news/expired',
    ];

    // Anonymous
    const search = await request(app)
      .get('/news/@search?portal_type=Page')
      .set('Accept', 'application/json')
      .expect(200);
    expect(ids(search)).not.toContain(inactive[0]);
    expect(ids(search)).not.toContain(inactive[1]);
    const querystring = await request(app)
      .post('/news/@querystring-search')
      .set('Accept', 'application/json')
      .send({
        query: [
          {
            i: 'portal_type',
            o: 'plone.app.querystring.operation.selection.any',
            v: ['Page'],
          },
        ],
      })
      .expect(200);
    expect(ids(querystring)).not.toContain(inactive[0]);
    expect(ids(querystring)).not.toContain(inactive[1]);

    // Admin
    const res = await admin(
      request(app).get('/news/@search?portal_type=Page'),
    ).expect(200);
    expect(ids(res)).toEqual(expect.arrayContaining(inactive));
  });
});
