/**
 * Upgrade 1009: prefix users and groups in the catalog permissions.
 * @module profiles/core/upgrades/1009
 */

// Type imports
import type { Knex } from 'knex';

// Internal imports
import models from '../../../../models';

/**
 * Rebuild the allowed users, groups and roles of all documents, users are
 * now stored as `user:<id>` and groups as `group:<id>`.
 * @method init
 * @param {Knex.Transaction} trx Transaction object.
 * @returns {Promise<void>} Promise resolved when done.
 */
export async function init(trx: Knex.Transaction): Promise<void> {
  const Document = models.get('Document');
  const root = await Document.fetchOne({ parent: null }, {}, trx);
  if (root) {
    await root.reindexSecurity(trx);
  }
}
