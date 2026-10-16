/**
 * Drift helper: describe the database schema as stable text, to compare a
 * migrated database with a committed snapshot.
 * @module helpers/drift/drift
 */

// Type imports
import type { Knex } from 'knex';

// External imports
import fs from 'fs';

/**
 * Get the rows of a query
 * @method rows
 * @param {Knex} db Knex instance or transaction.
 * @param {string} sql Query.
 * @param {any[]} bindings Bindings.
 * @returns {Promise<any[]>} Rows.
 */
async function rows(db: Knex, sql: string, bindings: any[]): Promise<any[]> {
  return (await db.raw(sql, bindings)).rows;
}

/**
 * Describe the schema of the database: schemas, extensions, tables with
 * their columns, indexes, constraints and triggers, and functions. The
 * lines are sorted, so the description doesn't depend on the order in
 * which columns or indexes were added.
 * @method describeSchema
 * @param {Knex} db Knex instance or transaction.
 * @param {string[]} schemas Only these Postgres schemas (default: all but the
 * system schemas).
 * @returns {Promise<string[]>} Lines.
 */
export async function describeSchema(
  db: Knex,
  schemas?: string[],
): Promise<string[]> {
  const all = (
    await rows(
      db,
      `select nspname from pg_namespace
       where nspname not like 'pg\\_%' and nspname <> 'information_schema'
       order by nspname`,
      [],
    )
  ).map((row) => row.nspname);
  const names = schemas ? all.filter((name) => schemas.includes(name)) : all;
  const lines: string[] = [];
  if (names.length === 0) {
    return lines;
  }
  const inSchemas = `(${names.map(() => '?').join(', ')})`;

  // Schemas and extensions
  names.map((name) => lines.push(`schema ${name}`));
  if (!schemas) {
    (
      await rows(
        db,
        `select extname from pg_extension where extname <> 'plpgsql'`,
        [],
      )
    ).map((row) => lines.push(`extension ${row.extname}`));
  }

  // Tables
  (
    await rows(
      db,
      `select n.nspname, c.relname, c.relkind, c.relpersistence
       from pg_class c join pg_namespace n on n.oid = c.relnamespace
       where c.relkind in ('r', 'p', 'v', 'm') and n.nspname in ${inSchemas}`,
      names,
    )
  ).map((row) =>
    lines.push(
      `table ${row.nspname}.${row.relname}${
        row.relkind === 'v'
          ? ' view'
          : row.relkind === 'm'
            ? ' materialized'
            : ''
      }${row.relpersistence === 'u' ? ' unlogged' : ''}`,
    ),
  );

  // Columns
  (
    await rows(
      db,
      `select n.nspname, c.relname, a.attname,
         format_type(a.atttypid, a.atttypmod) as type, a.attnotnull,
         pg_get_expr(d.adbin, d.adrelid) as def
       from pg_attribute a
       join pg_class c on c.oid = a.attrelid
       join pg_namespace n on n.oid = c.relnamespace
       left join pg_attrdef d on d.adrelid = a.attrelid and d.adnum = a.attnum
       where a.attnum > 0 and not a.attisdropped
         and c.relkind in ('r', 'p', 'v', 'm') and n.nspname in ${inSchemas}`,
      names,
    )
  ).map((row) =>
    lines.push(
      `column ${row.nspname}.${row.relname}.${row.attname} ${row.type}${
        row.attnotnull ? ' not null' : ''
      }${row.def !== null ? ` default ${row.def}` : ''}`,
    ),
  );

  // Indexes
  (
    await rows(
      db,
      `select schemaname, tablename, indexname, indexdef from pg_indexes
       where schemaname in ${inSchemas}`,
      names,
    )
  ).map((row) =>
    lines.push(
      `index ${row.schemaname}.${row.tablename}.${row.indexname} ${row.indexdef}`,
    ),
  );

  // Constraints; not null constraints (Postgres 18) are in the columns
  (
    await rows(
      db,
      `select n.nspname, c.relname, k.conname,
         pg_get_constraintdef(k.oid) as def
       from pg_constraint k
       join pg_class c on c.oid = k.conrelid
       join pg_namespace n on n.oid = c.relnamespace
       where n.nspname in ${inSchemas} and k.contype <> 'n'`,
      names,
    )
  ).map((row) =>
    lines.push(
      `constraint ${row.nspname}.${row.relname}.${row.conname} ${row.def}`,
    ),
  );

  // Triggers
  (
    await rows(
      db,
      `select n.nspname, c.relname, t.tgname, pg_get_triggerdef(t.oid) as def
       from pg_trigger t
       join pg_class c on c.oid = t.tgrelid
       join pg_namespace n on n.oid = c.relnamespace
       where not t.tgisinternal and n.nspname in ${inSchemas}`,
      names,
    )
  ).map((row) =>
    lines.push(
      `trigger ${row.nspname}.${row.relname}.${row.tgname} ${row.def}`,
    ),
  );

  // Functions, without the ones of extensions
  (
    await rows(
      db,
      `select n.nspname, p.proname,
         pg_get_function_identity_arguments(p.oid) as args
       from pg_proc p join pg_namespace n on n.oid = p.pronamespace
       where n.nspname in ${inSchemas}
         and not exists (select 1 from pg_depend d
           where d.objid = p.oid and d.deptype = 'e')`,
      names,
    )
  ).map((row) =>
    lines.push(`function ${row.nspname}.${row.proname}(${row.args})`),
  );

  return lines.sort();
}

