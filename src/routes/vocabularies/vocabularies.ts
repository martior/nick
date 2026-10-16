/**
 * Vocabularies route.
 * @module routes/vocabularies/vocabularies
 */

// Type imports
import type { Request, VocabularyTerm } from '../../types';
import type { Knex } from 'knex';

// External imports
import { sortBy } from 'es-toolkit/compat';

// Internal imports
import { RequestException } from '../../helpers/error/error';
import { getUrl } from '../../helpers/url/url';
import models from '../../models';
import vocabularies from '../../vocabularies';

export default [
  {
    op: 'get',
    view: '/@vocabularies',
    permission: 'View',
    client: 'getVocabularies',
    cache: 'static',
    handler: async (req: Request, trx: Knex.Transaction) => {
      const Vocabulary = models.get('Vocabulary');
      const profileVocabularies = await Vocabulary.fetchAll({}, {}, trx);

      return {
        json: sortBy(
          [
            ...Object.keys(vocabularies.vocabularies).map((vocabulary) => ({
              '@id': `${getUrl(req)}/@vocabularies/${vocabulary}`,
              title: vocabulary,
            })),
            ...profileVocabularies.map(
              (vocabulary: InstanceType<typeof Vocabulary>) => ({
                '@id': `${getUrl(req)}/@vocabularies/${vocabulary.id}`,
                title: vocabulary.title,
              }),
            ),
          ],
          'title',
        ),
      };
    },
  },
  {
    op: 'get',
    view: '/@vocabularies/:id',
    permission: 'View',
    client: 'getVocabulary',
    cache: 'dynamic',
    handler: async (req: Request, trx: Knex.Transaction) => {
      let id = req.params.id;
      let items: VocabularyTerm[];

      // Check if vocabulary is available
      if (!vocabularies.exists(id)) {
        const Vocabulary = models.get('Vocabulary');
        id = id === 'plone.contentrules.events' ? 'events' : id;
        const vocabulary = await Vocabulary.fetchById(id, {}, trx);
        if (!vocabulary) {
          throw new RequestException(404, { error: req.i18n('Not found.') });
        }
        items = vocabulary.items;
      } else {
        items = await vocabularies.get(id)(req, trx);
      }

      // Filter by title or token
      const title = typeof req.query.title === 'string' ? req.query.title : '';
      const token = typeof req.query.token === 'string' ? req.query.token : '';
      if (title && token) {
        throw new RequestException(400, {
          error: req.i18n(
            'You can not filter by title and token at the same time.',
          ),
        });
      }
      if (title) {
        items = items.filter((item: VocabularyTerm) =>
          `${item.title}`.toLowerCase().includes(title.toLowerCase()),
        );
      } else if (token) {
        items = items.filter(
          (item: VocabularyTerm) =>
            `${item.token}`.toLowerCase() === token.toLowerCase(),
        );
      }

      // Batch if requested
      const url = `${getUrl(req)}/@vocabularies/${id}`;
      const total = items.length;
      const start = Math.max(0, parseInt(`${req.query.b_start}`, 10) || 0);
      const size = parseInt(`${req.query.b_size}`, 10);
      let batching = {};
      if (size > 0 && (start > 0 || total > size)) {
        items = items.slice(start, start + size);
        const link = (bStart: number) => {
          const params = new URLSearchParams(
            req.query as Record<string, string>,
          );
          params.set('b_start', `${bStart}`);
          return `${url}?${params.toString()}`;
        };
        batching = {
          batching: {
            '@id': link(start),
            first: link(0),
            last: link(Math.floor((total - 1) / size) * size),
            ...(start + size < total ? { next: link(start + size) } : {}),
            ...(start > 0 ? { prev: link(Math.max(0, start - size)) } : {}),
          },
        };
      }

      // Return data
      return {
        json: {
          '@id': url,
          items,
          items_total: total,
          ...batching,
        },
      };
    },
  },
];
