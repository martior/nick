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
  type?: string;
  json: {
    title: string;
  };
}

// Maximum length of an id generated from the title
const maxLength = 255;

/**
 * Generate an id from a title, like the url normalizer of Plone: quotes are
 * removed, letters transliterated and lower cased, and every other
 * character than a-z, 0-9, dot, underscore and dash is a dash. Long ids are
 * cut at a dash.
 * @method idFromTitle
 * @param {string} title Title.
 * @returns {string} Id, empty if the title has no letters or digits.
 */
export function idFromTitle(title: string): string {
  const id = slugify(
    (title || '')
      .replace(/['"]/g, '')
      // Symbols are dashes, not words like `and` for `&`
      .replace(/[^\p{L}\p{N}\s._-]/gu, '-'),
    { lower: true },
  )
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^[-._]+|[-._]+$/g, '');
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
    // A title without letters or digits gives the type, like Plone
    this.id = uniqueId(
      id ||
        idFromTitle(this.json.title) ||
        idFromTitle(this.type || '') ||
        'item',
      blacklist || [],
    );
  },
};
