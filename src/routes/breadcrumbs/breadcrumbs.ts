/**
 * Breadcrumbs route.
 * @module routes/breadcrumbs/breadcrumbs
 */

// Type imports
import type { Knex } from 'knex';
import type { Request } from '../../types';

// External imports
import { compact, drop, head, last } from 'es-toolkit/array';
import { omit } from 'es-toolkit/object';

// Internal imports
import {
  getPath,
  getRootUrl,
  getUrl,
  getUrlByPath,
} from '../../helpers/url/url';
import models from '../../models';

/**
 * Traverse path.
 * @method traverse
 * @param {Object} document Current document object.
 * @param {Array} slugs Array of slugs.
 * @param {Array} items Current array of items.
 * @param {Object} trx Transaction object.
 * @returns {Promise<Array>} A Promise that resolves to an array of items.
 */
async function traverse(
  document: any,
  slugs: string[],
  items: any[],
  trx: Knex.Transaction,
): Promise<any[]> {
  if (slugs.length === 0) {
    return items;
  } else {
    const Document = models.get('Document');

    // Get child
    const child = await Document.fetchOne(
      {
        parent: document.uuid,
        id: head(slugs),
      },
      {},
      trx,
    );

    // Apply behaviors
    await child.applyBehaviors(trx);

    // Traverse up
    return traverse(
      child,
      drop(slugs, 1),
      [
        ...(child._type._schema.behaviors.includes('navigation_root')
          ? []
          : items),
        {
          '@id': `${last(items)['@id']}/${child.id}`,
          title: child.getTitle(),
          path: child.path,
        },
      ],
      trx,
    );
  }
}

export const handler = async (req: Request, trx: Knex.Transaction) => {
  const fullPath = getPath(req);
  const navrootPath = req.navroot.path === '/' ? '' : req.navroot.path;
  const relativePath = fullPath.startsWith(navrootPath)
    ? fullPath.slice(navrootPath.length)
    : fullPath;
  const slugs = relativePath.split('/');

  const items = await traverse(
    req.navroot,
    compact(slugs),
    [
      {
        '@id': `${getRootUrl(req)}${navrootPath}`,
        title: req.document.getTitle(),
      },
    ],
    trx,
  );

  // Leave out the ancestors the user may not view, so their titles don't
  // leak; the permissions are checked in one catalog query
  const Catalog = models.get('Catalog');
  const ancestors = drop(items, 1)
    .slice(0, -1)
    .map((item: any) => item.path);
  const visible = new Set(
    ancestors.length > 0
      ? (
          await Catalog.fetchAllRestricted(
            { _path: ['=', ancestors] },
            {},
            trx,
            req,
          )
        ).map((item: any) => item._path)
      : [],
  );
  const crumbs = drop(items, 1)
    .filter(
      (item: any, index: number, all: any[]) =>
        index === all.length - 1 || visible.has(item.path),
    )
    .map((item: any) => omit(item, ['path']));

  return {
    json: {
      '@id': `${getUrl(req)}/@breadcrumbs`,
      items: crumbs,
      root: getUrlByPath(req, req.navroot.path),
    },
  };
};

export default [
  {
    op: 'get',
    view: '/@breadcrumbs',
    permission: 'View',
    client: 'getBreadcrumbs',
    cache: 'content',
    handler,
  },
];
