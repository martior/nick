/**
 * Auth helper.
 * @module helpers/auth/auth
 */

// Type imports
import type { Request, User } from '../../types';

// External imports
import { createHash, createHmac } from 'crypto';
import { isUndefined } from 'es-toolkit/predicate';
import jwt from 'jsonwebtoken';
import { Knex } from 'knex';

// Internal imports
import config from '../config/config';

/**
 * Check required permission.
 * @method hasPermission
 * @param {string[]} permissions Permissions of the current user.
 * @param {string} permission Permission to check.
 * @returns {boolean} True if you have permission.
 */
export function hasPermission(
  permissions: string[],
  permission: string,
): boolean {
  return isUndefined(permission) || permissions.includes(permission);
}

/**
 * Extract the auth token from a request either the Authorization header
 * or the auth_token cookie.
 * @method getTokenFromRequest
 * @param {Object} headers Request headers.
 * @returns {string} Auth token.
 */
export function getTokenFromRequest(headers: {
  authorization?: string;
  cookie?: string;
}): string | undefined {
  const authMatch = headers.authorization?.match(/^Bearer (.*)$/);
  if (authMatch) {
    return authMatch[1];
  }

  const cookieMatch = headers.cookie?.match(/(?:^|;\s*)auth_token=([^;]*)/);
  return cookieMatch ? decodeURIComponent(cookieMatch[1]) : undefined;
}

/**
 * Get user based on token.
 * @method getUserId
 * @param {Object} req Request object.
 * @returns {string} User id.
 */
export function getUserId(req: Request): string | undefined {
  // Check if auth token
  if (!req.token) {
    return 'anonymous';
  } else {
    let decoded;
    try {
      decoded = jwt.verify(req.token, config.settings.secret, {
        algorithms: ['HS256'],
      });
    } catch (_err) {
      return 'anonymous';
    }

    // Return user id
    return typeof decoded.sub === 'string' ? decoded.sub : undefined;
  }
}

/**
 * Add jwt token to user
 * @method addToken
 * @param {User} user User object.
 * @param {string} token Token to be added.
 * @param {Knex.Transaction} trx Knex Transaction
 */
export async function addToken(
  user: User,
  token: string,
  trx: Knex.Transaction,
): Promise<void> {
  // Get tokens
  let tokens = user.tokens || [];

  // Remove expired tokens
  tokens = tokens.filter((token) => {
    try {
      jwt.verify(token, config.settings.secret);
      return true;
    } catch (_err) {
      return false;
    }
  });

  // Add new token
  tokens.push(token);

  // Store tokens
  await user.update({ tokens }, trx);
}

/**
 * Remove jwt token from user
 * @method removeToken
 * @param {User} user User object.
 * @param {string} token Token to be removed.
 * @param {Knex.Transaction} trx Knex Transaction
 */
export async function removeToken(
  user: User,
  token: string,
  trx: Knex.Transaction,
): Promise<undefined> {
  // Get tokens
  let tokens = user.tokens || [];

  // Remove expired tokens
  tokens = tokens.filter(
    (tokenFromArray: string | undefined) => tokenFromArray !== token,
  );

  // Store tokens
  await user.update({ tokens }, trx);
}

/**
 * Get the secret for password reset tokens. It is derived from the secret, so
 * a reset token is never a valid login token and the other way around.
 * @method getResetSecret
 * @returns {string} Secret.
 */
function getResetSecret(): string {
  return createHmac('sha256', config.settings.secret)
    .update('reset-password')
    .digest('hex');
}

/**
 * Get a fingerprint of the current password of a user. It changes when the
 * password changes, which makes a reset token valid only once.
 * @method getPasswordFingerprint
 * @param {User} user User object.
 * @returns {string} Fingerprint.
 */
function getPasswordFingerprint(user: User): string {
  return createHash('sha256')
    .update(`${user.id}:${(user as any).password || ''}`)
    .digest('hex');
}

/**
 * Create a password reset token for a user.
 * @method createResetToken
 * @param {User} user User object.
 * @returns {string} Reset token.
 */
export function createResetToken(user: User): string {
  return jwt.sign(
    {
      sub: user.id,
      purpose: 'reset-password',
      fingerprint: getPasswordFingerprint(user),
    },
    getResetSecret(),
    { expiresIn: '2h', algorithm: 'HS256' },
  );
}

/**
 * Check a password reset token of a user. Login tokens, tokens of other
 * users and tokens used before (the password changed since) are invalid.
 * @method verifyResetToken
 * @param {string} token Reset token.
 * @param {User} user User object.
 * @returns {boolean} True if valid.
 */
export function verifyResetToken(token: string, user: User): boolean {
  try {
    const decoded: any = jwt.verify(token, getResetSecret(), {
      algorithms: ['HS256'],
    });
    return (
      decoded.purpose === 'reset-password' &&
      decoded.sub === user.id &&
      decoded.fingerprint === getPasswordFingerprint(user)
    );
  } catch (_err) {
    return false;
  }
}
