/**
 * Search routes.
 * @module routes/search/search
 */

// Type imports
import type { Request } from '../../types';
import type { Knex } from 'knex';

// External imports
import { pick } from 'es-toolkit/object';

// Internal imports
import { chat } from '../../helpers/ai/ai';
import config from '../../helpers/config/config';
import { apiLimiter } from '../../helpers/limiter/limiter';
import { getComponents } from '../../helpers/content/content';
import { RequestException } from '../../helpers/error/error';
import {
  getBatching,
  getBatchParams,
  isValidOperation,
  querystringToQuery,
  queryparamToQuery,
} from '../../helpers/query/query';
import { getUrl, getUrlByPath } from '../../helpers/url/url';
import { mapAsync } from '../../helpers/utils/utils';
import models from '../../models';

interface ChatResult {
  message: {
    content: string;
  };
}

/**
 * Get the batching property of a result.
 * @method batching
 * @param {string} url Url of the current call.
 * @param {Object} params Query parameters of the current call.
 * @param {number} total Total number of items.
 * @param {number} start Batch start.
 * @param {number} size Batch size.
 * @returns {Object} Object with the batching links or an empty object.
 */
const batching = (
  url: string,
  params: Record<string, any>,
  total: number,
  start: number,
  size: number,
): Record<string, any> => {
  const links = getBatching(url, params, total, start, size);
  return links ? { batching: links } : {};
};

/**
 * Up to this number of matches the matches are filtered before sorting.
 * @constant FEW_MATCHES
 */
const FEW_MATCHES = 5000;

/**
 * Get the catalog method to fetch a batch of results, by the number of
 * matches, see Catalog.fetchFewRestricted.
 * @method fetchMethod
 * @param {number} count Number of matches.
 * @returns {string} Method name.
 */
const fetchMethod = (
  count: number,
): 'fetchFewRestricted' | 'fetchAllRestricted' =>
  count <= FEW_MATCHES ? 'fetchFewRestricted' : 'fetchAllRestricted';

/**
 * Serialize the search results.
 *
 * With `fullobjects` the full content objects are returned. Otherwise a
 * summary is returned; when `metadata_fields` is specified the summary
 * contains `@id`, `@type`, `title`, `description` and `review_state` plus
 * the requested metadata (`_all` for all metadata).
 * @method serializeItems
 * @param {Request} req Request object.
 * @param {Knex.Transaction} trx Transaction object.
 * @param {Array} items Catalog items.
 * @param {any} fullobjects Fullobjects parameter.
 * @param {any} metadataFields Metadata fields parameter.
 * @returns {Promise<Array>} Serialized items.
 */
const serializeItems = async (
  req: Request,
  trx: Knex.Transaction,
  items: any,
  fullobjects: any,
  metadataFields: any,
): Promise<any[]> => {
  const Document = models.get('Document');

  // Return full objects
  if (['1', 'true', 'True', true, 1].includes(fullobjects)) {
    return await mapAsync(items.models || items, async (item: any) => {
      const document = await Document.fetchOne({ uuid: item.UID }, {}, trx);
      await document.fetchRelated('_type', trx);
      await document.applyBehaviors(trx);
      await document.fetchRelationLists(trx);
      const parent = document.parent
        ? await Document.fetchById(document.parent, {}, trx)
        : undefined;
      const documentReq = { ...req, document } as Request;
      return {
        ...(await document.toJson(
          documentReq,
          await getComponents(documentReq, trx, []),
        )),
        ...(parent
          ? {
              parent: {
                '@id': getUrlByPath(req, parent.path),
                '@type': parent.type,
                title: parent.json.title,
                description: parent.json.description || '',
                review_state: parent.workflow_state,
              },
            }
          : {}),
      };
    });
  }

  // Get metadata fields
  const fields = (
    Array.isArray(metadataFields) ? metadataFields : [metadataFields]
  ).filter((field: any) => typeof field === 'string' && field !== '');

  return items.map((item: any) => {
    const json = {
      ...item.toJson(req),
      description: item.Description || '',
      review_state: item.review_state,
    };
    return fields.length === 0 || fields.includes('_all')
      ? json
      : pick(json, [
          '@id',
          '@type',
          'title',
          'description',
          'review_state',
          ...fields,
        ]);
  });
};

/**
 * Querystring search.
 * @method querystringSearch
 * @param {Request} req Request object.
 * @param {Knex.Transaction} trx Transaction object.
 * @param {Object} data Querystring search data.
 * @returns {Promise<Object>} Response.
 */
