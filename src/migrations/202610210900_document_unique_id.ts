/**
 * Make the ids of the documents in a folder unique.
 * @module migration/document_unique_id
 */

// Type imports
import type { Knex } from 'knex';

/**
 * Get the ids which are used more than once in a folder by documents which
 * are not in the recycle bin.
 * @method findDuplicates
 * @param {Knex} knex Knex object.
 * @returns {Promise<Array>} Paths of the folders, ids and counts.
 */
export const findDuplicates = async (
  knex: Knex,
): Promise<{ parent: string; id: string; count: number }[]> =>
  (
    await knex.raw(
      `SELECT coalesce(p.path, d.parent::text) AS parent, d.id, count(*)::int AS count
        FROM document d LEFT JOIN document p ON p.uuid = d.parent
        WHERE d.parent IS NOT NULL AND d.deleted IS NOT TRUE
        GROUP BY d.parent, p.path, d.id HAVING count(*) > 1
        ORDER BY 1, 2`,
    )
  ).rows;

export const up = async (knex: Knex): Promise<void> => {
  // Only one of the documents with the same id in a folder can be reached,
  // they have to be renamed or removed by hand first
  const duplicates = await findDuplicates(knex);
  if (duplicates.length > 0) {
    throw new Error(
      `${duplicates.length} ids are used more than once in a folder, rename or remove the documents first: ${duplicates
        .slice(0, 20)
        .map(({ parent, id, count }) => `${parent} ${id} (${count}x)`)
        .join(', ')}${duplicates.length > 20 ? ', ...' : ''}`,
    );
  }

  // Documents in the recycle bin keep their id, a new document can reuse it
  await knex.raw(
    'CREATE UNIQUE INDEX document_parent_id_unique ON document (parent, id) WHERE deleted IS NOT TRUE',
  );
};

export const down = async (knex: Knex): Promise<void> => {
  await knex.raw('DROP INDEX IF EXISTS document_parent_id_unique');
};
