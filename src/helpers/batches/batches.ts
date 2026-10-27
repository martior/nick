/**
 * Batches helper: data migrations which run in batches, commit each batch
 * and resume after the last committed batch, inline (in a migration or an
 * upgrade step) or in the background on the job queue.
 * @module helpers/batches/batches
 */

// Type imports
import type { Knex } from 'knex';

// Internal imports
import jobs from '../jobs/jobs';
import { knex } from '../knex/knex';
import { log } from '../log/log';

/**
 * Process one batch. Gets the cursor the previous batch returned (undefined
 * for the first batch) and returns the cursor for the next batch, or
 * undefined (or null) when there is nothing left to do.
 */
export type BatchHandler<C = any> = (
  trx: Knex.Transaction,
  cursor: C | undefined,
) => Promise<C | undefined | null>;

/**
 * A data migration.
 */
export interface DataMigration<C = any> {
  /** Unique name, like `<package>:<migration>`. */
  name: string;
  /** Process one batch. */
  batch: BatchHandler<C>;
}

/**
 * Progress of a data migration.
 */
export interface DataMigrationProgress {
  name: string;
  cursor: any;
  batches: number;
  done: boolean;
}

// Registered data migrations, for the job queue
const registry: { [name: string]: DataMigration } = {};

/**
 * Register a data migration, so a worker can run it from the job queue.
 * Call it in the `init()` of a profile.
 * @method registerDataMigration
 * @param {DataMigration} migration The data migration.
 */
export function registerDataMigration(migration: DataMigration): void {
  registry[migration.name] = migration;
}

/**
 * Get a registered data migration.
 * @method getDataMigration
 * @param {string} name Name of the data migration.
 * @returns {DataMigration | undefined} The data migration.
 */
export function getDataMigration(name: string): DataMigration | undefined {
  return registry[name];
}

/**
 * Get the progress of a data migration.
 * @method dataMigrationProgress
 * @param {string} name Name of the data migration.
 * @param {Knex} db Knex instance or transaction.
 * @returns {Promise<DataMigrationProgress | undefined>} Progress.
 */
export async function dataMigrationProgress(
  name: string,
  db: Knex = knex,
): Promise<DataMigrationProgress | undefined> {
  return await db('migration_progress').where({ name }).first();
}

/**
 * Run a data migration in batches. Every batch runs in its own transaction
 * together with its cursor, so after a failure the next call resumes after
 * the last committed batch; a finished migration is not run again. Use it
 * in a knex migration with `export const config = { transaction: false }`,
 * otherwise the whole migration is one transaction.
 * @method migrateInBatches
 * @param {DataMigration} migration The data migration.
 * @param {Knex} db Knex instance (or transaction) to start transactions on.
 * @param {AbortSignal} signal Stops between batches when aborted.
 * @returns {Promise<number>} Number of batches run by this call.
 */
export async function migrateInBatches<C = any>(
  migration: DataMigration<C>,
  db: Knex = knex,
  signal?: AbortSignal,
): Promise<number> {
  let batches = 0;
  for (;;) {
    signal?.throwIfAborted();
    const done = await db.transaction(async (trx) => {
      const progress = await trx('migration_progress')
        .where({ name: migration.name })
        .forUpdate()
        .first();
      if (progress?.done) {
        return true;
      }
      const next = await migration.batch(trx, progress?.cursor ?? undefined);
      const finished = next === undefined || next === null;
      await trx('migration_progress')
        .insert({
          name: migration.name,
          cursor: JSON.stringify(finished ? null : next),
          batches: (progress?.batches || 0) + 1,
          done: finished,
          updated: trx.fn.now(),
        })
        .onConflict('name')
        .merge();
      batches++;
      return finished;
    });
    if (done) {
      return batches;
    }
  }
}

/**
 * Queue a registered data migration on the job queue. A worker runs it in
 * batches; when the worker stops or fails, the job is retried and resumes
 * after the last committed batch. Queueing it again while it is queued or
 * running does nothing.
 * @method queueDataMigration
 * @param {string} name Name of the registered data migration.
 * @param {Knex.Transaction} trx Transaction (the job is queued on commit).
 * @returns {Promise<string>} Uuid of the job.
 */
export async function queueDataMigration(
  name: string,
  trx?: Knex.Transaction,
): Promise<string> {
  return await jobs.add(
    `Data migration ${name}`,
    `Run the data migration ${name} in batches`,
    { data_migration: name },
    'admin',
    trx,
    { key: `data_migration:${name}` },
  );
}

/**
 * Run a registered data migration from the job queue. The batches run in
 * their own transactions, not in the job's, so they are kept when the job
 * fails and the retry resumes after them.
 * @method runDataMigration
 * @param {string} name Name of the data migration.
 * @param {AbortSignal} signal Signal of the job.
 * @returns {Promise<any>} Result of the job.
 */
export async function runDataMigration(
  name: string,
  signal?: AbortSignal,
): Promise<any> {
  const migration = getDataMigration(name);
  if (!migration) {
    throw new Error(`Unknown data migration ${name}.`);
  }
  const db = jobs.db();
  const batches = await migrateInBatches(migration, db, signal);
  log.info(`Data migration ${name} done (${batches} batches)`);
  const progress = await dataMigrationProgress(name, db);
  return { batches: progress?.batches || batches, done: true };
}
