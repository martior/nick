/**
 * Workflow seed.
 * @module seeds/workflow/workflow
 */

// Type imports
import type { Knex } from 'knex';

// External imports
import { merge } from 'es-toolkit/object';

// Internal imports
import { fileExists } from '../../helpers/fs/fs';
import { stripI18n } from '../../helpers/i18n/i18n';
import { mapAsync } from '../../helpers/utils/utils';
import models from '../../models';

export const seedWorkflow = async (
  trx: Knex.Transaction,
  profilePath: string,
): Promise<void> => {
  const Workflow = models.get('Workflow');
  if (await fileExists(`${profilePath}/workflows`)) {
    const profile = stripI18n(
      (await import(`${profilePath}/workflows`)).default,
    );
    if (profile.purge) {
      await Workflow.delete({}, trx);
    }
    await mapAsync(profile.workflows, async (workflow: any) => {
      // Refuse expressions which are not supported, unless the loader
      // marked them unsupported (they deny at runtime)
      Workflow.checkExpressions(workflow.json).map((problem: any) => {
        const message = `Workflow ${workflow.id}, ${problem.where}: unsupported expression "${problem.expr}" (${problem.reason})`;
        if (!problem.acknowledged) {
          throw new Error(message);
        }
        console.warn(`${message}, it denies`);
      });

      // Check if type exists
      const current: any = await Workflow.fetchById(workflow.id, {}, trx);

      // If doesn’t exist
      if (!current) {
        await Workflow.create(workflow, {}, trx);
      } else if (profile.replace) {
        // Replace the definition, for example with an exported workflow
        await Workflow.update(workflow.id, workflow, trx);
      } else {
        await Workflow.update(
          workflow.id,
          merge((current as any).$toDatabaseJson(), workflow),
          trx,
        );
      }
    });
    console.log('Workflows imported');
  }
};
