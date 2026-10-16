/**
 * Runtime registration of the example add-on.
 * @module profiles/default
 */

// External imports
import {
  behaviors,
  models,
  registerDataMigration,
  routes,
  scheduledJobs,
} from '@plone/nick';

// Internal imports
import { rating } from '../../behaviors/rating/rating';
import { noteWords } from '../../migrations/202610200910_note_words';
import { Note } from '../../models/note/note';
import notesRoutes from '../../routes/notes/notes';
import { purgeNotes } from '../../scheduled_jobs/actions/purge_notes';

export function init(): void {
  // Model of the add-on's own table
  models.register('ExampleNote', () => Note);

  // Code half of the example_rating behavior
  behaviors.register('example_rating', rating);

  // REST services: @notes and @rating
  routes.register(notesRoutes);

  // Periodic task: purge the notes of deleted documents every night
  scheduledJobs.registerAction('example_purge_notes', purgeNotes);
  scheduledJobs.registerTask({
    id: 'example-purge-notes',
    title: 'Purge notes',
    description: 'Remove the notes of deleted documents',
    schedule: '0 3 * * *',
    action: 'example_purge_notes',
  });

  // The word count data migration can also run on the job queue
  registerDataMigration(noteWords);
}
