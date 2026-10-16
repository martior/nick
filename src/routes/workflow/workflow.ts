/**
 * Workflow routes.
 * @module routes/workflow/workflow
 */

// Type imports
import type { Request } from '../../types';
import type { Knex } from 'knex';

// External imports
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import { pick } from 'es-toolkit/object';

// Internal imports
import { hasPermission } from '../../helpers/auth/auth';
import { RequestException } from '../../helpers/error/error';
import { mapAsync } from '../../helpers/utils/utils';

dayjs.extend(utc);

/**
 * Check a transition on all children of a document
 * @method checkChildren
 * @param {Request} req Request object.
 * @param {Object} document Document object.
 * @param {string} transition Transition id.
 * @param {Knex.Transaction} trx Transaction object.
 * @returns {Promise<void>} Throws when the transition can't be applied.
 */
async function checkChildren(
  req: Request,
  document: any,
  transition: string,
  trx: Knex.Transaction,
): Promise<void> {
  await document.fetchChildren({}, trx, false);
  await mapAsync(document._children, async (child: any) => {
    const check = await child.checkTransition(transition, req.user, trx);
    if (check !== 'apply' && check !== 'same') {
      throw new RequestException(400, {
        error: {
          type: 'WorkflowException',
          message: req.i18n(
            'Transition {transition} is not available for {path}.',
            { transition, path: child.path },
          ),
        },
      });
    }
    await checkChildren(req, child, transition, trx);
  });
}

export const handler = async (req: Request, trx: Knex.Transaction) => {
  await req.type.fetchRelated('_workflow', trx);
  return {
    json: req.type._workflow.toJson(req),
  };
};

export default [
  {
    op: 'post',
    view: '/@workflow/:transition',
    permission: 'View',
    client: 'changeWorkflow',
    cache: 'alter',
    handler: async (req: Request, trx: Knex.Transaction) => {
      const recursive = req.body?.include_children === true ? true : false;
      await req.type.fetchRelated('_workflow', trx);

      // Check the publication dates
      const dates = pick(req.body || {}, ['effective', 'expires']);
      Object.keys(dates).forEach((field: string) => {
        const value = (dates as any)[field];
        if (typeof value !== 'string' || !dayjs(value).isValid()) {
          throw new RequestException(400, {
            message: req.i18n('Invalid date for {field}.', { field }),
          });
        }
      });

      // Lock the document to serialize concurrent changes
      await req.document.lockForUpdate(trx);
      const transition = req.params.transition;

      // Check the transition against the current state and the permissions
      const check = await req.document.checkTransition(
        transition,
        req.user,
        trx,
        req.permissions,
      );
      if (check === 'unknown' || check === 'unavailable') {
        throw new RequestException(400, {
          error: {
            type: 'WorkflowException',
            message: req.i18n(
              'Transition {transition} is not available in the current state.',
              { transition },
            ),
          },
        });
      }
      if (check === 'unauthorized') {
        throw new RequestException(401, {
          message: req.i18n(
            'You are not authorization to access this resource.',
          ),
        });
      }

      // Check the transition on all children, it is applied to all or none
      if (recursive) {
        await checkChildren(req, req.document, transition, trx);
      }

      // Return the last transition if the document is already in the new state
      if (check === 'same' && !recursive) {
        const last: any = req.document.workflow_history
          .filter((item: any) => !item.type || item.type === 'workflow')
          .pop();
        const state = req.document.workflow_state;
        return {
          json: {
            action: last?.action || null,
            actor: last?.actor || null,
            comments: last?.comments || '',
            review_state: state,
            time: last?.time || req.document.modified,
            title: req.i18n(req.type._workflow.json.states[state]?.title),
          },
          xkeys: [req.document.uuid],
        };
      }

      // Get new state and modified timestamp
      const new_state =
        req.type._workflow.json.transitions[req.params.transition].new_state;
      const modified = dayjs.utc().format();

      // Change workflow
      await req.document.changeWorkflow(
        req.params.transition,
        req.user,
        modified,
        recursive,
        trx,
        req,
        dates,
      );

      // Return workflow state
      return {
        json: {
          action: req.params.transition,
          actor: req.user.id,
          comments: '',
          review_state: new_state,
          time: modified,
          title: req.type._workflow.json.states[new_state].title,
        },
        xkeys: [req.document.uuid],
      };
    },
  },
  {
    op: 'post',
    view: '/@workflow',
    permission: 'View',
    cache: 'alter',
    handler: async (req: Request) => {
      throw new RequestException(400, {
        message: req.i18n('No transition specified.'),
      });
    },
  },
  {
    op: 'get',
    view: '/@workflow',
    permission: 'View',
    client: 'getWorkflow',
    cache: 'manage',
    handler,
  },
];
