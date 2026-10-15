/**
 * Query.
 * @module helpers/query/query
 */

// Type imports
import type { Knex } from 'knex';
import type {
  QueryOptions,
  QueryParam,
  QueryResult,
  QueryString,
  Request,
  WhereClause,
} from '../../types';

// External imports
import dayjs from 'dayjs';
import { normalize } from 'path';

// Internal imports
import { embed } from '../../helpers/ai/ai';
import config from '../../helpers/config/config';
import { getUrlByPath } from '../../helpers/url/url';
import { regExpEscape } from '../../helpers/utils/utils';
import models from '../../models';

/**
 * Prefix of the operation names used by plone.app.querystring.
 * @constant QS_PREFIX
 */
export const QS_PREFIX = 'plone.app.querystring.operation.';

/**
 * Supported querystring operations (without the prefix).
 * @constant operations
 */
export const operations = [
  'boolean.isFalse',
  'boolean.isTrue',
  'date.afterRelativeDate',
  'date.afterToday',
  'date.beforeRelativeDate',
  'date.beforeToday',
  'date.between',
  'date.largerThan',
  'date.largerThanRelativeDate',
  'date.lessThan',
  'date.lessThanRelativeDate',
  'date.today',
  'int.is',
  'int.largerThan',
  'int.lessThan',
  'list.contains',
  'reference.is',
  'selection.all',
  'selection.any',
  'selection.is',
  'selection.none',
  'string.absolutePath',
  'string.contains',
  'string.currentUser',
  'string.is',
  'string.path',
  'string.relativePath',
];

/**
 * Normalize an operation name by stripping the plone.app.querystring prefix.
 * @method normalizeOperation
 * @param {string} operation Operation name.
 * @returns {string} Operation name without prefix.
 */
export const normalizeOperation = (operation: string): string =>
  typeof operation === 'string' && operation.startsWith(QS_PREFIX)
    ? operation.substring(QS_PREFIX.length)
    : operation;

/**
 * Check if an operation is supported.
 * @method isValidOperation
 * @param {string} operation Operation name (with or without prefix).
 * @returns {boolean} True if supported.
 */
export const isValidOperation = (operation: string): boolean =>
  operations.includes(normalizeOperation(operation));

/**
 * Convert a value to an array of values.
 * @method toArray
 * @param {any} value Value or list of values.
 * @returns {Array} List of values.
 */
const toArray = (value: any): any[] =>
  (Array.isArray(value) ? value : [value]).filter(
    (item: any) => item !== undefined && item !== null && item !== '',
  );

/**
 * Strip the trailing slash of a path.
 * @method stripTrailingSlash
 * @param {string} path Path.
 * @returns {string} Path without trailing slash.
 */
const stripTrailingSlash = (path: string): string =>
  path.length > 1 ? path.replace(/\/+$/, '') || '/' : path;

/**
 * Build a where condition for one or more path queries.
 *
 * Depth semantics (ExtendedPathIndex):
 * - undefined or -1: the path itself and all its descendants
 * - 0: only the path itself
 * - n >= 1: descendants up to n levels below the path
 * @method pathCondition
 * @param {Array} paths List of path and depth pairs.
 * @returns {Array} Raw where condition.
 */
export const pathCondition = (
  paths: { path: string; depth?: number }[],
): ['raw', string, any[]] => {
  const sql: string[] = [];
  const bindings: any[] = [];
  paths.forEach(({ path, depth }) => {
    const base = stripTrailingSlash(path);
    const prefix = base === '/' ? '/' : `${base}/`;
    if (depth === undefined || depth < 0) {
      sql.push('("_path" = ? OR starts_with("_path", ?))');
      bindings.push(base, prefix);
    } else if (depth === 0) {
      sql.push('"_path" = ?');
      bindings.push(base);
    } else {
      sql.push('"_path" ~ ?');
      bindings.push(
        `^${regExpEscape(prefix)}[^/]+(/[^/]+){0,${Math.min(depth, 100) - 1}}$`,
      );
    }
  });
  return ['raw', sql.length > 0 ? `(${sql.join(' OR ')})` : 'false', bindings];
};

/**
 * Split a path value with an optional depth suffix (`/path::1`).
 * @method splitDepth
 * @param {string} value Path with optional depth.
 * @returns {Object} Path and depth.
 */
