/**
 * Note words migration: a schema change and a batched data migration. The
 * migration runs without a wrapping transaction, so every batch commits
 * on its own and an interrupted run resumes after the last batch.
 * @module migrations/note_words
 */

// Type imports
import type { DataMigration, Knex } from '@plone/nick';

// External imports
import { migrateInBatches } from '@plone/nick';

// Internal imports
import { countWords } from '../routes/notes/notes';

// Each batch commits on its own
export const config = { transaction: false };

// Number of notes per batch
export const batchSize = 100;

/**
 * Fill in the word count of the notes, in batches by id.
 * @constant noteWords
 */
export const noteWords: DataMigration<number> = {
  name: '@plone/nick-example-addon:note_words',
  batch: async (trx, cursor) => {
    const notes = await trx('example.note')
      .select('id', 'text')
      .where('id', '>', cursor || 0)
      .orderBy('id')
      .limit(batchSize);
    for (const note of notes) {
      await trx('example.note')
        .where({ id: note.id })
        .update({ words: countWords(note.text) });
    }
    return notes.length === batchSize ? notes[notes.length - 1].id : undefined;
  },
};

export const up = async (knex: Knex): Promise<void> => {
  // Schema change; safe to run again when resuming
  if (!(await knex.schema.withSchema('example').hasColumn('note', 'words'))) {
    await knex.schema
      .withSchema('example')
      .alterTable('note', (table: Knex.TableBuilder) => {
        table.integer('words');
      });
  }

  // Data migration in batches
  await migrateInBatches(noteWords, knex);
};

export const down = async (knex: Knex): Promise<void> => {
  await knex.schema
    .withSchema('example')
    .alterTable('note', (table: Knex.TableBuilder) => {
      table.dropColumn('words');
    });
  await knex('migration_progress').where({ name: noteWords.name }).delete();
};
