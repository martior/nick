/**
 * Timezones vocabulary.
 * @module vocabularies/timezones/timezones
 */

// Type imports
import type { Knex } from 'knex';
import type { Request, VocabularyTerm } from '../../types';

// Internal imports
import { arrayToVocabulary } from '../../helpers/utils/utils';

/**
 * Returns the timezones vocabulary.
 * @method timezones
 * @param {Request} _req Request object
 * @param {Knex.Transaction} _trx Transaction object
 * @returns {Promise<VocabularyTerm[]>} Array of terms.
 */
export async function timezones(
  _req: Request,
  _trx: Knex.Transaction,
): Promise<VocabularyTerm[]> {
  return arrayToVocabulary(['UTC', ...Intl.supportedValuesOf('timeZone')]);
}
