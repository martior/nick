/**
 * Users routes.
 * @module routes/users/users
 */

// Type imports
import type { Knex } from 'knex';
import type { Request } from '../../types';

// External imports
// @ts-expect-error bcrypt-promise does not have types
import bcrypt from 'bcrypt-promise';
import { omit } from 'es-toolkit/object';
import jwt from 'jsonwebtoken';

// Internal imports
import config from '../../helpers/config/config';
import events from '../../events';
import { RequestException } from '../../helpers/error/error';
import {
  handleBlocks,
  handleFiles,
  handleImages,
  handleRelationLists,
} from '../../helpers/content/content';
import { apiLimiter } from '../../helpers/limiter/limiter';
import { sendMail } from '../../helpers/mail/mail';
import { getRootUrl } from '../../helpers/url/url';
import models from '../../models';

const userFields = ['id', 'fullname', 'email'];
const defaultLimit = 25;

export default [
  {
    op: 'post',
    view: '/@users/:email/reset-password',
    client: 'resetPassword',
    cache: 'alter',
    handler: async (req: Request, trx: Knex.Transaction) => {
      const User = models.get('User');

      // Find user
      let user = await User.fetchOne({ email: req.params.email }, {}, trx);
      if (!user) {
        user = await User.fetchOne({ id: req.params.email }, {}, trx);
      }

      // Check min password length
      if (req.body?.new_password && req.body.new_password.length < 8) {
        throw new RequestException(400, {
          message: req.i18n('Password should be at least 8 characters long.'),
        });
      }

      // Check input
      if (req.body?.reset_token && req.body?.new_password && user) {
        // Decode jwt
        const decoded = jwt.verify(
          req.body?.reset_token,
          config.settings.secret,
          { algorithms: ['HS256'] },
        );

        // User found
        if (user && decoded && user.id === decoded.sub) {
          const password = await bcrypt.hash(req.body?.new_password, 10);
          await User.update(
            user.id,
            {
              password,
            },
            trx,
          );
        } else {
          throw new RequestException(401, {
            message: req.i18n('User doesn’t exist or invalid credentials.'),
          });
        }
      } else if (req.body?.old_password && req.body?.new_password && user) {
        // Only the user itself can set a password with the old password
        if (req.user.id !== user.id) {
          throw new RequestException(403, {
            message: req.i18n('You can only change your own password.'),
          });
        }

        // Check old password
        const same = await bcrypt.compare(
          req.body?.old_password,
          user.password,
        );
        if (!same) {
          throw new RequestException(403, {
            message: req.i18n('Wrong password.'),
          });
        }

        const password = await bcrypt.hash(req.body?.new_password, 10);
        await User.update(
          user.id,
          {
            password,
          },
          trx,
        );
      } else if (user) {
        // Create token
        const token = jwt.sign(
          {
            sub: user.id,
            fullname: user.fullname,
          },
          config.settings.secret,
          { expiresIn: '2h', algorithm: 'HS256' },
        );

        // Fetch settings
        const Controlpanel = models.get('Controlpanel');
        const controlpanel = await Controlpanel.fetchById('mail', {}, trx);
        const settings = controlpanel.data;

        // Send mail
        await sendMail(
          {
            to: `${user.fullname} <${user.email}>`,
            from: `${settings.email_from_name} <${settings.email_from_address}>`,
            subject: req.i18n('Password reset request'),
            text: req.i18n(
              'The following link takes you to a page where you can reset your password: {url} (This link will expire in 2 hours)',
              { url: `${config.settings.frontendUrl}/passwordreset/${token}` },
            ),
          },
          trx,
        );
      }

      // Return success
      return {
        status: 200,
      };
    },
  },
  {
    op: 'get',
    view: '/@users/:id',
    client: 'getUser',
    cache: 'manage',
    handler: async (req: Request, trx: Knex.Transaction) => {
      const User = models.get('User');

      // Check permissions
      const manageUsers = req.permissions.includes('Manage Users');
      if (!manageUsers && req.user.id !== req.params.id) {
        throw new RequestException(401, {
          message: req.i18n('You don’t have permissions to view this user.'),
        });
      }

      const user = await User.fetchById(
        req.params.id,
        {
          related: '[_roles, _groups]',
        },
        trx,
      );
      if (!user) {
        throw new RequestException(404, { error: req.i18n('Not found.') });
      }
      return {
        json: await user.toJson(req),
        xkeys: [req.params.id, 'groups'],
      };
    },
  },
  {
    op: 'get',
    view: '/@users',
    permission: 'Manage Users',
    client: 'getUsers',
    cache: 'manage',
    middleware: apiLimiter,
    handler: async (req: Request, trx: Knex.Transaction) => {
      const User = models.get('User');
      const query =
        typeof req.query.query === 'string' ? req.query.query : undefined;
      const search =
        typeof req.query.search === 'string' ? req.query.search : undefined;
      const groupsFilter = [
        req.query['groups-filter:list'] || req.query['groups-filter'] || [],
      ].flat() as string[];
      const filtered =
        query || search || groupsFilter.length > 0 || req.query.limit;

      // Check query length
      if ((query && query.length < 2) || (search && search.length < 2)) {
        throw new RequestException(400, {
          error: req.i18n('Query must be at least 2 characters long.'),
        });
      }

      // Check limit
      const limit = filtered
        ? parseInt(String(req.query.limit || defaultLimit), 10)
        : undefined;
      if (typeof limit !== 'undefined' && (isNaN(limit) || limit < 1)) {
        throw new RequestException(400, {
          error: req.i18n('Limit must be a positive number.'),
        });
      }

      // Build query
      const like = (value: string) => `%${value.replace(/[\\%_]/g, '\\$&')}%`;
      let users = User.buildQuery(
        query ? { id: ['ilike', like(query)] } : {},
        { order: 'fullname', related: '[_roles, _groups]', limit },
        trx,
      );
      if (search) {
        users = users.where((builder: Knex.QueryBuilder) =>
          builder
            .whereILike('id', like(search))
            .orWhereILike('fullname', like(search))
            .orWhereILike('email', like(search)),
        );
      }
      if (groupsFilter.length > 0) {
        users = users.whereIn(
          'id',
          trx('user_group').select('user').whereIn('group', groupsFilter),
        );
      }
      const items = await new User.collection(await users).toJson(req);

      return {
        json: {
          '@id': `${getRootUrl(req)}/@users`,
          items,
          items_total: items.length,
        },
        xkeys: ['users', 'groups'],
      };
    },
  },
  {
    op: 'post',
    view: '/@users',
    client: 'createUser',
    cache: 'alter',
    handler: async (req: Request, trx: Knex.Transaction) => {
      const User = models.get('User');

      // Check permissions
      const manageUsers = req.permissions.includes('Manage Users');
      if (!config.settings.userRegistration && !manageUsers) {
        throw new RequestException(401, {
          message: req.i18n('You don’t have permissions to add a user.'),
        });
      }

      // Check email
      if (
        typeof req.body?.email !== 'undefined' &&
        (typeof req.body.email !== 'string' ||
          !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(req.body.email))
      ) {
        throw new RequestException(400, {
          message: req.i18n('You must enter a valid email address.'),
        });
      }

      // Check password
      if (typeof req.body?.password === 'undefined') {
        if (manageUsers && !req.body?.sendPasswordReset) {
          throw new RequestException(400, {
            message: req.i18n(
              'Either a password or sendPasswordReset must be provided.',
            ),
          });
        }
      } else if (
        typeof req.body.password !== 'string' ||
        req.body.password.length < 8
      ) {
        throw new RequestException(400, {
          message: req.i18n('Password should be at least 8 characters long.'),
        });
      }

      // Encrypt password
      const password = req.body.password
        ? await bcrypt.hash(req.body.password, 10)
        : '';

      let json: any = omit(req.body, [
        ...userFields,
        'password',
        'roles',
        'groups',
        'username',
        'fullname',
        'email',
      ]);

      // Handle files, images and relation lists
      const schema = config.settings.userschema(req);
      json = await handleBlocks(json);
      json = await handleFiles(json, schema, trx);
      json = await handleImages(json, schema, trx);
      json = await handleRelationLists(json, schema);

      // Add user
      let user;
      try {
        user = await User.create(
          {
            id: req.body.username,
            fullname: req.body.fullname,
            email: req.body.email,
            json,
            password: manageUsers ? password : '',
            _roles: manageUsers ? req.body.roles || [] : [],
            _groups: manageUsers ? req.body.groups || [] : [],
          },
          { related: ['_roles', '_groups'] },
          trx,
        );
      } catch (err: any) {
        if (err.columns?.length > 0) {
          throw new RequestException(400, {
            message: req.i18n(
              err.columns?.includes('email')
                ? 'A user with this email already exists.'
                : 'A user with this username already exists.',
            ),
          });
        }
        throw new RequestException(400, {
          message: req.i18n('An error occurred while creating the user.'),
        });
      }

      // Check if password reset
      if (req.body.sendPasswordReset) {
        // Create token
        const token = jwt.sign(
          {
            sub: user.id,
            fullname: user.fullname,
          },
          config.settings.secret,
          { expiresIn: '2h', algorithm: 'HS256' },
        );

        // Fetch settings
        const Controlpanel = models.get('Controlpanel');
        const controlpanel = await Controlpanel.fetchById('mail', {}, trx);
        const settings = controlpanel.data;

        // Send mail
        await sendMail(
          {
            to: `${user.fullname} <${user.email}>`,
            from: `${settings.email_from_name} <${settings.email_from_address}>`,
            subject: req.i18n('Password reset request'),
            text: req.i18n(
              'The following link takes you to a page where you can reset your password: {url} (This link will expire in 2 hours)',
              { url: `${config.settings.frontendUrl}/passwordreset/${token}` },
            ),
          },
          trx,
        );
      }

      // Trigger on after add user
      await events.trigger('onAfterAddUser', req.document, user, trx);

      // Send created
      return {
        status: 201,
        json: await user.toJson(req),
      };
    },
  },
  {
    op: 'patch',
    view: '/@users/:id',
    client: 'updateUser',
    cache: 'alter',
    handler: async (req: Request, trx: Knex.Transaction) => {
      const User = models.get('User');

      // Check permissions, users can update their own properties
      const manageUsers = req.permissions.includes('Manage Users');
      if (!manageUsers && req.user.id !== req.params.id) {
        throw new RequestException(req.user.id === 'anonymous' ? 401 : 403, {
          message: req.i18n('You are not authorized to access this resource.'),
        });
      }

      // Make a copy
      let json: any = omit(req.body, [
        ...userFields,
        'password',
        'roles',
        'groups',
        'username',
        'fullname',
        'email',
      ]);

      const curUser = await User.fetchById(req.params.id, {}, trx);
      if (!curUser) {
        throw new RequestException(404, { error: req.i18n('Not found.') });
      }

      // Check min password length
      if (
        manageUsers &&
        typeof req.body.password !== 'undefined' &&
        (typeof req.body.password !== 'string' || req.body.password.length < 8)
      ) {
        throw new RequestException(400, {
          message: req.i18n('Password should be at least 8 characters long.'),
        });
      }

      // Handle images
      const schema = config.settings.userschema(req);
      json = await handleBlocks(json);
      json = await handleFiles(json, schema, trx);
      json = await handleImages(json, schema, trx);
      json = await handleRelationLists(json, schema);

      const user = await User.update(
        req.params.id,
        {
          id: manageUsers ? req.body.username : undefined,
          fullname: req.body.fullname,
          email: req.body.email,
          password:
            manageUsers && req.body.password
              ? await bcrypt.hash(req.body.password, 10)
              : undefined,
          json: { ...curUser.json, ...json },
          _roles: manageUsers ? req.body.roles : undefined,
          _groups: manageUsers ? req.body.groups : undefined,
        },
        trx,
      );

      // Trigger on after update user
      await events.trigger('onAfterUpdateUser', req.document, user, trx);

      // Send ok
      return {
        status: 204,
      };
    },
  },
  {
    op: 'delete',
    view: '/@users/:id',
    permission: 'Manage Users',
    client: 'deleteUser',
    cache: 'alter',
    handler: async (req: Request, trx: Knex.Transaction) => {
      const User = models.get('User');
      if (config.settings.systemUsers.includes(req.params.id)) {
        throw new RequestException(401, {
          error: {
            message: req.i18n('You can’t delete system users.'),
            type: req.i18n('System users'),
          },
        });
      }

      // Fetch user
      const user = await User.fetchById(req.params.id, {}, trx);
      if (!user) {
        throw new RequestException(404, { error: req.i18n('Not found.') });
      }

      // Check if user exists
      if (user) {
        // Trigger on before delete user
        await events.trigger('onBeforeDeleteUser', req.document, user, trx);

        // Delete files and images the user
        await user.deleteFilesAndImages(req, trx);

        // Delete user
        await user.delete(trx);

        // Trigger on after delete user
        await events.trigger('onAfterDeleteUser', req.document, user, trx);
      }

      return {
        status: 204,
      };
    },
  },
];
