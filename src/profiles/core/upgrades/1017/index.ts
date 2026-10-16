/**
 * Upgrade 1017: add the isFolderish catalog index of Plone.
 * @module profiles/core/upgrades/1017
 */

// Type imports
import type { Knex } from 'knex';

/**
 * Fill the new isFolderish index from the is_folderish index, which has the
 * same value, so no reindex is needed.
 * @method init
 * @param {Knex.Transaction} trx Transaction object.
 * @returns {Promise<void>} Promise resolved when done.
 */
export async function init(trx: Knex.Transaction): Promise<void> {
  await trx.raw(
    'UPDATE catalog SET "_isFolderish" = "_is_folderish" WHERE "_isFolderish" IS DISTINCT FROM "_is_folderish"',
  );
}
