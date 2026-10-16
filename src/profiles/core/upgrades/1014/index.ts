/**
 * Upgrade 1014: make the title a text line of at most 1024 characters.
 * @module profiles/core/upgrades/1014
 */

// Type imports
import type { Knex } from 'knex';

// Internal imports
import { mapAsync } from '../../../../helpers/utils/utils';
import models from '../../../../models';

/**
 * Add the factory and maximum length of the title of the basic behavior and
 * update the cached schemas of the types.
 * @method init
 * @param {Knex.Transaction} trx Transaction object.
 * @returns {Promise<void>} Promise resolved when done.
 */
export async function init(trx: Knex.Transaction): Promise<void> {
  const Type = models.get('Type');
  const behavior = await trx('behavior').where({ id: 'basic' }).first();
  if (behavior?.schema?.properties?.title) {
    await trx('behavior')
      .where({ id: 'basic' })
      .update({
        schema: {
          ...behavior.schema,
          properties: {
            ...behavior.schema.properties,
            title: {
              factory: 'Text line (String)',
              maxLength: 1024,
              ...behavior.schema.properties.title,
            },
          },
        },
      });
  }
  const types = await Type.fetchAll({}, {}, trx);
  await mapAsync(types.models, async (type: any) => {
    await type.cacheSchema(trx);
  });
}
