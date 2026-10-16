/**
 * Vocabularies tests.
 * @module routes/vocabularies/vocabularies
 */

// External imports
import request from 'supertest';
import { describe, expect, it } from 'vitest';

// Internal imports
import app from '../../app';
import { testRequest } from '../../helpers/tests/tests';

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

  it('should return a 404 if the vocabulary does not exist', () =>
    testRequest(app, 'vocabularies/get_notfound'));
});
