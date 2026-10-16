/**
 * Search tests.
 * @module routes/search/search
 */

// External imports
import request from 'supertest';
import { describe, expect, it } from 'vitest';

// Internal imports
import app from '../../app';
import { testRequest } from '../../helpers/tests/tests';

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

  it('should filter on isFolderish like Plone', async () => {
    const folderish = await request(app)
      .get('/@search?isFolderish=true')
      .set('Accept', 'application/json')
      .expect(200);
    const legacy = await request(app)
      .get('/@search?is_folderish=true')
      .set('Accept', 'application/json')
      .expect(200);
    expect(folderish.body.items_total).toBeGreaterThan(0);
    expect(folderish.body.items_total).toBe(legacy.body.items_total);
    const indexes = await request(app)
      .get('/@querystring')
      .set('Accept', 'application/json')
      .expect(200);
    expect(indexes.body.indexes.isFolderish.operations).toContain(
      'plone.app.querystring.operation.boolean.isTrue',
    );
  });

  it('should return a bad request on invalid parameters', async () => {
    for (const query of [
      'b_size=abc',
      'b_start=x',
      'b_size=-1',
      'path.depth=x',
      'created.query=not-a-date&created.range=min',
    ]) {
      const res = await request(app)
        .get(`/@search?${query}`)
        .set('Accept', 'application/json')
        .expect(400);
      expect(res.body.type).toBe('BadRequest');
    }
    await request(app)
      .get('/@search?b_size=2&b_start=-1&path.depth=-1')
      .set('Accept', 'application/json')
      .expect(200);
  });
});
