/**
 * Notes routes: a REST service of the add-on (`@notes` and `@rating`).
 * @module routes/notes/notes
 */

// Type imports
import type { Knex, Request, Route } from '@plone/nick';

// External imports
import { getUrl, RequestException } from '@plone/nick';

// Internal imports
import { Note } from '../../models/note/note';

/**
 * Count the words of a text
 * @method countWords
 * @param {string} text Text.
 * @returns {number} Number of words.
 */
export function countWords(text: string): number {
  return text.split(/\s+/).filter((word) => word !== '').length;
}

const routes: Route[] = [
  {
    op: 'get',
    view: '/@notes',
    permission: 'View',
    client: 'getNotes',
    cache: 'dynamic',
    handler: async (req: Request, trx: Knex.Transaction) => {
      const notes = await Note.query(trx)
        .where({ document: req.document.uuid })
        .orderBy('id');
      return {
        json: {
          '@id': `${getUrl(req)}/@notes`,
          items: notes.map((note) => note.toJson()),
          items_total: notes.length,
        },
      };
    },
  },
  {
    op: 'post',
    view: '/@notes',
    permission: 'Modify',
    client: 'addNote',
    cache: 'alter',
    handler: async (req: Request, trx: Knex.Transaction) => {
      if (typeof req.body?.text !== 'string' || req.body.text.trim() === '') {
        throw new RequestException(400, {
          message: req.i18n('A note needs a text.'),
        });
      }
      const note = await Note.query(trx).insertAndFetch({
        document: req.document.uuid,
        text: req.body.text,
        words: countWords(req.body.text),
        author: req.user.id,
      });
      return { status: 201, json: note.toJson() };
    },
  },
  {
    op: 'get',
    view: '/@rating',
    permission: 'View',
    client: 'getRating',
    cache: 'content',
    handler: async (req: Request) => {
      // Only documents whose type has the example_rating behavior have stars
      if (typeof req.document.getStars !== 'function') {
        throw new RequestException(404, {
          message: req.i18n('This item has no rating.'),
        });
      }
      return {
        json: {
          '@id': `${getUrl(req)}/@rating`,
          rating: req.document.json.rating ?? null,
          stars: req.document.getStars(),
        },
      };
    },
  },
];

export default routes;
