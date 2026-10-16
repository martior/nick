/**
 * A jobs helper: a job queue in the job table.
 *
 * Workers claim the oldest queued job with SELECT ... FOR UPDATE SKIP LOCKED
 * and hold a lease on it that a heartbeat renews while the job runs. Jobs
 * whose lease expires (a crashed worker) are queued again. Failed jobs are
 * retried with exponential backoff until max_attempts, then marked failed.
 * @module helpers/jobs/jobs
 */

// Type imports
import type { Knex } from 'knex';

// External imports
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import { omit } from 'es-toolkit/object';
import { fork } from 'node:child_process';
import { hostname } from 'node:os';
import { fileURLToPath } from 'node:url';
import { v4 as uuid } from 'uuid';

// Internal imports
import config from '../config/config';
import { log } from '../log/log';
import { Model } from '../../models/_model/_model';

dayjs.extend(utc);

const jobScript = fileURLToPath(
  import.meta.resolve('@plone/nick/scripts/job.ts'),
);

/**
 * Options when adding a job.
 */
export interface JobOptions {
  // Idempotency key: a second job with the same key is not added
  key?: string;
  // Maximum number of attempts
  maxAttempts?: number;
}

/**
 * A running job.
 */
interface RunningJob {
  controller: AbortController;
  child?: any;
}

/**
 * Get the error message of an error
 * @method errorMessage
 * @param {any} err Error object.
 * @returns {string} Error message.
 */
function errorMessage(err: any): string {
  if (err instanceof Error) {
    return err.message;
  }
  if (typeof err === 'string') {
    return err;
  }
  return JSON.stringify(err?.message || err);
}

/**
 * A job helper.
 * @class Jobs
 */
class Jobs {
  public id: string;
  public active: boolean;
  public running: { [uuid: string]: RunningJob };
  public draining: Promise<void> | undefined;
  public again: boolean;
  public timer: any;
  static instance: Jobs;

  /**
   * Construct a Jobs helper.
   * @constructs Jobs
   */
  constructor() {
    this.id = `${hostname()}:${process.pid}`;
    this.active = false;
    this.running = {};
    this.draining = undefined;
    this.again = false;
    this.timer = undefined;

    if (!Jobs.instance) {
      Jobs.instance = this;
    }

    return Jobs.instance;
  }

  /**
   * Get the knex instance or transaction to use for queue queries.
   * @method db
   * @returns {Knex} Knex instance.
   */
  db(): Knex {
    return Model.knex();
  }

  /**
   * Add a job. It is queued when the transaction commits.
   * @method add
   * @param {string} title Title of the job.
   * @param {string} description Description of the job.
   * @param {any} params Parameters of the job.
   * @param {string} actor User id of the actor.
   * @param {Knex.Transaction} trx Transaction object.
   * @param {JobOptions} options Options.
   * @returns {Promise<string>} Uuid of the (existing) job.
   */
  async add(
    title: string,
    description: string,
    params: any,
    actor: string,
    trx: Knex.Transaction | undefined,
    options: JobOptions = {},
  ): Promise<string> {
    const newUuid = uuid();
    const created = dayjs.utc().format();
    const db = trx || this.db();

    // Insert the job, unless a job with the same key exists
    const insert = db('job').insert({
      uuid: newUuid,
      title,
      description,
      params,
      actor,
      created,
      started: null,
      finished: null,
      status: 'created',
      result: {},
      key: options.key || null,
      max_attempts: options.maxAttempts || config.settings.jobs.maxAttempts,
    });
    const inserted = await db.raw(
      '? on conflict (key) where key is not null do nothing returning uuid',
      [insert],
    );
    if (inserted.rows.length === 0) {
      const existing = await db('job')
        .select('uuid')
        .where({ key: options.key })
        .first();
      return existing.uuid;
    }

    // Look for work when the transaction is committed, so the job sees the data
    if (trx?.executionPromise) {
      trx.executionPromise.then(
        () => jobs.check(),
        () => undefined,
      );
    } else {
      jobs.check();
    }

    return newUuid;
  }

