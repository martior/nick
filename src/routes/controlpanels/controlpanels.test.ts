/**
 * Controlpanels tests.
 * @module routes/controlpanels/controlpanels
 */

// External imports
import request from 'supertest';
import { describe, expect, it } from 'vitest';

// Internal imports
import app from '../../app';
import { adminToken, testRequest } from '../../helpers/tests/tests';
import { Controlpanel } from '../../models/controlpanel/controlpanel';

describe('Controlpanels', () => {
  it('should return the controlpanels', () =>
    testRequest(app, 'controlpanels/list'));

  it('should return a controlpanel', () =>
    testRequest(app, 'controlpanels/get'));

  it('should update a controlpanel', () =>
    testRequest(app, 'controlpanels/patch'));

  it('should return the types controlpanel', () =>
    testRequest(app, 'controlpanels/get_types'));

  it('should add a type in the types controlpanel', () =>
    testRequest(app, 'controlpanels/post_types'));

  it('should delete a type in the types controlpanel', () =>
    testRequest(app, 'controlpanels/delete_type'));

  it('should get a type in the types controlpanel', () =>
    testRequest(app, 'controlpanels/get_type'));

  it('should update a type in the types controlpanel', () =>
    testRequest(app, 'controlpanels/patch_type'));

  it('should return the content rules controlpanel', () =>
    testRequest(app, 'controlpanels/get_content_rules'));

  it('should add a content rule in the content rules controlpanel', () =>
    testRequest(app, 'controlpanels/post_content_rules'));

  it('should delete a content rule in the content rules controlpanel', () =>
    testRequest(app, 'controlpanels/delete_content_rule'));

  it('should get a content rule in the content rules controlpanel', () =>
    testRequest(app, 'controlpanels/get_content_rule'));

  it('should update a content rule in the content rules controlpanel', () =>
    testRequest(app, 'controlpanels/patch_content_rule'));

  it('should add an action to a content rule in the content rules controlpanel', () =>
    testRequest(app, 'controlpanels/post_content_rules_action'));

  it('should add a condition to a content rule in the content rules controlpanel', () =>
    testRequest(app, 'controlpanels/post_content_rules_condition'));

  it('should update an action to a content rule in the content rules controlpanel', () =>
    testRequest(app, 'controlpanels/patch_content_rule_action'));

  it('should update a condition to a content rule in the content rules controlpanel', () =>
    testRequest(app, 'controlpanels/patch_content_rule_condition'));

  it('should delete an action of a content rule in the content rules controlpanel', () =>
    testRequest(app, 'controlpanels/delete_content_rule_action'));

  it('should delete a condition of a content rule in the content rules controlpanel', () =>
    testRequest(app, 'controlpanels/delete_content_rule_condition'));

  it('should move an action of a content rule in the content rules controlpanel', () =>
    testRequest(app, 'controlpanels/move_content_rule_action'));

  it('should move a condition of a content rule in the content rules controlpanel', () =>
    testRequest(app, 'controlpanels/move_content_rule_condition'));

  it('should never return a stored password', async () => {
    const admin = (req: request.Test) =>
      req
        .set('Accept', 'application/json')
        .set('Authorization', `Bearer ${adminToken}`);
    await admin(request(app).patch('/@controlpanels/mail'))
      .send({ pass: 'secret' })
      .expect(204);

    // The password is not returned
    const res = await admin(request(app).get('/@controlpanels/mail')).expect(
      200,
    );
    expect(res.body.data.pass).toBeNull();

    // Sending the form back without a password keeps it
    await admin(request(app).patch('/@controlpanels/mail'))
      .send({ ...res.body.data, host: 'mail.example.com' })
      .expect(204);
    const mail = await Controlpanel.fetchById('mail', {}, global.txn!);
    expect(mail.data.pass).toBe('secret');
    expect(mail.data.host).toBe('mail.example.com');
  });
});
