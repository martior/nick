/**
 * Email tests.
 * @module routes/email/email
 */

// External imports
import request from 'supertest';
import { describe, it } from 'vitest';

// Internal imports
import app from '../../app';
import {
  adminToken,
  createUserWithToken,
  testRequest,
} from '../../helpers/tests/tests';

describe('Email', () => {
  it('should send an email', () => testRequest(app, 'mail/post'));

  it('should send an email to the webmaster', () =>
    testRequest(app, 'mail/post_webmaster'));

  it('should send an email to an user', () =>
    testRequest(app, 'mail/post_user'));

  it('should only send mail on the site root as a site manager', async () => {
    const mail = {
      to: 'someone@example.com',
      from: 'spoof@example.com',
      subject: 'Subject',
      message: 'Message',
    };

    // A local editor of the news folder
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
    await request(app)
      .post('/news/@email-send')
      .set('Accept', 'application/json')
      .set('Authorization', `Bearer ${token}`)
      .send(mail)
      .expect(401);
    await request(app)
      .post('/news/@users/admin/@email-notification')
      .set('Accept', 'application/json')
      .set('Authorization', `Bearer ${token}`)
      .send(mail)
      .expect(401);

    // Not on content, also not for the admin
    await request(app)
      .post('/news/@email-send')
      .set('Accept', 'application/json')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(mail)
      .expect(404);
  });
});
