/**
 * Index Model.
 * @module models/index/index
 */

// Type imports
import type { IndexOperator, Json, Request } from '../../types';

// Type imports
import type { Knex } from 'knex';

// External imports
import { mapKeys, mapValues } from 'es-toolkit/object';

// Internal imports
import { Model } from '../_model/_model';
import { IndexCollection } from '../../collections/index/index';
import { QS_PREFIX } from '../../helpers/query/query';
import vocabularies from '../../vocabularies';

/**
 * Vocabularies of which the values are returned inline, like the
 * fetch_vocabulary option of plone.app.querystring.
 * @constant fetchVocabularies
 */
const fetchVocabularies = ['types', 'workflowStates'];

/**
 * A model for Index.
 * @class Index
 * @extends Model
 */
export class Index extends Model {
  static tableName: string = 'index';
  static collection: (typeof Model)['collection'] =
    IndexCollection as unknown as (typeof Model)['collection'];

  // Declare properties.
  declare title: string;
  declare description: string;
  declare name: string;
  declare group: string;
  declare enabled: boolean;
  declare sortable: boolean;
  declare vocabulary: string;
  declare operators: IndexOperator[];
  declare type:
    | 'string'
    | 'integer'
    | 'float'
    | 'path'
    | 'uuid'
    | 'boolean'
    | 'date'
    | 'string[]'
    | 'uuid[]'
    | 'text';

  /**
   * Returns JSON data.
   * @method toJSON
   * @param {Request} req Request object
   * @param {Knex.Transaction} trx Transaction object
   * @returns {Promise<Json>} JSON object.
   */
  async toJson(req: Request, trx?: Knex.Transaction): Promise<Json> {
    const self: InstanceType<typeof Index> = this;

    // Get the values of the vocabulary
    const values: Record<string, { title: string }> = {};
    if (trx && fetchVocabularies.includes(self.vocabulary)) {
      const terms: any = await vocabularies.get(self.vocabulary)(req, trx);
      (Array.isArray(terms) ? terms : terms.items || []).map((term: any) => {
        values[term.token] = { title: term.title };
      });
    }

    // Operations are named like the plone.app.querystring operations
    const operators = mapKeys(
      self.operators || {},
      (_operator: any, key: string) => `${QS_PREFIX}${key}`,
    );

    return {
      title: req.i18n(self.title),
      description: req.i18n(self.description),
      group: self.group,
      enabled: self.enabled,
      sortable: self.sortable,
      values,
      vocabulary: self.vocabulary,
      operations: Object.keys(operators),
      operators: mapValues(operators, (operator: any) => ({
        ...operator,
        title: req.i18n(operator.title),
        description: req.i18n(operator.description),
      })),
    } as Json;
  }
}
