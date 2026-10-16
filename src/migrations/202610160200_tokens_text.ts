/**
 * Tokens text migration.
 * @module migration/tokens_text
 */

// Type imports
import type { Knex } from 'knex';

export const up = async (knex: Knex): Promise<void> => {
  await knex.raw('ALTER TABLE "user" ALTER COLUMN "tokens" TYPE text[]');
};

export const down = async (knex: Knex): Promise<void> => {
  await knex.raw(
    'ALTER TABLE "user" ALTER COLUMN "tokens" TYPE character varying(255)[]',
  );
};
