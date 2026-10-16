/**
 * Migration tests: a failing data migration makes migrate fail, and the
 * next run resumes after the last committed batch.
 * @module migrations/migrations.test
 */

// External imports
import { afterEach, describe, expect, it, vi } from 'vitest';

// Internal imports
import {
  dataMigrationProgress,
  migrateChain,
  migrationChains,
  MigrationSource,
  resolvePackage,
} from '@plone/nick';
import { batchSize, noteWords } from './202610200910_note_words';

const notes = 2 * batchSize + 50;

/**
 * Get the names in the ledger of the add-on
 * @method ledger
 * @returns {Promise<string[]>} Names of the migrations that ran.
 */
const ledger = async (): Promise<string[]> =>
  (
    await global.txn!('knex_migrations_plone_nick_example_addon')
      .select('name')
      .orderBy('name')
  ).map((row: any) => row.name);

describe('Example add-on migrations', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should fail on a broken batch and resume after the fix', async () => {
    const [chain] = await migrationChains([
      resolvePackage('@plone/nick-example-addon'),
    ]);
    expect(chain).toMatchObject({
      package: '@plone/nick-example-addon',
      tableName: 'knex_migrations_plone_nick_example_addon',
      schema: 'example',
    });

    // Run the schema migration only and add notes without a word count
    await global.txn!.raw('create schema if not exists example');
    await global.txn!.migrate.up({
      migrationSource: new MigrationSource(chain.directory),
      tableName: chain.tableName,
    });
    await global.txn!('example.note').insert(
      Array.from({ length: notes }, (_value, index) => ({
        document: '00000000-0000-4000-8000-000000000001',
        text: `note ${index}`,
      })),
    );

    // The third batch is broken: the migration fails
    const batch = noteWords.batch;
    let calls = 0;
    vi.spyOn(noteWords, 'batch').mockImplementation(async (trx, cursor) => {
      calls++;
      if (calls === 3) {
        throw new Error('Broken batch');
      }
      return await batch(trx, cursor);
    });
    await expect(migrateChain(chain, global.txn!)).rejects.toThrow(
      'Migration @plone/nick-example-addon:202610200910_note_words.ts failed: Broken batch',
    );

    // The first two batches are kept, the migration is not recorded
    expect(await ledger()).toEqual(['202610200900_note.ts']);
    const progress = await dataMigrationProgress(noteWords.name, global.txn!);
    expect(progress).toMatchObject({ batches: 2, done: false });
    const counted = await global.txn!('example.note').whereNotNull('words');
    expect(counted.length).toBe(2 * batchSize);

    // Fixed: the next run resumes with the third batch
    vi.restoreAllMocks();
    const resumed = vi.spyOn(noteWords, 'batch');
    expect(await migrateChain(chain, global.txn!)).toEqual([
      '202610200910_note_words.ts',
    ]);
    expect(resumed).toHaveBeenCalledTimes(1);
    expect(resumed.mock.calls[0][1]).toBe(progress!.cursor);
    expect(await ledger()).toEqual([
      '202610200900_note.ts',
      '202610200910_note_words.ts',
    ]);
    expect(
      await dataMigrationProgress(noteWords.name, global.txn!),
    ).toMatchObject({ batches: 3, done: true });
    expect((await global.txn!('example.note').whereNull('words')).length).toBe(
      0,
    );
    expect(
      (await global.txn!('example.note').where({ text: 'note 1' }).first())
        .words,
    ).toBe(2);
  });
});
