/**
 * Utils.
 * @module helpers/utils/utils
 */

// Type imports
import type { VocabularyTerm } from '../../types';

// External imports
import { omitBy } from 'es-toolkit/object';

/**
 * Map asynchronous but in order through array
 * @method mapAsync
 * @param {Array} array Array to be looped over
 * @param {function} callback Callback function
 * @returns {Promise} Promise which returns when all callbacks are done
 */
export async function mapAsync<Item>(
  array: Item[],
  callback: (item: Item, index: number) => Promise<any>,
): Promise<any[]> {
  const output = [];
  for (let i = 0; i < array.length; i++) {
    output.push(await callback(array[i], i));
  }
  return output;
}

/**
 * Map synchronous through array
 * @method mapSync
 * @param {Array} array Array to be looped over
 * @param {function} callback Callback function
 */
export function mapSync<Item>(
  array: Item[],
  callback: (item: Item, index: number) => void,
): void {
  for (let i = 0; i < array.length; i++) {
    callback(array[i], i);
  }
}

/**
 * Create a unique id
 * @method uniqueId
 * @param {String} id Base id.
 * @param {Array<String>} ids Array of sibling ids.
 * @param {Number} counter Current iteration.
 * @returns {String} Unique id.
 */
export function uniqueId(id: string, ids: string[], counter = 0): string {
  const newId = counter === 0 ? id : `${id}-${counter}`;
  return ids.indexOf(newId) === -1 ? newId : uniqueId(id, ids, counter + 1);
}

/**
 * Remove undefined
 * @method removeUndefined
 * @param {Object} object Object to remove undefined values from.
 * @returns {Object} Cleaned up object.
 */
export function removeUndefined<T extends object>(object: T): Partial<T> {
  return omitBy(object, (value) => typeof value === 'undefined');
}

/**
 * Convert array to vocabulary
 * @method arrayToVocabulary
 * @param {Array} items Items to be converted
 * @returns {Array} Array of terms
 */
export function arrayToVocabulary(items: string[]): VocabularyTerm[] {
  return items.map((item) => ({
    title: item,
    token: item,
  }));
}

/**
 * Convert object to vocabulary
 * @method objectToVocabulary
 * @param {Object} items Items to be converted
 * @returns {Array} Array of terms
 */
export function objectToVocabulary(items: {
  [key: string]: string;
}): VocabularyTerm[] {
  return Object.keys(items).map((key) => ({
    title: items[key],
    token: key,
  }));
}

/**
 * Checks if variable is a promise
 * @method isPromise
 * @param {*} variable Variable to be checked
 * @returns {boolean} True if variable is a promise
 */
export function isPromise(variable: any): boolean {
  return typeof variable === 'object' && typeof variable.then === 'function';
}

/**
 * Escape string to be usable for regexps
 * @method regExpEscape
 * @param {String} string Input string
 * @returns {String} Escaped string
 */
export function regExpEscape(string: string): string {
  return string.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
}

/**
 * Escape a string and turn it into a LIKE pattern matching it as a prefix.
 * Prefix patterns can use the path indexes, regular expressions can't.
 * @method likePrefix
 * @param {String} prefix Prefix
 * @returns {String} LIKE pattern
 */
export function likePrefix(prefix: string): string {
  return `${prefix.replace(/[\\%_]/g, '\\$&')}%`;
}

/**
 * Get the node version
 * @method getNodeVersion
 * @param {String} string Input string
 * @returns {String} Node version
 */
export function getNodeVersion(): string {
  return process.version;
}

/**
 * Strip newlines from string
 * @method stripNewlines
 * @param {String} string Input string
 * @returns {String} String without newlines
 */
export function stripNewlines(string: string): string {
  return string.replace(/\r\n|\n|\r/gm, '');
}

