/**
 * Sharing routes.
 * @module routes/sharing/sharing
 */

// Type imports
import type { Request } from '../../types';
import type { Knex } from 'knex';

// External imports
import { uniq } from 'es-toolkit/array';
import { isObject } from 'es-toolkit/compat';

// Internal imports
import { authenticatedUsers } from '../../helpers/auth/auth';
import config from '../../helpers/config/config';
import { RequestException } from '../../helpers/error/error';
import jobs from '../../helpers/jobs/jobs';
import { apiLimiter } from '../../helpers/limiter/limiter';
import { mapAsync } from '../../helpers/utils/utils';
import models from '../../models';

/**
 * Fetch principals
 * @method fetchPrincipals
 * @param {string[]} roles Role models.
 * @param {Object} document Document object.
 * @param {string} query Query string.
 * @param {Model} Model Model to query.
 * @param {string} title Field name of the title of the principal.
 * @param {string} type Type of the principal.
 * @param {Object} trx transaction object.
 * @returns {Array} Array of principals.
 */
async function fetchPrincipals(
  roles: string[],
  document: any,
  query: string | undefined,
  Model: any,
  title: string,
  type: string,
  trx: Knex.Transaction,
) {
  const Document = models.get('Document');

  // Get the principals with local roles on the document or its parents and,
  // with a search query, the principals matching it by id or title
  const prefix = `${type}:`;
  const ids = uniq(
    (await document.fetchLocalRoles(trx))
      .filter((localRole: any) => localRole.principal.startsWith(prefix))
      .map((localRole: any) => localRole.principal.slice(prefix.length)),
  );
  const search =
    query && query.length >= 2 ? `%${query.toLowerCase()}%` : undefined;
  const principals =
    ids.length > 0 || search
      ? await Model.query(trx)
          .withGraphFetched('_roles')
          .where((builder: any) => {
            if (ids.length > 0) {
              builder.whereIn('id', ids);
            }
            if (search) {
              builder.orWhereRaw(`LOWER(id) LIKE ? OR LOWER(${title}) LIKE ?`, [
                search,
                search,
              ]);
            }
          })
          .orderBy('id')
      : [];

  // Return principal data
  return await Promise.all(
    principals.map(async (principal: any) => {
      // Get local roles
      const localRoles = await principal.fetchRolesByDocument(
        document.uuid,
        trx,
      );

      // Get acquired roles
      let acquiredRoles = [] as string[];
      let traverse = document;
      while (traverse.parent && traverse.inherit_roles) {
        traverse = await Document.fetchById(traverse.parent, {}, trx);
        acquiredRoles = [
          ...acquiredRoles,
          ...(await principal.fetchRolesByDocument(traverse.uuid, trx)),
        ];
      }

      // Get global roles
      const globalRoles = principal._roles.map(
        (principalRoles: any) => principalRoles.id,
      );

      // Return principal
      return {
        id: principal.id,
        title: principal[title],
        roles: Object.fromEntries(
          roles.map((role: any) => {
            if (globalRoles.includes(role.id)) {
              return [role.id, 'global'];
            } else if (acquiredRoles.includes(role.id)) {
              return [role.id, 'acquired'];
            } else {
              return [role.id, localRoles.includes(role.id)];
            }
          }),
        ),
        type,
      };
    }),
  );
}

/**
 * Fetch the roles the current user may delegate: the roles with a
 * `Delegate <role>` permission the user has on the document, like the
 * "Sharing page: Delegate <role> role" permissions of Plone.
 * @method fetchDelegatableRoles
 * @param {Request} req Request object.
 * @param {Object} trx transaction object.
 * @returns {Promise<Object[]>} Roles sorted by id.
 */
async function fetchDelegatableRoles(
  req: Request,
  trx: Knex.Transaction,
): Promise<any[]> {
  const Role = models.get('Role');
  const roles = await Role.fetchAll({}, { order: 'id' }, trx);
  return roles
    .map((role: any) => role)
    .filter((role: any) => req.permissions.includes(`Delegate ${role.id}`));
}

