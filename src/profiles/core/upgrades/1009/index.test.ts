/**
 * Upgrade 1009 tests.
 * @module profiles/core/upgrades/1009/index.test
 */

// External imports
import { describe, expect, it } from 'vitest';

// Internal imports
import '../../../../app';
import models from '../../../../models';
import { init } from './index';

describe('Upgrade 1009', () => {
  it('should prefix users and groups in the catalog permissions', async () => {
    const trx = global.txn!;
    const Document = models.get('Document');
    const news = await Document.fetchOne({ path: '/news' }, {}, trx);
    await news
      .$relatedQuery('_userRoles', trx)
      .relate({ id: 'Reader', user: 'admin' });
    await news
      .$relatedQuery('_groupRoles', trx)
      .relate({ id: 'Reader', group: 'Administrators' });
    await trx('catalog')
      .where({ document: news.uuid })
      .update({ _allowedUsersGroupsRoles: ['Reader', 'admin'] });

    await init(trx);

    const row = await trx('catalog').where({ document: news.uuid }).first();
    expect(row._allowedUsersGroupsRoles).toContain('user:admin');
    expect(row._allowedUsersGroupsRoles).toContain('group:Administrators');
    expect(row._allowedUsersGroupsRoles).toContain('Reader');
    expect(row._allowedUsersGroupsRoles).not.toContain('admin');
  });
});
