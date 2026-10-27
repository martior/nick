/**
 * Upgrade 1013 tests.
 * @module profiles/core/upgrades/1013/index.test
 */

// External imports
import { describe, expect, it } from 'vitest';

// Internal imports
import '../../../../app';
import models from '../../../../models';
import { init } from './index';

describe('Upgrade 1013', () => {
  it('should make the title a text line with a maximum length', async () => {
    const trx = global.txn!;
    const Type = models.get('Type');
    const behavior = await trx('behavior').where({ id: 'basic' }).first();
    const {
      factory: _factory,
      maxLength: _maxLength,
      ...title
    } = behavior.schema.properties.title;
    await trx('behavior')
      .where({ id: 'basic' })
      .update({
        schema: {
          ...behavior.schema,
          properties: { ...behavior.schema.properties, title },
        },
      });

    await init(trx);

    const page = await Type.fetchById('Page', {}, trx);
    expect(page._schema.properties.title.factory).toBe('Text line (String)');
    expect(page._schema.properties.title.maxLength).toBe(1024);
  });
});
