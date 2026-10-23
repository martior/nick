/**
 * Context navigation routes.
 * @module routes/contextnavigation/contextnavigation
 */

// Type imports
import type { Request } from '../../types';
import type { Knex } from 'knex';

// Internal imports
import { getRootUrl, getUrl, getUrlByPath } from '../../helpers/url/url';
import { mapAsync } from '../../helpers/utils/utils';
import models from '../../models';

interface Options {
  displayedTypes: string[];
  bottomLevel: number;
  currentPath: string;
}

/**
 * Check if a path is below another path.
 * @method isBelow
 * @param {string} path Path.
 * @param {string} parent Path of the parent.
 * @returns {boolean} True if the path is below the parent.
 */
function isBelow(path: string, parent: string): boolean {
  return path.startsWith(parent === '/' ? '/' : `${parent}/`);
}

/**
 * Get a navigation item, like the items of the plone.restapi
 * contextnavigation (navigation portlet).
 * @method toItem
 * @param {Object} item Catalog item.
 * @param {Request} req Request object.
 * @param {string} currentPath Path of the context.
 * @param {Array} items Child items.
 * @returns {Object} Navigation item.
 */
function toItem(
  item: any,
  req: Request,
  currentPath: string,
  items: any[],
): Record<string, any> {
  const url = getUrlByPath(req, item.path);
  return {
    '@id': url,
    description: item.Description || '',
    href: url,
    icon: '',
    is_current: item.path === currentPath,
    is_folderish: item.is_folderish === true,
    is_in_path: isBelow(currentPath, item.path),
    items,
    normalized_id: item.id,
    review_state: item.review_state,
    thumb: '',
    title: item.Title,
    type: `${item.portal_type || item.Type || ''}`
      .toLowerCase()
      .replace(/ /g, '-'),
  };
}

/**
 * Get the navigation items below a folder. With `pathOnly` only the items in
 * the path of the context are listed below the first level; the context
 * itself lists all its items.
 * @method getItems
 * @param {string} parent Uuid of the folder.
 * @param {number} level Level of the items, 1 for the first level.
 * @param {boolean} pathOnly Only list the items in the path to the context.
 * @param {Options} options Navigation options.
 * @param {Request} req Request object.
 * @param {Knex.Transaction} trx Transaction object.
 * @returns {Promise<Object[]>} Navigation items.
 */
async function getItems(
  parent: string,
  level: number,
  pathOnly: boolean,
  options: Options,
  req: Request,
  trx: Knex.Transaction,
): Promise<any[]> {
  const Catalog = models.get('Catalog');

  // Fetch the items the user may view
  const items = await Catalog.fetchAllRestricted(
    { _parent: parent },
    { order: '_getObjPositionInParent' },
    trx,
    req,
  );

  // Omit items excluded from the navigation, of other types and, below the
  // first level, out of the path to the context
  items.filter(
    (item: InstanceType<typeof Catalog>) =>
      !item.exclude_from_nav &&
      options.displayedTypes.includes(item.portal_type || item.Type) &&
      (!pathOnly ||
        level === 1 ||
        item.path === options.currentPath ||
        isBelow(options.currentPath, item.path)),
  );

  return await mapAsync(items.models, async (item: any) => {
    const inPath = isBelow(options.currentPath, item.path);
    const below =
      !pathOnly ||
      item.path === options.currentPath ||
      isBelow(item.path, options.currentPath);
    const expand =
      (options.bottomLevel === 0 || level < options.bottomLevel) &&
      (inPath || below);
    return toItem(
      item,
      req,
      options.currentPath,
      expand
        ? await getItems(
            item.UID,
            level + 1,
            pathOnly && !below,
            options,
            req,
            trx,
          )
        : [],
    );
  });
}

export const handler = async (req: Request, trx: Knex.Transaction) => {
  const Catalog = models.get('Catalog');
  const Controlpanel = models.get('Controlpanel');
  const Document = models.get('Document');
  const Index = models.get('Index');
  const param = (name: string): string | undefined => {
    const value = req.query[`expand.contextnavigation.${name}`];
    return typeof value === 'string' ? value : undefined;
  };

  // Fetch query params, with the defaults of plone.restapi
  const name = param('name') || '';
  const includeTop = param('includeTop')?.toLowerCase() === 'true';
  const currentFolderOnly =
    param('currentFolderOnly')?.toLowerCase() === 'true';
  const topLevel = parseInt(param('topLevel') || '1', 10);
  const bottomLevel = parseInt(param('bottomLevel') || '0', 10);

  // Fetch settings
  const controlpanel = await Controlpanel.fetchById('navigation', {}, trx);
  const options: Options = {
    displayedTypes: controlpanel.data.displayed_types,
    bottomLevel: isNaN(bottomLevel) || bottomLevel < 0 ? 0 : bottomLevel,
    currentPath: req.document.path,
  };

  // Fetch indexes
  if (!req.indexes) {
    req.indexes = await Index.fetchAll({}, {}, trx);
  }

  // Get the root of the navigation: the current folder, or the folder at the
  // top level in the path from the navigation root to the context
  const navroot =
    req.navroot || (await Document.fetchOne({ parent: null }, {}, trx));

  // The root_path (the "Root node" of Plone's navigation portlet) replaces
  // the navigation root; the site root is used if it can't be viewed
  const rootPath = param('root_path')?.replace(/^\/+|\/+$/g, '');
  let base = navroot;
  if (rootPath) {
    const document = await Document.fetchOne({ path: `/${rootPath}` }, {}, trx);
    const viewable =
      document &&
      (await document.fetchUserPermissions(req.user, trx)).includes('View');
    base = viewable
      ? document
      : await Document.fetchOne({ parent: null }, {}, trx);
  }

  let root: any;
  if (currentFolderOnly) {
    root = req.document.isFolderish()
      ? req.document
      : await Document.fetchById(req.document.parent, {}, trx);
  } else {
    const inBase =
      req.document.path === base.path || isBelow(req.document.path, base.path);
    const slugs = req.document.path
      .slice(base.path === '/' ? 1 : base.path.length + 1)
      .split('/')
      .filter((slug: string) => slug !== '');
    const level = isNaN(topLevel) || topLevel < 0 ? 0 : topLevel;
    const path = [
      base.path === '/' ? '' : base.path,
      ...slugs.slice(0, level),
    ].join('/');

    // Nothing is shown when the context is above the top level
    root =
      level === 0
        ? base
        : !inBase || slugs.length < level
          ? undefined
          : await Document.fetchOne({ path: path || '/' }, {}, trx);
  }

  // Get the items
  const items = root
    ? await getItems(root.uuid, 1, !currentFolderOnly, options, req, trx)
    : [];
  if (includeTop && root) {
    const top = await Catalog.fetchOne({ document: root.uuid }, {}, trx);
    if (top) {
      items.unshift(toItem(top, req, options.currentPath, []));
    }
  }

  // Return navigation
  return {
    json: {
      '@id': `${getUrl(req)}/@contextnavigation`,
      available: items.length > 0,
      has_custom_name: name !== '',
      items,
      title: name || req.i18n('Navigation'),
      url:
        currentFolderOnly && root
          ? getUrlByPath(req, root.path)
          : rootPath && root && root.uuid !== navroot.uuid && root.parent
            ? getUrlByPath(req, root.path)
            : `${getRootUrl(req)}${navroot.path === '/' ? '' : navroot.path}/sitemap`,
    },
  };
};

export default [
  {
    op: 'get',
    view: '/@contextnavigation',
    permission: 'View',
    client: 'getContextNavigation',
    cache: 'content',
    handler,
  },
];
