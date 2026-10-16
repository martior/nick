/**
 * Jobs helper tests.
 * @module helpers/jobs/jobs.test
 */

// External imports
import { v4 as uuid } from 'uuid';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Internal imports
import config from '../config/config';
import jobs from './jobs';
import scheduledJobs from '../../scheduled_jobs';

const first = '00000000-0000-4000-8000-000000000001';
const second = '00000000-0000-4000-8000-000000000002';

/**
 * Insert a job
 * @method insertJob
 * @param {string} id Uuid of the job.
 * @param {any} data Extra data.
 * @returns {Promise<void>} Resolves when done.
 */
const insertJob = (id: string, data: any = {}) =>
  global.txn!('job').insert({
    uuid: id,
    title: 'Test job',
    description: '',
    params: { action: 'test_job' },
    actor: 'admin',
    created: '2022-04-02T20:00:00.000Z',
    status: 'created',
    result: {},
    ...data,
  });

/**
 * Get a job
 * @method getJob
 * @param {string} id Uuid of the job.
 * @returns {Promise<any>} Job row.
 */
const getJob = (id: string) => global.txn!('job').where({ uuid: id }).first();

describe('Jobs', () => {
  const handler = vi.fn();

  beforeEach(() => {
    handler.mockReset();
    handler.mockResolvedValue({ status: 'success' });
    scheduledJobs.registerAction('test_job', {
      getTitle: () => 'Test job',
      getDescription: () => '',
      getSummary: () => '',
      schema: {},
      handler,
    });
  });

  afterEach(() => {
    delete scheduledJobs.actions.test_job;
  });

  it('should add a job once per key', async () => {
    vi.mocked(uuid).mockReturnValueOnce(first as any);
    const check = vi.spyOn(jobs, 'check').mockResolvedValue(undefined);
    const options = { key: 'test:once' };
    const params = { action: 'test_job' };
    const id = await jobs.add('A', '', params, 'admin', global.txn!, options);
    vi.mocked(uuid).mockReturnValueOnce(second as any);
    const again = await jobs.add('A', '', params, 'admin', undefined, options);
    check.mockRestore();

    expect(id).toBe(first);
    expect(again).toBe(first);
    expect(await getJob(second)).toBeUndefined();
    expect((await getJob(first)).max_attempts).toBe(
      config.settings.jobs.maxAttempts,
    );
  });

  it('should claim with skip locked', () => {
    const sql = jobs.nextJobQuery(global.txn!).toSQL().sql;
    expect(sql).toContain('for update skip locked');
  });

  it('should claim the oldest queued job first', async () => {
    await insertJob(second, { created: '2022-04-01T00:00:00.000Z' });
    await insertJob(first, { created: '2022-04-03T00:00:00.000Z' });
    await insertJob('00000000-0000-4000-8000-000000000003', {
      created: '2022-03-01T00:00:00.000Z',
      run_after: '2999-01-01T00:00:00.000Z',
    });

    const job = await jobs.claim(global.txn!);
    expect(job.uuid).toBe(second);
    expect(job.status).toBe('started');
    expect(job.attempts).toBe(1);
    expect(job.locked_by).toBe(jobs.id);
    expect(job.locked_until).not.toBeNull();
  });

  it('should run a job and record the result', async () => {
    await insertJob(first, { params: { action: 'test_job', path: '/news' } });
    await jobs.work();

    const job = await getJob(first);
    expect(job.status).toBe('completed');
    expect(job.finished).not.toBeNull();
    expect(job.locked_by).toBeNull();
    expect(job.result).toEqual({ result: { status: 'success' } });
    expect(handler).toHaveBeenCalledWith(
      { path: '/news' },
      'admin',
      expect.anything(),
      expect.objectContaining({ job: first }),
    );
  });

  it('should retry a failed job with backoff and then mark it failed', async () => {
    handler.mockRejectedValue(new Error('Boom'));
    await insertJob(first, { max_attempts: 2 });

    // The first attempt fails and is queued again after the backoff
    await jobs.work();
    let job = await getJob(first);
    expect(job.status).toBe('created');
    expect(job.attempts).toBe(1);
    expect(job.result).toEqual({ error: 'Boom', attempts: 1 });
    expect(new Date(job.run_after).getTime()).toBeGreaterThan(
      new Date(job.started).getTime(),
    );

    // Not run again before the backoff is over
    await jobs.work();
    expect((await getJob(first)).attempts).toBe(1);

    // The last attempt marks it as failed, not completed
    await global.txn!('job')
      .where({ uuid: first })
      .update({ run_after: global.txn!.raw("now() - interval '1 second'") });
    await jobs.work();
    job = await getJob(first);
    expect(job.status).toBe('failed');
    expect(job.attempts).toBe(2);
    expect(job.finished).not.toBeNull();
    expect(handler).toHaveBeenCalledTimes(2);
  });

  it('should retry a job whose worker stopped', async () => {
    const expired = global.txn!.raw("now() - interval '1 minute'");
    await insertJob(first, {
      status: 'started',
      attempts: 1,
      locked_by: 'crashed-worker',
      locked_until: expired,
    });
    await insertJob(second, {
      status: 'started',
      attempts: 3,
      max_attempts: 3,
      locked_by: 'crashed-worker',
      locked_until: expired,
    });

    await jobs.work();

    const retried = await getJob(first);
    expect(retried.status).toBe('completed');
    expect(retried.attempts).toBe(2);
    const failed = await getJob(second);
    expect(failed.status).toBe('failed');
    expect(failed.result.error).toBeDefined();
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('should not complete a job after it lost its lease', async () => {
    await insertJob(first);
    const job = await jobs.claim(global.txn!);
    await global.txn!('job')
      .where({ uuid: first })
      .update({ locked_by: 'other-worker' });

    expect(await jobs.run(job, global.txn!)).toBe('lost');
    const row = await getJob(first);
    expect(row.status).toBe('started');
    expect(row.locked_by).toBe('other-worker');
  });

  it('should abort a job', async () => {
    await insertJob(first);
    const job = await jobs.claim(global.txn!);
    await jobs.abort(first, global.txn!);
    expect(await jobs.run(job, global.txn!)).toBe('lost');
    expect((await getJob(first)).status).toBe('aborted');
  });
});
