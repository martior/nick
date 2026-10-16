/**
 * Collect more statistics for the full text and keyword catalog columns.
 * @module migration/catalog_statistics
 */

// Type imports
import type { Knex } from 'knex';

/**
 * Set the statistics target of the full text and keyword columns
 * @method setStatistics
 * @param {Knex} knex Knex object.
 * @param {number} target Statistics target, -1 is the default.
 * @returns {Promise<void>} Promise resolved when done.
 */
const setStatistics = async (knex: Knex, target: number): Promise<void> => {
  // On a new site the catalog columns are added later by the profiles
  const indexes = await knex('index')
    .select('id')
    .where({ metadata: false })
    .whereIn('type', ['text', 'string[]', 'uuid[]'])
    .whereNot('id', '_allowedUsersGroupsRoles');
  for (const index of indexes) {
    if (await knex.schema.hasColumn('catalog', index.id)) {
      await knex.raw(
        `ALTER TABLE catalog ALTER COLUMN ?? SET STATISTICS ${target}`,
        [index.id],
      );
    }
  }
};

export const up = async (knex: Knex): Promise<void> => {
  // With the default target Postgres estimates a rare word as much more
  // frequent than it is, and a limited query then walks an index in sort
  // order through the whole table instead of using the full text index
  await setStatistics(knex, 1000);
};

export const down = async (knex: Knex): Promise<void> => {
  await setStatistics(knex, -1);
};
