/**
 * Document model tests.
 * @module models/document/document.test
 */

// External imports
import { describe, it, expect, vi } from 'vitest';

// Internal imports
import '../../app';
import { createDocument } from '../../helpers/tests/tests';
import models from '../../models';

describe('Document', () => {
  describe('allowedUsersGroupsRoles', () => {
    it('includes local roles and the owner with view in the workflow state', async () => {
      const Document = models.get('Document');
      const User = models.get('User');
      const root = await Document.fetchOne({ path: '/' }, {}, global.txn!);
      await User.create(
        { id: 'jane', fullname: 'Jane', password: 'secret' },
        {},
        global.txn!,
      );
      await User.create(
        { id: 'john', fullname: 'John', password: 'secret' },
        {},
        global.txn!,
      );
      const document: any = await Document.create(
        {
          uuid: '9a6b7c1e-2c6a-4f7e-9b1a-3f0d4a2c1e10',
          parent: root.uuid,
          id: 'private-page',
          path: '/private-page',
          position_in_parent: 99,
          version: 0,
          owner: 'jane',
          type: 'Page',
          workflow_state: 'private',
          workflow_history: JSON.stringify([]),
          lock: { locked: false, stealable: true },
          json: { title: 'Private page' },
        },
        {},
        global.txn!,
      );
      await document
        .$relatedQuery('_userRoles', global.txn!)
        .relate({ id: 'Editor', user: 'john' });
      await document.fetchRelated('_type._workflow', global.txn!);

      const allowed = await document.allowedUsersGroupsRoles(global.txn!);

      // Local Editor has View in the private state
      expect(allowed).toContain('user:john');
      // The owner has View in the core workflow private state
      expect(allowed).toContain('user:jane');

      // Owner without View in the private state
      delete document._type._workflow.json.states.private.permissions.Owner;
      expect(await document.allowedUsersGroupsRoles(global.txn!)).not.toContain(
        'user:jane',
      );
    });
  });

  describe('getAllowed', () => {
    it('does not depend on the order of the local roles', () => {
      const Document = models.get('Document');
      const roles = [
        { principal: 'user:john', role: 'Editor' },
        { principal: 'group:staff', role: 'Reader' },
        { principal: 'user:anna', role: 'Reader' },
        { principal: 'user:carl', role: 'Owner' },
      ];
      const allowed = Document.getAllowed(['Reader', 'Editor'], roles, 'jane');
      expect(allowed).toEqual([
        'Reader',
        'Editor',
        'group:staff',
        'user:anna',
        'user:john',
      ]);
      expect(
        Document.getAllowed(['Reader', 'Editor'], roles.reverse(), 'jane'),
      ).toEqual(allowed);
    });
  });

  describe('fetchAllRestricted', () => {
    it('does not match a user or group named like a role', async () => {
      const Catalog = models.get('Catalog');
      const Document = models.get('Document');
      const news = await Document.fetchOne({ path: '/news' }, {}, global.txn!);
      await news.fetchRelated('_type._workflow', global.txn!);
      await news.update({ workflow_state: 'private' }, global.txn!);
      news.workflow_state = 'private';
      await news.reindex(global.txn!);

      const req: any = {
        user: {
          id: 'Editor',
          _groups: [{ id: 'Administrator' }],
          getRoles: () => ['Authenticated'],
        },
      };
      const items = await Catalog.fetchAllRestricted(
        { _path: '/news' },
        {},
        global.txn!,
        req,
      );
      expect(items.getLength()).toBe(0);

      req.user.getRoles = () => ['Authenticated', 'Editor'];
      const allowed = await Catalog.fetchAllRestricted(
        { _path: '/news' },
        {},
        global.txn!,
        req,
      );
      expect(allowed.getLength()).toBe(1);
    });
  });

  describe('lockForUpdate', () => {
    it('reloads the document', async () => {
      const Document = models.get('Document');
      const news = await Document.fetchOne({ path: '/news' }, {}, global.txn!);
      await global.txn!('document')
        .where({ uuid: news.uuid })
        .update({ version: 7 });
      expect(news.version).not.toBe(7);
      await news.lockForUpdate(global.txn!);
      expect(news.version).toBe(7);
    });
  });

  describe('replacePath', () => {
    it('only changes the document and the documents below it', async () => {
      const Document = models.get('Document');
      const root = await Document.fetchOne({ path: '/' }, {}, global.txn!);
      const folder = await createDocument(
        'c2000000-0000-4000-8000-000000000001',
        root,
        'scale',
        'Folder',
      );
      await createDocument(
        'c2000000-0000-4000-8000-000000000002',
        folder,
        'child',
        'Page',
      );
      await createDocument(
        'c2000000-0000-4000-8000-000000000003',
        root,
        'scale-sibling',
        'Page',
      );
      await createDocument(
        'c2000000-0000-4000-8000-000000000004',
        root,
        'scalex',
        'Page',
      );

      await Document.replacePath('/scale', '/moved', global.txn!);

      const paths = async (table: string, column: string) =>
        (
          await global.txn!(table)
            .select(column)
            .where(column, 'like', '/%scale%')
            .orWhere(column, 'like', '/moved%')
        )
          .map((row: any) => row[column])
          .sort();
      expect(await paths('document', 'path')).toEqual([
        '/moved/child',
        '/scale',
        '/scale-sibling',
        '/scalex',
      ]);
      expect(await paths('catalog', '_path')).toEqual([
        '/moved/child',
        '/scale',
        '/scale-sibling',
        '/scalex',
      ]);
      expect(await paths('catalog', 'path')).toEqual([
        '/moved/child',
        '/scale',
        '/scale-sibling',
        '/scalex',
      ]);
      expect(await paths('redirect', 'path')).toEqual([
        '/scale',
        '/scale/child',
      ]);
    });

    it('handles quotes and like wildcards in paths', async () => {
      const Document = models.get('Document');
      const root = await Document.fetchOne({ path: '/' }, {}, global.txn!);
      const folder = await createDocument(
        'c2000000-0000-4000-8000-000000000005',
        root,
        "it's_100%",
        'Folder',
      );
      await createDocument(
        'c2000000-0000-4000-8000-000000000006',
        folder,
        'child',
        'Page',
      );
      await createDocument(
        'c2000000-0000-4000-8000-000000000007',
        root,
        "it's-1000",
        'Folder',
      );

      await Document.replacePath("/it's_100%", '/moved', global.txn!);

      const child = await Document.fetchById(
        'c2000000-0000-4000-8000-000000000006',
        {},
        global.txn!,
      );
      expect(child.path).toBe('/moved/child');
      const sibling = await Document.fetchById(
        'c2000000-0000-4000-8000-000000000007',
        {},
        global.txn!,
      );
      expect(sibling.path).toBe("/it's-1000");
    });
  });

  describe('traverse', () => {
    const uuid = (n: number) => `c2000000-0000-4000-8000-00000000010${n}`;

    /**
     * Create /t1/t2/t3/t4 with local roles for jane: Editor on t2 (blocked
     * on t3) and Reader on t4, and Contributor for her group on t1.
     * @returns {Promise<Object>} Root and user.
     */
    const setup = async () => {
      const Document = models.get('Document');
      const User = models.get('User');
      const root = await Document.fetchOne({ path: '/' }, {}, global.txn!);
      await User.create(
        { id: 'jane', fullname: 'Jane', password: 'secret' },
        {},
        global.txn!,
      );
      await global.txn!('group').insert({ id: 'janes', title: 'Janes' });
      await global.txn!('user_group').insert({ user: 'jane', group: 'janes' });
      let parent = root;
      for (const n of [1, 2, 3, 4]) {
        parent = await createDocument(uuid(n), parent, `t${n}`, 'Folder', {
          inherit_roles: n !== 3,
        });
      }
      await global.txn!('user_role_document').insert([
        { user: 'jane', role: 'Editor', document: uuid(2) },
        { user: 'jane', role: 'Reader', document: uuid(4) },
      ]);
      await global.txn!('group_role_document').insert({
        group: 'janes',
        role: 'Contributor',
        document: uuid(1),
      });
      const user = await User.fetchById(
        'jane',
        { related: '[_roles, _groups._roles]' },
        global.txn!,
      );
      return { Document, root, user };
    };

    it('merges the local roles along the path', async () => {
      const { root, user } = await setup();
      const two = await root.traverse(
        ['t1', 't2'],
        user,
        undefined,
        root,
        global.txn!,
      );
      expect(two.document.uuid).toBe(uuid(2));
      expect(two.localRoles.sort()).toEqual(['Contributor', 'Editor']);
      expect(two.document._type.id).toBe('Folder');

      const four = await root.traverse(
        ['t1', 't2', 't3', 't4'],
        user,
        undefined,
        root,
        global.txn!,
      );
      expect(four.document.uuid).toBe(uuid(4));
      expect(four.localRoles).toEqual(['Reader']);
      expect(four.navroot.uuid).toBe(root.uuid);

      expect(
        await root.traverse(['t1', 'nope'], user, [], root, global.txn!),
      ).toBe(false);
    });

    it('fetches the documents with one query for any depth', async () => {
      const { Document, root, user } = await setup();
      const fetchOne = vi.spyOn(Document, 'fetchOne');
      const query = vi.spyOn(Document, 'query');
      const result = await root.traverse(
        ['t1', 't2', 't3', 't4'],
        user,
        undefined,
        root,
        global.txn!,
      );
      expect(result.document.uuid).toBe(uuid(4));
      expect(fetchOne).not.toHaveBeenCalled();
      expect(query).toHaveBeenCalledTimes(1);
      fetchOne.mockRestore();
      query.mockRestore();
    });

    it('fetches the root with the documents along the path', async () => {
      const { Document, user } = await setup();
      const query = vi.spyOn(Document, 'query');
      const result = await Document.traverseFromRoot(
        ['t1', 't2'],
        user,
        global.txn!,
      );
      expect(result.document.uuid).toBe(uuid(2));
      expect(result.navroot.path).toBe('/');
      expect(result.localRoles.sort()).toEqual(['Contributor', 'Editor']);
      expect(query).toHaveBeenCalledTimes(1);
      query.mockRestore();

      const root = await Document.traverseFromRoot([], user, global.txn!);
      expect(root.document.path).toBe('/');
    });

    it('falls back to parent and id when a path is out of date', async () => {
      const { root, user } = await setup();
      await global.txn!('document')
        .where({ uuid: uuid(3) })
        .update({ path: '/stale' });
      const result = await root.traverse(
        ['t1', 't2', 't3', 't4'],
        user,
        undefined,
        root,
        global.txn!,
      );
      expect(result.document.uuid).toBe(uuid(4));
    });
  });
});
