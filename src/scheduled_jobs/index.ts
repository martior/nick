/**
 * A scheduled jobs registry.
 * @module scheduled_jobs
 */

// Type imports
import type { Knex } from 'knex';
import type {
  Request,
  ScheduledJobAction,
  ScheduledJobActions,
  ScheduledJobActionJson,
} from '../types';

// External imports
import cron from 'node-cron';

// Internal imports
import config from '../helpers/config/config';
import { stripI18n } from '../helpers/i18n/i18n';
import { translateSchema } from '../helpers/schema/schema';
import jobs from '../helpers/jobs/jobs';
import { log } from '../helpers/log/log';
import models from '../models';

/**
 * A scheduled job registry.
 * @class ScheduledJobs
 */
class ScheduledJobs {
  public actions: ScheduledJobActions;
  public tasks: any[];
  public active: boolean;
  public signature: string;
  public timer: any;
  static instance: ScheduledJobs;

  /**
   * Construct a Scheduled Jobs registry.
   * @constructs ScheduledJobs
   */
  constructor() {
    this.actions = {};
    this.tasks = [];
    this.active = false;
    this.signature = '';
    this.timer = undefined;

    if (!ScheduledJobs.instance) {
      ScheduledJobs.instance = this;
    }

    return ScheduledJobs.instance;
  }

  /**
   * Register an action rule.
   * @param {string} name The name of the action.
   * @param {ScheduledJobAction} rule The action to register.
   */
  registerAction(name: string, rule: ScheduledJobAction) {
    this.actions[name] = rule;
  }

  /**
   * Get an action rule.
   * @param {string} name The name of the action rule.
   * @returns {ScheduledJobAction} The action rule.
   */
  getAction(name: string): ScheduledJobAction {
    return this.actions[name];
  }

  /**
   * Get a list of all actions.
   * @param {Request} req The request object.
   * @returns {ScheduledJobActionJson[]} The actions.
   */
  getActions(req: Request): ScheduledJobActionJson[] {
    const self: ScheduledJobs = this;
    return Object.entries(self.actions).map(
      ([name, action]: [string, ScheduledJobAction]) => ({
        addview: name,
        title: action.getTitle(req),
        description: action.getDescription(req),
        '@schema': translateSchema(stripI18n(action.schema), req),
      }),
    );
  }

  /**
   * Add the job of a scheduled job for a time slot. Every scheduler adds it
   * with the same key, so it is added once per slot across all workers.
   * @param {any} scheduledJob The scheduled job.
   * @param {Date} slot The time slot.
   * @returns {Promise<string>} Uuid of the job.
   */
  async addJob(scheduledJob: any, slot: Date): Promise<string> {
    return jobs.add(
      scheduledJob.title,
      scheduledJob.description,
      {
        scheduled_job: scheduledJob.id,
        action: scheduledJob.action,
        ...scheduledJob.params,
      },
      'admin',
      undefined,
      { key: `scheduled_job:${scheduledJob.id}:${slot.toISOString()}` },
    );
  }

  /**
   * Refresh all tasks if the scheduled jobs changed.
   * @param {Knex.Transaction} trx The transaction to read the scheduled jobs with.
   * @returns {Promise<void>} A promise that resolves when the tasks have been reregistered.
   */
  async refreshTasks(trx?: Knex.Transaction) {
    const self = this;

    // Read the scheduled jobs
    const ScheduledJob = models.get('ScheduledJob');
    const scheduledJobs = (await ScheduledJob.fetchAll({}, {}, trx)).models
      .filter((scheduledJob: any) => scheduledJob.enabled)
      .map((scheduledJob: any) => scheduledJob.toJSON());

    // Keep the tasks if nothing changed
    const signature = JSON.stringify(scheduledJobs);
    if (signature === self.signature) {
      return;
    }
    self.signature = signature;

    // Destroy existing tasks
    self.tasks.forEach((task) => task.destroy());
    self.tasks = [];

    // Register new tasks; they must not use the transaction, which is
    // finished when they fire
    scheduledJobs.map((scheduledJob: any) => {
      const task = cron.schedule(scheduledJob.schedule, (context) =>
        self
          .addJob(scheduledJob, context.date)
          .catch((err) =>
            log.error(
              `Scheduling job ${scheduledJob.id} failed: ${err.message}`,
            ),
          ),
      );
      self.tasks.push(task);
    });
  }

  /**
   * Refresh the tasks when a transaction is committed, if this process
   * schedules jobs.
   * @param {Knex.Transaction} trx The transaction object.
   */
  refreshTasksAfter(trx: Knex.Transaction) {
    trx.executionPromise.then(
      () => (this.active ? this.refresh() : undefined),
      () => undefined,
    );
  }

  /**
   * Refresh the tasks and log errors.
   * @returns {Promise<void>} A promise that resolves when done.
   */
  async refresh() {
    try {
      await this.refreshTasks();
    } catch (err: any) {
      log.error(`Refreshing scheduled jobs failed: ${err.message}`);
    }
  }

  /**
   * Start scheduling jobs. Only worker processes schedule jobs; they reread
   * the scheduled jobs regularly to pick up changes made through the API.
   */
  async start() {
    if (this.active) {
      return;
    }
    this.active = true;
    await this.refresh();
    this.timer = setInterval(
      () => this.refresh(),
      config.settings.jobs.refreshInterval * 1000,
    );
  }

  /**
   * Stop scheduling jobs.
   */
  stop() {
    this.active = false;
    clearInterval(this.timer);
    this.tasks.forEach((task) => task.destroy());
    this.tasks = [];
    this.signature = '';
  }
}

// Create an instance of the Scheduled Job registry
const scheduledJobs = new ScheduledJobs();

// Export the instance and all content rules
export default scheduledJobs;
