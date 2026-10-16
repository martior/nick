/**
 * Workflow Model.
 * @module models/workflow/workflow
 */

// Type imports
import type {
  Json,
  PermissionModel,
  Request,
  WorkflowGuard,
  WorkflowType,
} from '../../types';

// External imports
import { flatten, uniq } from 'es-toolkit/array';
import { isObject } from 'es-toolkit/compat';

// Internal imports
import { Model } from '../_model/_model';
import { getUrl } from '../../helpers/url/url';
import { checkExpression } from '../../helpers/expression/expression';
import {
  type WorkflowContext,
  checkGuard,
} from '../../helpers/workflow/workflow';

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
   * @param {string[]} transitions Ids of the available transitions.
   * @returns {Json} JSON object.
   */
  toJson(req: Request, transitions: string[] = []): Json {
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
      transitions: transitions.map((transition) => ({
        '@id': `${getUrl(req)}/@workflow/${transition}`,
        title: req.i18n(self.json.transitions[transition].title),
      })),
    } as Json;
  }

  /**
   * Check the expressions of a workflow definition: every guard
   * expression must be supported by the expression evaluator. Guards which
   * the definition.xml loader marked `unsupported` are reported as
   * acknowledged, they deny at runtime.
   * @method checkExpressions
   * @static
   * @param {WorkflowType} json Workflow json.
   * @returns {Object[]} Problems: where, the expression, the reason and if
   * it was acknowledged.
   */
  static checkExpressions(json: WorkflowType): {
    where: string;
    expr: string;
    reason: string;
    acknowledged: boolean;
  }[] {
    const problems: {
      where: string;
      expr: string;
      reason: string;
      acknowledged: boolean;
    }[] = [];
    const checkGuardExpression = (where: string, guard?: WorkflowGuard) => {
      if (guard?.expr) {
        const reason = checkExpression(guard.expr);
        if (reason) {
          problems.push({
            where,
            expr: guard.expr,
            reason,
            acknowledged: !!guard.unsupported,
          });
        }
      }
    };
    Object.entries(json?.transitions || {}).map(([id, transition]) =>
      checkGuardExpression(`transition ${id}`, transition.guard),
    );
    return problems;
  }

  /**
   * Get the guard of a transition. `permission` is a shorthand for a guard
   * with one permission.
   * @method getGuard
   * @param {string} transition Transition id.
   * @returns {WorkflowGuard | undefined} Guard.
   */
  getGuard(transition: string): WorkflowGuard | undefined {
    const self: InstanceType<typeof Workflow> = this;
    const definition = self.json.transitions?.[transition];
    if (!definition) {
      return undefined;
    }
    if (definition.guard) {
      return definition.guard;
    }
    return definition.permission
      ? { permissions: [definition.permission] }
      : undefined;
  }

  /**
   * Check the guard of a transition.
   * @method checkTransitionGuard
   * @param {string} transition Transition id.
   * @param {WorkflowContext} context Document, user and transaction.
   * @returns {Promise<boolean>} True if the guard passes.
   */
  async checkTransitionGuard(
    transition: string,
    context: WorkflowContext,
  ): Promise<boolean> {
    const self: InstanceType<typeof Workflow> = this;
    return await checkGuard(self.getGuard(transition), {
      ...context,
      workflow: self,
      transition,
    });
  }

  /**
   * Get the transitions a user can take in a state: the exit transitions
   * of the state which are triggered by the user, not hidden and whose
   * guard passes.
   * @method getAvailableTransitions
   * @param {string} state Current state.
   * @param {WorkflowContext} context Document, user and transaction.
   * @returns {Promise<string[]>} Transition ids, sorted like DCWorkflow.
   */
  async getAvailableTransitions(
    state: string,
    context: WorkflowContext,
  ): Promise<string[]> {
    const self: InstanceType<typeof Workflow> = this;
    const available: string[] = [];
    for (const transition of self.json.states?.[state]?.transitions || []) {
      const definition = self.json.transitions?.[transition];
      if (
        definition &&
        definition.trigger !== 'automatic' &&
        !definition.hidden &&
        (await self.checkTransitionGuard(transition, context))
      ) {
        available.push(transition);
      }
    }
    return available.sort();
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
