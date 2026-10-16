/**
 * Controlpanels helper.
 * @module helpers/controlpanels/controlpanels
 */

// Type imports
import type { Knex } from 'knex';

// Internal imports
import models from '../../models';

/**
 * Get the settings (data) of a control panel. Control panels are profile
 * data: add-ons add them in `controlpanels/<id>.json` of a profile.
 * @method getControlpanelSettings
 * @param {string} id Id of the control panel.
 * @param {Knex.Transaction} trx Transaction object.
 * @returns {Promise<any>} The settings, or an empty object.
 */
export async function getControlpanelSettings(
  id: string,
  trx?: Knex.Transaction,
): Promise<any> {
  const Controlpanel = models.get('Controlpanel');
  const controlpanel = await Controlpanel.fetchById(id, {}, trx);
  return controlpanel?.data || {};
}
