/**
 * Context Navigation tests.
 * @module routes/contextnavigation/contextnavigation
 */

// External imports
import request from 'supertest';
import { describe, expect, it } from 'vitest';

// Internal imports
import app from '../../app';
import { createDocument, testRequest } from '../../helpers/tests/tests';
import models from '../../models';

const token =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJhZG1pbiIsImZ1bGxuYW1lIjoiQWRtaW4iLCJpYXQiOjE2NDkzMTI0NDl9.RS1Ny_r0v7vIylFfK6q0JVJrkiDuTOh9iG9IL8xbzAk';

/**
 * Get the context navigation
 * @method get
 * @param {string} path Path of the context.
 * @param {string} query Query string.
 * @returns {Promise<Object>} Response body.
 */
async function get(path: string, query: string = ''): Promise<any> {
  return (
    await request(app)
      .get(`${path}/@contextnavigation${query}`)
      .set('Accept', 'application/json')
      .set('Authorization', `Bearer ${token}`)
      .expect(200)
  ).body;
}

/**
 * Get the ids of a tree of navigation items
 * @method tree
 * @param {Array} items Navigation items.
 * @returns {Array} Ids, with the ids of the children in a nested array.
 */
function tree(items: any[]): any[] {
  return items.map((item: any) =>
    item.items.length > 0
      ? [item.normalized_id, tree(item.items)]
      : item.normalized_id,
  );
}

describe('Context Navigation', () => {
  it('should return the context navigation', () =>
    testRequest(app, 'contextnavigation/get'));

  it('should show the path to the context like plone.restapi', async () => {
    const Document = models.get('Document');
    const news = await Document.fetchOne({ path: '/news' }, {}, global.txn!);
    const folder = await createDocument(
      '0123abcd-0000-4000-8000-000000000601',
      news,
      'folder',
      'Folder',
      { position_in_parent: 0 },
    );
    await createDocument(
      '0123abcd-0000-4000-8000-000000000602',
      news,
      'page',
      'Page',
      { position_in_parent: 1 },
    );
    const sub = await createDocument(
      '0123abcd-0000-4000-8000-000000000603',
      folder,
      'sub',
      'Folder',
    );
    await createDocument(
      '0123abcd-0000-4000-8000-000000000604',
      sub,
      'deep',
      'Page',
    );

    // Nothing above the top level
    const root = await get('');
    expect(root.available).toBe(false);
    expect(root.items).toStrictEqual([]);

    // From the top level: all items of the first level, then only the path
    // to the context and all items below the context
    const nav = await get('/news/folder');
    expect(nav.title).toBe('Navigation');
    expect(nav.url).toBe('http://localhost:8080/sitemap');
    expect(tree(nav.items)).toStrictEqual([
      ['folder', [['sub', ['deep']]]],
      'page',
    ]);
    expect(nav.items[0].is_current).toBe(true);
    expect(nav.items[0].type).toBe('folder');

    const deep = await get('/news/folder/sub/deep');
    expect(tree(deep.items)).toStrictEqual([
      ['folder', [['sub', ['deep']]]],
      'page',
    ]);
    expect(deep.items[0].is_in_path).toBe(true);

    // The current folder only, with the top and a custom name
    const current = await get(
      '/news',
      '?expand.contextnavigation.currentFolderOnly=true&expand.contextnavigation.includeTop=true&expand.contextnavigation.name=Custom&expand.contextnavigation.bottomLevel=1',
    );
    expect(current.title).toBe('Custom');
    expect(current.has_custom_name).toBe(true);
    expect(current.url).toBe('http://localhost:8080/news');
    expect(tree(current.items)).toStrictEqual(['news', 'folder', 'page']);

    // A root path replaces the navigation root
    const rooted = await get(
      '/news/folder',
      '?expand.contextnavigation.root_path=/news/folder&expand.contextnavigation.topLevel=0',
    );
    expect(rooted.url).toBe('http://localhost:8080/news/folder');
    expect(tree(rooted.items)).toStrictEqual([['sub', ['deep']]]);
    const top = await get(
      '/news/folder',
      '?expand.contextnavigation.root_path=/news/folder&expand.contextnavigation.topLevel=0&expand.contextnavigation.includeTop=true',
    );
    expect(tree(top.items)).toStrictEqual(['folder', ['sub', ['deep']]]);
    const level = await get(
      '/news/folder/sub/deep',
      '?expand.contextnavigation.root_path=/news&expand.contextnavigation.topLevel=1',
    );
    expect(tree(level.items)).toStrictEqual([['sub', ['deep']]]);
  });
});
