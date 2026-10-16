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
import { errorBody, isDuplicateIdError, isRetryableError } from './error';

describe('Error', () => {
  describe('errorBody', () => {
    it('adds the plone.restapi error type', () => {
      expect(errorBody(400, { message: 'Bad' })).toStrictEqual({
        type: 'BadRequest',
        message: 'Bad',
      });
      expect(errorBody(404, { error: 'Not found.' })).toStrictEqual({
        type: 'NotFound',
        message: 'Not found.',
      });
      expect(
        errorBody(401, { error: { type: 'Document locked', message: 'x' } }),
      ).toStrictEqual({ error: { type: 'Document locked', message: 'x' } });
      expect(errorBody(403, { type: 'Custom', message: 'x' })).toStrictEqual({
        type: 'Custom',
        message: 'x',
      });
    });
  });

  describe('error responses', () => {
    const token =
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJhZG1pbiIsImZ1bGxuYW1lIjoiQWRtaW4iLCJpYXQiOjE2NDkzMTI0NDl9.RS1Ny_r0v7vIylFfK6q0JVJrkiDuTOh9iG9IL8xbzAk';

    it('answers invalid json with a json error', async () => {
      const res = await request(app)
        .post('/news')
        .set('Accept', 'application/json')
        .set('Content-Type', 'application/json')
        .set('Authorization', `Bearer ${token}`)
        .send('{not json')
        .expect(400);
      expect(res.body).toStrictEqual({
        type: 'BadRequest',
        message: 'The request body is not valid JSON.',
      });
    });

    it('answers a duplicate id in a folder with 400', async () => {
      const Document = models.get('Document');
      const duplicate = Object.assign(new Error('duplicate key'), {
        code: '23505',
        constraint: 'document_parent_id_unique',
      });
      expect(isDuplicateIdError(duplicate)).toBe(true);
      expect(isDuplicateIdError({ nativeError: duplicate })).toBe(true);
      expect(isDuplicateIdError({ code: '23505', constraint: 'other' })).toBe(
        false,
      );
      const spy = vi
        .spyOn(Document, 'replacePath')
        .mockRejectedValue(duplicate);
      try {
        const res = await request(app)
          .patch('/news')
          .set('Accept', 'application/json')
          .set('Authorization', `Bearer ${token}`)
          .send({ id: 'news-renamed' })
          .expect(400);
        expect(res.body).toStrictEqual({
          type: 'BadRequest',
          message: 'The id is already in use in this folder.',
        });
      } finally {
        spy.mockRestore();
      }
    });

    it('redirects to an absolute url', async () => {
      const Redirect = models.get('Redirect');
      const Document = models.get('Document');
      const news = await Document.fetchOne({ path: '/news' }, {}, global.txn!);
      await Redirect.create(
        { document: news.uuid, path: '/old-news' },
        {},
        global.txn!,
      );
      const res = await request(app)
        .get('/old-news')
        .set('Accept', 'application/json')
        .expect(301);
      expect(res.headers.location).toBe('http://localhost:8080/news');
    });
  });

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
