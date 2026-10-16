/**
 * Principals vocabulary.
 * @module vocabularies/principals/principals
 */

// Type imports
import type { Knex } from 'knex';
import type { Request, VocabularyTerm } from '../../types';

// Internal imports
import models from '../../models';

/**
 * Returns the principals (groups and users) vocabulary. Tokens are prefixed
 * with `group__` or `user__` like plone.app.vocabularies.Principals.
 * @method principals
 * @param {Request} req Request object
 * @param {Knex.Transaction} trx Transaction object
 * @returns {Promise<VocabularyTerm[]>} Array of terms.
 */
export async function principals(
  req: Request,
  trx: Knex.Transaction,
): Promise<VocabularyTerm[]> {
  const Group = models.get('Group');
  const User = models.get('User');
  const groups = await Group.fetchAll({}, { order: 'title' }, trx);
  const users = await User.fetchAll({}, { order: 'fullname' }, trx);
  return [
    ...groups.map((group: any) => ({
      title: req.i18n(group.title),
      token: `group__${group.id}`,
    })),
    ...users.map((user: any) => ({
      title: user.fullname || user.id,
      token: `user__${user.id}`,
    })),
  ];
}
