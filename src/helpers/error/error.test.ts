/**
 * Error helper tests.
 * @module helpers/error/error.test
 */

// External imports
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';

// Internal imports
import app from '../../app';
import models from '../../models';
import { isRetryableError } from './error';

describe('Error', () => {
  describe('isRetryableError', () => {
    it('detects deadlocks and serialization failures', () => {
      expect(isRetryableError({ code: '40P01' })).toBe(true);
      expect(isRetryableError({ nativeError: { code: '40001' } })).toBe(true);
      expect(isRetryableError({ code: '23505' })).toBe(false);
      expect(isRetryableError(undefined)).toBe(false);
    });
  });

  describe('retry', () => {
    it('runs a request again after a deadlock', async () => {
      const Document = models.get('Document');
      const deadlock = Object.assign(new Error('deadlock detected'), {
        code: '40P01',
      });
      const toJson = vi
        .spyOn(Document.prototype, 'toJson')
        .mockRejectedValueOnce(deadlock);

      await request(app)
        .get('/news')
        .set('Accept', 'application/json')
        .expect(200);
      expect(toJson).toHaveBeenCalledTimes(2);
      toJson.mockRestore();
    });

    it('gives up after three attempts', async () => {
      const Document = models.get('Document');
      const deadlock = Object.assign(new Error('deadlock detected'), {
        code: '40P01',
      });
      const toJson = vi
        .spyOn(Document.prototype, 'toJson')
        .mockRejectedValue(deadlock);

      await request(app)
        .get('/news')
        .set('Accept', 'application/json')
        .expect(500);
      expect(toJson).toHaveBeenCalledTimes(3);
      toJson.mockRestore();
    });
  });
});
