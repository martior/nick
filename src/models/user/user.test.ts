/**
 * User model tests.
 * @module models/user/user.test
 */

// External imports
import { describe, expect, it } from 'vitest';

// Internal imports
import '../../app';
import { addToken } from '../../helpers/auth/auth';
import { createUser } from '../../helpers/tests/tests';
import models from '../../models';

describe('User', () => {
  describe('lockTokens', () => {
    it('keeps tokens stored after the user was fetched', async () => {
      const User = models.get('User');
      const first = await createUser('jane');

      // A login that fetched the user before the first token was stored
      const stale = await User.fetchById('jane', {}, global.txn!);
      stale.tokens = [];
      const second = await createUser('john');
      await stale.lockTokens(global.txn!);
      await addToken(stale, second, global.txn!);

      const user = await User.fetchById('jane', {}, global.txn!);
      expect(user.tokens).toEqual([first, second]);
    });
  });
});
