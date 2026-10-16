/**
 * Reindex item action for scheduled jobs
 * @module scheduled_jobs/actions/reindex
 */

// Type imports
import type { Params, Request } from '../../types';

// External imports
import { compact } from 'es-toolkit/array';
import { Knex } from 'knex';

// Internal imports
import models from '../../models';

export const reindex = {
  getTitle: (req: Request) => req.i18n('Reindex items'),
  getDescription: (req: Request) => req.i18n('Reindex items based on type'),
  getSummary: (req: Request, params: Params) =>
    req.i18n('Reindex items of type {type}', {
      type:
        params.type && params.type.length > 0
          ? params.type.join(', ')
          : req.i18n('None'),
    }),
  schema: {
    fieldsets: [
      {
        fields: ['type'],
        id: 'default',
        title: 'Default',
      },
    ],
    properties: {
      type: {
        additionalItems: true,
        'description:i18n': 'The content type to reindex.',
        factory: 'Multiple Choice',
        items: {
          description: '',
          factory: 'Choice',
          title: '',
          type: 'string',
          vocabulary: {
            '@id': 'types',
          },
        },
        'title:i18n': 'Content type',
        type: 'array',
        uniqueItems: true,
      },
    },
    required: ['type'],
    type: 'object',
  },
  handler: async (
    params: Params,
    _actor: string,
    _trx: Knex.Transaction,
    context?: { signal?: AbortSignal },
  ) => {
    // Reindex the documents of the types, all documents without types
    const Document = models.get('Document');
    const types = compact(
      Array.isArray(params.type) ? params.type : [params.type],
    );
    const count = await Document.reindexCatalog({
      types: types.length > 0 ? types : undefined,
      signal: context?.signal,
    });

    // Return success
    return { status: 'success', count };
  },
};
