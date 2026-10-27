/**
 * Utils helper tests.
 * @module helpers/utils/utils.test
 */

// External imports
import { describe, it, expect } from 'vitest';

// Internal imports
import {
  mapAsync,
  mapSync,
  uniqueId,
  isValidId,
  sortableTitle,
  pasteId,
  removeUndefined,
  arrayToVocabulary,
  objectToVocabulary,
  isPromise,
  regExpEscape,
  likePrefix,
  getNodeVersion,
  stripNewlines,
  bytesToNumber,
  parseRange,
} from './utils';

describe('utils', () => {
  describe('mapAsync', () => {
    it('maps async in order', async () => {
      const result = await mapAsync([1, 2, 3], async (item) => item * 2);
      expect(result).toEqual([2, 4, 6]);
    });

    it('returns empty array for empty input', async () => {
      const result = await mapAsync([], async () => {});
      expect(result).toEqual([]);
    });
  });

  describe('mapSync', () => {
    it('maps sync through array', () => {
      const result: number[] = [];
      mapSync([1, 2, 3], (item) => result.push(item * 2));
      expect(result).toEqual([2, 4, 6]);
    });
  });

  describe('uniqueId', () => {
    it('returns id if unique', () => {
      expect(uniqueId('test', ['other'])).toBe('test');
    });

    it('appends counter if not unique', () => {
      expect(uniqueId('test', ['test', 'other'])).toBe('test-1');
    });

    it('increments counter until unique', () => {
      expect(uniqueId('test', ['test', 'test-1', 'test-2'])).toBe('test-3');
    });
  });

  describe('removeUndefined', () => {
    it('removes undefined values', () => {
      expect(removeUndefined({ a: 1, b: undefined, c: 'test' })).toEqual({
        a: 1,
        c: 'test',
      });
    });

    it('returns empty object when all undefined', () => {
      expect(removeUndefined({ a: undefined })).toEqual({});
    });
  });

  describe('arrayToVocabulary', () => {
    it('converts string array to vocabulary terms', () => {
      expect(arrayToVocabulary(['a', 'b'])).toEqual([
        { title: 'a', token: 'a' },
        { title: 'b', token: 'b' },
      ]);
    });
  });

  describe('objectToVocabulary', () => {
    it('converts object to vocabulary terms', () => {
      expect(objectToVocabulary({ key: 'Value' })).toEqual([
        { title: 'Value', token: 'key' },
      ]);
    });
  });

  describe('isPromise', () => {
    it('returns true for promise', () => {
      expect(isPromise(Promise.resolve())).toBe(true);
    });

    it('returns false for non-promise', () => {
      expect(isPromise({})).toBe(false);
    });
  });

  describe('regExpEscape', () => {
    it('escapes special regex characters', () => {
      expect(regExpEscape('a.b[c]')).toBe('a\\.b\\[c\\]');
    });
  });

  describe('likePrefix', () => {
    it('escapes like wildcards and adds a trailing wildcard', () => {
      expect(likePrefix('/a_b%c\\d/')).toBe('/a\\_b\\%c\\\\d/%');
    });
  });

  describe('getNodeVersion', () => {
    it('returns node version', () => {
      expect(getNodeVersion()).toBe(process.version);
    });
  });

  describe('stripNewlines', () => {
    it('removes newlines', () => {
      expect(stripNewlines('a\nb\rc\r\nd')).toBe('abcd');
    });
  });

  describe('parseRange', () => {
    it('parses a range with a start and an end', () => {
      expect(parseRange('bytes=0-999', 3000)).toEqual({ start: 0, end: 999 });
    });

    it('parses a range with an open end', () => {
      expect(parseRange('bytes=1000-', 3000)).toEqual({
        start: 1000,
        end: undefined,
      });
    });

    it('parses the last bytes', () => {
      expect(parseRange('bytes=-500', 3000)).toEqual({
        start: 2500,
        end: 2999,
      });
      expect(parseRange('bytes=-5000', 3000)).toEqual({
        start: 0,
        end: 2999,
      });
    });

    it('limits the end to the last byte', () => {
      expect(parseRange('bytes=2000-99999', 3000)).toEqual({
        start: 2000,
        end: 2999,
      });
    });

    it('refuses a range outside of the file', () => {
      expect(parseRange('bytes=3000-', 3000)).toBe('unsatisfiable');
      expect(parseRange('bytes=3000-3999', 3000)).toBe('unsatisfiable');
      expect(parseRange('bytes=-0', 3000)).toBe('unsatisfiable');
      expect(parseRange('bytes=0-', 0)).toBe('unsatisfiable');
    });

    it('ignores what is not a single bytes range', () => {
      expect(parseRange(undefined, 3000)).toBeUndefined();
      expect(parseRange('bytes=0-1,10-11', 3000)).toBeUndefined();
      expect(parseRange('chunks=0-1', 3000)).toBeUndefined();
      expect(parseRange('bytes=-', 3000)).toBeUndefined();
      expect(parseRange('bytes=5-3', 3000)).toBeUndefined();
      expect(parseRange('bytes=a-b', 3000)).toBeUndefined();
    });
  });

  describe('bytesToNumber', () => {
    it('converts KB to bytes', () => {
      expect(bytesToNumber('1 KB')).toBe(1024);
    });

    it('converts MB to bytes', () => {
      expect(bytesToNumber('1 MB')).toBe(1024 ** 2);
    });

    it('returns number for plain string', () => {
      expect(bytesToNumber('512')).toBe(512);
    });

    it('returns 0 for invalid string', () => {
      expect(bytesToNumber('invalid')).toBe(0);
    });

    it('returns value for unknown unit', () => {
      expect(bytesToNumber('5 xb')).toBe(5);
    });
  });

  describe('sortableTitle', () => {
    it('makes titles sortable like Plone', () => {
      expect(sortableTitle(' Item 2 ')).toBe('item 0002');
      expect(sortableTitle('Item 10')).toBe('item 0010');
      expect(sortableTitle('Item 12345')).toBe('item 12345');
      expect(sortableTitle('Ångström Éclair')).toBe('angstrom eclair');
      expect(sortableTitle(undefined)).toBe('');
      expect(
        [sortableTitle('Item 10'), sortableTitle('item 2')].sort(),
      ).toEqual(['item 0002', 'item 0010']);
    });
  });

  describe('isValidId', () => {
    it('accepts ids Zope accepts', () => {
      ['news', 'has space', 'UPPER.case~ok', 'index_html', 'a@b'].forEach(
        (id) => expect(isValidId(id)).toBe(true),
      );
    });

    it('refuses ids Zope refuses', () => {
      [
        '',
        'a/b',
        '_a',
        '.',
        '..',
        'aq_parent',
        'a__',
        'ü',
        12,
        '@search',
        '@@view',
      ].forEach((id) => expect(isValidId(id)).toBe(false));
    });
  });

  describe('pasteId', () => {
    it('keeps a free id', () => {
      expect(pasteId('src', ['other'])).toBe('src');
    });

    it('prefixes the id like Zope', () => {
      expect(pasteId('src', ['src'])).toBe('copy_of_src');
      expect(pasteId('src', ['src', 'copy_of_src'])).toBe('copy2_of_src');
      expect(pasteId('copy_of_src', ['copy_of_src'])).toBe('copy2_of_src');
    });
  });
});
