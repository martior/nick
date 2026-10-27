/**
 * Reindex security action for scheduled jobs
 * @module scheduled_jobs/actions/reindex_security
 */

// Type imports
import type { Params, Request } from '../../types';

// External imports
import { Knex } from 'knex';

// Internal imports
import models from '../../models';

export const reindex_security = {
  getTitle: (req: Request) => req.i18n('Reindex security'),
  getDescription: (req: Request) =>
    req.i18n('Reindex the permissions of an item and the items below it'),
  getSummary: (req: Request, params: Params) =>
    req.i18n('Reindex security of {path}', {
      path: params.path || '/',
    }),
  schema: {
    fieldsets: [
      {
        fields: ['path'],
        id: 'default',
        title: 'Default',
      },
    ],
    properties: {
      path: {
        'description:i18n': 'Path of the item, for example /news.',
        factory: 'Text line (String)',
        'title:i18n': 'Path',
        type: 'string',
      },
    },
    required: ['path'],
    type: 'object',
  },
  handler: async (params: Params, _actor: string, trx: Knex.Transaction) => {
    // Get the document
    const Document = models.get('Document');
    const document = await Document.fetchOne(
      { path: params.path || '/' },
      {},
      trx,
    );

    // Reindex the security of the document and its children
    const count = document ? await document.reindexSecurity(trx) : 0;

    // Return success
    return { status: 'success', count };
  },
};
