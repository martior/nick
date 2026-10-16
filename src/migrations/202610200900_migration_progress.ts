/**
 * Migration progress migration: the cursor of batched data migrations, so
 * an interrupted data migration resumes after its last committed batch.
 * @module migration/migration_progress
 */

// Type imports
import type { Knex } from 'knex';

export const up = async (knex: Knex): Promise<void> => {
  await knex.schema.createTable(
    'migration_progress',
    (table: Knex.TableBuilder) => {
      table.string('name', 255).primary();
      table.jsonb('cursor');
      table.integer('batches').notNullable().defaultTo(0);
      table.boolean('done').notNullable().defaultTo(false);
      table.dateTime('updated').notNullable().defaultTo(knex.fn.now());
    },
  );
};

export const down = async (knex: Knex): Promise<void> => {
  await knex.schema.dropTable('migration_progress');
};
