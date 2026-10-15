/**
 * Export helper tests.
 * @module helpers/export/export.test
 */

// External imports
import { describe, it, expect } from 'vitest';

// Internal imports
import { getDocumentFilename, getDocumentPath } from './export';

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
});
