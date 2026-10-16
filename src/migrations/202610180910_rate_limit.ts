/**
 * Rate limit migration: counters shared by all API processes.
 * @module migration/rate_limit
 */

// Type imports
import type { Knex } from 'knex';

export const up = async (knex: Knex): Promise<void> => {
  // Unlogged: the counters need no crash safety and are written often
  await knex.raw(`
    CREATE UNLOGGED TABLE rate_limit (
      key varchar(255) PRIMARY KEY,
      hits integer NOT NULL,
      reset_time timestamptz NOT NULL
    )
  `);
};

export const down = async (knex: Knex): Promise<void> => {
  await knex.schema.dropTable('rate_limit');
};
