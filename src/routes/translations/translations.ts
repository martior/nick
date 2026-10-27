/**
 * Translations routes.
 * @module routes/translations/translations
 */

// Type imports
import type { Request } from '../../types';
import type { Knex } from 'knex';

// Internal imports
import { RequestException } from '../../helpers/error/error';
import { getUrl, getUrlByPath, stripPath } from '../../helpers/url/url';
import models from '../../models';

/**
 * Check if the user can view and modify a translation.
 * @method checkModify
 * @param {Object} document Document of the translation.
 * @param {Request} req Request object.
 * @param {Knex.Transaction} trx Transaction object.
 */
async function checkModify(
  document: any,
  req: Request,
  trx: Knex.Transaction,
): Promise<void> {
  const permissions = document
    ? await document.fetchUserPermissions(req.user, trx)
    : [];

  // Not found if not viewable
  if (!permissions.includes('View')) {
    throw new RequestException(404, { error: req.i18n('Not found.') });
  }

  // Not authorized if not modifiable
  if (!permissions.includes('Modify')) {
    throw new RequestException(req.user.id === 'anonymous' ? 401 : 403, {
      message: req.i18n('You are not authorized to access this resource.'),
    });
  }
}

export const handler = async (req: Request, trx: Knex.Transaction) => {
  const Document = models.get('Document');
  const Controlpanel = models.get('Controlpanel');
  const documents = req.document.translation_group
    ? await Document.fetchAll(
        { translation_group: req.document.translation_group, deleted: false },
        {},
        trx,
      )
    : [];
  const controlpanel = await Controlpanel.fetchById('language', {}, trx);
  const settings = controlpanel.data;

  // Only list the translations the user can view
  const viewable = await Promise.all(
    (documents.models || []).map(
      async (document: InstanceType<typeof Document>) =>
        document.uuid === req.document.uuid ||
        (await document.fetchUserPermissions(req.user, trx)).includes('View'),
    ),
  );

  return {
    json: {
      '@id': `${getUrl(req)}/@translations`,
      items: (documents.models || [])
        .filter((_document: any, index: number) => viewable[index])
        .map((document: InstanceType<typeof Document>) => ({
          '@id': getUrlByPath(req, document.path),
          language: document.language,
        })),
      root: Object.fromEntries(
        settings.available_languages.map((language: string) => [
          language,
          getUrlByPath(req, `/${language}`),
        ]),
      ),
    },
    xkeys: [req.document.translation_group],
  };
};

export default [
  {
    op: 'get',
    view: '/@translations',
    permission: 'View',
    client: 'getTranslations',
    cache: 'content',
    handler,
  },
  {
    op: 'delete',
    view: '/@translations',
    permission: 'Modify',
    client: 'unlinkTranslation',
    cache: 'alter',
    handler: async (req: Request, trx: Knex.Transaction) => {
      const Document = models.get('Document');
      const document = await Document.fetchOne(
        {
          translation_group: req.document.translation_group,
          language: req.body.language,
        },
        {},
        trx,
      );

      // Check if the user can modify the translation
      await checkModify(document, req, trx);

      await document.update(
        {
          translation_group: document.uuid,
        },
        trx,
      );
      return {
        json: {},
      };
    },
  },
  {
    op: 'post',
    view: '/@translations',
    permission: 'Modify',
    client: 'linkTranslation',
    cache: 'alter',
    handler: async (req: Request, trx: Knex.Transaction) => {
      const Document = models.get('Document');

      // Strip prefix of url
      const id = stripPath(req.body.id);

      let target;
      // Check if path
      if (id.startsWith('/')) {
        target = await Document.fetchOne({ path: id }, {}, trx);
        // Else it is a uuid
      } else {
        target = await Document.fetchOne({ uuid: id }, {}, trx);
      }

      // Check if the user can modify the target
      await checkModify(target, req, trx);

      // Link documents
      await target.update(
        {
          translation_group: req.document.translation_group,
        },
        trx,
      );

      return {
        json: {},
      };
    },
  },
  {
    op: 'get',
    view: '/@translation-locator',
    permission: 'View',
    client: 'getTranslationLocation',
    cache: 'manage',
    handler: async (req: Request, trx: Knex.Transaction) => {
      const Document = models.get('Document');

      // Fetch parent
      const parent = await Document.fetchOne({
        uuid: req.document.parent,
      });

      const document = await Document.fetchOne(
        {
          translation_group: parent.translation_group,
          language: req.query.target_language,
          deleted: false,
        },
        {},
        trx,
      );

      // Only point to the translation if the user can view it
      const viewable =
        document &&
        (await document.fetchUserPermissions(req.user, trx)).includes('View');

      return {
        json: {
          '@id': viewable
            ? getUrlByPath(req, document.path)
            : getUrlByPath(
                req,
                req.document.type === 'Languageroot'
                  ? '/'
                  : `/${req.query.target_language}`,
              ),
        },
      };
    },
  },
];
