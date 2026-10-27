/**
 * Catalog model tests.
 * @module models/catalog/catalog.test
 */

// External imports
import { describe, it, expect, vi } from 'vitest';

// Internal imports
import '../../app';
import models from '../../models';

describe('Catalog', () => {
  describe('toJson', () => {
    it('sends unset dates like Plone', () => {
      const Catalog = models.get('Catalog');
      const metadata = [
        'EffectiveDate',
        'ExpirationDate',
        'CreationDate',
        'ModificationDate',
        'expires',
      ].map((name) => ({ name, metadata: true }));
      const req: any = {
        indexes: { models: metadata },
        protocol: 'http',
        headers: { host: 'localhost:8080' },
      };
      const item = Catalog.fromJson({
        path: '/page',
        Type: 'Page',
        Title: 'Page',
        EffectiveDate: null,
        ExpirationDate: null,
        CreationDate: null,
        ModificationDate: '2022-04-02T20:30:00.000Z',
        expires: null,
      });
      expect(item.toJson(req)).toMatchObject({
        EffectiveDate: 'None',
        ExpirationDate: 'None',
        CreationDate: 'Unknown',
        ModificationDate: '2022-04-02T20:30:00.000Z',
        expires: null,
      });
    });
  });

  describe('fetchFewRestricted', () => {
    const req: any = {
      user: { id: 'admin', getRoles: () => ['Authenticated', 'Administrator'] },
    };
    const options = {
      order: { column: '_sortable_title', reverse: true },
      limit: 2,
      offset: 1,
    };

    it('returns the same batch as fetchAllRestricted', async () => {
      const Catalog = models.get('Catalog');
      const where = { _path: ['raw', '"_path" LIKE ?', ['/%']] };
      const all = await Catalog.fetchAllRestricted(
        where,
        options,
        global.txn!,
        req,
      );
      const few = await Catalog.fetchFewRestricted(
        where,
        options,
        global.txn!,
        req,
      );
      expect(few.map((item: any) => item._path)).toEqual(
        all.map((item: any) => item._path),
      );
      expect(few.getLength()).toBe(2);
    });

    it('filters before sorting', async () => {
      const Catalog = models.get('Catalog');
      const query = vi.spyOn(Catalog, 'buildQuery');
      await Catalog.fetchFewRestricted({}, options, global.txn!, req);
      const sql = query.mock.results[1].value.toKnexQuery().toSQL().sql;
      expect(sql).toMatch(/^with "catalog" as materialized \(select/);
      expect(sql).toMatch(/order by "_sortable_title" DESC limit \?/);
      query.mockRestore();
    });
  });
});
