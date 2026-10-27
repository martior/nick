/**
 * Id from title behavior.
 * @module behaviors/id_from_title/id_from_title
 */

// External imports
import slugify from 'slugify';

// Internal imports
import { uniqueId } from '../../helpers/utils/utils';

interface Document {
  id: string;
  json: {
    title: string;
  };
}

// Maximum length of an id generated from the title
const maxLength = 255;

/**
 * Generate an id from a title. Long ids are cut at a dash.
 * @method idFromTitle
 * @param {string} title Title.
 * @returns {string} Id.
 */
function idFromTitle(title: string): string {
  const id = slugify(title, { lower: true, remove: /[*+~.()'"!:@?/]/g });
  if (id.length <= maxLength) {
    return id;
  }
  const cut = id.slice(0, maxLength);
  return cut.includes('-') ? cut.slice(0, cut.lastIndexOf('-')) : cut;
}

/**
 * Id from title behavior.
 * @constant id_from_title
 */
export const id_from_title = {
  /**
   * Set id
   * @method setId
   * @param {string} id Provided id (can be empty)
   * @param {Array} blacklist Blacklist ids
   */
  setId: function (this: Document, id?: string, blacklist?: string[]): void {
    this.id = uniqueId(id || idFromTitle(this.json.title), blacklist || []);
  },
};
