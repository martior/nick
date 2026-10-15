/**
 * Export helper tests.
 * @module helpers/export/export.test
 */

// External imports
import { describe, it, expect } from 'vitest';

// Internal imports
import {
  fetchAllBatches,
  forEachBatch,
  getDocumentFilename,
  getDocumentPath,
} from './export';

/**
 * Fake batched endpoint.
 * @param {number} total Number of items.
 * @param {boolean} batching Return batching links.
 * @returns {Object} Fetch function and requested urls.
 */
const batchedEndpoint = (total: number, batching: boolean) => {
  const urls: string[] = [];
  const fetch = async (url: string) => {
    urls.push(url);
    const params = new URL(url).searchParams;
    const start = parseInt(params.get('b_start') || '0');
    const size = parseInt(params.get('b_size') || '25');
    const items = Array.from(
      { length: Math.max(0, Math.min(size, total - start)) },
      (_value, index) => ({ id: start + index }),
    );
    return {
      items,
      items_total: total,
      ...(batching && start + size < total
        ? {
            batching: {
              next: `http://host/@search?sort_on=path&b_size=${size}&b_start=${start + size}`,
            },
          }
        : {}),
    };
  };
  return { fetch, urls };
};

describe('export', () => {
  describe('getDocumentPath', () => {
    it('returns the root path for the site url', () => {
      expect(getDocumentPath('http://host/plone', 'http://host/plone')).toBe(
        '/',
      );
    });

    it('returns the decoded path of a document', () => {
      expect(
        getDocumentPath(
          'http://host/plone/news/my%20item',
          'http://host/plone',
        ),
      ).toBe('/news/my item');
    });
  });

  describe('getDocumentFilename', () => {
    it('returns _root.json for the root', () => {
      expect(getDocumentFilename('/')).toBe('_root.json');
    });

    it('separates path segments with dots', () => {
      expect(getDocumentFilename('/news/item-1')).toBe('news.item-1.json');
    });

    it('escapes dots and other characters in ids', () => {
      expect(getDocumentFilename('/files/report.pdf')).toBe(
        'files.report~2epdf.json',
      );
      expect(getDocumentFilename('/über uns')).toBe('~c3~bcber~20uns.json');
    });

    it('keeps parents before children when sorted', () => {
      const files = ['/a.b/c', '/a-b', '/a.b', '/a']
        .map((path) => getDocumentFilename(path).replace(/\.json$/, ''))
        .sort();
      expect(files.indexOf('a~2eb')).toBeLessThan(files.indexOf('a~2eb.c'));
    });
  });

  describe('forEachBatch', () => {
    it('follows the batching links', async () => {
      const { fetch, urls } = batchedEndpoint(250, true);
      const sizes: number[] = [];
      const count = await forEachBatch(
        'http://host/@search?sort_on=path',
        fetch,
        (items) => {
          sizes.push(items.length);
        },
        100,
      );
      expect(count).toBe(250);
      expect(sizes).toEqual([100, 100, 50]);
      expect(urls[0]).toBe(
        'http://host/@search?sort_on=path&b_size=100&b_start=0',
      );
    });

    it('falls back to items_total without batching links', async () => {
      const { fetch, urls } = batchedEndpoint(120, false);
      const items = await fetchAllBatches('http://host/@users', fetch, 50);
      expect(items.map((item: any) => item.id)).toEqual(
        Array.from({ length: 120 }, (_value, index) => index),
      );
      expect(urls).toHaveLength(3);
    });

    it('treats an array as a single batch', async () => {
      const items = await fetchAllBatches('http://host/@groups', async () => [
        { id: 'a' },
        { id: 'b' },
      ]);
      expect(items).toEqual([{ id: 'a' }, { id: 'b' }]);
    });
  });
});
