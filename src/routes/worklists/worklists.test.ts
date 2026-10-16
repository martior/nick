/**
 * Worklists tests.
 * @module routes/worklists/worklists.test
 */

// External imports
import { readFileSync } from 'fs';
import request from 'supertest';
import { describe, expect, it } from 'vitest';

// Internal imports
import app from '../../app';
import { convertDefinition } from '../../helpers/dcworkflow/dcworkflow';
import { createDocument, createUser } from '../../helpers/tests/tests';
import models from '../../models';

/**
 * Get the worklists as a user.
 * @method worklists
 * @param {string} token Token of the user.
 * @returns {Promise<Object>} Response body.
 */
async function worklists(token: string) {
  return (
    await request(app)
      .get('/@worklists')
      .set('Accept', 'application/json')
      .set('Authorization', `Bearer ${token}`)
  ).body;
}

describe('Worklists', () => {
  it('lists the worklists of the user with their items', async () => {
    const Document = models.get('Document');
    const Workflow = models.get('Workflow');

    // The core workflow with the worklists of Plone's
    const { workflow: plone } = convertDefinition(
      readFileSync(
        `${import.meta.dirname}/../../helpers/dcworkflow/fixtures/workflows/simple_publication_workflow/definition.xml`,
        'utf8',
      ),
    );
    const workflow = await Workflow.fetchById(
      'simple_publication_workflow',
      {},
      global.txn!,
    );
    await workflow.update(
      {
        json: {
          ...workflow.json,
          worklists: {
            ...plone.json.worklists,
            mine: {
              title: 'My drafts',
              match: {
                review_state: ['private'],
                owner: ['python:user.getId()'],
              },
            },
          },
          variables: {
            owner: { for_status: true, default_expr: 'user/getId' },
          },
        },
      },
      global.txn!,
    );
    const reviewer = await createUser('reviewer', ['Reviewer']);
    const member = await createUser('member', []);
    const news = await Document.fetchOne({ path: '/news' }, {}, global.txn!);
    for (const [index, state] of ['pending', 'pending', 'private'].entries()) {
      const document = await createDocument(
        `4d5e6f70-0000-4000-8000-00000000000${index}`,
        news,
        `item-${index}`,
        'Page',
        { workflow_state: state, owner: 'reviewer' },
      );
      await document.saveWorkflowStatus(
        'simple_publication_workflow',
        state,
        { owner: 'reviewer' },
        global.txn!,
      );
    }

    // The reviewer passes the guard (Review portal content) of the queue
    const body = await worklists(reviewer);
    expect(body.items.map((item: any) => item.id)).toEqual([
      'mine',
      'reviewer_queue',
    ]);
    const queue = body.items[1];
    expect(queue).toMatchObject({
      '@id':
        'http://localhost:8080/@worklists/simple_publication_workflow/reviewer_queue',
      workflow: 'simple_publication_workflow',
      title: 'Reviewer tasks',
      items_total: 2,
      action: {
        title: 'Pending (2)',
        url: 'http://localhost:8080/search?review_state=pending',
        category: 'global',
      },
    });
    expect(queue.items.map((item: any) => item['@id'])).toEqual([
      'http://localhost:8080/news/item-0',
      'http://localhost:8080/news/item-1',
    ]);

    // A match on a variable with an expression: the private item the
    // reviewer owns
    expect(body.items[0]).toMatchObject({ title: 'My drafts', items_total: 1 });
    expect(body.items[0].items[0]['@id']).toBe(
      'http://localhost:8080/news/item-2',
    );

    // Without the permission or matches there are no worklists
    expect((await worklists(member)).items).toEqual([]);
  });
});
