/**
 * Workflow model tests.
 * @module models/workflow/workflow.test
 */

// External imports
import request from 'supertest';
import { describe, expect, it } from 'vitest';

// Internal imports
import app from '../../app';
import { createDocument, createUser } from '../../helpers/tests/tests';
import models from '../../models';
import { Workflow } from './workflow';

const json: any = {
  states: {
    open: { permissions: { Editor: ['View'] } },
    restricted: {
      permissions: { Editor: ['View', 'Modify'] },
      acquire: ['Modify'],
    },
  },
};

describe('Workflow', () => {
  describe('getManagedPermissions', () => {
    it('defaults to the permissions used in the states', () => {
      expect(Workflow.getManagedPermissions(json)).toEqual(['View', 'Modify']);
      expect(
        Workflow.getManagedPermissions({
          ...json,
          managed_permissions: ['View'],
        }),
      ).toEqual(['View']);
    });
  });

  describe('applyPermissions', () => {
    it('adds the state permissions to the global ones with the additive model', () => {
      const workflow = Workflow.fromJson({
        id: 'test',
        json: { ...json, permission_model: 'additive' },
      });
      expect(
        workflow.applyPermissions('restricted', ['Reader'], ['View', 'Add']),
      ).toEqual(['View', 'Add']);
    });

    it('replaces global permissions with the acquire model by default', () => {
      const workflow = Workflow.fromJson({ id: 'test', json });

      // View is managed and not acquired, Add is not managed
      expect(
        workflow.applyPermissions('restricted', ['Reader'], ['View', 'Add']),
      ).toEqual(['Add']);

      // Modify is acquired in the restricted state
      expect(
        workflow.applyPermissions('restricted', ['Reader'], ['Modify']),
      ).toEqual(['Modify']);

      // The roles of the state still get their permissions
      expect(workflow.applyPermissions('open', ['Editor'], ['Add'])).toEqual([
        'Add',
        'View',
      ]);
    });
  });

  describe('acquire permission model', () => {
    it('removes global View in a state without it', async () => {
      const Document = models.get('Document');
      const Workflow = models.get('Workflow');
      const reader = await createUser('reader', ['Reader']);
      const news = await Document.fetchOne({ path: '/news' }, {}, global.txn!);
      const page = await createDocument(
        '3c4d5e6f-0000-4000-8000-000000000001',
        news,
        'page',
        'Page',
      );
      const get = () =>
        request(app)
          .get('/news/page')
          .set('Accept', 'application/json')
          .set('Authorization', `Bearer ${reader}`);
      const allowed = async () => {
        await page.reindexSecurity(global.txn!);
        return (
          await global.txn!('catalog').where({ document: page.uuid }).first()
        )._allowedUsersGroupsRoles;
      };
      // The permissions outside of a request, like in move, search and lock
      const userPermissions = async () => {
        const User = models.get('User');
        const user = await User.fetchById(
          'reader',
          { related: '[_roles, _groups._roles]' },
          global.txn!,
        );
        const document = await Document.fetchOne(
          { uuid: page.uuid },
          {},
          global.txn!,
        );
        return document.fetchUserPermissions(user, global.txn!);
      };

      // The core private state gives Reader View
      await get().expect(200);
      expect(await allowed()).toContain('Reader');
      expect(await userPermissions()).toContain('View');

      // A private state without Reader hides the page from global Readers
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
      await get().expect(401);
      expect(await allowed()).not.toContain('Reader');
      expect(await userPermissions()).not.toContain('View');

      // Unless the workflow keeps the additive model
      await workflow.update(
        { json: { ...json, permission_model: 'additive' } },
        global.txn!,
      );
      await get().expect(200);
      expect(await allowed()).toContain('Reader');
      expect(await userPermissions()).toContain('View');
    });
  });
});
