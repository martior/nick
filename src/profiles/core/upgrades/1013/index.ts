/**
 * Upgrade 1013: rebuild the catalog permissions after giving Owner View in
 * the private and pending states.
 * @module profiles/core/upgrades/1013
 */

// Type imports
import type { Knex } from 'knex';

// Internal imports
import models from '../../../../models';

/**
 * Rebuild the allowed users, groups and roles of all documents.
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