/**
 * Compare two schema descriptions
 * @method diffSchema
 * @param {string[]} expected Expected lines (the snapshot).
 * @param {string[]} actual Actual lines (the database).
 * @returns {string[]} Differences: `- line` is missing in the database,
 * `+ line` is not in the snapshot.
 */
export function diffSchema(expected: string[], actual: string[]): string[] {
  const expectedSet = new Set(expected);
  const actualSet = new Set(actual);
  return [
    ...expected.filter((line) => !actualSet.has(line)).map((l) => `- ${l}`),
    ...actual.filter((line) => !expectedSet.has(line)).map((l) => `+ ${l}`),
  ];
}

/**
 * Read a schema snapshot
 * @method readSnapshot
 * @param {string} file Snapshot file.
 * @returns {string[]} Lines (without comments), or [] if there is no file.
 */
export function readSnapshot(file: string): string[] {
  if (!fs.existsSync(file)) {
    return [];
  }
  return fs
    .readFileSync(file, 'utf-8')
    .split('\n')
    .map((line) => line.replace(/\s+#.*$/, ''))
    .filter((line) => line.trim() !== '' && !line.startsWith('#'));
}

/**
 * Write a schema snapshot. Lines created by profiles (at runtime, outside
 * the migrations, like catalog index columns) are marked with a comment.
 * @method writeSnapshot
 * @param {string} file Snapshot file.
 * @param {string[]} lines Lines.
 * @param {string[]} runtime Lines created by profiles.
 */
export function writeSnapshot(
  file: string,
  lines: string[],
  runtime: string[] = [],
): void {
  const marked = new Set(runtime);
  fs.writeFileSync(
    file,
    [
      '# Database schema after migrating and installing the profiles.',
      '# Generated by `pnpm migrate:check --update`; do not edit.',
      '# Lines marked "# profile" are created by profiles (catalog indexes and',
      '# metadata), not by migrations.',
      ...lines.map((line) => (marked.has(line) ? `${line}  # profile` : line)),
      '',
    ].join('\n'),
  );
}

/**
 * Check the tables of the registered models exist
 * @method missingModelTables
 * @param {string[]} lines Schema description.
 * @param {Object} models Model registry entries.
 * @returns {string[]} Models whose table does not exist.
 */
export function missingModelTables(
  lines: string[],
  models: { [name: string]: () => any },
): string[] {
  const tables = new Set(
    lines
      .filter((line) => line.startsWith('table '))
      .map((line) => line.split(' ')[1]),
  );
  return Object.entries(models)
    .map(([name, model]) => [name, model().tableName])
    .filter(
      ([, tableName]) =>
        tableName &&
        !tables.has(
          tableName.includes('.') ? tableName : `public.${tableName}`,
        ),
    )
    .map(([name, tableName]) => `${name} (${tableName})`);
}