const querystringSearch = async (
  req: Request,
  trx: Knex.Transaction,
  data: any,
): Promise<any> => {
  const Catalog = models.get('Catalog');
  const Index = models.get('Index');

  // Check if a valid query is supplied
  if (!Array.isArray(data?.query) || data.query.length === 0) {
    throw new RequestException(400, {
      message: req.i18n('No query supplied.'),
    });
  }
  if (data.query.some((row: any) => !row || !isValidOperation(row.o))) {
    throw new RequestException(400, {
      message: req.i18n('Invalid query.'),
    });
  }

  const query = await querystringToQuery(data, req.document.path, req, trx);

  // Exclude the context itself from the results
  if (req.document.path !== '/') {
    query[0]['_UID:context'] = ['raw', '"_UID" <> ?', [req.document.uuid]];
  }
  // Get batch, the limit caps the total number of results
  const { start, size } = getBatchParams(data.b_start, data.b_size);
  const limit = parseInt(data.limit, 10);
  const count = await Catalog.countRestricted(query[0], trx, req);
  const total = isNaN(limit) || limit < 0 ? count : Math.min(count, limit);
  const items =
    size > 0 && start < total
      ? await Catalog[fetchMethod(count)](
          query[0],
          {
            ...query[1],
            offset: start,
            limit: Math.min(size, total - start),
          },
          trx,
          req,
        )
      : [];

  // Fetch indexes
  if (!req.indexes) {
    req.indexes = await Index.fetchAll({}, {}, trx);
  }

  // Return JSON response
  return {
    json: {
      '@id': `${getUrl(req)}/@search`,
      items: await serializeItems(
        req,
        trx,
        items,
        data.fullobjects,
        data.metadata_fields,
      ),
      items_total: total,
      ...batching(`${getUrl(req)}/@querystring-search`, {}, total, start, size),
    },
  };
};

export default [
  {
    op: 'get',
    view: '/@search',
    permission: 'View',
    client: 'search',
    cache: 'dynamic',
    middleware: apiLimiter,
    handler: async (req: Request, trx: Knex.Transaction) => {
      const Catalog = models.get('Catalog');
      const Index = models.get('Index');
      const query = await queryparamToQuery(
        req.query,
        req.document.path,
        req,
        trx,
      );

      // Get batch
      const { start, size } = getBatchParams(
        req.query.b_start,
        req.query.b_size,
      );
      const total = await Catalog.countRestricted(query[0], trx, req);
      const items =
        size > 0 && start < total
          ? await Catalog[fetchMethod(total)](
              query[0],
              { ...query[1], offset: start, limit: size },
              trx,
              req,
            )
          : [];

      // Fetch indexes
      if (!req.indexes) {
        req.indexes = await Index.fetchAll({}, {}, trx);
      }

      // Check if AI response requested
      let ai: ChatResult | null = null;
      if (
        config.settings.ai?.models?.embed?.enabled &&
        req.query.use_ai === '1'
      ) {
        const prompt = req.query.SearchableText.replaceAll(/\*/g, '') || '';
        ai = (await chat(
          prompt,
          [],
          {},
          [],
          'Please give a short description of the terms provided in the query',
        )) as unknown as ChatResult;
      }

      // Return JSON response
      return {
        json: {
          '@id': `${getUrl(req)}/@search`,
          items: await serializeItems(
            req,
            trx,
            items,
            req.query.fullobjects,
            req.query.metadata_fields,
          ),
          items_total: total,
          ...batching(`${getUrl(req)}/@search`, req.query, total, start, size),
          ...(ai ? { ai: ai.message.content } : {}),
        },
      };
    },
  },
  {
    op: 'post',
    view: '/@querystring-search',
    permission: 'View',
    client: 'querystringSearch',
    cache: 'dynamic',
    middleware: apiLimiter,
    handler: async (req: Request, trx: Knex.Transaction) =>
      querystringSearch(req, trx, req.body),
  },
  {
    op: 'get',
    view: '/@querystring-search',
    permission: 'View',
    client: 'getQuerystringSearch',
    cache: 'dynamic',
    middleware: apiLimiter,
    handler: async (req: Request, trx: Knex.Transaction) => {
      let data = {};
      try {
        data = JSON.parse(req.query.query || '{}');
      } catch {
        throw new RequestException(400, {
          message: req.i18n('Invalid query.'),
        });
      }
      return querystringSearch(req, trx, data);
    },
  },
];
