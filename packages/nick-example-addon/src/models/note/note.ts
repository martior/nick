/**
 * Note model: a table in the add-on's own Postgres schema.
 * @module models/note/note
 */

// External imports
import { Model } from '@plone/nick';

/**
 * A note about a document.
 * @class Note
 * @extends Model
 */
export class Note extends Model {
  static tableName: string = 'example.note';
  static idColumn: string = 'id';

  declare document: string;
  declare text: string;
  declare words: number | null;
  declare author: string | null;
  declare created: string;

  /**
   * Returns JSON data.
   * @method toJson
   * @returns {Object} JSON object.
   */
  toJson(): any {
    return {
      id: this.id,
      text: this.text,
      words: this.words,
      author: this.author,
      created: this.created,
    };
  }
}
