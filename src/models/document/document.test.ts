/**
 * Document model tests.
 * @module models/document/document.test
 */

// External imports
import { describe, it, expect } from 'vitest';

// Internal imports
import '../../app';
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
      // The owner is not in the core workflow private state
      expect(allowed).not.toContain('user:jane');

      // Owner with View in the private state
      document._type._workflow.json.states.private.permissions.Owner = ['View'];
      expect(await document.allowedUsersGroupsRoles(global.txn!)).toContain(
        'user:jane',
      );
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
});
