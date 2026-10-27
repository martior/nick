/**
 * Modules helper: run the parts of Nick in one process or split them over
 * several (`nick --modules=api,worker,migrate`).
 * @module helpers/modules/modules
 */

// External imports
import type { Server } from 'node:http';

// Internal imports
import config from '../config/config';
import { describeSchema, diffSchema, readSnapshot } from '../drift/drift';
import { initI18n } from '../i18n/i18n';
import jobs from '../jobs/jobs';
import { knex } from '../knex/knex';
import { log } from '../log/log';
import { migrate } from '../migrate/migrate';
import { initProfiles } from '../profiles/profiles';
import scheduledJobs from '../../scheduled_jobs';

export const allModules = ['migrate', 'api', 'worker'];

/**
 * Parse the modules from the command line arguments or NICK_MODULES
 * @method parseModules
 * @param {string[]} args Command line arguments.
 * @param {string} env Value of NICK_MODULES.
 * @returns {string[]} Modules in the order they start.
 */
export function parseModules(
  args: string[],
  env: string | undefined = process.env.NICK_MODULES,
): string[] {
  let value: string | undefined = env;
  args.forEach((arg, index) => {
    if (arg.startsWith('--modules=')) {
      value = arg.substring('--modules='.length);
    } else if (arg === '--modules') {
      value = args[index + 1];
    }
  });
  if (!value || value === 'all') {
    return allModules;
  }
  const modules = value
    .split(',')
    .map((module) => module.trim())
    .filter((module) => module !== '');
  const unknown = modules.filter((module) => !allModules.includes(module));
  if (unknown.length > 0 || modules.length === 0) {
    throw new Error(
      `Unknown module(s): ${unknown.join(', ')}. Use any of ${allModules.join(', ')}.`,
    );
  }
  return allModules.filter((module) => modules.includes(module));
}

/**
 * Options of the modules.
 */
export interface ModuleOptions {
  /** Compare the schema with this snapshot after migrating. */
  checkSchema?: string;
}

/**
 * Parse the options from the command line arguments
 * @method parseOptions
 * @param {string[]} args Command line arguments.
 * @returns {ModuleOptions} Options.
 */
export function parseOptions(args: string[]): ModuleOptions {
  const options: ModuleOptions = {};
  args.forEach((arg) => {
    if (arg === '--check-schema') {
      options.checkSchema = 'src/migrations/schema.snapshot.txt';
    } else if (arg.startsWith('--check-schema=')) {
      options.checkSchema = arg.substring('--check-schema='.length);
    }
  });
  return options;
}

/**
 * Compare the schema of the database with a snapshot
 * @method checkSchema
 * @param {string} snapshot Snapshot file.
 * @returns {Promise<boolean>} True if the schema matches.
 */
export async function checkSchema(snapshot: string): Promise<boolean> {
  const expected = readSnapshot(snapshot);
  if (expected.length === 0) {
    log.error(`Schema check: no snapshot at ${snapshot}`);
    return false;
  }
  const diff = diffSchema(expected, await describeSchema(knex));
  if (diff.length > 0) {
    log.error(
      `Schema check: the schema differs from ${snapshot} (- snapshot only, + database only):\n${diff.join('\n')}`,
    );
    return false;
  }
  log.info(`Schema check: the schema matches ${snapshot}`);
  return true;
}

/**
 * Start the API
 * @method startApi
 * @returns {Promise<Server>} The HTTP server.
 */
export async function startApi(): Promise<Server> {
  const { default: app } = await import('../../app');
  return await new Promise((resolve) => {
    const { host, port } = config.settings;
    const listening = () => {
      log.info(
        `Server listening on ${host ? `${host}:${port}` : `port ${port}`}`,
      );
      resolve(server);
    };

    // Listen on all interfaces unless a host is configured, like 127.0.0.1
    // behind a reverse proxy
    const server = host
      ? app.listen(port, host, listening)
      : app.listen(port, listening);
  });
}

/**
 * Start the worker: run queued jobs and schedule periodic jobs
 * @method startWorker
 * @returns {Promise<void>} Resolves when started.
 */
export async function startWorker(): Promise<void> {
  await initProfiles();
  initI18n();
  jobs.start();
  await scheduledJobs.start();
  log.info(
    `Worker ${jobs.id} started (${config.settings.jobs.isolation} jobs)`,
  );
}

/**
 * Run modules. Migrate runs first and must succeed before the other
 * modules start. With only migrate, the process ends when it is done.
 * @method run
 * @param {string[]} modules Modules to run.
 * @param {ModuleOptions} options Options.
 * @returns {Promise<number | undefined>} Exit code, or undefined if the
 * process keeps running.
 */
export async function run(
  modules: string[],
  options: ModuleOptions = {},
): Promise<number | undefined> {
  if (modules.includes('migrate')) {
    try {
      await migrate();
      log.info('Migrate done');
    } catch (err: any) {
      log.error(`Migrate failed: ${err?.stack || err}`);
      console.error(err);
      await knex.destroy();
      return 1;
    }
    if (options.checkSchema && !(await checkSchema(options.checkSchema))) {
      await knex.destroy();
      return 1;
    }
    if (modules.length === 1) {
      await knex.destroy();
      return 0;
    }
  }

  // Start the other modules
  let server: Server | undefined;
  if (modules.includes('api')) {
    server = await startApi();
  }
  if (modules.includes('worker')) {
    await startWorker();
  }

  // Stop gracefully: stop accepting requests and jobs, finish running ones
  let stopping = false;
  const stop = async (signal: string) => {
    if (stopping) {
      return;
    }
    stopping = true;
    log.info(`${signal} received, stopping`);
    scheduledJobs.stop();
    await Promise.all([
      server
        ? new Promise((resolve) => server.close(() => resolve(undefined)))
        : undefined,
      jobs.stop(),
    ]);
    await knex.destroy();
    process.exit(0);
  };
  process.on('SIGTERM', () => stop('SIGTERM'));
  process.on('SIGINT', () => stop('SIGINT'));
  return undefined;
}
