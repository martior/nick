/**
 * Index the document and catalog paths for prefix queries.
 * @module migration/path_prefix_indexes
 */

// Type imports
import type { Knex } from 'knex';

/**
 * Get the path indexes which have a column in the catalog
 * @method getPathIndexes
 * @param {Knex} knex Knex object.
 * @returns {Promise<string[]>} Column names.
 */
const getPathIndexes = async (knex: Knex): Promise<string[]> => {
  // On a new site the catalog columns are added later by the profiles
  const indexes = await knex('index')
    .select('id')
    .where({ metadata: false, type: 'path' });
  const columns: string[] = [];
  for (const index of indexes) {
    if (await knex.schema.hasColumn('catalog', index.id)) {
      columns.push(index.id);
    }
  }
  return columns;
};

export const up = async (knex: Knex): Promise<void> => {
  // The default btree index can't be used for LIKE 'prefix%' with a
  // non C collation, the pattern operator class can
  await knex.raw(
    'CREATE INDEX IF NOT EXISTS document_path_pattern_index ON document (path varchar_pattern_ops)',
  );
  for (const column of await getPathIndexes(knex)) {
    await knex.raw(
      'CREATE INDEX IF NOT EXISTS ?? ON catalog (?? varchar_pattern_ops)',
      [`catalog_${column.toLowerCase()}_pattern_index`, column],
    );
  }
};

export const down = async (knex: Knex): Promise<void> => {
  await knex.raw('DROP INDEX IF EXISTS document_path_pattern_index');
  for (const column of await getPathIndexes(knex)) {
    await knex.raw('DROP INDEX IF EXISTS ??', [
      `catalog_${column.toLowerCase()}_pattern_index`,
    ]);
  }
};
