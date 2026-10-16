/**
 * Permissions helper.
 * @module helpers/permissions/permissions
 */

// Type imports
import type { Knex } from 'knex';

// External imports
import { difference, uniq } from 'es-toolkit/array';

// Internal imports
import models from '../../models';

export interface PermissionChange {
  role: string;
  permission: string;
  count: number;
  states: { workflow: string; state: string; count: number }[];
}

/**
 * List the roles that lose a permission on content when the workflows that
 * don't choose a permission model use the acquire model instead of the
 * additive model.
 * @method fetchPermissionModelChanges
 * @param {Knex.Transaction} trx Transaction object.
 * @returns {Promise<PermissionChange[]>} Changes by role and permission.
 */
export async function fetchPermissionModelChanges(
  trx: Knex.Transaction,
): Promise<PermissionChange[]> {
  const Workflow = models.get('Workflow');

  // Get the roles of every permission
  const globalRoles: Record<string, string[]> = {};
  (await trx('role_permission')).map((row: any) => {
    globalRoles[row.permission] = [
      ...(globalRoles[row.permission] || []),
      row.role,
    ];
  });

  const changes: Record<string, PermissionChange> = {};
  for (const workflow of await trx('workflow').orderBy('id')) {
    const json = workflow.json || {};

    // Workflows with an explicit additive model don't change
    if (json.permission_model === 'additive') {
      continue;
    }

    // Count the content in each state
    const counts = await trx('document')
      .join('type', 'document.type', 'type.id')
      .where('type.workflow', workflow.id)
      .where('document.deleted', false)
      .groupBy('document.workflow_state')
      .select('document.workflow_state')
      .count('document.uuid as count');

    for (const { workflow_state: state, count } of counts as any[]) {
      const permissions = json.states?.[state]?.permissions || {};
      for (const permission of Workflow.getManagedPermissions(json)) {
        const stateRoles = Object.keys(permissions).filter((role) =>
          permissions[role].includes(permission),
        );
        const before = uniq([
          ...(globalRoles[permission] || []),
          ...stateRoles,
        ]);
        const after = uniq([
          ...(Workflow.isAcquired(
            { ...json, permission_model: 'acquire' },
            state,
            permission,
          )
            ? globalRoles[permission] || []
            : []),
          ...stateRoles,
        ]);
        for (const role of difference(before, after)) {
          const key = `${role}:${permission}`;
          changes[key] = changes[key] || {
            role,
            permission,
            count: 0,
            states: [],
          };
          changes[key].count += parseInt(count);
          changes[key].states.push({
            workflow: workflow.id,
            state,
            count: parseInt(count),
          });
        }
      }
    }
  }
  return Object.values(changes).sort((a, b) =>
    `${a.role}:${a.permission}`.localeCompare(`${b.role}:${b.permission}`),
  );
}

/**
 * Format permission changes as text
 * @method formatPermissionModelChanges
 * @param {PermissionChange[]} changes Changes by role and permission.
 * @returns {string} One line per role and permission.
 */
export function formatPermissionModelChanges(
  changes: PermissionChange[],
): string {
  if (changes.length === 0) {
    return 'No role loses a permission with the acquire permission model.';
  }
  return changes
    .map(
      (change) =>
        `role ${change.role} loses ${change.permission} on ${change.count} item${change.count === 1 ? '' : 's'} (${change.states
          .map((item) => `${item.workflow}/${item.state}: ${item.count}`)
          .join(', ')})`,
    )
    .join('\n');
}
