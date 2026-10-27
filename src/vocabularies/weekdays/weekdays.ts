/**
 * Weekdays vocabularies.
 * @module vocabularies/weekdays/weekdays
 */

// Type imports
import type { Knex } from 'knex';
import type { Request, VocabularyTerm } from '../../types';

/**
 * Returns the weekdays vocabulary, Monday is 0.
 * @method weekdays
 * @param {Request} req Request object
 * @param {Knex.Transaction} _trx Transaction object
 * @returns {Promise<VocabularyTerm[]>} Array of terms.
 */
export async function weekdays(
  req: Request,
  _trx: Knex.Transaction,
): Promise<VocabularyTerm[]> {
  return [
    req.i18n('Monday'),
    req.i18n('Tuesday'),
    req.i18n('Wednesday'),
    req.i18n('Thursday'),
    req.i18n('Friday'),
    req.i18n('Saturday'),
    req.i18n('Sunday'),
  ].map((title: string, index: number) => ({ title, token: `${index}` }));
}

/**
 * Returns the abbreviated weekdays vocabulary, Monday is 0.
 * @method weekdaysAbbr
 * @param {Request} req Request object
 * @param {Knex.Transaction} _trx Transaction object
 * @returns {Promise<VocabularyTerm[]>} Array of terms.
 */
export async function weekdaysAbbr(
  req: Request,
  _trx: Knex.Transaction,
): Promise<VocabularyTerm[]> {
  return [
    req.i18n('Mon'),
    req.i18n('Tue'),
    req.i18n('Wed'),
    req.i18n('Thu'),
    req.i18n('Fri'),
    req.i18n('Sat'),
    req.i18n('Sun'),
  ].map((title: string, index: number) => ({ title, token: `${index}` }));
}
