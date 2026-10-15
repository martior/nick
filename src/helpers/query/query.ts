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
 * Quote a term for use in a tsquery.
 * @method quoteTerm
 * @param {string} term Term to quote.
 * @returns {string} Quoted term.
 */
const quoteTerm = (term: string): string =>
  `'${term.replace(/\\/g, '\\\\').replace(/'/g, "''")}'`;

/**
 * Convert a single search term to a tsquery expression.
 * A `*` or `?` wildcard turns the term into a prefix search.
 * @method termToTsquery
 * @param {string} term Search term.
 * @returns {string | null} Tsquery expression or null if empty.
 */
const termToTsquery = (term: string): string | null => {
  const value = term.replace(/^[*?]+/, '');
  if (!/[*?]/.test(value)) {
    return value ? quoteTerm(value) : null;
  }
  const words = value
    .split(/[*?]/)[0]
    .split(/[^\p{L}\p{N}]+/u)
    .filter((word: string) => word !== '');
  if (words.length === 0) {
    return null;
  }
  return words
    .map((word: string, index: number) =>
      index === words.length - 1 ? `${quoteTerm(word)}:*` : quoteTerm(word),
    )
    .join(' & ');
};

/**
 * Combine tsquery expressions with an operator.
 * @method combine
 * @param {Array} items Tsquery expressions.
 * @param {string} operator Operator (`&` or `|`).
 * @returns {string | null} Combined expression or null if empty.
 */
const combine = (items: (string | null)[], operator: string): string | null => {
  const terms = items.filter((item) => item !== null) as string[];
  if (terms.length === 0) {
    return null;
  }
  return terms.length === 1 ? terms[0] : `(${terms.join(` ${operator} `)})`;
};

/**
 * Convert a search text to a safe tsquery string.
 *
 * Follows the ZCTextIndex query syntax used by Plone: terms are combined
 * with AND, the AND, OR and NOT keywords (case insensitive) and parentheses
 * are supported, "quoted text" is a phrase and a trailing `*` (or `?`) is a
 * prefix search. Any other input is treated as plain text, so the result is
 * always a valid argument for `to_tsquery`.
 * @method textToTsquery
 * @param {string} text Search text.
 * @returns {string} Tsquery string, empty if there are no terms.
 */
export const textToTsquery = (text: any): string => {
  const tokens: string[] =
    `${Array.isArray(text) ? text.join(' ') : (text ?? '')}`
      .replace(/\0/g, '')
      .match(/\(|\)|-?"[^"]*"|[^()\s]+/g) || [];
  let pos = 0;
  const keyword = (token?: string): string | undefined =>
    token !== undefined && ['AND', 'OR', 'NOT'].includes(token.toUpperCase())
      ? token.toUpperCase()
      : undefined;

  const parsePrimary = (): string | null => {
    if (pos >= tokens.length) {
      return null;
    }
    const token = tokens[pos++];
    if (token === '(') {
      const result = parseOr();
      if (tokens[pos] === ')') {
        pos++;
      }
      return result;
    }
    if (token === ')' || keyword(token)) {
      return null;
    }
    const phrase = token.match(/^(-?)"(.*)"$/);
    if (phrase) {
      const value = phrase[2].trim();
      if (!value) {
        return null;
      }
      return phrase[1] ? `!${quoteTerm(value)}` : quoteTerm(value);
    }
    return termToTsquery(token);
  };

  const parseNot = (): string | null => {
    if (keyword(tokens[pos]) === 'NOT') {
      pos++;
      if (pos >= tokens.length) {
        return null;
      }
      const result = parseNot();
      return result ? `!${result}` : null;
    }
    return parsePrimary();
  };

  const parseAnd = (): string | null => {
    const items = [parseNot()];
    while (
      pos < tokens.length &&
      tokens[pos] !== ')' &&
      keyword(tokens[pos]) !== 'OR'
    ) {
      if (keyword(tokens[pos]) === 'AND') {
        pos++;
        if (pos >= tokens.length) {
          break;
        }
      }
      items.push(parseNot());
    }
    return combine(items, '&');
  };

  const parseOr = (): string | null => {
    const items = [parseAnd()];
    while (keyword(tokens[pos]) === 'OR') {
      pos++;
      if (pos < tokens.length && tokens[pos] !== ')') {
        items.push(parseAnd());
      }
    }
    return combine(items, '|');
  };

  // Parse all tokens, stray closing parentheses are skipped
  const items: (string | null)[] = [];
  while (pos < tokens.length) {
    items.push(parseOr());
    if (tokens[pos] === ')') {
      pos++;
    }
  }
  return combine(items, '&') || '';
};

/**
 * Get a where condition for a full text search.
 * @method textCondition
 * @param {string} field Column name.
 * @param {string} text Search text.
 * @returns {Array} Raw where condition.
 */
