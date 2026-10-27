/**
 * Config helper tests.
 * @module helpers/config/config.test
 */

// External imports
import { describe, expect, it } from 'vitest';

// Internal imports
import { getSecret } from './config';

describe('Config', () => {
  describe('getSecret', () => {
    it('should use a configured secret', () => {
      expect(getSecret('my-secret', undefined)).toBe('my-secret');
      expect(getSecret('my-secret', 'production')).toBe('my-secret');
    });

    it('should only use the default secret in development and tests', () => {
      expect(getSecret('secret', 'development')).toBe('secret');
      expect(getSecret(undefined, 'test')).toBe('secret');
    });

    it('should use a random secret without a configured secret', () => {
      const secret = getSecret('secret', undefined);
      expect(secret).not.toBe('secret');
      expect(secret).toHaveLength(64);
      expect(getSecret(undefined, 'staging')).not.toBe(secret);
    });

    it('should keep the default secret in production so the app refuses it', () => {
      expect(getSecret('secret', 'production')).toBe('secret');
    });
  });
});
