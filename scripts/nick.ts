#!/usr/bin/env -S node --import tsx
/* eslint no-console: 0 */
/**
 * Nick command line: nick [--modules=migrate,api,worker]
 * @module scripts/nick
 */

// Internal imports
import { parseModules, run } from '../src/helpers/modules/modules';

let modules: string[];
try {
  modules = parseModules(process.argv.slice(2));
} catch (err: any) {
  console.error(err.message);
  process.exit(2);
}

// Run the modules; exit when they are done (migrate only)
const code = await run(modules);
if (code !== undefined) {
  process.exit(code);
}