export const textCondition = (
  field: string,
  text: any,
): ['raw', string, any[]] => {
  const tsquery = textToTsquery(text);
  return tsquery
    ? ['raw', `"${field}" @@ to_tsquery(?)`, [tsquery]]
    : ['raw', 'false', []];
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
              where[`_${query.i}:${Object.keys(where).length}`] = textCondition(
                `_${query.i}`,
                query.v,
              );
            } else {
              add(query.i, `${field} = ?`, [query.v]);
            }
            break;
          case 'string.contains':
            if (index.type === 'text') {
              where[`_${query.i}:${Object.keys(where).length}`] = textCondition(
                `_${query.i}`,
                query.v,
              );
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
 * Convert a parameter value to a typed list of values for an index.
 * @method typedValues
 * @param {string} type Index type.
 * @param {any} value Parameter value.
 * @returns {Array} List of typed values, invalid values are left out.
 */
const typedValues = (type: string, value: any): any[] =>
  toArray(value)
    .map((item: any) => {
      switch (type) {
        case 'integer':
          return parseInt(item, 10);
        case 'float':
          return parseFloat(item);
        case 'boolean':
          return ['true', '1', 'yes', 'on'].includes(`${item}`.toLowerCase());
        case 'date':
          return parseDate(item);
        case 'uuid':
        case 'uuid[]':
          return /^[0-9a-f]{8}-?([0-9a-f]{4}-?){3}[0-9a-f]{12}$/i.test(item)
            ? item
            : undefined;
        default:
          return `${item}`;
      }
    })
    .filter(
      (item: any) =>
        item !== undefined && !(typeof item === 'number' && isNaN(item)),
    );

/**
 * Convert queryparam to query.
 *
 * Supports the ZCatalog query options as used by plone.restapi: an index
 * can be queried with `index=value` (a list of values is an OR),
 * `index.query`, `index.range` (`min`, `max` or `min:max`),
 * `index.operator` (`and` or `or`) and `index.not`. The path index supports
 * `path.query` (one or more physical paths) and `path.depth`.
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

  // Get indexes
  const indexes: IndexMap = {} as IndexMap;
  (await Index.fetchAll({ metadata: false }, {}, trx)).map(
    (index: InstanceType<typeof Index>) => {
      indexes[index.name] = index;
    },
  );

  // Group parameters by index and option
  const params: Record<string, Record<string, any>> = {};
  Object.keys(queryparam || {}).forEach((key: string) => {
    const name = key.replace(/:(list|record|records|tuple)$/, '');
    const match = name.match(/^(.+)\.(query|range|operator|depth|not)$/);
    const [index, option] = match ? [match[1], match[2]] : [name, 'query'];
    params[index] = {
      ...params[index],
      [option]: queryparam[key],
    };
  });

  const where: WhereClause = {};

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

  // Set path search, default to the context or the navigation root
  const depth = parseInt(params.path?.depth, 10);
  const paths = toArray(params.path?.query);
  if (paths.length === 0) {
    paths.push(
      typedValues('boolean', params.use_site_search_settings?.query)[0] &&
        req.navroot
        ? req.navroot.path
        : path,
    );
  }
  where['_path'] = pathCondition(
    paths.map((item: string) => ({
      path: `${item}`.replace(getUrlByPath(req, '/'), '') || '/',
      depth: isNaN(depth) ? undefined : depth,
    })),
  );

  // Loop through indexes
  await Promise.all(
    Object.keys(params).map(async (key) => {
      const index = indexes[key];
      const param = params[key];
      const value = param.query;

      // Check if key in indexes
      if (!index || key === 'path' || value === undefined) {
        return;
      }

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
        return;
      }

      const field = `_${key}`;
      const values = typedValues(index.type, value);
      switch (index.type) {
        case 'string':
        case 'integer':
        case 'float':
        case 'uuid':
        case 'boolean':
        case 'date':
          if (param.range) {
            const range = ['integer', 'float'].includes(index.type)
              ? values.sort((a: number, b: number) => a - b)
              : values.sort();
            if (range.length === 0) {
              break;
            }
            switch (param.range) {
              case 'min':
                where[field] = ['raw', `"${field}" >= ?`, [range[0]]];
                break;
              case 'max':
                where[field] = [
                  'raw',
                  `"${field}" <= ?`,
                  [range[range.length - 1]],
                ];
                break;
              case 'min:max':
              case 'minmax':
                where[field] = [
                  'raw',
                  `"${field}" BETWEEN ? AND ?`,
                  [range[0], range[range.length - 1]],
                ];
                break;
              default:
                break;
            }
          } else {
            where[field] = ['raw', `"${field}" = any(?)`, [values]];
          }
          break;
        case 'string[]':
        case 'uuid[]':
          where[field] = [
            'raw',
            `"${field}" ${`${param.operator}`.toLowerCase() === 'and' ? '@>' : '&&'} ?`,
            [values],
          ];
          break;
        case 'text':
          where[field] = textCondition(field, value);
          break;
        default:
          break;
      }

      // Check not option
      if (param.not !== undefined && index.type !== 'text') {
        const not = typedValues(index.type, param.not);
        where[`${field}:not`] = [
          'raw',
          ['string[]', 'uuid[]'].includes(index.type)
            ? `NOT (coalesce("${field}", '{}') && ?)`
            : `("${field}" IS NULL OR NOT ("${field}" = any(?)))`,
          [not],
        ];
      }
    }),
  );

  // Check sort
  if (params.sort_on && Object.keys(indexes).includes(params.sort_on.query)) {
    options.order.column = `_${params.sort_on.query}`;
  }

  // Check sort order
  if (params.sort_order) {
    options.order.reverse = ['descending', 'reverse'].includes(
      params.sort_order.query,
    );
  }

  // Check batch size
  if (params.b_size) {
    options.limit = Math.min(
      config.settings.requestLimit?.batch || 1000,
      Math.max(1, parseInt(params.b_size.query, 10) || 1),
    );
  }

  // Check batch start
  if (params.b_start) {
    options.offset = parseInt(params.b_start.query, 10) || 0;
  }

  return [where, options];
};
