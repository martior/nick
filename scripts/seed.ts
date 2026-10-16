/* eslint no-console: 0 */
/**
 * Seed script.
 * @module scripts/seed
 */

// Type imports
import type { Knex } from 'knex';

// External imports
import { last } from 'es-toolkit/array';

// Internal imports
import { fileExists } from '../src/helpers/fs/fs';
import { stripI18n } from '../src/helpers/i18n/i18n';
import { knex } from '../src/helpers/knex/knex';
import { upgradeProfiles } from '../src/helpers/migrate/migrate';
import { initProfiles, mapProfiles } from '../src/helpers/profiles/profiles';
import models from '../src/models';
import seeds from '../src/seeds';

const reset = '\x1b[0m';
const underline = '\x1b[4m';

/**
 * Main function
 * @function main
 * @return {undefined}
 */
async function main() {
  const command = last(process.argv);
  await initProfiles();

  // Run the upgrade steps
  if (command === 'upgrade') {
    try {
      await upgradeProfiles();
    } catch (err) {
      console.error(err);
      process.exitCode = 1;
    }
    await knex.destroy();
    return;
  }

  const trx = await knex.transaction();
  const Profile = models.get('Profile');

  try {
    await mapProfiles(async (profilePath, index) => {
      if (await fileExists(`${profilePath}/metadata`)) {
        const metadata = stripI18n(await import(`${profilePath}/metadata`));
        const profile = await Profile.fetchOne({ id: metadata.id }, {}, trx);

        switch (command) {
          case 'status':
            if (index === 0) {
              console.log(
                `${`${underline}Profile${reset}`.padEnd(58)}${`${underline}Current${reset}`.padEnd(
                  18,
                )}${`${underline}Latest${reset}`.padEnd(18)}`,
              );
            }
            console.log(
              `${metadata.id.padEnd(50)}${(profile
                ? profile.version
                : 'Not found'
              ).padEnd(10)}${`${metadata.version}`.padEnd(10)}`,
            );
            break;
          default:
            console.log(`Applying profile ${metadata.id}`);
            if (profile && metadata.version === parseInt(profile.version)) {
              console.log('Profile already up to date');
            } else {
              return await seeds.run(trx, profilePath);
            }
            break;
        }
      }
    });

    // Commit changes
    await trx.commit();
    knex.destroy();
  } catch (err) {
    await trx.rollback();
    knex.destroy();
    console.error(err);
    process.exitCode = 1;
  }
}

main();
