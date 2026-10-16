/**
 * Workflow tests.
 * @module routes/workflow/workflow
 */

// External imports
import request from 'supertest';
import { describe, expect, it } from 'vitest';

// Internal imports
import app from '../../app';
import {
  createDocument,
  createUser,
  testRequest,
} from '../../helpers/tests/tests';
import models from '../../models';

const token =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJhZG1pbiIsImZ1bGxuYW1lIjoiQWRtaW4iLCJpYXQiOjE2NDkzMTI0NDl9.RS1Ny_r0v7vIylFfK6q0JVJrkiDuTOh9iG9IL8xbzAk';

/**
 * Post a transition
 * @method transition
 * @param {string} path Path of the document.
 * @param {string} transition Transition id.
 * @param {Object} body Request body.
 * @param {string} auth Token.
 * @returns {Promise<Object>} Response.
 */
function transition(
  path: string,
  transition: string,
  body: any = {},
  auth: string = token,
) {
  return request(app)
    .post(`${path}/@workflow/${transition}`)
    .set('Accept', 'application/json')
    .set('Authorization', `Bearer ${auth}`)
    .send(body);
}

/**
 * Fetch a document by path
 * @method fetch
 * @param {string} path Path of the document.
 * @returns {Promise<Object>} Document.
 */
function fetch(path: string) {
  const Document = models.get('Document');
  return Document.fetchOne({ path }, {}, global.txn!);
}

describe('Workflow', () => {
  it('should return the workflow', () => testRequest(app, 'workflow/get'));

  it('should change a workflow state', async () => {
    await testRequest(app, 'content/post');
    return testRequest(app, 'workflow/post');
  });

  it('should refuse an unknown transition', async () => {
    const res = await transition('/news', 'no-such-transition');
    expect(res.status).toBe(400);
    expect(res.body.error.type).toBe('WorkflowException');
  });

  it('should refuse a transition not available in the current state', async () => {
    const res = await transition('/news', 'submit');
    expect(res.status).toBe(400);
    expect((await fetch('/news')).workflow_state).toBe('published');
  });

  it('should not record a transition to the current state', async () => {
    const before = (await fetch('/news')).workflow_history.length;
    const res = await transition('/news', 'publish');
    expect(res.status).toBe(200);
    expect(res.body.review_state).toBe('published');
    expect((await fetch('/news')).workflow_history.length).toBe(before);
  });

  it('should check the permission on every child', async () => {
    const news = await fetch('/news');
    const folder = await createDocument(
      '1c2d3e4f-0000-4000-8000-000000000001',
      news,
      'folder',
      'Folder',
      { workflow_state: 'pending' },
    );
    const sub = await createDocument(
      '1c2d3e4f-0000-4000-8000-000000000002',
      folder,
      'sub',
      'Folder',
      { inherit_roles: false, workflow_state: 'pending' },
    );
    await createDocument(
      '1c2d3e4f-0000-4000-8000-000000000003',
      sub,
      'page',
      'Page',
      { workflow_state: 'pending' },
    );
    const reviewer = await createUser('reviewer');
    await folder
      .$relatedQuery('_userRoles', global.txn!)
      .relate({ id: 'Reviewer', user: 'reviewer' });

    const res = await transition(
      '/news/folder',
      'publish',
      { include_children: true },
      reviewer,
    );
    expect(res.status).toBe(400);
    expect((await fetch('/news/folder')).workflow_state).toBe('pending');
    expect((await fetch('/news/folder/sub/page')).workflow_state).toBe(
      'pending',
    );

    // Without the blocked child the transition is applied to all
    await sub.update({ inherit_roles: true }, global.txn!);
    const ok = await transition(
      '/news/folder',
      'publish',
      { include_children: true },
      reviewer,
    );
    expect(ok.status).toBe(200);
    expect((await fetch('/news/folder/sub/page')).workflow_state).toBe(
      'published',
    );
  });

  it('should set the publication dates', async () => {
    const Document = models.get('Document');
    const news = await Document.fetchOne({ path: '/news' }, {}, global.txn!);
    const folder = await createDocument(
      '0123abcd-0000-4000-8000-000000000301',
      news,
      'dated',
      'Folder',
    );
    await createDocument(
      '0123abcd-0000-4000-8000-000000000302',
      folder,
      'child',
      'Page',
    );

    // Invalid dates are refused
    await transition('/news/dated', 'publish', {
      effective: 'not-a-date',
    }).expect(400);
    expect((await fetch('/news/dated')).workflow_state).toBe('private');

    // Submitting doesn't set the effective date
    await transition('/news/dated', 'submit').expect(200);
    expect((await fetch('/news/dated')).json.effective).toBeUndefined();

    // Dates are applied to the children too
    const res = await transition('/news/dated', 'publish', {
      include_children: true,
      effective: '2030-06-01T12:00:00',
      expires: '2031-05-06T07:08:00',
      comment: 'Published with dates',
    }).expect(200);
    expect(res.body.comments).toBe('Published with dates');
    const child = await fetch('/news/dated/child');
    expect(child.json.effective).toBe('2030-06-01T12:00:00');
    expect(child.json.expires).toBe('2031-05-06T07:08:00');
    expect(child.workflow_history.at(-1).comments).toBe('Published with dates');
    const workflow = await request(app)
      .get('/news/dated/child/@workflow')
      .set('Accept', 'application/json')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(
      workflow.body.history.map((item: any) => [item.action, item.comments]),
    ).toStrictEqual([['publish', 'Published with dates']]);

    // Republishing keeps the effective date
    await transition('/news/dated', 'retract').expect(200);
    await transition('/news/dated', 'publish').expect(200);
    expect((await fetch('/news/dated')).json.effective).toBe(
      '2030-06-01T12:00:00',
    );
  });

  it('should set the effective date when first published', async () => {
    const Document = models.get('Document');
    const news = await Document.fetchOne({ path: '/news' }, {}, global.txn!);
    await createDocument(
      '0123abcd-0000-4000-8000-000000000303',
      news,
      'undated',
      'Page',
    );
    await transition('/news/undated', 'publish').expect(200);
    expect((await fetch('/news/undated')).json.effective).toBe(
      '2022-04-08T16:00:00.000Z',
    );
  });

  it('should refuse a post without a transition', () =>
    request(app)
      .post('/news/@workflow')
      .set('Accept', 'application/json')
      .set('Authorization', `Bearer ${token}`)
      .expect(400));
});
