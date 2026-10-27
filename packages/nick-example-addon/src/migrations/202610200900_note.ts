/**
 * Note migration: the note table in the add-on's own schema (`example`,
 * declared in package.json and created by Nick before migrating).
 * @module migrations/note
 */

// Type imports
import type { Knex } from '@plone/nick';

export const up = async (knex: Knex): Promise<void> => {
  await knex.schema
    .withSchema('example')
    .createTable('note', (table: Knex.TableBuilder) => {
      table.increments('id').primary();
      table.uuid('document').notNullable().index();
      table.text('text').notNullable();
      table.string('author');
      table.dateTime('created').notNullable().defaultTo(knex.fn.now());
    });
};

export const down = async (knex: Knex): Promise<void> => {
  await knex.schema.withSchema('example').dropTable('note');
};
