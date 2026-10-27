/* eslint no-console: 0 */
/**
 * Migrate helper: database migrations, profile installation and upgrades.
 * @module helpers/migrate/migrate
 */

// Type imports
import type { Knex } from 'knex';

// External imports
import { createHash } from 'crypto';
import fs from 'fs';
import path from 'path';

// Internal imports
import { fileExists } from '../fs/fs';
import { knex } from '../knex/knex';
import {
  getPackages,
  initProfiles,
  mapProfiles,
  readMetadata,
  resolvePackage,
} from '../profiles/profiles';
import type { PackageInfo } from '../profiles/profiles';
import models from '../../models';
import seeds from '../../seeds';

// Advisory lock key, so only one process migrates at a time ("nick" in hex)
const lockKey = 0x6e69636b;

// Name of the core package
const corePackage = '@plone/nick';

/**
 * The migration chain of a package: its own knex migrations directory and
 * its own ledger table.
 */
export interface MigrationChain {
  package: string;
  directory: string[];
  tableName: string;
  schema?: string;
}

/**
 * Name of the migration ledger of a package: `knex_migrations_<package>`,
 * shortened with a hash to fit Postgres' 63 character names (with `_lock`).
 * @method migrationTable
 * @param {string} name Name of the package.
 * @returns {string} Table name.
 */
export function migrationTable(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  const table = `knex_migrations_${slug}`;
  if (table.length <= 50) {
    return table;
  }
  const hash = createHash('sha1').update(name).digest('hex').substring(0, 8);
  return `${table.substring(0, 41)}_${hash}`;
}

/**
 * Get the knex migration settings of core, from the knexfile in the working
 * directory if there is one (older projects add their own migrations there)
 * @method coreMigrationSettings
 * @returns {Promise<Knex.MigratorConfig>} Migration settings.
 */
async function coreMigrationSettings(): Promise<Knex.MigratorConfig> {
  const knexfile = path.join(process.cwd(), 'knexfile.ts');
  if (fs.existsSync(knexfile)) {
    const settings = (await import(knexfile)).default;
    const environment = process.env.NODE_ENV || 'development';
    return (settings[environment] || settings.development).migrations;
  }
  const core = resolvePackage(corePackage);
  return {
    directory: path.join(core.root, core.config.migrations || 'src/migrations'),
    tableName: 'knex_migrations',
  };
}

/**
 * Get the migration chains: core first, then every package of the
 * configured profiles with migrations, in dependency order
 * @method migrationChains
 * @param {PackageInfo[]} packages Packages (default: of the configured profiles).
 * @returns {Promise<MigrationChain[]>} Chains in the order they run.
 */
export async function migrationChains(
  packages?: PackageInfo[],
): Promise<MigrationChain[]> {
  const chains: MigrationChain[] = [];
  const all = packages || (await getPackages());

  // Core, unless only other packages are asked for
  if (!packages || packages.find((pkg) => pkg.name === corePackage)) {
    const settings = await coreMigrationSettings();
    chains.push({
      package: corePackage,
      directory: ([] as string[])
        .concat(settings.directory || [])
        .map((dir) => path.resolve(dir)),
      tableName: settings.tableName || 'knex_migrations',
    });
  }

  // Directories which are already in the core chain (older knexfiles)
  const legacy = chains.flatMap((chain) => chain.directory);

  all
    .filter((pkg) => pkg.name !== corePackage && pkg.config.migrations)
    .map((pkg) => {
      const directory = path.resolve(pkg.root, pkg.config.migrations || '');
      if (legacy.includes(directory)) {
        return;
      }
      chains.push({
        package: pkg.name,
        directory: [directory],
        tableName: pkg.config.migrationsTable || migrationTable(pkg.name),
        schema: pkg.config.schema,
      });
    });
  return chains;
}

/**
 * A knex migration source for the directories of a chain. Migrations are
 * sorted by file name across the directories, like knex does, but loaded
 * with Nick's own module loader, so they can import `@plone/nick`.
 * @class MigrationSource
 */
