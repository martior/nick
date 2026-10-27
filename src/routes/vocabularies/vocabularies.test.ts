/**
 * Vocabularies tests.
 * @module routes/vocabularies/vocabularies
 */

// External imports
import request from 'supertest';
import { describe, expect, it } from 'vitest';

// Internal imports
import app from '../../app';
import {
  adminToken,
  createUserWithToken,
  testRequest,
} from '../../helpers/tests/tests';

describe('Vocabularies', () => {
  it('should return the vocabularies', () =>
    testRequest(app, 'vocabularies/list'));

  it('should return a single vocabulary', () =>
    testRequest(app, 'vocabularies/get'));

  it('should filter a vocabulary by title', () =>
    testRequest(app, 'vocabularies/get_title'));

  it('should filter a vocabulary by token', () =>
    testRequest(app, 'vocabularies/get_token'));

  it('should batch a vocabulary', () =>
    testRequest(app, 'vocabularies/get_batched'));

  it('should return a actions vocabulary', () =>
    testRequest(app, 'vocabularies/get_actions'));

  it('should return a behaviors vocabulary', () =>
    testRequest(app, 'vocabularies/get_behaviors'));

  it('should return a groups vocabulary', () =>
    testRequest(app, 'vocabularies/get_groups'));

  it('should return a image scales vocabulary', () =>
    testRequest(app, 'vocabularies/get_image_scales'));

  it('should return a permissions vocabulary', () =>
    testRequest(app, 'vocabularies/get_permissions'));

  it('should return a subjects vocabulary', () =>
    testRequest(app, 'vocabularies/get_subjects'));

  it('should return a supported languages vocabulary', () =>
    testRequest(app, 'vocabularies/get_supported_languages'));

  it('should return a system groups vocabulary', () =>
    testRequest(app, 'vocabularies/get_system_groups'));

  it('should return a system users vocabulary', () =>
    testRequest(app, 'vocabularies/get_system_users'));

  it('should return a system types vocabulary', () =>
    testRequest(app, 'vocabularies/get_types'));

  it('should return a system users vocabulary', () =>
    testRequest(app, 'vocabularies/get_users'));

  it('should return a workflow states vocabulary', () =>
    testRequest(app, 'vocabularies/get_workflow_states'));

  it('should return a workflow transitions vocabulary', () =>
    testRequest(app, 'vocabularies/get_workflow_transitions'));

  it('should return a workflows vocabulary', () =>
    testRequest(app, 'vocabularies/get_workflows'));

  it('should return a boolean vocabulary', () =>
    testRequest(app, 'vocabularies/get_boolean'));

  it('should return a captcha-providers vocabulary', () =>
    testRequest(app, 'vocabularies/get_captcha_providers'));

  it('should return a fields vocabulary', () =>
    testRequest(app, 'vocabularies/get_fields'));

  it('should return a available languages vocabulary', () =>
    testRequest(app, 'vocabularies/get_available_languages'));

  it('should return a plone.app.vocabularies vocabulary', () =>
    testRequest(app, 'vocabularies/get_plone_weekdays'));

  it('should support the plone.app.vocabularies names used by Volto', async () => {
    for (const name of [
      'AvailableContentLanguages',
      'Groups',
      'ImagesScales',
      'Keywords',
      'MetadataFields',
      'Month',
      'MonthAbbr',
      'PortalTypes',
      'Principals',
      'ReallyUserFriendlyTypes',
      'Roles',
      'SupportedContentLanguages',
      'Timezones',
      'UserFriendlyTypes',
      'Users',
      'Weekdays',
      'WeekdaysAbbr',
      'Workflows',
      'WorkflowStates',
      'WorkflowTransitions',
    ]) {
      const res = await request(app)
        .get(`/@vocabularies/plone.app.vocabularies.${name}`)
        .set(
          'Authorization',
          'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJhZG1pbiIsImZ1bGxuYW1lIjoiQWRtaW4iLCJpYXQiOjE2NDkzMTI0NDl9.RS1Ny_r0v7vIylFfK6q0JVJrkiDuTOh9iG9IL8xbzAk',
        )
        .expect(200);
      expect(res.body.items_total).toBe(res.body.items.length);
      if (!['Keywords'].includes(name)) {
        expect(res.body.items.length).toBeGreaterThan(0);
      }
    }
  });

  it('should not return the users vocabulary to anonymous', () =>
    testRequest(app, 'vocabularies/get_users_anonymous'));

  it('should not return the subjects vocabulary to anonymous', () =>
    request(app)
      .get('/@vocabularies/subjects')
      .set('Accept', 'application/json')
      .expect(401));

  it('should return a 404 if the vocabulary does not exist', () =>
    testRequest(app, 'vocabularies/get_notfound'));

  it('should not return the users and groups vocabularies to members', async () => {
    const token = await createUserWithToken('member');
    await request(app)
      .get('/@vocabularies/groups')
      .set('Accept', 'application/json')
      .expect(401);
    await request(app)
      .get('/@vocabularies/users')
      .set('Accept', 'application/json')
      .set('Authorization', `Bearer ${token}`)
      .expect(403);
    await request(app)
      .get('/@vocabularies/groups')
      .set('Accept', 'application/json')
      .set('Authorization', `Bearer ${token}`)
      .expect(403);

    // Also not through the principals vocabulary or the plone.app names
    for (const id of [
      'principals',
      'plone.app.vocabularies.Groups',
      'plone.app.vocabularies.Principals',
    ]) {
      await request(app)
        .get(`/@vocabularies/${id}`)
        .set('Accept', 'application/json')
        .set('Authorization', `Bearer ${token}`)
        .expect(403);
    }
  });

  it('should only return subjects of items the user can view', async () => {
    await request(app)
      .post('/')
      .set('Accept', 'application/json')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        '@type': 'Page',
        id: 'private-page',
        title: 'Private Page',
        subjects: ['secret-keyword'],
      })
      .expect(201);
    const tokens = (res: request.Response) =>
      res.body.items.map((item: any) => item.token);

    // An editor of the news folder, who can't view the private page
    const token = await createUserWithToken('editor');
    await request(app)
      .post('/news/@sharing')
      .set('Accept', 'application/json')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        entries: [{ id: 'editor', type: 'user', roles: { Editor: true } }],
        inherit: true,
      })
      .expect(204);
    const editor = await request(app)
      .get('/news/@vocabularies/subjects')
      .set('Accept', 'application/json')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(tokens(editor)).not.toContain('secret-keyword');

    // Admin
    const admin = await request(app)
      .get('/@vocabularies/subjects')
      .set('Accept', 'application/json')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(tokens(admin)).toContain('secret-keyword');
  });
});
