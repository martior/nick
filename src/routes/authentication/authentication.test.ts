/**
 * Authentication tests.
 * @module routes/authentication/authentication
 */

// External imports
import jwt from 'jsonwebtoken';
import { describe, expect, it, vi } from 'vitest';

// Internal imports
import app from '../../app';
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

  it('should handle logout', () =>
    testRequest(app, 'authentication/logout_post'));
});