export class MigrationSource {
  public directory: string[];

  /**
   * Construct a MigrationSource.
   * @constructs MigrationSource
   * @param {string[]} directory Directories.
   */
  constructor(directory: string[]) {
    this.directory = directory;
  }

  /**
   * Get the migrations
   * @method getMigrations
   * @returns {Promise<Array>} Migrations.
   */
  async getMigrations(): Promise<{ file: string; directory: string }[]> {
    return this.directory
      .filter((directory) => fs.existsSync(directory))
      .flatMap((directory) =>
        fs
          .readdirSync(directory)
          .filter(
            (file) =>
              /\.(ts|js|cjs|mjs)$/.test(file) &&
              !file.endsWith('.d.ts') &&
              !/\.test\.(ts|js)$/.test(file),
          )
          .map((file) => ({ file, directory })),
      )
      .sort((a, b) => (a.file < b.file ? -1 : a.file > b.file ? 1 : 0));
  }

  /**
   * Get the name of a migration
   * @method getMigrationName
   * @param {Object} migration Migration.
   * @returns {string} Name (the file name).
   */
  getMigrationName(migration: { file: string }): string {
    return migration.file;
  }

  /**
   * Load a migration
   * @method getMigration
   * @param {Object} migration Migration.
   * @returns {Promise<any>} Migration module.
   */
  async getMigration(migration: {
    file: string;
    directory: string;
  }): Promise<any> {
    return await import(path.join(migration.directory, migration.file));
  }
}

/**
 * Get the knex settings of a chain
 * @method chainSettings
 * @param {MigrationChain} chain The chain.
 * @returns {Knex.MigratorConfig} Settings.
 */
function chainSettings(chain: MigrationChain): Knex.MigratorConfig {
  return {
    migrationSource: new MigrationSource(chain.directory),
    tableName: chain.tableName,
  };
}

/**
 * Run the migrations of a chain, each in its own transaction (unless the
 * migration sets `config.transaction = false`), so a failed migration
 * leaves the ones before it applied and the next run resumes with it.
 * @method migrateChain
 * @param {MigrationChain} chain The chain.
 * @param {Knex} db Knex instance (or transaction).
 * @returns {Promise<string[]>} Names of the migrations that ran.
 */
export async function migrateChain(
  chain: MigrationChain,
  db: Knex = knex,
): Promise<string[]> {
  const settings = chainSettings(chain);
  const ran: string[] = [];

  if (chain.schema) {
    await db.raw('create schema if not exists ??', [chain.schema]);
  }

  for (;;) {
    const [, pending] = await db.migrate.list(settings);
    if (pending.length === 0) {
      break;
    }
    const name = pending[0].file;
    try {
      const [, names] = await db.migrate.up(settings);
      if (names.length === 0) {
        break;
      }
      ran.push(...names);
    } catch (err: any) {
      throw new Error(
        `Migration ${chain.package}:${name} failed: ${err?.message || err}`,
        { cause: err },
      );
    }
  }
  return ran;
}

/**
 * Run the knex migrations of core and of the packages of the profiles
 * @method migrateDatabase
 * @param {Knex} db Knex instance (or transaction).
 * @param {PackageInfo[]} packages Packages (default: of the configured profiles).
 * @returns {Promise<string[]>} Names of the migrations that ran,
 * prefixed with the package (`<package>:<migration>`).
 */
export async function migrateDatabase(
  db: Knex = knex,
  packages?: PackageInfo[],
): Promise<string[]> {
  const ran: string[] = [];
  for (const chain of await migrationChains(packages)) {
    const names = await migrateChain(chain, db);
    if (names.length > 0) {
      console.log(`${chain.package}: ${names.length} migrations run`);
    } else {
      console.log(`${chain.package}: already up to date`);
    }
    ran.push(...names.map((name) => `${chain.package}:${name}`));
  }
  return ran;
}

/**
 * Get the status of the migration chains
 * @method migrationStatus
 * @param {Knex} db Knex instance (or transaction).
 * @returns {Promise<Array>} Per chain the completed and pending migrations.
 */
