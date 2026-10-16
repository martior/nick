/**
 * Months vocabularies.
 * @module vocabularies/months/months
 */

// Type imports
import type { Knex } from 'knex';
import type { Request, VocabularyTerm } from '../../types';

/**
 * Returns the months vocabulary, January is 0.
 * @method months
 * @param {Request} req Request object
 * @param {Knex.Transaction} _trx Transaction object
 * @returns {Promise<VocabularyTerm[]>} Array of terms.
 */
export async function months(
  req: Request,
  _trx: Knex.Transaction,
): Promise<VocabularyTerm[]> {
  return [
    req.i18n('January'),
    req.i18n('February'),
    req.i18n('March'),
    req.i18n('April'),
    req.i18n('May'),
    req.i18n('June'),
    req.i18n('July'),
    req.i18n('August'),
    req.i18n('September'),
    req.i18n('October'),
    req.i18n('November'),
    req.i18n('December'),
  ].map((title: string, index: number) => ({ title, token: `${index}` }));
}

/**
 * Returns the abbreviated months vocabulary, January is 0.
 * @method monthsAbbr
 * @param {Request} req Request object
 * @param {Knex.Transaction} _trx Transaction object
 * @returns {Promise<VocabularyTerm[]>} Array of terms.
 */
export async function monthsAbbr(
  req: Request,
  _trx: Knex.Transaction,
): Promise<VocabularyTerm[]> {
  return [
    req.i18n('Jan'),
    req.i18n('Feb'),
    req.i18n('Mar'),
    req.i18n('Apr'),
    req.i18n('May'),
    req.i18n('Jun'),
    req.i18n('Jul'),
    req.i18n('Aug'),
    req.i18n('Sep'),
    req.i18n('Oct'),
    req.i18n('Nov'),
    req.i18n('Dec'),
  ].map((title: string, index: number) => ({ title, token: `${index}` }));
}
