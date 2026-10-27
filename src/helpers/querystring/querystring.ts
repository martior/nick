/**
 * Querystring helper.
 * @module helpers/querystring/querystring
 */

// External imports
import { parse } from 'node:querystring';

/**
 * Parse a querystring the way a Plone backend reads its request form.
 *
 * Zope marshals a parameter named `name:list` into a list under `name`, so
 * Plone clients send list values as `expand:list=a&expand:list=b`. Every
 * other parameter is parsed as Express' simple parser does, repeated names
 * becoming lists. A bare value and its `:list` form are merged, bare values
 * first.
 * @method parseQuerystring
 * @param {string} querystring Querystring without the leading `?`
 * @returns {Object} Parsed parameters
 */
export function parseQuerystring(
  querystring: string,
): Record<string, string | string[]> {
  const parsed = parse(querystring);
  const result: Record<string, string | string[]> = {};
  const lists: Record<string, string[]> = {};

  Object.keys(parsed).forEach((key) => {
    const value = parsed[key] as string | string[];
    if (key.endsWith(':list')) {
      lists[key.slice(0, -':list'.length)] = ([] as string[]).concat(value);
    } else {
      result[key] = value;
    }
  });

  Object.keys(lists).forEach((key) => {
    result[key] = [
      ...(typeof result[key] === 'undefined'
        ? []
        : ([] as string[]).concat(result[key])),
      ...lists[key],
    ];
  });

  return result;
}

/**
 * Get the elements to expand, as plone.restapi's expandable_elements() reads
 * them: a list as it is, a comma separated string split, a single value
 * wrapped.
 * @method expandable
 * @param {string | string[] | undefined} expand Value of the expand parameter
 * @returns {string[]} Elements to expand
 */
export function expandable(expand: string | string[] | undefined): string[] {
  if (typeof expand === 'undefined') {
    return [];
  }
  if (Array.isArray(expand)) {
    return expand;
  }
  return expand.includes(',') ? expand.split(',') : [expand];
}
