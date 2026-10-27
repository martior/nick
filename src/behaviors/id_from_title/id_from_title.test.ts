/**
 * ID from title behavior tests.
 * @module behaviors/id_from_title/id_from_title.test
 */

// External imports
import { describe, it, expect } from 'vitest';

// Internal imports
import { idFromTitle, id_from_title } from './id_from_title';

describe('id_from_title', () => {
  describe('setId', () => {
    it('uses provided id when not in blacklist', () => {
      const doc = { id: '', json: { title: 'My Title' } };
      id_from_title.setId.call(doc, 'my-id', ['other']);
      expect(doc.id).toBe('my-id');
    });

    it('appends counter when id is in blacklist', () => {
      const doc = { id: '', json: { title: 'My Title' } };
      id_from_title.setId.call(doc, 'my-id', ['my-id']);
      expect(doc.id).toBe('my-id-1');
    });

    it('slugifies title when id is not provided', () => {
      const doc = { id: '', json: { title: 'My Title! @Test' } };
      id_from_title.setId.call(doc);
      expect(doc.id).toBe('my-title-test');
    });

    it('gives the type for a title without letters or digits', () => {
      const doc = { id: '', type: 'Page', json: { title: '?!, & %' } };
      id_from_title.setId.call(doc);
      expect(doc.id).toBe('page');
    });

    it('cuts long ids at a dash', () => {
      const doc = { id: '', json: { title: 'Lorem ipsum '.repeat(100) } };
      id_from_title.setId.call(doc);
      expect(doc.id.length).toBeLessThanOrEqual(255);
      expect(doc.id.startsWith('lorem-ipsum-lorem')).toBe(true);
      expect(doc.id.endsWith('-')).toBe(false);
    });
  });

  describe('idFromTitle', () => {
    it('makes every character but letters, digits, dot, underscore and dash a dash like Plone', () => {
      expect(
        idFromTitle('The Plone universe: the ecosystem, and how it evolved'),
      ).toBe('the-plone-universe-the-ecosystem-and-how-it-evolved');
      expect(idFromTitle('Q&A: 100% ready; #1 = best')).toBe(
        'q-a-100-ready-1-best',
      );
      expect(idFromTitle('Version 2.0 of my_module')).toBe(
        'version-2.0-of-my_module',
      );
    });

    it('removes quotes and transliterates letters', () => {
      expect(idFromTitle('Rob\'s "best" Café')).toBe('robs-best-cafe');
      expect(idFromTitle('Straße Ærø')).toBe('strasse-aero');
    });

    it('trims dashes, dots and underscores', () => {
      expect(idFromTitle('  -- Hello. --  ')).toBe('hello');
      expect(idFromTitle('_private_')).toBe('private');
    });

    it('gives an empty id for a title without letters or digits', () => {
      expect(idFromTitle('?!, & %')).toBe('');
      expect(idFromTitle('')).toBe('');
    });
  });
});
