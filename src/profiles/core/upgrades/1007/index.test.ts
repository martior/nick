/**
 * Upgrade 1007 tests.
 * @module profiles/core/upgrades/1007/index.test
 */

// External imports
import { describe, expect, it } from 'vitest';

// Internal imports
import { init } from './index';

describe('Upgrade 1007', () => {
  it('should add the selection.none operation', async () => {
    const trx = global.txn!;
    const index = await trx('index').where({ id: '_review_state' }).first();
    const { 'selection.none': _none, ...operators } = index.operators;
    await trx('index').where({ id: '_review_state' }).update({ operators });

    await init(trx);

    const upgraded = await trx('index').where({ id: '_review_state' }).first();
    expect(Object.keys(upgraded.operators)).toStrictEqual([
      'selection.any',
      'selection.none',
    ]);
  });
});
