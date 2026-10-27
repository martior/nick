/**
 * Permissions helper tests.
 * @module helpers/permissions/permissions.test
 */

// External imports
import { describe, expect, it } from 'vitest';

// Internal imports
import '../../app';
import { createDocument } from '../tests/tests';
import models from '../../models';
import {
  fetchPermissionModelChanges,
  formatPermissionModelChanges,
} from './permissions';

describe('Permissions', () => {
  it('lists the roles that lose a permission with the acquire model', async () => {
    const Document = models.get('Document');
    const Workflow = models.get('Workflow');
    const news = await Document.fetchOne({ path: '/news' }, {}, global.txn!);
    await createDocument(
      '4d5e6f70-0000-4000-8000-000000000001',
      news,
      'page',
      'Page',
    );
    expect(await fetchPermissionModelChanges(global.txn!)).toEqual([]);

    // Remove Reader from the private state, as in workflows before 1011
    const workflow = await Workflow.fetchById(
      'simple_publication_workflow',
      {},
      global.txn!,
    );
    const { Reader: _reader, ...permissions } =
      workflow.json.states.private.permissions;
    const json = {
      ...workflow.json,
      states: {
        ...workflow.json.states,
        private: { ...workflow.json.states.private, permissions },
      },
    };
    await workflow.update({ json }, global.txn!);

    const changes = await fetchPermissionModelChanges(global.txn!);
    expect(changes).toEqual([
      {
        role: 'Reader',
        permission: 'View',
        count: 1,
        states: [
          {
            workflow: 'simple_publication_workflow',
            state: 'private',
            count: 1,
          },
        ],
      },
    ]);
    expect(formatPermissionModelChanges(changes)).toBe(
      'role Reader loses View on 1 item (simple_publication_workflow/private: 1)',
    );

    // Workflows that keep the additive model don't change
    await workflow.update(
      { json: { ...json, permission_model: 'additive' } },
      global.txn!,
    );
    expect(await fetchPermissionModelChanges(global.txn!)).toEqual([]);
  });
});