export default [
  {
    op: 'get',
    view: '/@sharing',
    permission: 'Modify',
    client: 'getSharing',
    cache: 'manage',
    middleware: apiLimiter,
    handler: async (req: Request, trx: Knex.Transaction) => {
      const User = models.get('User');
      const Group = models.get('Group');

      // Get the roles the user may delegate
      const roles = await fetchDelegatableRoles(req, trx);

      // Get user roles
      const users = await fetchPrincipals(
        roles,
        req.document,
        typeof req.query.search === 'string' ? req.query.search : undefined,
        User,
        'fullname',
        'user',
        trx,
      );

      // Get groups
      const groups = await fetchPrincipals(
        roles,
        req.document,
        typeof req.query.search === 'string' ? req.query.search : undefined,
        Group,
        'title',
        'group',
        trx,
      );

      // The group of all authenticated users is always listed, like in Plone
      if (!groups.some((group: any) => group.id === authenticatedUsers)) {
        groups.push({
          id: authenticatedUsers,
          title: req.i18n('Logged-in users'),
          roles: Object.fromEntries(roles.map((role: any) => [role.id, false])),
          type: 'group',
        });
      }

      // Return sharing data
      return {
        json: {
          available_roles: roles.map((role: any) => ({
            id: role.id,
            title: role.title,
          })),
          entries: [...users, ...groups]
            .sort((a, b) => (a.title > b.title ? 1 : -1))
            .map((entry: any) => ({
              ...entry,
              // The entry of the current user is shown but not editable
              disabled: entry.type === 'user' && entry.id === req.user.id,
            })),
          inherit: req.document.inherit_roles,
        },
        xkeys: [req.document.uuid],
      };
    },
  },
  {
    op: 'post',
    view: '/@sharing',
    permission: 'Modify',
    client: 'updateSharing',
    cache: 'alter',
    handler: async (req: Request, trx: Knex.Transaction) => {
      const User = models.get('User');
      const Group = models.get('Group');

      // Lock the document to serialize concurrent changes
      await req.document.lockForUpdate(trx);

      // Validate input
      const body = req.body || {};
      const entries = body.entries ?? [];
      if (
        (body.inherit !== undefined && typeof body.inherit !== 'boolean') ||
        !Array.isArray(entries) ||
        !entries.every(
          (entry: any) =>
            isObject(entry) &&
            typeof (entry as any).id === 'string' &&
            ['user', 'group'].includes((entry as any).type) &&
            isObject((entry as any).roles),
        )
      ) {
        throw new RequestException(400, {
          message: req.i18n(
            'Sharing data needs an optional boolean inherit and a list of entries with an id, a type user or group and roles.',
          ),
        });
      }

      // Update inherit
      if (
        typeof body.inherit === 'boolean' &&
        req.document.inherit_roles !== body.inherit
      ) {
        await req.document.update(
          {
            inherit_roles: body.inherit,
          },
          trx,
        );
      }

      // Get the roles the user may delegate, other roles are ignored
      const roles = (await fetchDelegatableRoles(req, trx)).map(
        (role: any) => role.id,
      );

      // Create the group of all authenticated users when it gets roles
      if (
        entries.some(
          (entry: any) =>
            entry.type === 'group' && entry.id === authenticatedUsers,
        ) &&
        !(await Group.fetchById(authenticatedUsers, {}, trx))
      ) {
        await Group.create(
          { id: authenticatedUsers, title: 'Logged-in users' },
          {},
          trx,
        );
      }

      // Update local roles: an entry is the complete set of the local roles
      // of the principal, roles not set to true are removed
      await mapAsync(entries, async (entry: any) => {
        const Model = entry.type === 'user' ? User : Group;
        const principal = await Model.fetchById(entry.id, {}, trx);
        if (principal) {
          await mapAsync(roles, async (role: string) => {
            const existing = await principal
              .$relatedQuery('_documentRoles', trx)
              .where({ id: role, document: req.document.uuid })
              .first();
            if (entry.roles[role] === true && !existing) {
              await principal
                .$relatedQuery('_documentRoles', trx)
                .relate({ id: role, document: req.document.uuid });
            } else if (entry.roles[role] !== true && existing) {
              // Remove the role on this document only
              await trx(
                entry.type === 'user'
                  ? 'user_role_document'
                  : 'group_role_document',
              )
                .where({
                  [entry.type === 'user' ? 'user' : 'group']: principal.id,
                  role,
                  document: req.document.uuid,
                })
                .delete();
            }
          });
        }
      });

      // Reindex the permissions of the document and the documents below it,
      // in a job if the subtree is large
      const Document = models.get('Document');
      const limit = config.settings.reindexSecurityLimit ?? 1000;
      const [{ count }] = await Document.knex()('document')
        .count('uuid')
        .whereRaw('starts_with(path, ?)', [
          req.document.path === '/' ? '/' : `${req.document.path}/`,
        ])
        .transacting(trx);
      if (parseInt(count as string) < limit) {
        await req.document.reindexSecurity(trx);
      } else {
        await jobs.add(
          req.i18n('Reindex security'),
          req.i18n('Reindex security of {path}', { path: req.document.path }),
          { action: 'reindex_security', path: req.document.path },
          req.user.id,
          trx,
        );
      }

      return {
        status: 204,
      };
    },
  },
];
