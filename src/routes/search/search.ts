/**
 * Search routes.
 * @module routes/search/search
 */

// Type imports
import type { Request } from '../../types';
import type { Knex } from 'knex';

// Internal imports
import { chat } from '../../helpers/ai/ai';
import config from '../../helpers/config/config';
import { apiLimiter } from '../../helpers/limiter/limiter';
import { RequestException } from '../../helpers/error/error';
import {
  getBatching,
  getBatchParams,
  isValidOperation,
  querystringToQuery,
  queryparamToQuery,
} from '../../helpers/query/query';
import { getUrl } from '../../helpers/url/url';
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
          ? await Catalog.fetchAllRestricted(
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
          items: items.map((item: InstanceType<typeof Catalog>) =>
            item.toJson(req),
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
    handler: async (req: Request, trx: Knex.Transaction) => {
      const Catalog = models.get('Catalog');
      const Index = models.get('Index');

      // Check if a valid query is supplied
      if (!Array.isArray(req.body?.query) || req.body.query.length === 0) {
        throw new RequestException(400, {
          message: req.i18n('No query supplied.'),
        });
      }
      if (req.body.query.some((row: any) => !row || !isValidOperation(row.o))) {
        throw new RequestException(400, {
          message: req.i18n('Invalid query.'),
        });
      }

      const query = await querystringToQuery(
        req.body,
        req.document.path,
        req,
        trx,
      );

      // Exclude the context itself from the results
      if (req.document.path !== '/') {
        query[0]['_UID:context'] = ['raw', '"_UID" <> ?', [req.document.uuid]];
      }
      // Get batch, the limit caps the total number of results
      const { start, size } = getBatchParams(req.body.b_start, req.body.b_size);
      const limit = parseInt(req.body.limit, 10);
      const count = await Catalog.countRestricted(query[0], trx, req);
      const total = isNaN(limit) || limit < 0 ? count : Math.min(count, limit);
      const items =
        size > 0 && start < total
          ? await Catalog.fetchAllRestricted(
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
          items: items.map((item: InstanceType<typeof Catalog>) =>
            item.toJson(req),
          ),
          items_total: total,
          ...batching(
            `${getUrl(req)}/@querystring-search`,
            {},
            total,
            start,
            size,
          ),
        },
      };
    },
  },
];
