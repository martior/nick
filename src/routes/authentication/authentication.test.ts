/**
 * Authentication tests.
 * @module routes/authentication/authentication
 */

// External imports
import { createHmac } from 'crypto';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';

// Internal imports
import app from '../../app';
import config from '../../helpers/config/config';
import { testRequest } from '../../helpers/tests/tests';

describe('Authentication', () => {
  it('should handle login', () =>
    testRequest(app, 'authentication/login_post_valid'));

  it('should give every token a unique id', async () => {
    const sign = vi.mocked(jwt.sign);
    sign.mockClear();
    await testRequest(app, 'authentication/login_post_valid');
    expect(sign).toHaveBeenCalledWith(
      expect.objectContaining({ sub: 'admin' }),
      expect.anything(),
      expect.objectContaining({
        jwtid: 'a95388f2-e4b3-4292-98aa-62656cbd5b9c',
      }),
    );
  });

  it('should fail on incorrect credentials', () =>
    testRequest(app, 'authentication/login_post_incorrect'));

  it('should fail on invalid user', () =>
    testRequest(app, 'authentication/login_post_invalid'));

  it('should fail on missing credentials', () =>
    testRequest(app, 'authentication/login_post_missing'));

  it('should handle login-renew with a valid user', () =>
    testRequest(app, 'authentication/login_renew_post_valid'));

  it('should handle login-renew with an invalid user', () =>
    testRequest(app, 'authentication/login_renew_post_invalid'));

  it('should treat a token of a deleted user as anonymous', () => {
    const encode = (data: object) =>
      Buffer.from(JSON.stringify(data)).toString('base64url');
    const unsigned = `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({
      sub: 'deleted',
      iat: 1649312449,
    })}`;
    const token = `${unsigned}.${createHmac('sha256', config.settings.secret)
      .update(unsigned)
      .digest('base64url')}`;
    return request(app)
      .post('/@login-renew')
      .set('Accept', 'application/json')
      .set('Authorization', `Bearer ${token}`)
      .expect(401);
  });

  it('should handle logout', () =>
    testRequest(app, 'authentication/logout_post'));
});
