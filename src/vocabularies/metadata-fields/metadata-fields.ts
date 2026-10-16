/**
 * Metadata fields vocabulary.
 * @module vocabularies/metadata-fields/metadata-fields
 */

// Type imports
import type { Knex } from 'knex';
import type { Request, VocabularyTerm } from '../../types';

// Internal imports
import models from '../../models';

/**
 * Returns the vocabulary of the metadata fields of the catalog.
 * @method metadataFields
 * @param {Request} req Request object
 * @param {Knex.Transaction} trx Transaction object
 * @returns {Promise<VocabularyTerm[]>} Array of terms.
 */
export async function metadataFields(
  req: Request,
  trx: Knex.Transaction,
): Promise<VocabularyTerm[]> {
  const Index = models.get('Index');
  const indexes = await Index.fetchAll(
    { metadata: true },
    { order: 'name' },
    trx,
  );
  return indexes.map((index: any) => ({
    title: index.title ? req.i18n(index.title) : index.name,
    token: index.name,
  }));
}
