/**
 * Allow ids, paths and titles longer than 255 characters.
 * @module migration/long_strings
 */

// Type imports
import type { Knex } from 'knex';

const columns = [
  { table: 'document', column: 'id' },
  { table: 'document', column: 'path' },
  { table: 'version', column: 'id' },
  { table: 'redirect', column: 'path' },
];

/**
 * Get the string columns of the catalog.
 * @method catalogColumns
 * @param {Knex} knex Knex object.
 * @param {string} type Data type (udt name) of the columns.
 * @returns {Promise<string[]>} Names of the columns.
 */
const catalogColumns = async (knex: Knex, type: string): Promise<string[]> =>
  (
    await knex('information_schema.columns')
      .select('column_name')
      .where({ table_name: 'catalog', udt_name: type })
      .whereRaw('table_schema = current_schema()')
  ).map((row: any) => row.column_name);

export const up = async (knex: Knex): Promise<void> => {
  for (const { table, column } of columns) {
    await knex.schema.alterTable(table, (builder: Knex.TableBuilder) => {
      builder.text(column).alter({ alterNullable: false });
    });
  }
  for (const column of await catalogColumns(knex, 'varchar')) {
    await knex.raw('alter table catalog alter column ?? type text', [column]);
  }
  for (const column of await catalogColumns(knex, '_varchar')) {
    await knex.raw('alter table catalog alter column ?? type text[]', [column]);
  }
};

export const down = async (knex: Knex): Promise<void> => {
  for (const { table, column } of columns) {
    await knex.schema.alterTable(table, (builder: Knex.TableBuilder) => {
      builder.string(column).alter({ alterNullable: false });
    });
  }
  // The catalog columns stay text: text columns can't be told apart from
  // the ones which were text before, and text holds all values.
};