  /**
   * Queue jobs whose lease expired again, or fail them if they used up their
   * attempts.
   * @method reap
   * @param {Knex} db Knex instance or transaction.
   * @returns {Promise<number>} Number of jobs queued again or failed.
   */
  async reap(db: Knex = this.db()): Promise<number> {
    const failed = await db('job')
      .where({ status: 'started' })
      .where('locked_until', '<', db.fn.now())
      .whereRaw('attempts >= max_attempts')
      .update({
        status: 'failed',
        finished: db.fn.now(),
        locked_by: null,
        locked_until: null,
        result: { error: 'The worker running the job stopped.' },
      });
    const retried = await db('job')
      .where({ status: 'started' })
      .where('locked_until', '<', db.fn.now())
      .whereRaw('attempts < max_attempts')
      .update({
        status: 'created',
        locked_by: null,
        locked_until: null,
        run_after: db.fn.now(),
        result: { error: 'The worker running the job stopped.' },
      });
    if (failed + retried > 0) {
      log.warn(
        `Jobs with an expired lease: ${retried} queued again, ${failed} failed`,
      );
    }
    return failed + retried;
  }

  /**
   * Build the query selecting the next job to run, oldest first.
   * @method nextJobQuery
   * @param {Knex} db Knex instance or transaction.
   * @returns {Knex.QueryBuilder} Query builder.
   */
  nextJobQuery(db: Knex): Knex.QueryBuilder {
    return db('job')
      .select('uuid')
      .where({ status: 'created' })
      .where((query) =>
        query.whereNull('run_after').orWhere('run_after', '<=', db.fn.now()),
      )
      .orderBy([
        { column: 'created', order: 'asc' },
        { column: 'uuid', order: 'asc' },
      ])
      .limit(1)
      .forUpdate()
      .skipLocked();
  }

  /**
   * Claim the oldest queued job and take a lease on it.
   * @method claim
   * @param {Knex} db Knex instance or transaction.
   * @returns {Promise<any>} The claimed job row or undefined.
   */
  async claim(db: Knex = this.db()): Promise<any> {
    const [job] = await db('job')
      .whereIn('uuid', this.nextJobQuery(db))
      .update({
        status: 'started',
        started: db.fn.now(),
        finished: null,
        attempts: db.raw('attempts + 1'),
        locked_by: this.id,
        locked_until: db.raw(`now() + make_interval(secs => ?)`, [
          config.settings.jobs.lease,
        ]),
      })
      .returning('*');
    return job;
  }

  /**
   * Renew the lease of a running job.
   * @method heartbeat
   * @param {string} jobUuid Uuid of the job.
   * @param {Knex} db Knex instance or transaction.
   * @returns {Promise<boolean>} True if this worker still holds the lease.
   */
  async heartbeat(jobUuid: string, db: Knex = this.db()): Promise<boolean> {
    const updated = await db('job')
      .where({ uuid: jobUuid, locked_by: this.id, status: 'started' })
      .update({
        locked_until: db.raw(`now() + make_interval(secs => ?)`, [
          config.settings.jobs.lease,
        ]),
      });
    return updated > 0;
  }

  /**
   * Mark a job as completed, if this worker still holds the lease.
   * @method complete
   * @param {string} jobUuid Uuid of the job.
   * @param {any} result Result of the job.
   * @param {Knex} db Knex instance or transaction.
   * @returns {Promise<boolean>} True if the job was marked as completed.
   */
  async complete(jobUuid: string, result: any, db: Knex): Promise<boolean> {
    const updated = await db('job')
      .where({ uuid: jobUuid, locked_by: this.id, status: 'started' })
      .update({
        status: 'completed',
        finished: db.fn.now(),
        locked_by: null,
        locked_until: null,
        result: result ?? {},
      });
    return updated > 0;
  }

