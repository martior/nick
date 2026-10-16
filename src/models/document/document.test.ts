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
      expect(allowed).toContain('john');
      // The owner is not in the core workflow private state
      expect(allowed).not.toContain('jane');

      // Owner with View in the private state
      document._type._workflow.json.states.private.permissions.Owner = ['View'];
      expect(await document.allowedUsersGroupsRoles(global.txn!)).toContain(
        'jane',
      );
    });
  });
});
