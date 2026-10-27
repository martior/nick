/**
 * Index the array columns of the catalog with GIN.
 * @module migration/catalog_gin
 */

// Type imports
import type { Knex } from 'knex';

/**
 * Get the array indexes which have a column in the catalog
 * @method getArrayIndexes
 * @param {Knex} knex Knex object.
 * @returns {Promise<string[]>} Column names.
 */
const getArrayIndexes = async (knex: Knex): Promise<string[]> => {
  // On a new site the catalog columns are added later by the profiles.
  // The permission tokens keep their btree index, see the catalog seed.
  const indexes = await knex('index')
    .select('id')
    .where({ metadata: false })
    .whereIn('type', ['string[]', 'uuid[]'])
    .whereNot('id', '_allowedUsersGroupsRoles');
  const columns: string[] = [];
  for (const index of indexes) {
    if (await knex.schema.hasColumn('catalog', index.id)) {
      columns.push(index.id);
    }
  }
  return columns;
};

/**
 * Recreate the index of the array columns with the given method
 * @method recreateIndexes
 * @param {Knex} knex Knex object.
 * @param {string} method Index method.
 * @returns {Promise<void>} Promise resolved when done.
 */
const recreateIndexes = async (knex: Knex, method: string): Promise<void> => {
  for (const column of await getArrayIndexes(knex)) {
    const name = `catalog_${column.toLowerCase()}_index`;
    await knex.raw('DROP INDEX IF EXISTS ??', [name]);
    await knex.raw(`CREATE INDEX ?? ON catalog USING ${method} (??)`, [
      name,
      column,
    ]);
  }
};

export const up = async (knex: Knex): Promise<void> => {
  // A btree index can't be used for the && and @> operators
  await recreateIndexes(knex, 'gin');
};

export const down = async (knex: Knex): Promise<void> => {
  await recreateIndexes(knex, 'btree');
};
