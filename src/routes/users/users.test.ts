/**
 * User tests.
 * @module routes/users/users
 */

// External imports
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { describe, expect, it, afterEach, vi } from 'vitest';

// Internal imports
import app from '../../app';
import * as mail from '../../helpers/mail/mail';
import {
  adminToken,
  createDocument,
  createUser,
  testRequest,
} from '../../helpers/tests/tests';
import models from '../../models';
import { User } from '../../models/user/user';

const token = adminToken;

describe('User', () => {
  afterEach(async () => {
    await testRequest(app, 'users/delete');
  });

  it('should get a list of users', () => testRequest(app, 'users/list'));

  it('should get a list of users by query', () =>
    testRequest(app, 'users/list_query'));

  it('should get an error when not logged in', () =>
    testRequest(app, 'users/list_anonymous'));

  it('should get an individual user', () => testRequest(app, 'users/get'));

  it('should not get a user when not logged in', () =>
    testRequest(app, 'users/get_anonymous'));

  it('should not get a user when not found', () =>
    testRequest(app, 'users/get_notfound'));

  it('should add a new user', () => testRequest(app, 'users/post'));

  it('should update a user', async () => {
    await testRequest(app, 'users/post');
    return testRequest(app, 'users/patch');
  });

  it('should delete a user', async () => {
    await testRequest(app, 'users/post');
    return testRequest(app, 'users/delete');
  });

  it('should send a reset password mail', async () => {
    await testRequest(app, 'users/post');
    return testRequest(app, 'users/reset_password_mail');
  });

  it('should reset a password once with a reset token', async () => {
    await testRequest(app, 'users/post');

    // Use real tokens, jwt.sign is mocked in the test setup
    const sign = vi.mocked(jwt.sign).getMockImplementation();
    vi.mocked(jwt.sign).mockRestore();
    try {
      // Request the mail and get the token from it
      vi.mocked(mail.sendMail).mockClear();
      await testRequest(app, 'users/reset_password_mail');
      const text = vi.mocked(mail.sendMail).mock.calls[0][0].text as string;
      const token = (text.match(/passwordreset\/([^\s]+)/) || [])[1];
      const reset = (resetToken: string) =>
        request(app)
          .post('/@users/headlessnick/reset-password')
          .set('Accept', 'application/json')
          .send({ reset_token: resetToken, new_password: 'headless' });

      // A login token is not a reset token
      const loginToken = jwt.sign(
        { sub: 'headlessnick', fullname: 'Nearly Headless Nick' },
        'secret',
        { expiresIn: '2h', algorithm: 'HS256' },
      );
      await reset(loginToken).expect(401);

      // The reset token works once and logs out all sessions
      await User.query(global.txn!)
        .findById('headlessnick')
        .patch({ tokens: [loginToken] } as any);
      await reset(token).expect(200);
      const user = await User.fetchById('headlessnick', {}, global.txn!);
      expect(user.tokens).toEqual([]);
      await reset(token).expect(401);
    } finally {
      vi.spyOn(jwt, 'sign').mockImplementation(sign as any);
    }
  });

  it('should set own password', async () => {
    await testRequest(app, 'users/post');
    return testRequest(app, 'users/reset_password_own');
  });

  it('should keep the content and versions of a deleted user', async () => {
    const Document = models.get('Document');
    const Version = models.get('Version');
    await createUser('jane');
    const news = await Document.fetchOne({ path: '/news' }, {}, global.txn!);
    const folder = await createDocument(
      '2b3c4d5e-0000-4000-8000-000000000001',
      news,
      'janes',
      'Folder',
      {
        owner: 'jane',
        workflow_history: JSON.stringify([
          {
            action: 'publish',
            actor: 'jane',
            review_state: 'published',
            time: '2022-04-08T16:00:00.000Z',
          },
        ]),
      },
    );
    await createDocument(
      '2b3c4d5e-0000-4000-8000-000000000002',
      folder,
      'deep',
      'Page',
      { owner: 'jane' },
    );
    await Version.create(
      {
        document: news.uuid,
        version: 2,
        id: 'news',
        created: '2022-04-08T16:00:00.000Z',
        actor: 'jane',
        json: { title: 'By Jane' },
      },
      {},
      global.txn!,
    );

    await request(app)
      .delete('/@users/jane')
      .set('Accept', 'application/json')
      .set('Authorization', `Bearer ${token}`)
      .expect(204);

    const deep = await Document.fetchOne(
      { path: '/news/janes/deep' },
      {},
      global.txn!,
    );
    expect(deep.owner).toBeNull();
    const version = await Version.fetchOne(
      { document: news.uuid, version: 2 },
      {},
      global.txn!,
    );
    expect(version.actor).toBeNull();

    const history = await request(app)
      .get('/news/janes/@history')
      .set('Accept', 'application/json')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(
      history.body.find((item: any) => item.type === 'workflow').actor.id,
    ).toBe('jane');
    await request(app)
      .get('/news/@history')
      .set('Accept', 'application/json')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
  });
});
