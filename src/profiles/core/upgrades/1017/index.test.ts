/**
 * Upgrade 1017 tests.
 * @module profiles/core/upgrades/1017/index.test
 */

// External imports
import { describe, expect, it } from 'vitest';

// Internal imports
import '../../../../app';
import { init } from './index';

describe('Upgrade 1017', () => {
  it('should fill the isFolderish index', async () => {
    const trx = global.txn!;
    await trx('catalog').update({ _isFolderish: null });

    await init(trx);

    const rows = await trx('catalog').select('_is_folderish', '_isFolderish');
    expect(rows.length).toBeGreaterThan(0);
    rows.forEach((row: any) =>
      expect(row._isFolderish).toBe(row._is_folderish),
    );
    expect(rows.some((row: any) => row._isFolderish === true)).toBe(true);
  });
});
