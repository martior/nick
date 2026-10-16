/**
 * Query helper tests.
 * @module helpers/query/query.test
 */

// External imports
import { describe, it, expect } from 'vitest';

// Internal imports
import { parseBoolean, pathCondition, textToTsquery } from './query';

describe('Query', () => {
  describe('parseBoolean', () => {
    it('should read the plone.restapi true strings as true', () => {
      ['true', 'True', '1', 'yes', 'on', 'y', 't', 'active', 'enabled'].map(
        (value) => expect(parseBoolean(value)).toBe(true),
      );
    });

    it('should read any other value as false', () => {
      ['false', '0', 'no', 'off', 'n', 'f', 'inactive', 'maybe', ''].map(
        (value) => expect(parseBoolean(value)).toBe(false),
      );
    });
  });

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

  describe('pathCondition', () => {
    const paths = [
      '/',
      '/a',
      '/a/b',
      '/a/b/c',
      '/a/b/c/d',
      '/ab',
      '/a_c',
      '/a%c/x',
    ];

    /**
     * Match the test paths against path queries.
     * @param {Array} queries Path queries.
     * @returns {Promise<string[]>} Matching paths.
     */
    const match = async (queries: { path: string; depth?: number }[]) => {
      const [, sql, bindings] = pathCondition(queries);
      const result = await global.txn!.raw(
        `SELECT "_path" FROM unnest(?::varchar[]) AS t("_path") WHERE ${sql}`,
        [paths, ...bindings],
      );
      return result.rows.map((row: any) => row._path).sort();
    };

    it('should match the path and everything below it', async () => {
      expect(await match([{ path: '/a' }])).toEqual([
        '/a',
        '/a/b',
        '/a/b/c',
        '/a/b/c/d',
      ]);
      expect(await match([{ path: '/a/', depth: -1 }])).toEqual([
        '/a',
        '/a/b',
        '/a/b/c',
        '/a/b/c/d',
      ]);
      expect(await match([{ path: '/' }])).toEqual(paths.slice().sort());
    });

    it('should support depth', async () => {
      expect(await match([{ path: '/a', depth: 0 }])).toEqual(['/a']);
      expect(await match([{ path: '/a', depth: 1 }])).toEqual(['/a/b']);
      expect(await match([{ path: '/a', depth: 2 }])).toEqual([
        '/a/b',
        '/a/b/c',
      ]);
      expect(await match([{ path: '/', depth: 1 }])).toEqual(
        ['/a', '/a_c', '/ab'].sort(),
      );
    });

    it('should not treat like wildcards in paths as wildcards', async () => {
      expect(await match([{ path: '/a_c' }])).toEqual(['/a_c']);
      expect(await match([{ path: '/a%c' }])).toEqual(['/a%c/x']);
    });

    it('should combine paths with or', async () => {
      expect(
        await match([
          { path: '/ab', depth: 0 },
          { path: '/a/b/c', depth: 1 },
        ]),
      ).toEqual(['/a/b/c/d', '/ab'].sort());
    });

    it('should use the path index', async () => {
      const [, sql, bindings] = pathCondition([{ path: '/a', depth: 2 }]);
      await global.txn!.raw('SET LOCAL enable_seqscan = off');
      const plan = await global.txn!.raw(
        `EXPLAIN SELECT * FROM catalog WHERE ${sql}`,
        bindings,
      );
      expect(JSON.stringify(plan.rows)).toContain(
        'catalog__path_pattern_index',
      );
    });
  });
});