const splitDepth = (value: string): { path: string; depth?: number } => {
  const [path, depth] = `${value}`.split('::');
  const parsed = parseInt(depth, 10);
  return {
    path,
    depth: isNaN(parsed) ? undefined : parsed,
  };
};

/**
 * Get a date offset in days from the start of today.
 * @method startOfDay
 * @param {number} days Offset in days.
 * @returns {string} ISO date.
 */
const startOfDay = (days = 0): string =>
  dayjs().add(days, 'day').startOf('day').toISOString();

/**
 * Get a date offset in days from the end of today.
 * @method endOfDay
 * @param {number} days Offset in days.
 * @returns {string} ISO date.
 */
const endOfDay = (days = 0): string =>
  dayjs().add(days, 'day').endOf('day').toISOString();

/**
 * Parse a date value.
 * @method parseDate
 * @param {any} value Date value.
 * @returns {string | undefined} ISO date or undefined when invalid.
 */
const parseDate = (value: any): string | undefined => {
  const date = dayjs(value);
  return value !== '' && value !== null && date.isValid()
    ? date.toISOString()
    : undefined;
};

/**
 * Convert querystring to query.
 * @method querystringToQuery
 * @param {Object} querystring Querystring
 * @param {String} path Path to search
 * @param {Object} req Request object
 * @param {Object} trx Transaction object.
 * @returns {Object} Query.
 */
