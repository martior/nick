/**
 * Example add-on tests: install the add-on and use each extension point.
 * @module index.test
 */

// Type imports
import type { Application } from 'express';

// External imports
import request from 'supertest';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

// Internal imports
import {
  behaviors,
  getApp,
  initProfile,
  initProfiles,
  installProfiles,
  jobs,
  migrateDatabase,
  models,
  resolvePackage,
  resolveProfiles,
  routes,
  scheduledJobs,
} from '@plone/nick';

const addon = '@plone/nick-example-addon';
const auth = {
  Authorization:
    'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJhZG1pbiIsImZ1bGxuYW1lIjoiQWRtaW4iLCJpYXQiOjE2NDkzMTI0NDl9.RS1Ny_r0v7vIylFfK6q0JVJrkiDuTOh9iG9IL8xbzAk',
  Accept: 'application/json',
};

let app: Application;
let profilePath: string;

describe('Example add-on', () => {
  beforeAll(async () => {
    // The add-on depends on core, so core comes first
    const profiles = await resolveProfiles([`${addon}:default`]);
    expect(profiles.map((profile) => profile.id)).toEqual([
      '@plone/nick:core',
      `${addon}:default`,
    ]);
    profilePath = profiles[1].path;

    // Register core and the add-on before the app builds its routes
    await initProfiles();
    await initProfile(profilePath);
    app = await getApp();
  });

  beforeEach(async () => {
    // Install the add-on in the test transaction: its migrations, then its
    // profile
    await migrateDatabase(global.txn!, [resolvePackage(addon)]);
    await installProfiles(global.txn!, [profilePath]);
  });

  it('should run its own migration chain in its own schema', async () => {
    const ledger = await global.txn!('knex_migrations_plone_nick_example_addon')
      .select('name')
      .orderBy('name');
    expect(ledger.map((row: any) => row.name)).toEqual([
      '202610200900_note.ts',
      '202610200910_note_words.ts',
    ]);
    const columns = await global.txn!('information_schema.columns')
      .select('column_name')
      .where({ table_schema: 'example', table_name: 'note' })
      .orderBy('ordinal_position');
    expect(columns.map((column: any) => column.column_name)).toEqual([
      'id',
      'document',
      'text',
      'author',
      'created',
      'words',
    ]);

    // Nothing left to do on the next run
    expect(await migrateDatabase(global.txn!, [resolvePackage(addon)])).toEqual(
      [],
    );
  });

  it('should register its model, behavior, routes and scheduled job', async () => {
    expect(models.get('ExampleNote').tableName).toBe('example.note');
    expect(behaviors.behaviors.example_rating.getStars).toBeDefined();
    expect(
      routes.routes.filter((route: any) =>
        ['/@notes', '/@rating'].includes(route.view),
      ).length,
    ).toBe(3);
    expect(scheduledJobs.actions.example_purge_notes).toBeDefined();

    // The scheduled job comes from scheduled_jobs.json of the profile
    expect(
      await global.txn!('scheduled_job')
        .where({ id: 'example-purge-notes' })
        .first(),
    ).toMatchObject({
      schedule: '0 3 * * *',
      action: 'example_purge_notes',
      enabled: true,
    });
  });

  it('should add a content type with a behavior', async () => {
    const type = await request(app).get('/@types/Review').set(auth);
    expect(type.status).toBe(200);
    expect(type.body.properties.rating).toMatchObject({ type: 'integer' });

    const created = await request(app)
      .post('/')
      .set(auth)
      .send({ '@type': 'Review', title: 'Great soup', rating: 4 });
    expect(created.status).toBe(201);
    expect(created.body['@type']).toBe('Review');

    // The behavior's code: stars from the rating
    const rating = await request(app).get('/great-soup/@rating').set(auth);
    expect(rating.status).toBe(200);
    expect(rating.body).toMatchObject({ rating: 4, stars: '★★★★☆' });

    // Types without the behavior have no rating
    expect((await request(app).get('/news/@rating').set(auth)).status).toBe(
      404,
    );
  });

  it('should add a REST service which uses its own table', async () => {
    await request(app)
      .post('/')
      .set(auth)
      .send({ '@type': 'Review', title: 'Noted' });
    const added = await request(app)
      .post('/noted/@notes')
      .set(auth)
      .send({ text: 'Tastes like more' });
    expect(added.status).toBe(201);
    expect(added.body).toMatchObject({
      text: 'Tastes like more',
      words: 3,
      author: 'admin',
    });

    const listed = await request(app).get('/noted/@notes').set(auth);
    expect(listed.status).toBe(200);
    expect(listed.body.items_total).toBe(1);
    expect(listed.body.items[0].text).toBe('Tastes like more');

    // Permissions of the routes apply
    expect(
      (
        await request(app)
          .post('/noted/@notes')
          .set('Accept', 'application/json')
          .send({ text: 'Anonymous' })
      ).status,
    ).toBe(401);
    expect(
      (await request(app).post('/noted/@notes').set(auth).send({})).status,
    ).toBe(400);
  });

  it('should run its scheduled job on the job queue', async () => {
    vi.spyOn(jobs, 'check').mockResolvedValue(undefined);

    // The scheduled job of the profile is scheduled by the workers
    await scheduledJobs.refreshTasks(global.txn!);
    expect(scheduledJobs.tasks.map((task: any) => task.getPattern())).toContain(
      '0 3 * * *',
    );
    scheduledJobs.stop();

    // A note of a document which no longer exists
    await global.txn!('example.note').insert({
      document: '00000000-0000-4000-8000-00000000dead',
      text: 'Orphan',
      words: 1,
    });

    // The slot's job runs the add-on's action
    const scheduledJob = await global.txn!('scheduled_job')
      .where({ id: 'example-purge-notes' })
      .first();
    const id = await scheduledJobs.addJob(
      scheduledJob,
      new Date('2022-04-08T03:00:00.000Z'),
    );
    const job = await jobs.claim(global.txn!);
    expect(job.uuid).toBe(id);
    expect(job.params).toMatchObject({ action: 'example_purge_notes' });
    expect(await jobs.run(job, global.txn!)).toBe('completed');
    expect(
      (await global.txn!('job').where({ uuid: id }).first()).result,
    ).toEqual({ result: { status: 'success', purged: 1 } });
    expect(await global.txn!('example.note').count('* as count')).toEqual([
      { count: '0' },
    ]);
    vi.restoreAllMocks();
  });
});
