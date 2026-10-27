/**
 * Groups routes.
 * @module routes/groups/groups
 */

// Type imports
import type { Request } from '../../types';
import type { Knex } from 'knex';

// Internal imports
import config from '../../helpers/config/config';
import events from '../../events';
import { RequestException } from '../../helpers/error/error';
import { apiLimiter } from '../../helpers/limiter/limiter';
import { getRootUrl } from '../../helpers/url/url';
import models from '../../models';

const defaultLimit = 25;

export default [
  {
    op: 'get',
    view: '/@groups/:id',
    permission: 'Manage Users',
    client: 'getGroup',
    cache: 'manage',
    handler: async (req: Request, trx: Knex.Transaction) => {
      const Group = models.get('Group');
      const group = await Group.fetchById(
        req.params.id,
        {
          related: '[_roles, _users]',
        },
        trx,
      );
      if (!group) {
        throw new RequestException(404, { error: req.i18n('Not found.') });
      }
      return {
        json: await group.toJson(req),
        keys: [req.params.id],
      };
    },
  },
  {
    op: 'get',
    view: '/@groups',
    permission: 'Manage Users',
    client: 'getGroups',
    middleware: apiLimiter,
    cache: 'manage',
    handler: async (req: Request, trx: Knex.Transaction) => {
      const Group = models.get('Group');
      const query =
        typeof req.query.query === 'string' ? req.query.query : undefined;
      if (query && query.length < 2) {
        throw new RequestException(400, {
          error: req.i18n('Query must be at least 2 characters long.'),
        });
      }

      // Check limit
      const limit =
        query || req.query.limit
          ? parseInt(String(req.query.limit || defaultLimit), 10)
          : undefined;
      if (typeof limit !== 'undefined' && (isNaN(limit) || limit < 1)) {
        throw new RequestException(400, {
          error: req.i18n('Limit must be a positive number.'),
        });
      }

      const groups = await Group.fetchAll(
        query ? { id: ['ilike', `%${query.replace(/[\\%_]/g, '\\$&')}%`] } : {},
        { order: 'title', related: '_roles', limit },
        trx,
      );
      return {
        json: await groups.toJson(req),
        keys: ['groups'],
      };
    },
  },
  {
    op: 'post',
    view: '/@groups',
    permission: 'Manage Users',
    client: 'createGroup',
    cache: 'alter',
    handler: async (req: Request, trx: Knex.Transaction) => {
      const Group = models.get('Group');
      const Role = models.get('Role');
      const User = models.get('User');

      // Check group name
      if (typeof req.body?.groupname !== 'string' || !req.body.groupname) {
        throw new RequestException(400, {
          error: {
            type: req.i18n('Bad request'),
            message: req.i18n('Property “groupname” is required.'),
          },
        });
      }
      if (await Group.fetchById(req.body.groupname, {}, trx)) {
        throw new RequestException(400, {
          error: {
            type: req.i18n('Bad request'),
            message: req.i18n('The group name you entered already exists.'),
          },
        });
      }

      // Check roles and users
      const roles = req.body.roles ?? [];
      const users = req.body.users ?? [];
      if (!Array.isArray(roles) || !Array.isArray(users)) {
        throw new RequestException(400, {
          error: {
            type: req.i18n('Bad request'),
            message: req.i18n('Roles and users must be lists.'),
          },
        });
      }
      const knownRoles = (
        await Role.fetchAll({ id: ['=', roles] }, {}, trx)
      ).map((role: any) => role.id);
      const unknownRoles = roles.filter(
        (role: string) => !knownRoles.includes(role),
      );
      if (unknownRoles.length > 0) {
        throw new RequestException(400, {
          error: {
            type: req.i18n('Bad request'),
            message: req.i18n('Unknown roles: {roles}', {
              roles: unknownRoles.join(', '),
            }),
          },
        });
      }
      const knownUsers = (
        await User.fetchAll({ id: ['=', users] }, {}, trx)
      ).map((user: any) => user.id);
      const unknownUsers = users.filter(
        (user: string) => !knownUsers.includes(user),
      );
      if (unknownUsers.length > 0) {
        throw new RequestException(400, {
          error: {
            type: req.i18n('Bad request'),
            message: req.i18n('Unknown users: {users}', {
              users: unknownUsers.join(', '),
            }),
          },
        });
      }

      const group = await Group.create(
        {
          id: req.body.groupname,
          title: req.body.title,
          description: req.body.description,
          email: req.body.email,
          _roles: roles,
          _users: users,
        },
        {},
        trx,
      );

      // Trigger on after add group
      await events.trigger('onAfterAddGroup', req.document, group, trx);

      // Send created
      return {
        status: 201,
        headers: {
          Location: `${getRootUrl(req)}/@groups/${group.id}`,
        },
        json: await group.toJson(req),
      };
    },
  },
  {
    op: 'patch',
    view: '/@groups/:id',
    permission: 'Manage Users',
    client: 'updateGroup',
    cache: 'alter',
    handler: async (req: Request, trx: Knex.Transaction) => {
      const Group = models.get('Group');

      // Check if group exists
      if (!(await Group.fetchById(req.params.id, {}, trx))) {
        throw new RequestException(404, { error: req.i18n('Not found.') });
      }

      const group = await Group.update(
        req.params.id,
        {
          id: req.body.groupname,
          title: req.body.title,
          description: req.body.description,
          email: req.body.email,
          _roles: req.body.roles,
          _users: req.body.users,
        },
        trx,
      );

      // Trigger on after update group
      await events.trigger('onAfterUpdateGroup', req.document, group, trx);

      // Send ok
      return {
        status: 204,
      };
    },
  },
  {
    op: 'delete',
    view: '/@groups/:id',
    permission: 'Manage Users',
    client: 'deleteGroup',
    cache: 'alter',
    handler: async (req: Request, trx: Knex.Transaction) => {
      const Group = models.get('Group');
      if (config.settings.systemGroups.includes(req.params.id)) {
        throw new RequestException(401, {
          error: {
            message: req.i18n('You can’t delete system groups.'),
            type: req.i18n('System group'),
          },
        });
      }

      // Check if group exists
      if (!(await Group.fetchById(req.params.id, {}, trx))) {
        throw new RequestException(404, { error: req.i18n('Not found.') });
      }

      // Trigger on before delete group
      await events.trigger(
        'onBeforeDeleteGroup',
        req.document,
        req.user,
        trx,
        req.params.id,
      );

      await Group.deleteById(req.params.id, trx);

      // Trigger on after delete group
      await events.trigger(
        'onAfterDeleteGroup',
        req.document,
        req.user,
        trx,
        req.params.id,
      );

      return {
        status: 204,
      };
    },
  },
];
