/**
 * Limiter helper tests.
 * @module helpers/limiter/limiter.test
 */

// External imports
import express from 'express';
import { rateLimit } from 'express-rate-limit';
import request from 'supertest';
import { describe, expect, it } from 'vitest';

// Internal imports
import config from '../config/config';
import { getStore, PostgresStore } from './limiter';

describe('PostgresStore', () => {
  it('should count hits per window', async () => {
    const store = new PostgresStore('test:');
    store.init({ windowMs: 60000 } as any);

    expect(await store.get('1.2.3.4')).toBeUndefined();
    expect((await store.increment('1.2.3.4')).totalHits).toBe(1);
    const second = await store.increment('1.2.3.4');
    expect(second.totalHits).toBe(2);
    expect(second.resetTime!.getTime()).toBeGreaterThan(Date.now());
    expect((await store.get('1.2.3.4'))!.totalHits).toBe(2);

    // Other keys and prefixes are counted separately
    expect((await store.increment('5.6.7.8')).totalHits).toBe(1);
    expect(
      (await new PostgresStore('other:').increment('1.2.3.4')).totalHits,
    ).toBe(1);

    await store.decrement('1.2.3.4');
    expect((await store.get('1.2.3.4'))!.totalHits).toBe(1);

    // A new window starts when the old one is over
    await global.txn!('rate_limit')
      .where({ key: 'test:1.2.3.4' })
      .update({ reset_time: global.txn!.raw("now() - interval '1 second'") });
    expect(await store.get('1.2.3.4')).toBeUndefined();
    expect((await store.increment('1.2.3.4')).totalHits).toBe(1);

    await store.resetKey('1.2.3.4');
    expect(await store.get('1.2.3.4')).toBeUndefined();
  });

  it('should limit requests across processes', async () => {
    // Two apps stand for two API processes sharing the database
    const app = () => {
      const instance = express();
      instance.use(
        rateLimit({
          windowMs: 60000,
          max: 2,
          store: new PostgresStore('shared:'),
        }),
      );
      instance.get('/', (_req, res) => {
        res.send('ok');
      });
      return instance;
    };
    const first = app();
    const second = app();

    await request(first).get('/').expect(200);
    await request(second).get('/').expect(200);
    await request(first).get('/').expect(429);
    await request(second).get('/').expect(429);
  });

  it('should use the memory store by default', () => {
    expect(getStore('api:')).toBeUndefined();
    config.settings.rateLimit.store = 'postgres';
    expect(getStore('api:')).toBeInstanceOf(PostgresStore);
    config.settings.rateLimit.store = 'memory';
  });
});
