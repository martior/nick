/**
 * Limiter helper.
 * @module helpers/limiter/limiter
 */

// Type imports
import type {
  ClientRateLimitInfo,
  IncrementResponse,
  Options,
  Store,
} from 'express-rate-limit';

// External imports
import { rateLimit } from 'express-rate-limit';

// Internal imports
import config from '../../helpers/config/config';
import { Model } from '../../models/_model/_model';

/**
 * A rate limit store in Postgres, shared by all API processes.
 * @class PostgresStore
 */
export class PostgresStore implements Store {
  public prefix: string;
  public windowMs: number;
  public localKeys: boolean;

  /**
   * Construct a PostgresStore.
   * @constructs PostgresStore
   * @param {string} prefix Prefix of the keys.
   */
  constructor(prefix: string) {
    this.prefix = prefix;
    this.windowMs = 60000;
    this.localKeys = false;
  }

  /**
   * Initialize the store.
   * @param {Options} options Options of the rate limiter.
   */
  init(options: Options): void {
    this.windowMs = options.windowMs;
  }

  /**
   * Get the info of a key.
   * @param {string} key The key (client ip).
   * @returns {Promise<ClientRateLimitInfo | undefined>} The info.
   */
  async get(key: string): Promise<ClientRateLimitInfo | undefined> {
    const row = await Model.knex()('rate_limit')
      .where({ key: `${this.prefix}${key}` })
      .where('reset_time', '>', Model.knex().fn.now())
      .first();
    return row
      ? { totalHits: row.hits, resetTime: new Date(row.reset_time) }
      : undefined;
  }

  /**
   * Count a hit of a key; start a new window if the old one is over.
   * @param {string} key The key (client ip).
   * @returns {Promise<IncrementResponse>} The hits and the reset time.
   */
  async increment(key: string): Promise<IncrementResponse> {
    const knex = Model.knex();
    const result = await knex.raw(
      `insert into rate_limit (key, hits, reset_time)
       values (?, 1, clock_timestamp() + make_interval(secs => ?))
       on conflict (key) do update set
         hits = case when rate_limit.reset_time <= clock_timestamp()
           then 1 else rate_limit.hits + 1 end,
         reset_time = case when rate_limit.reset_time <= clock_timestamp()
           then excluded.reset_time else rate_limit.reset_time end
       returning hits, reset_time`,
      [`${this.prefix}${key}`, this.windowMs / 1000],
    );

    // Now and then remove counters of windows which are over
    if (Math.random() < 0.01) {
      await knex('rate_limit')
        .where('reset_time', '<', knex.raw('clock_timestamp()'))
        .delete();
    }

    const [row] = result.rows;
    return { totalHits: row.hits, resetTime: new Date(row.reset_time) };
  }

  /**
   * Remove a hit of a key.
   * @param {string} key The key (client ip).
   */
  async decrement(key: string): Promise<void> {
    await Model.knex()('rate_limit')
      .where({ key: `${this.prefix}${key}` })
      .where('hits', '>', 0)
      .decrement('hits', 1);
  }

  /**
   * Reset a key.
   * @param {string} key The key (client ip).
   */
  async resetKey(key: string): Promise<void> {
    await Model.knex()('rate_limit')
      .where({ key: `${this.prefix}${key}` })
      .delete();
  }
}

/**
 * Get the store of a rate limiter: in memory (per process, the default) or
 * in Postgres (shared by all processes).
 * @method getStore
 * @param {string} prefix Prefix of the keys.
 * @returns {Store | undefined} The store, undefined for the memory store.
 */
export function getStore(prefix: string): Store | undefined {
  return config.settings.rateLimit?.store === 'postgres'
    ? new PostgresStore(prefix)
    : undefined;
}

export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: config.settings.rateLimit?.api || 100,
  message: { message: 'Too many requests' },
  standardHeaders: true,
  legacyHeaders: false,
  store: getStore('api:'),
});

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: config.settings.rateLimit?.auth || 5,
  message: { message: 'Too many authentication attempts' },
  standardHeaders: true,
  legacyHeaders: false,
  store: getStore('auth:'),
});
