/**
 * Upgrade 1007: add the selection.none querystring operation.
 * @module profiles/core/upgrades/1007
 */

// Type imports
import type { Knex } from 'knex';

// Internal imports
import { mapAsync } from '../../../../helpers/utils/utils';

/**
 * Add the selection.none operation to the selection indexes.
 * @method init
 * @param {Knex.Transaction} trx Transaction object.
 * @returns {Promise<void>} Promise resolved when done.
 */
export async function init(trx: Knex.Transaction): Promise<void> {
  const indexes = await trx('index').whereIn('id', [
    '_Subject',
    '_portal_type',
    '_review_state',
  ]);
  await mapAsync(indexes, async (index: any) => {
    if (index.operators && !index.operators['selection.none']) {
      await trx('index')
        .where({ id: index.id })
        .update({
          operators: {
            ...index.operators,
            'selection.none': {
              title: 'Matches none of',
              description: 'Tip: you can use * to autocomplete.',
              operation: 'excludes',
              widget: 'MultipleSelectionWidget',
            },
          },
        });
    }
  });
}
