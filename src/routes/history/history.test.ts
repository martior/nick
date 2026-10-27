/**
 * History tests.
 * @module routes/history/history
 */

// External imports
import request from 'supertest';
import { describe, expect, it } from 'vitest';

// Internal imports
import app from '../../app';
import { testRequest } from '../../helpers/tests/tests';
import models from '../../models';

const token =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJhZG1pbiIsImZ1bGxuYW1lIjoiQWRtaW4iLCJpYXQiOjE2NDkzMTI0NDl9.RS1Ny_r0v7vIylFfK6q0JVJrkiDuTOh9iG9IL8xbzAk';

describe('History', () => {
  it('should return the history', () => testRequest(app, 'history/get'));

  it('should return a content object of a specific version', () =>
    testRequest(app, 'history/get_version'));

  it('should revert to a specific version', async () => {
    await testRequest(app, 'content/post');
    await testRequest(app, 'content/patch');
    return testRequest(app, 'history/patch');
  });

  it('should return the comments of workflow transitions', async () => {
    const Document = models.get('Document');
    const news = await Document.fetchOne({ path: '/news' }, {}, global.txn!);
    await news.update(
      {
        workflow_history: JSON.stringify([
          {
            action: 'publish',
            actor: 'admin',
            comments: 'Approved',
            review_state: 'published',
            state_title: 'Published',
            time: '2022-04-03T20:22:00.000Z',
            transition_title: 'Publish',
          },
        ]),
      },
      global.txn!,
    );

    const response = await request(app)
      .get('/news/@history')
      .set('Accept', 'application/json')
      .set('Authorization', `Bearer ${token}`);
    expect(
      response.body.find((item: any) => item.type === 'workflow').comments,
    ).toBe('Approved');
  });
});
