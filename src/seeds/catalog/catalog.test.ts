/**
 * Catalog seed tests.
 * @module seeds/catalog/catalog.test
 */

// External imports
import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { describe, it, expect, afterEach } from 'vitest';

// Internal imports
import '../../app';
import { seedCatalog } from './catalog';
import * as catalogGin from '../../migrations/202610190900_catalog_gin';
import * as catalogStatistics from '../../migrations/202610190920_catalog_statistics';

/**
 * Get the definition of a catalog index.
 * @param {string} name Name of the index.
 * @returns {Promise<string>} Index definition.
 */
const indexdef = async (name: string): Promise<string> =>
  (
    await global.txn!.raw(
      `SELECT indexdef FROM pg_indexes WHERE tablename = 'catalog' AND indexname = ?`,
      [name],
    )
  ).rows[0]?.indexdef || '';

describe('seedCatalog', () => {
  let profile: string;

  afterEach(() => {
    rmSync(profile, { recursive: true, force: true });
  });

  it('should index array columns with gin', async () => {
    profile = mkdtempSync(`${tmpdir()}/nick-catalog-`);
    writeFileSync(
      `${profile}/catalog.json`,
      JSON.stringify({
        indexes: [
          { name: 'tags_test', type: 'string[]', attr: 'tags_test' },
          { name: 'refs_test', type: 'uuid[]', attr: 'refs_test' },
        ],
        metadata: [],
      }),
    );
    await seedCatalog(global.txn!, profile);

    expect(await indexdef('catalog__tags_test_index')).toContain('USING gin');
    expect(await indexdef('catalog__refs_test_index')).toContain('USING gin');
  });
});

describe('catalog gin migration', () => {
  it('should convert the array indexes of a site to gin and back', async () => {
    const name = 'catalog__subject_index';
    await catalogGin.down(global.txn!);
    expect(await indexdef(name)).toContain('USING btree');

    await catalogGin.up(global.txn!);
    expect(await indexdef(name)).toContain('USING gin');
    expect(await indexdef('catalog__isreferencing_index')).toContain(
      'USING gin',
    );
  });

  it('should keep the btree index of the permission tokens', async () => {
    await catalogGin.up(global.txn!);
    expect(await indexdef('catalog__allowedusersgroupsroles_index')).toContain(
      'USING btree',
    );
  });

  it('should use the gin index for keyword queries', async () => {
    await global.txn!.raw('SET LOCAL enable_seqscan = off');
    const plan = await global.txn!.raw(
      `EXPLAIN SELECT * FROM catalog WHERE "_Subject" && ?::varchar[]`,
      [['news']],
    );
    expect(JSON.stringify(plan.rows)).toContain('catalog__subject_index');
  });
});

describe('catalog statistics migration', () => {
  /**
   * Get the statistics target of a catalog column.
   * @param {string} column Column name.
   * @returns {Promise<number|null>} Statistics target, null for the default.
   */
  const target = async (column: string) =>
    (
      await global.txn!.raw(
        `SELECT attstattarget FROM pg_attribute WHERE attrelid = 'catalog'::regclass AND attname = ?`,
        [column],
      )
    ).rows[0].attstattarget;

  it('should collect more statistics for text and keyword columns', async () => {
    await catalogStatistics.down(global.txn!);
    expect(await target('_SearchableText')).toBeNull();

    await catalogStatistics.up(global.txn!);
    expect(await target('_SearchableText')).toBe(1000);
    expect(await target('_Subject')).toBe(1000);
    expect(await target('_allowedUsersGroupsRoles')).toBeNull();
  });
});
