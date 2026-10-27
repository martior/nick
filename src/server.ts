/**
 * Server: the API and the worker in one process, without migrating.
 * Use `nick --modules=...` (scripts/nick.ts) to choose the modules.
 * @module server
 */

// Internal imports
import { run } from './helpers/modules/modules';

await run(['api', 'worker']);
