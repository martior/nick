/* eslint no-console: 0 */
/**
 * Migration drift check: migrate a scratch database from scratch, install
 * the profiles and compare the schema with the committed snapshot.
 *
 *   pnpm migrate:check [--update] [--snapshot <file>] [--schema <name>]
 *
 * Fails when
 * - a migration, a profile installation or an upgrade fails,
 * - running migrate a second time changes the schema (DDL outside the
 *   migrations which isn't idempotent),
 * - a registered model has no table,
 * - the schema differs from the snapshot; the profile lines (catalog
 *   indexes and metadata create columns at runtime) are part of it, so a
 *   catalog change shows up as a snapshot change.
 * @module scripts/migrate-check
 */

// External imports
import knexPkg from 'knex';
import path from 'path';

const args = process.argv.slice(2);
const option = (name: string): string | undefined => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
};
const update = args.includes('--update');
const keep = args.includes('--keep');
const snapshot = path.resolve(
  option('--snapshot') || 'src/migrations/schema.snapshot.txt',
);
const schemas = option('--schema')?.split(',');

// Settings of the configured database, before switching to the scratch one
const { default: config } = await import('../src/helpers/config/config');
const connection = config.settings.connection;
const scratch = process.env.MIGRATE_CHECK_DB || `${connection.database}_check`;

// Create the scratch database
const admin = knexPkg({
  client: 'pg',
  connection: { ...connection },
  pool: { min: 0, max: 1 },
});
await admin.raw('drop database if exists ?? with (force)', [scratch]);
await admin.raw('create database ??', [scratch]);
console.log(`Scratch database ${scratch} created`);

// Use the scratch database from here on
connection.database = scratch;
const { knex } = await import('../src/helpers/knex/knex');
const { migrate, migrateDatabase } =
  await import('../src/helpers/migrate/migrate');
const { describeSchema, diffSchema, missingModelTables, readSnapshot } =
  await import('../src/helpers/drift/drift');
const { writeSnapshot } = await import('../src/helpers/drift/drift');
const { default: models } = await import('../src/models');

let failed = false;
const fail = (message: string, lines: string[] = []) => {
  failed = true;
  console.error(`\nFAIL: ${message}`);
  lines.map((line) => console.error(`  ${line}`));
};

try {
  // Migrations only, then the profiles
  await migrateDatabase();
  const migrated = await describeSchema(knex, schemas);
  await migrate();
  const installed = await describeSchema(knex, schemas);
  const runtime = installed.filter((line) => !migrated.includes(line));
  if (runtime.length > 0) {
    console.log(
      `\n${runtime.length} schema lines are created by profiles, not by migrations (marked in the snapshot)`,
    );
  }

  // A second run must not change anything
  await migrate();
  const again = await describeSchema(knex, schemas);
  const changed = diffSchema(installed, again);
  if (changed.length > 0) {
    fail('Running migrate a second time changed the schema:', changed);
  }

  // Every model has its table
  if (!schemas) {
    const missing = missingModelTables(installed, models.models);
    if (missing.length > 0) {
      fail('Models without a table:', missing);
    }
  }

  // Compare with the snapshot
  if (update) {
    writeSnapshot(snapshot, installed, runtime);
    console.log(`\nSnapshot ${snapshot} written (${installed.length} lines)`);
  } else {
    const expected = readSnapshot(snapshot);
    const diff = diffSchema(expected, installed);
    if (expected.length === 0) {
      fail(`No snapshot at ${snapshot}; run pnpm migrate:check --update`);
    } else if (diff.length > 0) {
      fail(
        `The schema differs from ${path.relative(process.cwd(), snapshot)} (- snapshot only, + database only). Add a migration, or run pnpm migrate:check --update and commit the snapshot:`,
        diff,
      );
    } else {
      console.log(`\nThe schema matches ${snapshot}`);
    }
  }
} catch (err: any) {
  fail(`Migrate failed: ${err?.message || err}`);
  console.error(err);
} finally {
  await knex.destroy();
  if (!keep) {
    await admin.raw('drop database if exists ?? with (force)', [scratch]);
  }
  await admin.destroy();
}

process.exit(failed ? 1 : 0);
