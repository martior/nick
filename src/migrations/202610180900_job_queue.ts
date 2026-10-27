/**
 * Job queue migration: attempts, leases, backoff and idempotency keys.
 * @module migration/job_queue
 */

// Type imports
import type { Knex } from 'knex';

export const up = async (knex: Knex): Promise<void> => {
  await knex.schema.alterTable('job', (table: Knex.TableBuilder) => {
    table.integer('attempts').notNullable().defaultTo(0);
    table.integer('max_attempts').notNullable().defaultTo(3);
    table.dateTime('run_after');
    table.string('locked_by');
    table.dateTime('locked_until');
    table.string('key');
  });

  // One job per idempotency key
  await knex.raw(
    'CREATE UNIQUE INDEX job_key_unique ON job (key) WHERE key IS NOT NULL',
  );

  // Claim queries look up queued jobs by status, oldest first
  await knex.raw('CREATE INDEX job_status_created ON job (status, created)');

  // Jobs that were running when the old process stopped get retried
  await knex('job')
    .where({ status: 'started' })
    .update({ locked_until: knex.fn.now() });
};

export const down = async (knex: Knex): Promise<void> => {
  await knex.raw('DROP INDEX IF EXISTS job_status_created');
  await knex.raw('DROP INDEX IF EXISTS job_key_unique');
  await knex.schema.alterTable('job', (table: Knex.TableBuilder) => {
    table.dropColumn('attempts');
    table.dropColumn('max_attempts');
    table.dropColumn('run_after');
    table.dropColumn('locked_by');
    table.dropColumn('locked_until');
    table.dropColumn('key');
  });
};
