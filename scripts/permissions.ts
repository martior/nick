/* eslint no-console: 0 */
/**
 * Permission model dry run: lists the content whose permissions change when
 * workflows use the acquire permission model. Nothing is changed.
 * @module scripts/permissions
 */

// Internal imports
import { knex } from '../src/helpers/knex/knex';
import {
  fetchPermissionModelChanges,
  formatPermissionModelChanges,
} from '../src/helpers/permissions/permissions';
import { initProfiles } from '../src/helpers/profiles/profiles';

/**
 * Main function
 * @function main
 * @return {undefined}
 */
async function main() {
  await initProfiles();
  const trx = await knex.transaction();
  try {
    const changes = await fetchPermissionModelChanges(trx);
    console.log(
      process.argv.includes('--json')
        ? JSON.stringify(changes, null, 2)
        : formatPermissionModelChanges(changes),
    );
  } finally {
    await trx.rollback();
    knex.destroy();
  }
}

main();
