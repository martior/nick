/**
 * Workflow Model.
 * @module models/workflow/workflow
 */

// Type imports
import type { Json, PermissionModel, Request, WorkflowType } from '../../types';

// External imports
import { flatten, uniq } from 'es-toolkit/array';
import { isObject } from 'es-toolkit/compat';
import { mapValues, pick, pickBy } from 'es-toolkit/object';

// Internal imports
import { Model } from '../_model/_model';
import { getUrl } from '../../helpers/url/url';

/**
 * A model for Workflow.
 * @class Workflow
 * @extends Model
 */
export class Workflow extends Model {
  static tableName: string = 'workflow';

  // Permission model of workflows that don't set one
  static defaultPermissionModel: PermissionModel = 'acquire';

  // Declare properties
  declare json: WorkflowType;

  /**
   * Returns JSON data.
   * @method toJson
   * @param {Request} req Request object
   * @returns {Json} JSON object.
   */
  toJson(req: Request): Json {
    const self: InstanceType<typeof Workflow> = this;
    const current_state_id = req.document.workflow_state;
    const current_state = (self.json.states || {})[current_state_id] || {};

    // Workflow history, the creation is the first entry (without action)
    const stateTitle = (state?: string) =>
      req.i18n(self.json.states?.[state || '']?.title || state || '');
    const history = (req.document.workflow_history || [])
      .filter((item: any) => !item.type || item.type === 'workflow')
      .map((item: any) => ({
        action: item.action || null,
        actor: item.actor,
        comments: item.comments || '',
        review_state: item.review_state,
        time: item.time,
        title: stateTitle(item.review_state),
      }));

    return {
      '@id': `${getUrl(req)}/@workflow`,
      history,
      state: {
        id: current_state_id,
        title: req.i18n(current_state.title),
      },
      transitions: Object.entries(
        mapValues(
          pick(
            pickBy(self.json.transitions || {}, (transition: any) =>
              req.permissions.includes(transition.permission),
            ),
            current_state.transitions || [],
          ),
          (item: any) => item.title,
        ),
      ).map((transition) => ({
        '@id': `${getUrl(req)}/@workflow/${transition[0]}`,
        title: req.i18n(transition[1]),
      })),
    } as Json;
  }

  /**
   * Get the permissions managed by a workflow: the managed_permissions or
   * all permissions used in the states.
   * @method getManagedPermissions
   * @static
   * @param {WorkflowType} json Workflow json.
   * @returns {string[]} Array of permissions.
   */
  static getManagedPermissions(json: WorkflowType): string[] {
    return (
      json?.managed_permissions ||
      uniq(
        flatten(
          Object.values(json?.states || {}).map((state: any) =>
            flatten(Object.values(state.permissions || {}) as string[][]),
          ),
        ),
      )
    );
  }

  /**
   * Check if a permission in a state is acquired from the global role
   * permissions. With the additive permission model every permission is
   * acquired. With the acquire model a managed permission is only acquired
   * when the state lists it in `acquire`, otherwise the roles of the state
   * replace the global roles, like a workflow permission with acquire
   * unchecked in Plone.
   * @method isAcquired
   * @static
   * @param {WorkflowType} json Workflow json.
   * @param {string} state Workflow state.
   * @param {string} permission Permission.
   * @returns {boolean} True if acquired.
   */
  static isAcquired(
    json: WorkflowType,
    state: string,
    permission: string,
  ): boolean {
    if (
      (json?.permission_model || Workflow.defaultPermissionModel) !== 'acquire'
    ) {
      return true;
    }
    if (!Workflow.getManagedPermissions(json).includes(permission)) {
      return true;
    }
    return (json.states?.[state]?.acquire || []).includes(permission);
  }

  /**
   * Get the effective permissions in a state
   * @method applyPermissions
   * @param {string} state Current workflow state
   * @param {string[]} roles Array of roles
   * @param {string[]} globalPermissions Permissions of the roles globally
   * @returns {string[]} Array of permissions.
   */
  applyPermissions(
    state: string,
    roles: string[],
    globalPermissions: string[],
  ): string[] {
    const self: InstanceType<typeof Workflow> = this;
    return uniq([
      ...globalPermissions.filter((permission) =>
        Workflow.isAcquired(self.json, state, permission),
      ),
      ...self.getPermissions(state, roles),
    ]);
  }

  /**
   * Get permissions by state and roles
   * @method getPermissions
   * @param {string} state Current workflow state
   * @param {string[]} roles Array of roles
   * @returns {string[]} Array of permissions.
   */
  getPermissions(state: string, roles: string[]): string[] {
    const self: InstanceType<typeof Workflow> = this;
    return flatten(
      roles.map((role) =>
        isObject(self.json.states)
          ? self.json.states[state]?.permissions?.[role] || []
          : [],
      ),
    );
  }
}
