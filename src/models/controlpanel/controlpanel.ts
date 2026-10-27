/**
 * Controlpanel Model.
 * @module models/controlpanel/controlpanel
 */

// Type imports
import type { Json, Request, Schema } from '../../types';

// External imports
import { compact } from 'es-toolkit/array';

// Internal imports
import { Model } from '../_model/_model';
import { translateSchema } from '../../helpers/schema/schema';
import { getRootUrl } from '../../helpers/url/url';

/**
 * A model for Controlpanel.
 * @class Controlpanel
 * @extends Model
 */
export class Controlpanel extends Model {
  static tableName: string = 'controlpanel';

  // Declare properties
  declare id: string;
  declare title: string;
  declare group: string;
  declare data: { [key: string]: any };
  declare schema: Schema;

  /**
   * Get the password fields of the schema.
   * @method getPasswordFields
   * @returns {string[]} Names of the password fields.
   */
  getPasswordFields(): string[] {
    const self: InstanceType<typeof Controlpanel> = this;
    const properties: any = self.schema?.properties || {};
    return Object.keys(properties).filter(
      (property) => properties[property].widget === 'password',
    );
  }

  /**
   * Returns JSON data.
   * @method toJson
   * @param {Request} req Request object
   * @param {Boolean} extend Extend data
   * @returns {Json} JSON object.
   */
  toJson(req: Request, extend = false): Json {
    const self: InstanceType<typeof Controlpanel> = this;
    // Get basic data
    const json = {
      '@id': `${getRootUrl(req)}/@controlpanels/${self.id}`,
      group: self.group,
      title: self.title,
    };

    // Return extended or basic data
    return extend
      ? ({
          ...json,
          // Never return stored passwords
          data: {
            ...self.data,
            ...Object.fromEntries(
              self
                .getPasswordFields()
                .filter((field) => field in (self.data || {}))
                .map((field) => [field, null]),
            ),
          },
          schema: translateSchema(self.schema, req),
        } as unknown as Json)
      : (json as Json);
  }
}
