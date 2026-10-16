/**
 * Workflow Model.
 * @module models/workflow/workflow
 */

// Type imports
import type { Json, Request, WorkflowType } from '../../types';

// External imports
import { flatten } from 'es-toolkit/array';
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

    // Workflow history with the initial state first, like plone.restapi.
    // Migrated content may have the initial state in the history already.
    const stateTitle = (state?: string) =>
      req.i18n(self.json.states?.[state || '']?.title || state || '');
    const entries = (req.document.workflow_history || []).filter(
      (item: any) => !item.type || item.type === 'workflow',
    );
    const history = [
      ...(entries.length > 0 && !entries[0].action
        ? []
        : [
            {
              action: null,
              actor: req.document.owner,
              comments: '',
              review_state: self.json.initial_state,
              time: req.document.created,
              title: stateTitle(self.json.initial_state),
            },
          ]),
      ...entries.map((item: any) => ({
        action: item.action || null,
        actor: item.actor,
        comments: item.comments || '',
        review_state: item.review_state,
        time: item.time,
        title: stateTitle(item.review_state),
      })),
    ];

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
