/**
 * Keep content, versions and jobs when deleting a user.
 * @module migration/user_set_null
 */

// Type imports
import type { Knex } from 'knex';

const columns = [
  { table: 'document', column: 'owner' },
  { table: 'version', column: 'actor' },
  { table: 'job', column: 'actor' },
];

/**
 * Change the foreign keys to the user table
 * @method changeForeignKeys
 * @param {Knex} knex Knex object.
 * @param {string} onDelete On delete action.
 * @returns {Promise<void>} Promise resolved when done.
 */
const changeForeignKeys = async (knex: Knex, onDelete: string) => {
  for (const { table, column } of columns) {
    await knex.schema.alterTable(table, (builder: Knex.TableBuilder) => {
      builder.dropForeign([column]);
      builder
        .foreign(column)
        .references('user.id')
        .onUpdate('CASCADE')
        .onDelete(onDelete);
    });
  }
};

export const up = async (knex: Knex): Promise<void> => {
  await changeForeignKeys(knex, 'SET NULL');
};

export const down = async (knex: Knex): Promise<void> => {
  await changeForeignKeys(knex, 'CASCADE');
};