  /**
   * Record a failed attempt: queue the job again with backoff, or mark it
   * as failed when it used up its attempts.
   * @method fail
   * @param {any} job Job row.
   * @param {string} error Error message.
   * @param {Knex} db Knex instance or transaction.
   * @returns {Promise<string>} The new status.
   */
  async fail(job: any, error: string, db: Knex): Promise<string> {
    const { backoff, maxBackoff } = config.settings.jobs;
    const retry = job.attempts < job.max_attempts;
    const delay = Math.min(maxBackoff, backoff * 2 ** (job.attempts - 1));
    const status = retry ? 'created' : 'failed';
    await db('job')
      .where({ uuid: job.uuid, locked_by: this.id, status: 'started' })
      .update({
        status,
        finished: retry ? null : db.fn.now(),
        locked_by: null,
        locked_until: null,
        run_after: retry
          ? db.raw(`now() + make_interval(secs => ?)`, [delay])
          : null,
        result: { error, attempts: job.attempts },
      });
    log.error(
      `Job ${job.uuid} (${job.title}) failed in attempt ${job.attempts}: ${error}${
        retry ? `, retrying in ${delay}s` : ''
      }`,
    );
    return status;
  }

  /**
   * Run a job in a child process.
   * @method runInProcess
   * @param {any} job Job row.
   * @param {RunningJob} running Running job info.
   * @returns {Promise<any>} Result of the job.
   */
  runInProcess(job: any, running: RunningJob): Promise<any> {
    return new Promise((resolve, reject) => {
      const child = fork(jobScript, [], {
        execArgv: ['--import', 'tsx'],
      });
      running.child = child;
      running.controller.signal.addEventListener('abort', () => child.kill());
      child.on('message', (data: any) =>
        data?.error !== undefined
          ? reject(new Error(errorMessage(data.error)))
          : resolve(data?.result),
      );
      child.on('exit', (code: number) =>
        reject(new Error(`The job process exited with code ${code}.`)),
      );
      child.send({ ...job.params, actor: job.actor });
    });
  }

  /**
   * Run a claimed job and record the outcome.
   * @method run
   * @param {any} job Job row.
   * @param {Knex} db Knex instance or transaction.
   * @returns {Promise<string>} The new status of the job.
   */
  async run(job: any, db: Knex = this.db()): Promise<string> {
    const running: RunningJob = { controller: new AbortController() };
    this.running[job.uuid] = running;

    // Renew the lease while the job runs; abort it when the lease is lost
    const heartbeat = setInterval(
      async () => {
        try {
          if (!(await this.heartbeat(job.uuid, db))) {
            running.controller.abort();
          }
        } catch (err) {
          log.error(
            `Heartbeat of job ${job.uuid} failed: ${errorMessage(err)}`,
          );
        }
      },
      Math.max(1, config.settings.jobs.lease / 3) * 1000,
    );
    heartbeat.unref?.();

    try {
      // Run the job in a child process
      if (config.settings.jobs.isolation === 'process') {
        const result = await this.runInProcess(job, running);
        if (!(await this.complete(job.uuid, result, db))) {
          log.warn(`Job ${job.uuid} finished after it lost its lease`);
          return 'lost';
        }
        return 'completed';
      }

      // Run the job in its own transaction, together with its completion
      const trx = await db.transaction();
      try {
        const result = await this.execute(job, trx, running);
        if (running.controller.signal.aborted) {
          throw new Error('The job was aborted.');
        }
        if (!(await this.complete(job.uuid, result, trx))) {
          await trx.rollback();
          log.warn(`Job ${job.uuid} finished after it lost its lease`);
          return 'lost';
        }
        await trx.commit();
        return 'completed';
      } catch (err) {
        if (!trx.isCompleted()) {
          await trx.rollback();
        }
        throw err;
      }
    } catch (err) {
      return await this.fail(job, errorMessage(err), db);
    } finally {
      clearInterval(heartbeat);
      delete this.running[job.uuid];
    }
  }

