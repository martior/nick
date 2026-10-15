/**
 * Export helper.
 * @module helpers/export/export
 */

/**
 * Get the path of a document relative to the site root from its url.
 * @method getDocumentPath
 * @param {string} url Url of the document.
 * @param {string} baseUrl Url of the site root.
 * @returns {string} Decoded path, `/` for the site root.
 */
export function getDocumentPath(url: string, baseUrl: string): string {
  const path = url.replace(baseUrl, '');
  return path === '' ? '/' : decodeURIComponent(path);
}

/**
 * Get the profile filename of a document. Every character of an id which
 * is not a letter, digit, dash or underscore is escaped as `~<hex>`, so
 * dots in ids (`report.pdf`) don't clash with the dots separating the path
 * segments. The parent filename is always a prefix of the child filename,
 * so sorting the filenames imports parents before their children.
 * @method getDocumentFilename
 * @param {string} path Decoded path of the document.
 * @returns {string} Filename of the document.
 */
export function getDocumentFilename(path: string): string {
  if (path === '' || path === '/') {
    return '_root.json';
  }
  const slugs = path
    .replace(/^\//, '')
    .split('/')
    .map((slug) =>
      Array.from(Buffer.from(slug, 'utf8'))
        .map((byte) => {
          const char = String.fromCharCode(byte);
          return /[\w-]/.test(char)
            ? char
            : `~${byte.toString(16).padStart(2, '0')}`;
        })
        .join(''),
    );
  return `${slugs.join('.')}.json`;
}

/**
 * Call a batched listing endpoint page by page. Uses `batching.next` when
 * available and falls back to `b_start` when only `items_total` is returned.
 * Endpoints returning a plain array are treated as a single batch.
 * @method forEachBatch
 * @param {string} url Url of the listing, may already contain a query string.
 * @param {Function} fetch Function fetching an url and returning the json.
 * @param {Function} callback Function called with the items of each batch.
 * @param {number} size Batch size.
 * @returns {Promise<number>} Number of items.
 */
export async function forEachBatch(
  url: string,
  fetch: (url: string) => Promise<any>,
  callback: (items: any[]) => Promise<void> | void,
  size: number = 100,
): Promise<number> {
  const separator = url.includes('?') ? '&' : '?';
  let next: string | undefined = `${url}${separator}b_size=${size}&b_start=0`;
  let count = 0;

  while (next) {
    const result: any = await fetch(next);
    const items: any[] = Array.isArray(result) ? result : result.items || [];
    await callback(items);
    count += items.length;

    if (Array.isArray(result) || items.length === 0) {
      next = undefined;
    } else if (result.batching) {
      next = result.batching.next;
    } else if (result.items_total && count < result.items_total) {
      next = `${url}${separator}b_size=${size}&b_start=${count}`;
    } else {
      next = undefined;
    }
  }
  return count;
}

/**
 * Fetch all items of a batched listing endpoint.
 * @method fetchAllBatches
 * @param {string} url Url of the listing.
 * @param {Function} fetch Function fetching an url and returning the json.
 * @param {number} size Batch size.
 * @returns {Promise<any[]>} All items.
 */
export async function fetchAllBatches(
  url: string,
  fetch: (url: string) => Promise<any>,
  size: number = 100,
): Promise<any[]> {
  const output: any[] = [];
  await forEachBatch(
    url,
    fetch,
    (items) => {
      output.push(...items);
    },
    size,
  );
  return output;
}

/**
 * Roles which exist in Nick's core profile.
 */
export const coreRoles = [
  'Anonymous',
  'Authenticated',
  'Owner',
  'Reader',
  'Contributor',
  'Editor',
  'Reviewer',
  'Administrator',
];

/**
 * Plone roles which map to a different Nick role. Plone's `Member` role is
 * given to every logged in user, which is `Authenticated` in Nick.
 */
export const roleMapping: Record<string, string> = {
  Manager: 'Administrator',
  'Site Administrator': 'Administrator',
  Member: 'Authenticated',
};

/**
 * Plone groups which are virtual and not exported.
 */
export const virtualGroups = ['AuthenticatedUsers'];

/**
 * Map a Plone role to a Nick role.
 * @method mapRole
 * @param {string} role Plone role.
 * @returns {string} Nick role.
 */
export function mapRole(role: string): string {
  return roleMapping[role] || role;
}

/**
 * Map Plone roles of a principal to Nick roles. `Anonymous` and
 * `Authenticated` are dropped, Nick adds them to every user.
 * @method mapPrincipalRoles
 * @param {string[]} roles Plone roles.
 * @returns {string[]} Nick roles.
 */
export function mapPrincipalRoles(roles: string[]): string[] {
  return [
    ...new Set(
      (roles || [])
        .map(mapRole)
        .filter((role) => !['Anonymous', 'Authenticated'].includes(role)),
    ),
  ];
}

/**
 * Get the roles which have to be added to Nick.
 * @method getCustomRoles
 * @param {Array} roles Roles of the Plone site.
 * @returns {Array} Roles not in Nick's core profile.
 */
export function getCustomRoles(roles: any[]): any[] {
  return roles.filter(
    (role) => !coreRoles.includes(role.id) && !(role.id in roleMapping),
  );
}