export const querystringToQuery = async (
  querystring = {} as QueryString,
  path = '/',
  req: Request,
  trx: Knex.Transaction,
): Promise<QueryResult> => {
  // Get root url
  const root = path.endsWith('/') ? path : `${path}/`;

  // Models
  const Index = models.get('Index');
  type IndexMap = Record<string, InstanceType<typeof Index>>;

  // Get indexes
  const indexes: IndexMap = {} as IndexMap;
  (await Index.fetchAll({ metadata: false }, {}, trx)).map(
    (index: InstanceType<typeof Index>) => {
      indexes[index.name] = index;
    },
  );

  const where: WhereClause = {};
  const paths: { path: string; depth?: number }[] = [];

  // Default options
  const options: QueryOptions = {
    offset: 0,
    limit: 100,
    order: {
      column: 'UID',
      reverse: false,
    },
    select: undefined,
  };

  // Add a condition with a unique key
  const add = (index: string, sql: string, bindings: any[]) => {
    where[`_${index}:${Object.keys(where).length}`] = ['raw', sql, bindings];
  };

  // Add query
  await Promise.all(
    (Array.isArray(querystring.query) ? querystring.query : []).map(
      async (query: any) => {
        const operation = normalizeOperation(query.o);
        const index = indexes[query.i];

        // Check if key is SearchableText and AI is enabled
        if (
          query.i === 'SearchableText' &&
          config.settings.ai?.models?.embed?.enabled
        ) {
          // Get embedding vector
          const embedding = await embed(query.v.replace(/\*/g, ''));

          where['_embedding'] = [
            'raw',
            `1 - (_embedding <=> '${embedding}') > ${config.settings.ai.models.embed.minSimilarity}`,
          ];
          options.select = [
            '*',
            trx.raw(`1 - (_embedding <=> ?) AS similarity`, [embedding]),
          ];
          options.order.column = 'similarity';
          options.order.reverse = true;
          return;
        }

        // Ignore unknown indexes
        if (!index) {
          return;
        }

        const field = `"_${query.i}"`;
        const isArray = ['string[]', 'uuid[]'].includes(index.type);
        const values = toArray(query.v);

        switch (operation) {
          case 'selection.any':
          case 'selection.is':
          case 'list.contains':
            if (isArray) {
              add(query.i, `${field} && ?`, [values]);
            } else {
              add(query.i, `${field} = any(?)`, [values]);
            }
            break;
          case 'selection.all':
            if (isArray) {
              add(query.i, `${field} @> ?`, [values]);
            } else {
              add(query.i, `${field} = all(?)`, [values]);
            }
            break;
          case 'selection.none':
            if (isArray) {
              add(query.i, `NOT (coalesce(${field}, '{}') && ?)`, [values]);
            } else {
              add(query.i, `(${field} IS NULL OR NOT (${field} = any(?)))`, [
                values,
              ]);
            }
            break;
          case 'reference.is':
            if (isArray) {
              add(query.i, `${field} && ?::uuid[]`, [values]);
            } else {
              add(query.i, `${field} = any(?::uuid[])`, [values]);
            }
            break;
          case 'boolean.isTrue':
            add(query.i, `${field} = true`, []);
            break;
          case 'boolean.isFalse':
            add(query.i, `${field} IS NOT true`, []);
            break;
          case 'int.is':
            add(query.i, `${field} = any(?)`, [
              values.map((value) => parseInt(value, 10)),
            ]);
            break;
          case 'int.lessThan':
            add(query.i, `${field} <= ?`, [parseInt(query.v, 10) || 0]);
            break;
          case 'int.largerThan':
            add(query.i, `${field} >= ?`, [parseInt(query.v, 10) || 0]);
            break;
          case 'date.today':
            add(query.i, `${field} BETWEEN ? AND ?`, [
              startOfDay(),
              endOfDay(),
            ]);
            break;
          case 'date.between': {
            const range = [
              parseDate(values[0]) || dayjs(0).toISOString(),
              parseDate(values[1]) || dayjs().toISOString(),
            ].sort();
            add(query.i, `${field} BETWEEN ? AND ?`, range);
            break;
          }
          case 'date.lessThan': {
            const date = parseDate(query.v);
            if (date) {
              add(query.i, `${field} <= ?`, [date]);
            }
            break;
          }
          case 'date.largerThan': {
            const date = parseDate(query.v);
            if (date) {
              add(query.i, `${field} >= ?`, [date]);
            }
            break;
          }
          case 'date.afterToday':
            add(query.i, `${field} >= ?`, [dayjs().toISOString()]);
            break;
          case 'date.beforeToday':
            add(query.i, `${field} <= ?`, [dayjs().toISOString()]);
            break;
          case 'date.lessThanRelativeDate':
            add(query.i, `${field} BETWEEN ? AND ?`, [
              startOfDay(),
              endOfDay(parseInt(query.v, 10) || 0),
            ]);
            break;
          case 'date.largerThanRelativeDate':
            add(query.i, `${field} BETWEEN ? AND ?`, [
              startOfDay(-(parseInt(query.v, 10) || 0)),
              endOfDay(),
            ]);
            break;
          case 'date.beforeRelativeDate':
            add(query.i, `${field} <= ?`, [
              startOfDay(-(parseInt(query.v, 10) || 0)),
            ]);
            break;
          case 'date.afterRelativeDate':
            add(query.i, `${field} >= ?`, [
              startOfDay(parseInt(query.v, 10) || 0),
            ]);
            break;
          case 'string.is':
            if (index.type === 'text') {
              add(query.i, `${field} @@ to_tsquery(?)`, [query.v]);
            } else {
              add(query.i, `${field} = ?`, [query.v]);
            }
            break;
          case 'string.contains':
            if (index.type === 'text') {
              add(query.i, `${field} @@ to_tsquery(?)`, [query.v]);
            } else if (`${query.v}`.length >= 2) {
              add(query.i, `${field} ILIKE ?`, [`%${query.v}%`]);
            }
            break;
          case 'string.currentUser':
            add(query.i, `${field} = ?`, [req.user.id]);
            break;
          case 'string.absolutePath': {
            const { path: value, depth } = splitDepth(query.v);
            let absolute = value.replace(getUrlByPath(req, '/'), '') || '/';

            // Resolve uuid
            if (!absolute.includes('/')) {
              const Document = models.get('Document');
              const document = /^[0-9a-f-]{36}$/i.test(absolute)
                ? await Document.fetchOne({ uuid: absolute }, {}, trx)
                : undefined;
              absolute = document ? document.path : `/${absolute}`;
            }
            paths.push({ path: absolute, depth });
            break;
          }
          case 'string.relativePath': {
            const { path: value, depth } = splitDepth(query.v);
            paths.push({ path: normalize(`${root}${value}`), depth });
            break;
          }
          case 'string.path': {
            const { path: value, depth } = splitDepth(query.v);
            const navroot = req.navroot?.path || '/';
            paths.push({
              path: normalize(
                `${navroot}${navroot.endsWith('/') ? '' : '/'}${value}`,
              ),
              depth,
            });
            break;
          }
          default:
            break;
        }
      },
    ),
  );

  // Add path queries, multiple paths are combined with or
  if (paths.length > 0) {
    where['_path'] = pathCondition(paths);
  }

  // Check sort
  if (querystring.sort_on) {
    if (Object.keys(indexes).includes(querystring.sort_on)) {
      options.order.column = `_${querystring.sort_on}`;
    }
  }

  // Check sort order
  if (querystring.sort_order) {
    options.order.reverse = ['descending', 'reverse'].includes(
      querystring.sort_order,
    );
  }

  // Check path depth
  if (querystring['path.depth']) {
    where['_path'] = [
      '~',
      `^${root}[^/]+${'(/[^/]+)?'.repeat(Math.min(querystring['path.depth'] - 1, 20))}$`,
    ];
  }

  // Check batch size
  if (querystring.b_size) {
    options.limit = Math.min(
      config.settings.requestLimit?.batch || 1000,
      Math.max(1, parseInt(querystring.b_size, 10) || 1),
    );
  }

  // Check batch start
  if (querystring.b_start) {
    options.offset = parseInt(querystring.b_start, 10) || 0;
  }

  // Check metafields
  if (querystring.meta_fields === '_all') {
    // select column_name from information_schema.columns where table_name = 'catalog' and column_name ~ '^[^_]';
  }

  return [where, options];
};

