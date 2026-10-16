/**
 * Catalog helper tests.
 * @module helpers/catalog/catalog.test
 */

// External imports
import { describe, it, expect } from 'vitest';

// Internal imports
import { createCoveringIndexes, dropCoveringIndexes } from './catalog';

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

describe('Catalog', () => {
  describe('createCoveringIndexes', () => {
    it('should create the indexes with the permission columns', async () => {
      await dropCoveringIndexes(global.txn!);
      expect(await indexdef('catalog_type_state_covering_index')).toBe('');

      await createCoveringIndexes(global.txn!);
      await createCoveringIndexes(global.txn!);
      expect(await indexdef('catalog_type_state_covering_index')).toContain(
        '(_portal_type, _review_state) INCLUDE (_deleted, "_allowedUsersGroupsRoles", "_Subject")',
      );
    });

    it('should be used for counts by type and state', async () => {
      await createCoveringIndexes(global.txn!);
      await global.txn!.raw('SET LOCAL enable_seqscan = off');
      await global.txn!.raw('SET LOCAL enable_bitmapscan = off');
      // The test catalog is too small to prefer it over these
      await global.txn!.raw(
        'DROP INDEX catalog__portal_type_index, catalog__review_state_index, catalog__deleted_index',
      );
      const plan = async (where: string) =>
        JSON.stringify(
          (
            await global.txn!.raw(
              `EXPLAIN SELECT count(*) FROM catalog WHERE ${where} AND "_allowedUsersGroupsRoles" && ?::varchar[] AND "_deleted" = false`,
              [['Anonymous']],
            )
          ).rows,
        );
      expect(
        await plan(`"_portal_type" = 'Page' AND "_review_state" = 'published'`),
      ).toContain('catalog_type_state_covering_index');
    });
  });
});
