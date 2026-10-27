/**
 * Long descriptions migration.
 * @module migration/long_descriptions
 */

// Type imports
import type { Knex } from 'knex';

const tables = ['workflow', 'type', 'group'];

export const up = async (knex: Knex): Promise<void> => {
  for (const table of tables) {
    await knex.schema.alterTable(table, (builder: Knex.TableBuilder) => {
      builder.text('description').alter();
    });
  }
};

export const down = async (knex: Knex): Promise<void> => {
  for (const table of tables) {
    await knex.schema.alterTable(table, (builder: Knex.TableBuilder) => {
      builder.string('description').alter();
    });
  }
};
