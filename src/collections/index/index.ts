/**
 * IndexCollection.
 * @module collections/index/index
 */

// Type imports
import type { Knex } from 'knex';
import type { Json, Model, Request } from '../../types';

// Internal imports
import { Collection } from '../../collections/_collection/_collection';

interface IndexModel extends Model {
  name: string;
  toJson(req: Request, trx?: Knex.Transaction): Promise<Json>;
}

/**
 * Index Collection
 * @class IndexCollection
 * @extends Collection
 */
export class IndexCollection extends Collection<IndexModel> {
  /**
   * Returns JSON data.
   * @method toJson
   * @param {Request} req Request object.
   * @param {Knex.Transaction} trx Transaction object.
   * @returns {Promise<Json>} JSON object.
   */
  async toJson(req: Request, trx?: Knex.Transaction): Promise<Json> {
    const json: Json = {};

    // Add index to return json
    await Promise.all(
      this.map(async (index) => {
        json[index.name] = await index.toJson(req, trx);
      }),
    );

    // Return json
    return json;
  }
}
