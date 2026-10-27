/**
 * Job Model.
 * @module models/job/job
 */

// Type imports
import type { Request } from '../../types';

// External imports
import { omit } from 'es-toolkit/object';

// Internal imports
import { Model } from '../_model/_model';

/**
 * A model for Job.
 * @class Job
 * @extends Model
 */
export class Job extends Model {
  static tableName: string = 'job';
  static idColumn: string = 'uuid';

  /**
   * Returns JSON data without the queue bookkeeping.
   * @method toJson
   * @param {Request} _req Request object.
   * @returns {Json} JSON object.
   */
  toJson(_req?: Request): any {
    return omit(this.toJSON() as Record<string, any>, [
      'attempts',
      'max_attempts',
      'run_after',
      'locked_by',
      'locked_until',
      'key',
    ]);
  }
}
