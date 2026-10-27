/**
 * Scheduled jobs registry tests.
 * @module scheduled_jobs/index.test
 */

// External imports
import { v4 as uuid } from 'uuid';
import { afterEach, describe, expect, it, vi } from 'vitest';

// Internal imports
import app from '../app';
import jobs from '../helpers/jobs/jobs';
import scheduledJobs from '.';

const scheduledJob = {
  id: 'reindex-events',
  title: 'Reindex Events',
  description: 'Reindex all events',
  action: 'reindex',
  params: { type: 'Event' },
};

describe('Scheduled jobs', () => {
  afterEach(() => {
    scheduledJobs.stop();
    vi.restoreAllMocks();
  });

  it('should not schedule jobs when the app is imported', () => {
    expect(app).toBeDefined();
    expect(scheduledJobs.active).toBe(false);
    expect(scheduledJobs.tasks).toEqual([]);
  });

  it('should add a job once per time slot', async () => {
    vi.spyOn(jobs, 'check').mockResolvedValue(undefined);
    const slot = new Date('2022-04-08T00:00:00.000Z');
    const next = new Date('2022-04-09T00:00:00.000Z');
    vi.mocked(uuid)
      .mockReturnValueOnce('00000000-0000-4000-8000-000000000001' as any)
      .mockReturnValueOnce('00000000-0000-4000-8000-000000000002' as any)
      .mockReturnValueOnce('00000000-0000-4000-8000-000000000003' as any);

    // Two workers firing for the same slot add one job
    const first = await scheduledJobs.addJob(scheduledJob, slot);
    const second = await scheduledJobs.addJob(scheduledJob, slot);
    const third = await scheduledJobs.addJob(scheduledJob, next);

    expect(second).toBe(first);
    expect(third).not.toBe(first);
    const rows = await global.txn!('job').where(
      'key',
      'like',
      'scheduled_job:reindex-events:%',
    );
    expect(rows.map((row: any) => row.key).sort()).toEqual([
      'scheduled_job:reindex-events:2022-04-08T00:00:00.000Z',
      'scheduled_job:reindex-events:2022-04-09T00:00:00.000Z',
    ]);
    expect(rows[0].params).toEqual({
      scheduled_job: 'reindex-events',
      action: 'reindex',
      type: 'Event',
    });
  });

  it('should register tasks only when the scheduled jobs changed', async () => {
    await scheduledJobs.refreshTasks(global.txn!);
    const tasks = scheduledJobs.tasks;
    expect(tasks.length).toBe(1);
    expect(tasks[0].getPattern()).toBe('0 0 * * *');

    // Unchanged: the tasks are kept
    await scheduledJobs.refreshTasks(global.txn!);
    expect(scheduledJobs.tasks).toBe(tasks);

    // Disabled: the task is removed
    await global.txn!('scheduled_job')
      .where({ id: 'reindex-events' })
      .update({ enabled: false });
    await scheduledJobs.refreshTasks(global.txn!);
    expect(scheduledJobs.tasks).toEqual([]);
  });

  it('should add the job with the slot of the task', async () => {
    const addJob = vi.spyOn(scheduledJobs, 'addJob').mockResolvedValue('');
    await scheduledJobs.refreshTasks(global.txn!);
    await scheduledJobs.tasks[0].execute();

    expect(addJob).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'reindex-events' }),
      expect.any(Date),
    );
  });
});
