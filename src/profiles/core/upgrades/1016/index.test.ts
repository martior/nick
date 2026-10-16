/**
 * Upgrade 1016 tests.
 * @module profiles/core/upgrades/1016/index.test
 */

// External imports
import { describe, expect, it } from 'vitest';

// Internal imports
import '../../../../app';
import { sortableTitle } from '../../../../helpers/utils/utils';
import { init } from './index';

describe('Upgrade 1016', () => {
  it('should recompute the sortable titles', async () => {
    const trx = global.txn!;
    await trx('index')
      .where({ name: 'sortable_title' })
      .update({ attr: 'getTitle' });
    await trx('catalog').update({ _sortable_title: trx.ref('Title') });

    await init(trx);

    const index = await trx('index').where({ name: 'sortable_title' }).first();
    expect(index.attr).toBe('sortableTitle');
    const rows = await trx('catalog').select('Title', '_sortable_title');
    expect(rows.length).toBeGreaterThan(0);
    rows.forEach((row: any) =>
      expect(row._sortable_title).toBe(sortableTitle(row.Title)),
    );
  });
});