  /**
   * Execute a job in this process.
   * @method execute
   * @param {any} job Job row.
   * @param {Knex.Transaction} trx Transaction object.
   * @param {RunningJob} running Running job info.
   * @returns {Promise<any>} Result of the job.
   */
  async execute(
    job: any,
    trx: Knex.Transaction,
    running: RunningJob,
  ): Promise<any> {
    const params = job.params || {};

    // Run a registered action
    if (params.action) {
      const { default: scheduledJobs } = await import('../../scheduled_jobs');
      const action = scheduledJobs.getAction(params.action);
      if (!action) {
        throw new Error(`Unknown job action ${params.action}.`);
      }
      return {
        result: await action.handler(
          omit(params, ['scheduled_job', 'action']),
          job.actor || 'admin',
          trx,
          { job: job.uuid, signal: running.controller.signal },
        ),
      };
    }

    // Call an API method through the client
    const { Client } = await import('../../client');
    const cli = Client.initialize({ apiPath: config.settings.jobs.apiPath });
    if (!cli[params.method]) {
      throw new Error(`Unknown job method ${params.method}.`);
    }
    const result = await cli[params.method](
      omit(
        {
          ...params,
          params: {
            ...params.params,
            job: true,
          },
        },
        ['method'],
      ),
    );
    return { result: result.data };
  }

  /**
   * Run queued jobs until the queue is empty.
   * @method work
   * @returns {Promise<void>} Resolves when the queue is empty.
   */
  work(): Promise<void> {
    // Look again when the queue is already being drained
    if (this.draining) {
      this.again = true;
      return this.draining;
    }

    this.draining = (async () => {
      const db = this.db();
      try {
        do {
          this.again = false;
          await this.reap(db);
          for (
            let job = await this.claim(db);
            job;
            job = await this.claim(db)
          ) {
            await this.run(job, db);
          }
        } while (this.again);
      } catch (err) {
        log.error(`Job queue error: ${errorMessage(err)}`);
      } finally {
        this.draining = undefined;
      }
    })();
    return this.draining;
  }

  /**
   * Look for queued jobs if this process runs a worker.
   * @method check
   * @returns {Promise<void>} Resolves when done.
   */
  async check(): Promise<void> {
    if (this.active) {
      await this.work();
    }
  }

  /**
   * Start working: poll the queue.
   * @method start
   * @returns {void}
   */
  start(): void {
    if (this.active) {
      return;
    }
    this.active = true;
    const poll = async () => {
      await this.work();
      if (this.active) {
        this.timer = setTimeout(poll, config.settings.jobs.pollInterval * 1000);
      }
    };
    poll();
  }

  /**
   * Stop working. Running jobs finish first.
   * @method stop
   * @returns {Promise<void>} Resolves when the running jobs are finished.
   */
  async stop(): Promise<void> {
    this.active = false;
    clearTimeout(this.timer);
    await this.draining;
  }

  /**
   * Abort a job.
   * @method abort
   * @param {string} jobUuid The uuid of the job
   * @param {Knex} db Knex instance or transaction.
   * @returns {Promise<void>} Resolves when done.
   */
  async abort(jobUuid: string, db: Knex = this.db()): Promise<void> {
    // Stop the job if it runs in this process
    const running = this.running[jobUuid];
    running?.controller.abort();

    // Mark it as aborted
    await db('job')
      .where({ uuid: jobUuid })
      .whereIn('status', ['created', 'started'])
      .update({
        status: 'aborted',
        finished: db.fn.now(),
        locked_by: null,
        locked_until: null,
      });
  }
}

// Create an instance of the Jobs helper
const jobs = new Jobs();

// Export the instance
export default jobs;
