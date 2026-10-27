/**
 * Drift helper tests.
 * @module helpers/drift/drift.test
 */

// External imports
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import path from 'path';
import { describe, expect, it } from 'vitest';

// Internal imports
import {
  describeSchema,
  diffSchema,
  missingModelTables,
  readSnapshot,
  writeSnapshot,
} from './drift';

describe('Drift', () => {
  it('should describe the schema', async () => {
    await global.txn!.raw('create schema drift_test');
    await global.txn!.raw(
      "create table drift_test.item (id serial primary key, title varchar(10) not null default 'x')",
    );
    expect(await describeSchema(global.txn!, ['drift_test'])).toEqual([
      "column drift_test.item.id integer not null default nextval('drift_test.item_id_seq'::regclass)",
      "column drift_test.item.title character varying(10) not null default 'x'::character varying",
      'constraint drift_test.item.item_pkey PRIMARY KEY (id)',
      'index drift_test.item.item_pkey CREATE UNIQUE INDEX item_pkey ON drift_test.item USING btree (id)',
      'schema drift_test',
      'table drift_test.item',
    ]);
    const all = await describeSchema(global.txn!);
    expect(all).toContain('table public.document');
    expect(all).toContain('table drift_test.item');
  });

  it('should compare, write and read snapshots', () => {
    expect(diffSchema(['a', 'b'], ['b', 'c'])).toEqual(['- a', '+ c']);
    const dir = mkdtempSync(path.join(tmpdir(), 'nick-drift-'));
    const file = path.join(dir, 'schema.txt');
    expect(readSnapshot(file)).toEqual([]);
    writeSnapshot(file, ['column a', 'column b'], ['column b']);
    expect(readSnapshot(file)).toEqual(['column a', 'column b']);
    rmSync(dir, { recursive: true, force: true });
  });

  it('should find models without a table', () => {
    const lines = ['table public.job', 'table example.note'];
    expect(
      missingModelTables(lines, {
        Job: () => ({ tableName: 'job' }),
        Note: () => ({ tableName: 'example.note' }),
        Lost: () => ({ tableName: 'lost' }),
      }),
    ).toEqual(['Lost (lost)']);
  });
});
