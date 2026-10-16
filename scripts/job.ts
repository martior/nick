/**
 * Job runner, used when jobs run in a child process (jobs.isolation 'process').
 * @module scripts/job
 */

// External imports
import { omit } from 'es-toolkit/object';

// Internal imports
import { Client } from '../src/client';
import { initProfiles } from '../src/helpers/profiles/profiles';
import scheduled_jobs from '../src/scheduled_jobs';
import config from '../src/helpers/config/config';
import models from '../src/models';

// Init profiles
await initProfiles();

/**
 * Send a message to the parent and exit
 * @method reply
 * @param {any} message Message to send.
 */
function reply(message: any) {
  if (process.send) {
    process.send(message, () => process.exit(0));
  } else {
    process.exit(0);
  }
}

// Read message
process.on('message', async (data: any) => {
  // Check if process should be exited
  if (data && data.exit) {
    process.exit(0);
  } else if (data.action) {
    // Create transaction
    const Document = models.get('Document');
    const trx = await Document.startTransaction();

    // Run job
    try {
      const result = await scheduled_jobs
        .getAction(data.action)
        .handler(
          omit(data, ['scheduled_job', 'action', 'actor']),
          data.actor || 'admin',
          trx,
        );

      // Commit transaction
      await trx.commit();

      // Send result
      reply({ result: { result } });
    } catch (err: any) {
      // Rollback transaction
      await trx.rollback();

      // Send error
      reply({ error: err?.message || String(err) });
    }
  } else {
    try {
      const cli = Client.initialize({
        apiPath: config.settings.jobs.apiPath,
      });
      const result = await cli[data.method](
        omit(
          {
            ...data,
            params: {
              ...data.params,
              job: true,
            },
          },
          ['method', 'actor'],
        ),
      );

      // Send result
      reply({ result: { result: result.data } });
    } catch (err: any) {
      // Send error
      reply({ error: err?.message || String(err) });
    }
  }
});
