/**
 * Catalog Model.
 * @module models/catalog/catalog
 */

// Type imports
import type { Json, Request, VocabularyTerm } from '../../types';
import type { Knex } from 'knex';

// External imports
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import { uniq } from 'es-toolkit/array';
import { pick } from 'es-toolkit/object';

// Internal imports
import { Model } from '../_model/_model';
import { principalTokens } from '../../helpers/auth/auth';
import config from '../../helpers/config/config';
import { getRootUrl } from '../../helpers/url/url';

dayjs.extend(utc);

/**
 * A model for Catalog.
 * @class Catalog
 * @extends Model
 */
export class Catalog extends Model {
  static tableName: string = 'catalog';
  static idColumn: string = 'document';

  // Declare properties
  declare _path: string;
  declare similarity: number;
  declare path: string;
  declare Type: string;
  declare Title: string;
  declare start: string;
  declare UID: string;
  declare created: string;
  declare modified: string;
  declare end: string;
  declare recurrence: string;
  declare deleted: boolean;
  declare image_field: string;
  declare image_scales: any;
  declare exclude_from_nav: boolean;
  declare items: any[];

  /**
   * Returns JSON data.
   * @method toJson
   * @param {Request} req Request object.
   * @returns {Json} JSON object.
   */
  toJson(req: Request): Json {
    const self: InstanceType<typeof Catalog> = this;
    const metadata = req.indexes.models.filter(
      (index: any) => index.metadata === true && index.enabled !== false,
    );

    if (
      config.settings.ai?.models?.embed?.enabled &&
      typeof self.similarity === 'number'
    ) {
      metadata.push({
        name: 'similarity',
      });
    }

    return {
      '@id': `${getRootUrl(req)}${self.path}`,
      '@type': self.Type,
      title: self.Title,
      ...pick(
        self,
        metadata.map((field: any) => field.name),
      ),
    } as Json;
  }

  /**
   * Fetch all items but take permissions into account.
   * @method fetchAllRestricted
   * @static
   * @param {Object} where Where clause.
   * @param {Object} options Options for the query.
   * @param {Knex.Transaction} trx Transaction object.
   * @param {Request} req Request object.
   * @returns {Promise<any>} JSON object.
   */
  static async fetchAllRestricted(
    where: any = {},
    options: any = {},
    trx?: Knex.Transaction,
    req?: Request,
  ): Promise<any> {
    if (!req) return this.fetchAll(where, options, trx);

    // Fetch data
    return this.fetchAll(this.restrictWhere(where, req), options, trx);
  }

  /**
   * Fetch a sorted batch of items, taking permissions into account, for a
   * query which matches only a few items: the items are filtered first and
   * sorted afterwards. Otherwise Postgres may walk an index in sort order
   * through most of the catalog to find the few items, because it can't
   * estimate how many items pass the permission filter.
   * @method fetchFewRestricted
   * @static
   * @param {Object} where Where clause.
   * @param {Object} options Options for the query.
   * @param {Knex.Transaction} trx Transaction object.
   * @param {Request} req Request object.
   * @returns {Promise<any>} Collection of items.
   */
  static async fetchFewRestricted(
    where: any = {},
    options: any = {},
    trx?: Knex.Transaction,
    req?: Request,
  ): Promise<any> {
    const { order, limit, offset, ...rest } = options;
    const matches = this.buildQuery(
      req ? this.restrictWhere(where, req) : where,
      rest,
      trx,
    ).toKnexQuery();
    // The materialized CTE is named like the table, so the outer query
    // reads the matches; inside the CTE catalog is still the table
    const items = await this.buildQuery(
      {},
      { order, limit, offset },
      trx,
    ).withMaterialized('catalog', matches);
    return new this.collection(items);
  }

  /**
   * Count all items but take permissions into account.
   * @method countRestricted
   * @static
   * @param {Object} where Where clause.
   * @param {Knex.Transaction} trx Transaction object.
   * @param {Request} req Request object.
   * @returns {Promise<number>} Number of items.
   */
  static async countRestricted(
    where: any = {},
    trx?: Knex.Transaction,
    req?: Request,
  ): Promise<number> {
    return await this.buildQuery(
      req ? this.restrictWhere(where, req) : where,
      {},
      trx,
    ).resultSize();
  }

  /**
   * Add the permission restrictions of the current user to a where clause.
   * @method restrictWhere
   * @static
   * @param {Object} where Where clause.
   * @param {Request} req Request object.
   * @returns {Object} Restricted where clause.
   */
  static restrictWhere(where: any, req: Request): any {
    // Find user, groups and roles
    const userGroupsRoles = uniq(principalTokens(req.user));

    return {
      ...where,
      _allowedUsersGroupsRoles: ['&&', userGroupsRoles],
      _deleted: false,
    };
  }

  /**
   * Fetch all items closest by embedding but take permissions into account.
   * @method fetchClosestEmbeddingRestricted
   * @static
   * @param {any} embedding Embedding vector to compare.
   * @param {number} limit Limit for the query.
   * @param {Knex.Transaction} trx Transaction object.
   * @param {Request} req Request object.
   * @returns {Promise<any>} JSON object.
   */
  static async fetchClosestEmbeddingRestricted(
    embedding: any,
    limit: number,
    trx?: Knex.Transaction,
    req?: Request,
  ): Promise<any> {
    // Fetch data
    return this.fetchAllRestricted(
      { deleted: false },
      {
        select: [
          '*',
          this.knex().raw(`1 - (_embedding <=> '${embedding}') AS similarity`),
        ],
        order: { column: 'similarity', reverse: true },
        limit,
      },
      trx,
      req,
    );
  }

  /**
   * Returns a vocabulary term.
   * @method getVocabularyTerm
   * @param {Request} req Request object.
   * @returns {VocabularyTerm} Vocabulary term.
   */
  getVocabularyTerm(req: Request): VocabularyTerm {
    const self: InstanceType<typeof Catalog> = this;
    return {
      title: req.i18n(self.Title),
      token: self.Title,
    };
  }

  /**
   * Convert document to ICS event format
   * @method toICSEvent
   * @return {string | null} ICS string or null if start or end date is missing
   */
  toICSEvent(): string | null {
    const self: InstanceType<typeof Catalog> = this;

    // Check if start date is available
    if (!self.start) {
      return null;
    }

    // Set event data
    const event = {
      SUMMARY: self.Title,
      DTSTART: dayjs(self.start).utc().format('YYYYMMDDTHHmmss[Z]'),
      DTSTAMP: dayjs().utc().format('YYYYMMDDTHHmmss[Z]'),
      UID: `${self.UID}@${config.settings.frontendUrl}`,
      CREATED: dayjs(self.created).utc().format('YYYYMMDDTHHmmss[Z]'),
      'LAST-MODIFIED': dayjs(self.modified).utc().format('YYYYMMDDTHHmmss[Z]'),
      URL: `${config.settings.frontendUrl}${self.path === '/' ? '' : self.path}`,
    } as any;

    // Add end date if available
    if (self.end) {
      event.DTEND = dayjs(self.end).utc().format('YYYYMMDDTHHmmss[Z]');
    }

    // Add recurrence rule if available
    if (self.recurrence) {
      self.recurrence.split('\n').forEach((rule: string) => {
        const [key, value] = rule.split(':');
        event[key] = value;
      });
    }

    return `BEGIN:VEVENT
${Object.keys(event)
  .map((key) => `${key}:${event[key]}`)
  .join('\n')}
END:VEVENT`;
  }
}