/**
 * Parse the Range header of a request for a file, like RFC 9110: a single
 * bytes range `start-end`, `start-` (end open) or `-length` (the last bytes).
 * An end beyond the file is the last byte.
 * @method parseRange
 * @param {string} header Range header.
 * @param {number} size Size of the file in bytes.
 * @returns {Object | 'unsatisfiable' | undefined} Start and end (undefined
 * when open), `unsatisfiable` when the range is outside of the file, or
 * undefined when the whole file has to be served: no header, several
 * ranges, another unit or an invalid range.
 */
export function parseRange(
  header: string | undefined,
  size: number,
): { start: number; end?: number } | 'unsatisfiable' | undefined {
  const match = (header || '').trim().match(/^bytes=(\d*)-(\d*)$/);
  if (!match || (match[1] === '' && match[2] === '')) {
    return undefined;
  }

  // The last bytes
  if (match[1] === '') {
    const length = parseInt(match[2], 10);
    if (length === 0 || size === 0) {
      return 'unsatisfiable';
    }
    return { start: Math.max(size - length, 0), end: size - 1 };
  }

  const start = parseInt(match[1], 10);
  const end = match[2] === '' ? undefined : parseInt(match[2], 10);
  if (end !== undefined && end < start) {
    return undefined;
  }
  if (start >= size) {
    return 'unsatisfiable';
  }
  return {
    start,
    end: end === undefined ? undefined : Math.min(end, size - 1),
  };
}

/**
 * Convert string with bytes to number
 * @param bytes Input string
 * @returns Values in bytes
 */
export function bytesToNumber(bytes: string): number {
  const units: { [key: string]: number } = {
    kb: 1024,
    mb: 1024 ** 2,
    gb: 1024 ** 3,
    tb: 1024 ** 4,
  };

  // Match number and unit
  const match = bytes.toLowerCase().match(/^(\d+(?:\.\d+)?)\s*([a-z]+)$/);

  if (!match) return parseFloat(bytes) || 0;

  const value = parseFloat(match[1]);
  const unit = match[2];

  return units[unit] ? value * units[unit] : value;
}

/**
 * Get the sortable title of a title, like Plone's sortable_title: accents
 * removed, lower case, stripped and numbers zero filled to 4 digits, so
 * `Item 2` sorts before `Item 10`.
 * @method sortableTitle
 * @param {any} title Title.
 * @returns {string} Sortable title, empty if the title is not a string.
 */
export function sortableTitle(title: any): string {
  if (typeof title !== 'string') {
    return '';
  }
  return title
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .trim()
    .replace(/[0-9]+/g, (number: string) => number.padStart(4, '0'));
}

/**
 * Check if an id is valid, like Zope's checkValidId: only characters which
 * are allowed in urls, traversable, and not starting with an underscore or
 * `aq_` or ending with two underscores. Ids starting with `@` are refused
 * too, because such path segments address services: a child called
 * `@search` would hide the search service of its folder.
 * @method isValidId
 * @param {any} id Id to check.
 * @returns {boolean} True if the id is valid.
 */
export function isValidId(id: any): boolean {
  return (
    typeof id === 'string' &&
    id !== '' &&
    !/[^a-zA-Z0-9\-_~,.$()# @]/.test(id) &&
    id !== '.' &&
    id !== '..' &&
    !id.startsWith('_') &&
    !id.startsWith('@') &&
    !id.startsWith('aq_') &&
    id !== 'REQUEST' &&
    !id.endsWith('__')
  );
}

/**
 * Get the id of a pasted item, like Zope: `copy_of_<id>`, `copy2_of_<id>`
 * and so on when the id is already used.
 * @method pasteId
 * @param {string} id Id of the item.
 * @param {Array<string>} ids Ids of the items in the target folder.
 * @returns {string} Unique id.
 */
export function pasteId(id: string, ids: string[]): string {
  const match = id.match(/^copy([0-9]*)_of_(.*)$/);
  let n = match ? parseInt(match[1] || '1', 10) : 0;
  const original = match ? match[2] : id;
  let newId = id;
  while (ids.includes(newId)) {
    newId = `copy${n ? n + 1 : ''}_of_${original}`;
    n = n + 1;
  }
  return newId;
}
