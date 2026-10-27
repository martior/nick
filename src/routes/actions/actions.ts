/**
 * Action route.
 * @module routes/actions/actions
 */

// Type imports
import type { Knex } from 'knex';
import type { Request } from '../../types';

// External imports
import { pick } from 'es-toolkit/object';

// Internal imports
import models from '../../models';

export const handler = async (req: Request, trx: Knex.Transaction) => {
  const Action = models.get('Action');
  const actions = await Action.fetchAll({}, { order: 'order' }, trx);
  const json = await actions.toJson(req);

  // Only return the requested categories
  const categories = [
    req.query?.['categories:list'] || req.query?.categories || [],
  ].flat() as string[];
  return {
    json: categories.length > 0 ? pick(json, categories) : json,
  };
};

export default [
  {
    op: 'get',
    view: '/@actions',
    permission: 'View',
    client: 'getActions',
    cache: 'content',
    handler,
  },
];
