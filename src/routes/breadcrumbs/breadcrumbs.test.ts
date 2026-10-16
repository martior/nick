/**
 * Breadcrumbs tests.
 * @module routes/breadcrumbs/breadcrumbs
 */

// External imports
import request from 'supertest';
import { describe, expect, it } from 'vitest';

// Internal imports
import app from '../../app';
import { createDocument, testRequest } from '../../helpers/tests/tests';
import models from '../../models';

describe('Breadcrumbs', () => {
  it('should return the breadcrumbs', () =>
    testRequest(app, 'breadcrumbs/get'));

  it('should leave out ancestors the user may not view', async () => {
    const Document = models.get('Document');
    const root = await Document.fetchOne({ path: '/' }, {}, global.txn!);
    const folder = await createDocument(
      '0123abcd-0000-4000-8000-000000000301',
      root,
      'private-folder',
      'Folder',
      { json: { title: 'Private folder' } },
    );
    await createDocument(
      '0123abcd-0000-4000-8000-000000000302',
      folder,
      'published-page',
      'Page',
      {
        workflow_state: 'published',
        json: { title: 'Published page' },
      },
    );

    const res = await request(app)
      .get('/private-folder/published-page/@breadcrumbs')
      .set('Accept', 'application/json')
      .expect(200);
    expect(res.body.items).toEqual([
      {
        '@id': 'http://localhost:8080/private-folder/published-page',
        title: 'Published page',
      },
    ]);

    // The admin sees the folder
    const admin = await request(app)
      .get('/private-folder/published-page/@breadcrumbs')
      .set('Accept', 'application/json')
      .set(
        'Authorization',
        'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJhZG1pbiIsImZ1bGxuYW1lIjoiQWRtaW4iLCJpYXQiOjE2NDkzMTI0NDl9.RS1Ny_r0v7vIylFfK6q0JVJrkiDuTOh9iG9IL8xbzAk',
      )
      .expect(200);
    expect(admin.body.items.map((item: any) => item.title)).toEqual([
      'Private folder',
      'Published page',
    ]);
  });
});