export async function migrationStatus(db: Knex = knex): Promise<
  {
    package: string;
    tableName: string;
    completed: string[];
    pending: string[];
  }[]
> {
  const status = [];
  for (const chain of await migrationChains()) {
    const [completed, pending] = await db.migrate.list(chainSettings(chain));
    status.push({
      package: chain.package,
      tableName: chain.tableName,
      completed: completed.map((migration: any) => migration.name),
      pending: pending.map((migration: any) => migration.file),
    });
  }
  return status;
}

/**
 * Install profiles which are not installed yet
 * @method installProfiles
 * @param {Knex} db Knex instance (or transaction) to start transactions on.
 * @param {string[]} profilePaths Profile directories (default: configured).
 * @returns {Promise<string[]>} Ids of the installed profiles.
 */
export async function installProfiles(
  db: Knex = knex,
  profilePaths?: string[],
): Promise<string[]> {
  const Profile = models.get('Profile');
  const installed: string[] = [];
  const paths =
    profilePaths || (await mapProfiles(async (profilePath) => profilePath));
  for (const profilePath of paths) {
    const metadata = await readMetadata(profilePath);
    if (
      !metadata ||
      (await Profile.fetchById(metadata.id, {}, db as Knex.Transaction))
    ) {
      continue;
    }
    console.log(`Applying profile ${metadata.id}`);
    await db.transaction(async (trx) => {
      await seeds.run(trx, profilePath);
    });
    installed.push(metadata.id);
  }
  return installed;
}

/**
 * Run the upgrade steps of the installed profiles. Every step runs in its
 * own transaction, which also records the step as the profile version, so
 * an interrupted upgrade resumes with the step that failed.
 * @method upgradeProfiles
 * @param {Knex} db Knex instance (or transaction) to start transactions on.
 * @param {string[]} profilePaths Profile directories (default: configured).
 * @returns {Promise<string[]>} The upgrade steps that ran.
 */
export async function upgradeProfiles(
  db: Knex = knex,
  profilePaths?: string[],
): Promise<string[]> {
  const Profile = models.get('Profile');
  const steps: string[] = [];
  const paths =
    profilePaths || (await mapProfiles(async (profilePath) => profilePath));

  for (const profilePath of paths) {
    const metadata = await readMetadata(profilePath);
    const profile = metadata
      ? await Profile.fetchById(metadata.id, {}, db as Knex.Transaction)
      : undefined;
    if (!metadata || !profile) {
      continue;
    }
    for (
      let version = parseInt(profile.version) + 1;
      version <= metadata.version;
      version++
    ) {
      const step = `${metadata.id}:${version}`;
      const upgradePath = `${profilePath}/upgrades/${version}`;
      console.log(`Upgrading ${metadata.id} to ${version}`);
      try {
        await db.transaction(async (trx) => {
          await seeds.run(trx, upgradePath);

          // Run custom upgrade code if available
          if (await fileExists(`${upgradePath}/index`)) {
            const upgrade = await import(`${upgradePath}/index`);
            await upgrade.init(trx);
          }

          // Record the step
          await trx('profile')
            .where({ id: metadata.id })
            .update({ version: `${version}` });
        });
      } catch (err: any) {
        throw new Error(
          `Upgrade step ${step} failed, ${metadata.id} stays at ${version - 1}: ${err?.message || err}`,
          { cause: err },
        );
      }
      steps.push(step);
    }
  }
  return steps;
}

/**
 * Migrate: run the database migrations of core and the packages, install
 * new profiles and upgrade installed ones. Only one process migrates at a
 * time.
 * @method migrate
 * @returns {Promise<void>} Resolves when done, rejects on the first error.
 */
export async function migrate(): Promise<void> {
  const lock = await knex.transaction();
  try {
    await lock.raw('select pg_advisory_xact_lock(?)', [lockKey]);
    await migrateDatabase();
    await initProfiles();
    await installProfiles();
    await upgradeProfiles();
  } finally {
    await lock.commit();
  }
}
