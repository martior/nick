/**
 * Upgrade 1018: sort titles like Plone's sortable_title.
 * @module profiles/core/upgrades/1018
 */

// Type imports
import type { Knex } from 'knex';

// Internal imports
import { sortableTitle } from '../../../../helpers/utils/utils';

/**
 * Number of catalog rows updated with one statement.
 * @constant BATCH_SIZE
 */
const BATCH_SIZE = 5000;

/**
 * Index the sortable title with the sortableTitle method instead of the
 * title and recompute the sortable title of all catalog rows from the title
 * metadata, in batches, so no full reindex is needed.
 * @method init
 * @param {Knex.Transaction} trx Transaction object.
 * @returns {Promise<void>} Promise resolved when done.
 */
export async function init(trx: Knex.Transaction): Promise<void> {
  const index = await trx('index').where({ name: 'sortable_title' }).first();
  if (!index) {
    return;
  }
  await trx('index')
    .where({ name: 'sortable_title' })
    .update({ attr: 'sortableTitle' });

  let last: string | undefined;
  for (;;) {
    const rows = await trx('catalog')
      .select('document', 'Title')
      .modify((query: Knex.QueryBuilder) => {
        if (last) {
          query.where('document', '>', last);
        }
      })
      .orderBy('document')
      .limit(BATCH_SIZE);
    if (rows.length === 0) {
      break;
    }
    last = rows[rows.length - 1].document;
    await trx.raw(
      `UPDATE catalog SET "_sortable_title" = v.title
        FROM jsonb_to_recordset(?::jsonb) AS v(document uuid, title text)
        WHERE catalog.document = v.document`,
      [
        JSON.stringify(
          rows.map((row: any) => ({
            document: row.document,
            title: sortableTitle(row.Title),
          })),
        ),
      ],
    );
  }
}
