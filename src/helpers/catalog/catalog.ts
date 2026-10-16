/**
 * Catalog helper.
 * @module helpers/catalog/catalog
 */

// Type imports
import type { Knex } from 'knex';

/**
 * Indexes which contain the permission filter, so counting the results of
 * a search needs no visit of the (wide) catalog rows. The index by type and
 * state serves listings by type, state and subject, and as a narrow copy of
 * the permission columns also searches without other conditions.
 * @constant coveringIndexes
 */
export const coveringIndexes = [
  {
    name: 'catalog_type_state_covering_index',
    columns: ['_portal_type', '_review_state'],
    include: ['_deleted', '_allowedUsersGroupsRoles', '_Subject'],
  },
];

/**
 * Create the covering indexes whose columns exist.
 * @method createCoveringIndexes
 * @param {Knex} knex Knex object or transaction.
 * @returns {Promise<void>} Promise resolved when done.
 */
export async function createCoveringIndexes(knex: Knex): Promise<void> {
  for (const index of coveringIndexes) {
    const columns = [...index.columns, ...index.include];
    let exists = true;
    for (const column of columns) {
      exists = exists && (await knex.schema.hasColumn('catalog', column));
    }
    if (exists) {
      await knex.raw(
        `CREATE INDEX IF NOT EXISTS ?? ON catalog (${index.columns.map(() => '??').join(', ')}) INCLUDE (${index.include.map(() => '??').join(', ')})`,
        [index.name, ...columns],
      );
    }
  }
}

/**
 * Drop the covering indexes.
 * @method dropCoveringIndexes
 * @param {Knex} knex Knex object or transaction.
 * @returns {Promise<void>} Promise resolved when done.
 */
export async function dropCoveringIndexes(knex: Knex): Promise<void> {
  for (const index of coveringIndexes) {
    await knex.raw('DROP INDEX IF EXISTS ??', [index.name]);
  }
}
