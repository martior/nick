/**
 * Purge notes action: removes notes of documents which no longer exist.
 * @module scheduled_jobs/actions/purge_notes
 */

// Type imports
import type { Knex, Params, Request, ScheduledJobAction } from '@plone/nick';

export const purgeNotes: ScheduledJobAction = {
  getTitle: (req: Request) => req.i18n('Purge notes'),
  getDescription: (req: Request) =>
    req.i18n('Remove the notes of deleted documents'),
  getSummary: (req: Request) =>
    req.i18n('Remove the notes of deleted documents'),
  schema: {
    fieldsets: [{ fields: [], id: 'default', title: 'Default' }],
    properties: {},
    required: [],
    type: 'object',
  },
  handler: async (_params: Params, _actor: string, trx: Knex.Transaction) => {
    const purged = await trx('example.note')
      .whereNotExists(
        trx('document')
          .select('uuid')
          .whereRaw('document.uuid = note.document'),
      )
      .delete();
    return { status: 'success', purged };
  },
};
