/**
 * Query helper tests.
 * @module helpers/query/query.test
 */

// External imports
import { describe, it, expect } from 'vitest';

// Internal imports
import { textToTsquery } from './query';

describe('Query', () => {
  describe('textToTsquery', () => {
    it('should combine terms with and', () => {
      expect(textToTsquery('alpha zebra')).toBe("('alpha' & 'zebra')");
    });

    it('should support the and, or and not keywords', () => {
      expect(textToTsquery('zebra AND alpha')).toBe("('zebra' & 'alpha')");
      expect(textToTsquery('zebra or beta')).toBe("('zebra' | 'beta')");
      expect(textToTsquery('zebra NOT alpha')).toBe("('zebra' & !'alpha')");
    });

    it('should support parentheses', () => {
      expect(textToTsquery('(alpha OR beta) zebra')).toBe(
        "(('alpha' | 'beta') & 'zebra')",
      );
    });

    it('should support phrases', () => {
      expect(textToTsquery('"alpha zebra"')).toBe("'alpha zebra'");
    });

    it('should convert wildcards to a prefix search', () => {
      expect(textToTsquery('zeb*')).toBe("'zeb':*");
      expect(textToTsquery('ze?ra')).toBe("'ze':*");
      expect(textToTsquery('*zebra')).toBe("'zebra'");
    });

    it('should quote special characters', () => {
      expect(textToTsquery("zebra' OR '1'='1")).toBe(
        "('zebra''' | '''1''=''1')",
      );
      expect(textToTsquery('back\\slash')).toBe("'back\\\\slash'");
    });

    it('should return an empty string when there are no terms', () => {
      expect(textToTsquery('')).toBe('');
      expect(textToTsquery('  ')).toBe('');
      expect(textToTsquery('(')).toBe('');
      expect(textToTsquery(')')).toBe('');
      expect(textToTsquery('*')).toBe('');
      expect(textToTsquery('AND')).toBe('');
      expect(textToTsquery('NOT')).toBe('');
      expect(textToTsquery(undefined)).toBe('');
    });

    it('should fold accents', async () => {
      const result = await global.txn!.raw(
        "SELECT to_tsvector('nick', ?) @@ to_tsquery('nick', ?) AS match",
        ['Crème brûlée naïve café', textToTsquery('creme brulee naive cafe')],
      );
      expect(result.rows[0].match).toBe(true);
    });

    it('should always produce a valid tsquery', async () => {
      const terms = [
        'alpha zebra',
        'zebra AND alpha',
        '"alpha zebra"',
        'zebra OR beta',
        '(',
        ')',
        '<script>',
        'zebra; DROP TABLE x',
        "zebra' OR '1'='1",
        '"',
        '?',
        '\\',
        '%',
        "'",
        '-',
        '@',
        '\u0000',
        '​',
        'a OR OR b',
        'NOT NOT a',
        '((a) b',
        'a AND',
        ':*',
        '!&|',
        'Crème brûlée 日本語',
      ];
      for (const term of terms) {
        const tsquery = textToTsquery(term);
        if (tsquery) {
          await expect(
            global.txn!.raw("SELECT to_tsquery('nick', ?)", [tsquery]),
          ).resolves.toBeDefined();
        }
      }
    });
  });
});
