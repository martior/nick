/**
 * Migrate helper tests.
 * @module helpers/migrate/migrate.test
 */

// External imports
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import path from 'path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

// Internal imports
import models from '../../models';
import { Profile } from '../../models/profile/profile';
import { resolvePackage } from '../profiles/profiles';
import type { PackageInfo } from '../profiles/profiles';
import { migrationChains, migrationTable, upgradeProfiles } from './migrate';

declare global {
  var failUpgradeStep: boolean;
}

describe('upgradeProfiles', () => {
  let profilePath: string;

  beforeAll(() => {
    models.register('Profile', () => Profile);

    // A profile at version 3 with two upgrade steps; step 3 can fail
    profilePath = mkdtempSync(path.join(tmpdir(), 'nick-upgrade-'));
    writeFileSync(
      `${profilePath}/metadata.json`,
      JSON.stringify({ id: 'test:upgrades', version: 3 }),
    );
    mkdirSync(`${profilePath}/upgrades/2`, { recursive: true });
    mkdirSync(`${profilePath}/upgrades/3`, { recursive: true });
    writeFileSync(
      `${profilePath}/upgrades/2/index.ts`,
      `export const init = async (trx) => {
  await trx('profile').where({ id: 'test:upgrades' }).update({ title: 'Step 2' });
};
`,
    );
    writeFileSync(
      `${profilePath}/upgrades/3/index.ts`,
      `export const init = async (trx) => {
  await trx('profile').where({ id: 'test:upgrades' }).update({ title: 'Step 3' });
  if (globalThis.failUpgradeStep) {
    throw new Error('Broken step');
  }
};
`,
    );
  });

  afterAll(() => {
    rmSync(profilePath, { recursive: true, force: true });
  });

  it('should run each step in its own transaction and resume', async () => {
    await global.txn!('profile').insert({
      id: 'test:upgrades',
      title: 'Test',
      version: '1',
    });
    const profile = () =>
      global.txn!('profile').where({ id: 'test:upgrades' }).first();

    // Step 3 fails: step 2 is kept, step 3 is rolled back
    global.failUpgradeStep = true;
    await expect(upgradeProfiles(global.txn!, [profilePath])).rejects.toThrow(
      'Upgrade step test:upgrades:3 failed, test:upgrades stays at 2: Broken step',
    );
    expect(await profile()).toMatchObject({ version: '2', title: 'Step 2' });

    // The next run resumes at step 3
    global.failUpgradeStep = false;
    expect(await upgradeProfiles(global.txn!, [profilePath])).toEqual([
      'test:upgrades:3',
    ]);
    expect(await profile()).toMatchObject({ version: '3', title: 'Step 3' });

    // Nothing left to do
    expect(await upgradeProfiles(global.txn!, [profilePath])).toEqual([]);
  });

  it('should skip profiles which are not installed', async () => {
    expect(await upgradeProfiles(global.txn!, [profilePath])).toEqual([]);
  });
});

describe('migrationChains', () => {
  const core = resolvePackage('@plone/nick');
  const addon: PackageInfo = {
    name: '@acme/nick-addon',
    root: '/srv/acme',
    version: '1.0.0',
    config: { migrations: 'src/migrations', schema: 'acme' },
    profilesDir: '/srv/acme/src/profiles',
  };

  it('should name the ledger of a package', () => {
    expect(migrationTable('@plone/nick-example-addon')).toBe(
      'knex_migrations_plone_nick_example_addon',
    );
    const long = migrationTable(`@acme/${'x'.repeat(80)}`);
    expect(long.length).toBeLessThanOrEqual(50);
    expect(long).not.toBe(migrationTable(`@acme/${'x'.repeat(81)}`));
  });

  it('should run core first, then the packages in their order', async () => {
    const other: PackageInfo = {
      ...addon,
      name: 'my_project',
      root: '/srv/project',
      config: { migrations: 'migrations', migrationsTable: 'project_ledger' },
    };
    const chains = await migrationChains([core, addon, other]);
    expect(chains.slice(1)).toEqual([
      {
        package: '@acme/nick-addon',
        directory: ['/srv/acme/src/migrations'],
        tableName: 'knex_migrations_acme_nick_addon',
        schema: 'acme',
      },
      {
        package: 'my_project',
        directory: ['/srv/project/migrations'],
        tableName: 'project_ledger',
        schema: undefined,
      },
    ]);
    expect(chains[0].package).toBe('@plone/nick');
    expect(chains[0].tableName).toBe('knex_migrations');
    expect(chains[0].directory[0].endsWith('/src/migrations')).toBe(true);

    // Packages without migrations have no chain; core only when asked for
    expect(
      await migrationChains([{ ...addon, config: {} }, other]),
    ).toMatchObject([{ package: 'my_project' }]);
  });

  it('should skip directories which are in the core chain already', async () => {
    const chains = await migrationChains([
      core,
      { ...addon, root: core.root, config: { migrations: 'src/migrations' } },
    ]);
    expect(chains.map((chain) => chain.package)).toEqual(['@plone/nick']);
  });
});
