/**
 * Example add-on for Nick.
 * @module @plone/nick-example-addon
 */

export { Note } from './models/note/note';
export { rating } from './behaviors/rating/rating';
export { default as notesRoutes } from './routes/notes/notes';
export { purgeNotes } from './scheduled_jobs/actions/purge_notes';