/**
 * Convert queryparam to query.
 * @method queryparamToQuery
 * @param {Object} queryparam Querystring
 * @param {String} path Path to search
 * @param {Object} req Request object
 * @param {Object} trx Transaction object.
 * @returns {Object} Query.
 */
export const queryparamToQuery = async (
  queryparam: QueryParam,
  path = '/',
  req: Request,
  trx: Knex.Transaction,
): Promise<QueryResult> => {
  const Index = models.get('Index');
  type IndexMap = Record<string, InstanceType<typeof Index>>;

  // Get root url
  const root = path.endsWith('/') ? path : `${path}/`;

  // Get indexes
  const indexes: IndexMap = {} as IndexMap;
  (await Index.fetchAll({ metadata: false }, {}, trx)).map(
    (index: InstanceType<typeof Index>) => {
      indexes[index.name] = index;
    },
  );

  // Set path search
  const where: WhereClause = {
    _path: ['~', `^${path}`],
  };

  // Default option
  const options: QueryOptions = {
    offset: 0,
    limit: 100,
    order: {
      column: 'UID',
      reverse: false,
    },
    select: undefined,
  };

  // Loop through query params
  await Promise.all(
    Object.keys(queryparam).map(async (key) => {
      const value = queryparam[key];

      // Check if key in indexes
      if (indexes[key]) {
        // Check if key is SearchableText and AI is enabled
        if (
          key === 'SearchableText' &&
          config.settings.ai?.models?.embed?.enabled
        ) {
          // Get embedding vector
          const embedding = await embed(value.replace(/\*/g, ''));

          where['_embedding'] = [
            'raw',
            `1 - (_embedding <=> '${embedding}') > ${config.settings.ai.models.embed.minSimilarity}`,
          ];
          options.select = [
            '*',
            trx.raw(`1 - (_embedding <=> ?) AS similarity`, [embedding]),
          ];
          options.order.column = 'similarity';
          options.order.reverse = true;
        } else {
          const field = `_${key}`;
          switch (indexes[key].type) {
            case 'string':
            case 'integer':
            case 'float':
            case 'path':
            case 'uuid':
            case 'boolean':
            case 'date':
              where[field] = value;
              break;
            case 'string[]':
            case 'uuid[]':
              break;
            case 'text':
              where[field] = ['@@', value.replace(/\*/g, '')];
              break;
            default:
              break;
          }
        }
      }

      // Check other query params
      switch (key) {
        case 'sort_on':
          if (Object.keys(indexes).includes(value)) {
            options.order.column = `_${value}`;
          }
          break;
        case 'sort_order':
          options.order.reverse = value !== 'ascending';
          break;
        case 'path.depth':
          where['_path'] = [
            '~',
            `^${root}[^/]+${'(/[^/]+)?'.repeat(parseInt(value, 10) - 1)}$`,
          ];
          break;
        case 'b_size':
          options.limit = Math.min(
            config.settings.requestLimit?.batch || 1000,
            Math.max(1, parseInt(value, 10) || 1),
          );
          break;
        case 'b_start':
          options.offset = parseInt(value, 10) || 0;
          break;
        default:
          break;
      }
    }),
  );
  return [where, options];
};
