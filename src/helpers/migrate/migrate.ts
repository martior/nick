/* eslint no-console: 0 */
/**
 * Migrate helper: database migrations, profile installation and upgrades.
 * @module helpers/migrate/migrate
 */

// Type imports
import type { Knex } from 'knex';

// External imports
import fs from 'fs';
import path from 'path';

// Internal imports
import config from '../config/config';
import { fileExists } from '../fs/fs';
import { stripI18n } from '../i18n/i18n';
import { knex } from '../knex/knex';
import { initProfiles, mapProfiles } from '../profiles/profiles';
import models from '../../models';
import seeds from '../../seeds';

// Advisory lock key, so only one process migrates at a time ("nick" in hex)
const lockKey = 0x6e69636b;

/**
 * Read the profile metadata of a profile directory
 * @method readMetadata
 * @param {string} profilePath Path of the profile.
 * @returns {Promise<any>} Metadata or undefined.
 */
async function readMetadata(profilePath: string): Promise<any> {
  if (await fileExists(`${profilePath}/metadata`)) {
    return stripI18n((await import(`${profilePath}/metadata`)).default);
  }
  return undefined;
}

/**
 * Get the knex migration settings, from the knexfile in the working
 * directory if there is one (projects add their own migrations there)
 * @method migrationSettings
 * @returns {Promise<Knex.MigratorConfig>} Migration settings.
 */
async function migrationSettings(): Promise<Knex.MigratorConfig> {
  const knexfile = path.join(process.cwd(), 'knexfile.ts');
  if (fs.existsSync(knexfile)) {
    const settings = (await import(knexfile)).default;
    const environment = process.env.NODE_ENV || 'development';
    return (settings[environment] || settings.development).migrations;
  }
  return {
    directory: path.join(config.settings.packageRoot, 'src/migrations'),
    tableName: 'knex_migrations',
  };
}

/**
 * Run the knex migrations
 * @method migrateDatabase
 * @returns {Promise<string[]>} Names of the migrations that ran.
 */
export async function migrateDatabase(): Promise<string[]> {
  const [batch, migrations] = await knex.migrate.latest(
    await migrationSettings(),
  );
  if (migrations.length > 0) {
    console.log(`Batch ${batch} run: ${migrations.length} migrations`);
  } else {
    console.log('Already up to date');
  }
  return migrations;
}

/**
 * Install the profiles which are not installed yet
 * @method installProfiles
 * @returns {Promise<string[]>} Ids of the installed profiles.
 */
export async function installProfiles(): Promise<string[]> {
  const Profile = models.get('Profile');
  const installed: string[] = [];
  await mapProfiles(async (profilePath) => {
    const metadata = await readMetadata(profilePath);
    if (!metadata || (await Profile.fetchById(metadata.id))) {
      return;
    }
    console.log(`Applying profile ${metadata.id}`);
    await knex.transaction(async (trx) => {
      await seeds.run(trx, profilePath);
    });
    installed.push(metadata.id);
  });
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
    if (!profile) {
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
 * Migrate: run the database migrations, install new profiles and upgrade
 * installed ones. Only one process migrates at a time.
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
