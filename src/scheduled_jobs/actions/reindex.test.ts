/**
 * Reindex action tests.
 * @module scheduled_jobs/actions/reindex.test
 */

// External imports
import { describe, it, expect } from 'vitest';

// Internal imports
import '../../app';
import { createDocument } from '../../helpers/tests/tests';
import models from '../../models';
import { reindex } from './reindex';

/**
 * Get all catalog rows as text, by document.
 * @returns {Promise<Object>} Catalog rows by document uuid.
 */
const catalogRows = async (): Promise<Record<string, any>> =>
  Object.fromEntries(
    (
      await global.txn!.raw(
        'SELECT document, to_jsonb(catalog)::text AS row FROM catalog',
      )
    ).rows.map((row: any) => [row.document, row.row]),
  );

describe('reindex', () => {
  it('rebuilds the same catalog rows as indexing every document', async () => {
    const Document = models.get('Document');
    const root = await Document.fetchOne({ path: '/' }, {}, global.txn!);

    // Local roles, blocked inheritance and a published page below them
    const folder = await createDocument(
      'c2000000-0000-4000-8000-000000000201',
      root,
      'reindex-folder',
      'Folder',
    );
    const blocked = await createDocument(
      'c2000000-0000-4000-8000-000000000202',
      folder,
      'blocked',
      'Folder',
      { inherit_roles: false },
    );
    await createDocument(
      'c2000000-0000-4000-8000-000000000203',
      blocked,
      'page',
      'Page',
      { workflow_state: 'published', json: { title: 'Zebra page' } },
    );
    await createDocument(
      'c2000000-0000-4000-8000-000000000204',
      folder,
      'private-page',
      'Page',
    );
    await global.txn!('user_role_document').insert([
      { user: 'admin', role: 'Editor', document: folder.uuid },
      { user: 'admin', role: 'Reader', document: blocked.uuid },
    ]);

    // Expected: every document indexed by itself
    const documents = await Document.fetchAll({}, {}, global.txn!);
    for (const document of documents.models) {
      await document.reindex(global.txn!);
    }
    const expected = await catalogRows();

    // Damage the catalog and rebuild it
    await global.txn!('catalog').update({
      _allowedUsersGroupsRoles: [],
      _review_state: 'damaged',
      _SearchableText: null,
      Title: 'damaged',
    });
    await global.txn!('catalog')
      .where({ document: 'c2000000-0000-4000-8000-000000000204' })
      .delete();
    const count = await Document.reindexCatalog({ batchSize: 3 });

    expect(count).toBe(documents.models.length);
    expect(await catalogRows()).toEqual(expected);
  });

  it('reindexes the documents of a type given as a string or a list', async () => {
    await global.txn!('catalog').update({ _review_state: 'damaged' });

    const result = await reindex.handler(
      { type: ['Event'] } as any,
      'admin',
      global.txn!,
    );
    expect(result.status).toBe('success');
    expect(result.count).toBeGreaterThan(0);
    const states = await global.txn!('catalog')
      .select('_Type', '_review_state')
      .where({ _review_state: 'damaged' });
    expect(states.length).toBeGreaterThan(0);
    expect(states.some((row: any) => row._Type === 'Event')).toBe(false);

    const string = await reindex.handler(
      { type: 'Event' } as any,
      'admin',
      global.txn!,
    );
    expect(string.count).toBe(result.count);
  });

  it('stops when the job is aborted', async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(
      reindex.handler({ type: [] } as any, 'admin', global.txn!, {
        signal: controller.signal,
      }),
    ).rejects.toThrow('Reindex aborted');
  });
});
