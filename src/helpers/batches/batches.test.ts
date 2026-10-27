/**
 * Batches helper tests.
 * @module helpers/batches/batches.test
 */

// External imports
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Internal imports
import jobs from '../jobs/jobs';
import {
  dataMigrationProgress,
  migrateInBatches,
  queueDataMigration,
  registerDataMigration,
} from './batches';
import type { DataMigration } from './batches';

declare global {
  var failBatch: number | undefined;
}

// Doubles the values of the batch_test table, two rows per batch
const double: DataMigration<number> = {
  name: 'test:double',
  batch: async (trx, cursor) => {
    const rows = await trx('batch_test')
      .where('id', '>', cursor || 0)
      .orderBy('id')
      .limit(2);
    if (globalThis.failBatch && rows[0]?.id === globalThis.failBatch) {
      throw new Error('Broken batch');
    }
    for (const row of rows) {
      await trx('batch_test')
        .where({ id: row.id })
        .update({ value: row.value * 2 });
    }
    return rows.length === 2 ? rows[1].id : undefined;
  },
};

/**
 * Get the values of the batch_test table
 * @method values
 * @returns {Promise<number[]>} Values.
 */
const values = async (): Promise<number[]> =>
  (await global.txn!('batch_test').orderBy('id')).map((row: any) => row.value);

describe('Batches', () => {
  beforeEach(async () => {
    await global.txn!.raw(
      'create temporary table batch_test (id serial primary key, value integer) on commit drop',
    );
    await global.txn!('batch_test').insert(
      [1, 2, 3, 4, 5].map((value) => ({ value })),
    );
    registerDataMigration(double);
  });

  afterEach(() => {
    globalThis.failBatch = undefined;
    vi.restoreAllMocks();
  });

  it('should run batches, resume after a failure and not run twice', async () => {
    globalThis.failBatch = 3;
    await expect(migrateInBatches(double, global.txn!)).rejects.toThrow(
      'Broken batch',
    );
    expect(await values()).toEqual([2, 4, 3, 4, 5]);
    expect(await dataMigrationProgress(double.name, global.txn!)).toMatchObject(
      { cursor: 2, batches: 1, done: false },
    );

    globalThis.failBatch = undefined;
    expect(await migrateInBatches(double, global.txn!)).toBe(2);
    expect(await values()).toEqual([2, 4, 6, 8, 10]);
    expect(await dataMigrationProgress(double.name, global.txn!)).toMatchObject(
      { batches: 3, done: true },
    );

    // Done: nothing runs again
    expect(await migrateInBatches(double, global.txn!)).toBe(0);
    expect(await values()).toEqual([2, 4, 6, 8, 10]);
  });

  it('should run a data migration on the job queue and resume on retry', async () => {
    vi.spyOn(jobs, 'check').mockResolvedValue(undefined);
    const id = await queueDataMigration(double.name, global.txn!);
    expect(await queueDataMigration(double.name, global.txn!)).toBe(id);
    const job = await global.txn!('job').where({ uuid: id }).first();
    expect(job.params).toEqual({ data_migration: double.name });
    const running = { controller: new AbortController() };

    // The first attempt fails in the second batch; the first batch is kept
    globalThis.failBatch = 3;
    await expect(jobs.execute(job, global.txn!, running)).rejects.toThrow(
      'Broken batch',
    );
    expect(await values()).toEqual([2, 4, 3, 4, 5]);

    // The retry resumes after the first batch
    globalThis.failBatch = undefined;
    expect(await jobs.execute(job, global.txn!, running)).toEqual({
      result: { batches: 3, done: true },
    });
    expect(await values()).toEqual([2, 4, 6, 8, 10]);

    // An aborted job stops between batches
    await global.txn!('migration_progress').delete();
    running.controller.abort();
    await expect(jobs.execute(job, global.txn!, running)).rejects.toThrow();
    expect(await values()).toEqual([2, 4, 6, 8, 10]);
  });
});
