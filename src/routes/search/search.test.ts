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

  it('should support operators in the searchable text', () =>
    testRequest(app, 'search/get_operators'));

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

  it('should be able to filter on a keyword index', () =>
    testRequest(app, 'search/get_subject'));

  it('should be able to filter on a path query', () =>
    testRequest(app, 'search/get_path'));

  it('should be able to filter on a date range', () =>
    testRequest(app, 'search/get_range'));

  it('should be able to select metadata fields', () =>
    testRequest(app, 'search/get_metadata_fields'));

  it('should be able to return full objects', () =>
    testRequest(app, 'search/get_fullobjects'));

  it('should be able to set batch size', () =>
    testRequest(app, 'search/get_batch'));

  it('should be able to set offset', () =>
    testRequest(app, 'search/get_offset'));

  it('should ignore unknown parameters', () =>
    testRequest(app, 'search/get_unknown'));

  it('should be able to do a querystring search', () =>
    testRequest(app, 'search/post'));

  it('should support plone.app.querystring operation names', () =>
    testRequest(app, 'search/post_operations'));

  it('should be able to batch and limit a querystring search', () =>
    testRequest(app, 'search/post_batch'));

  it('should be able to do a querystring search using a get call', () =>
    testRequest(app, 'search/get_querystring'));

  it('should return a bad request on an invalid querystring operation', () =>
    testRequest(app, 'search/post_invalid'));
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

  it('should only return related items the user can view in full objects', async () => {
    const events = '1a2123ba-14e8-4910-8e6b-c04a40d72a41';
    const privatePage = '6e8a0c2e-4b6d-4f8a-9c0e-2b4d6f8a0c01';
    const admin = (req: request.Test) =>
      req
        .set('Accept', 'application/json')
        .set('Authorization', `Bearer ${adminToken}`);

    // A published page relating to a private page and to events
    await admin(request(app).post('/news'))
      .send({
        '@type': 'Page',
        id: 'private-page',
        uuid: privatePage,
        title: 'Private Page',
      })
      .expect(201);
    await admin(request(app).post('/news'))
      .send({
        '@type': 'Page',
        id: 'related',
        uuid: '6e8a0c2e-4b6d-4f8a-9c0e-2b4d6f8a0c02',
        title: 'Related',
        relatedItems: [privatePage, events],
      })
      .expect(201);
    await admin(request(app).post('/news/related/@workflow/publish')).expect(
      200,
    );

    // Anonymous only gets the published events folder
    const res = await request(app)
      .get('/@search?id=related&fullobjects=1')
      .set('Accept', 'application/json')
      .expect(200);
    expect(res.body.items[0].relatedItems.map((item: any) => item.UID)).toEqual(
      [events],
    );
  });
});
