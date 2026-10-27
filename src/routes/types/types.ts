/**
 * Types routes.
 * @module routes/types/types
 */

// Type imports
import type { Fieldset, Property, Request, Schema } from '../../types';
import type { Knex } from 'knex';

// External imports
import { omit, pick } from 'es-toolkit/object';
import slugify from 'slugify';

// Internal imports
import { RequestException } from '../../helpers/error/error';
import { translateSchema } from '../../helpers/schema/schema';
import models from '../../models';

// Fields which can be added through the web, by factory
const factories: { [factory: string]: Partial<Property> } = {
  'Text line (String)': { type: 'string' },
  Text: { type: 'string', widget: 'textarea' },
  Integer: { type: 'integer' },
  'Floating-point number': { type: 'number' },
  'Yes/No': { type: 'boolean' },
  Date: { type: 'string', widget: 'date' },
  'Date/Time': { type: 'string', widget: 'datetime' },
  Email: { type: 'string', widget: 'email' },
  URL: { type: 'string', widget: 'url' },
  File: { type: 'object', widget: 'file' },
  Image: { type: 'object', widget: 'file' },
  JSONField: { type: 'dict', widget: 'json' },
};

/**
 * Only authenticated users may see type information, like in plone.restapi.
 * @method checkAuthenticated
 * @param {Request} req Request object.
 */
function checkAuthenticated(req: Request): void {
  if (req.user.id === 'anonymous') {
    throw new RequestException(401, {
      message: req.i18n('You are not authorized to access this resource.'),
    });
  }
}

/**
 * Fetch a type or throw a not found error.
 * @method fetchType
 * @param {Request} req Request object.
 * @param {Knex.Transaction} trx Transaction object.
 * @returns {Promise<Object>} Type.
 */
async function fetchType(req: Request, trx: Knex.Transaction): Promise<any> {
  const Type = models.get('Type');
  const type = await Type.fetchById(req.params.type, {}, trx);
  if (!type) {
    throw new RequestException(404, { error: req.i18n('Not found.') });
  }
  return type;
}

/**
 * Get the schema the type adds to its behaviors, which can be changed
 * through the web.
 * @method ownSchema
 * @param {Object} type Type object.
 * @returns {Schema} Schema of the type.
 */
function ownSchema(type: any): Schema {
  return {
    ...type.schema,
    fieldsets: type.schema?.fieldsets || [],
    properties: type.schema?.properties || {},
    required: type.schema?.required || [],
  };
}

/**
 * Save the schema of a type and update its cached schema.
 * @method saveSchema
 * @param {Object} type Type object.
 * @param {Schema} schema New schema of the type.
 * @param {Knex.Transaction} trx Transaction object.
 * @returns {Promise<void>}
 */
async function saveSchema(
  type: any,
  schema: Schema,
  trx: Knex.Transaction,
): Promise<void> {
  await type.update({ schema }, trx);
  type.schema = schema;
  await type.cacheSchema(trx);
}

/**
 * Get the JSON schema of a type.
 * @method typeSchema
 * @param {Request} req Request object.
 * @param {Object} type Type object.
 * @returns {Object} JSON schema.
 */
function typeSchema(req: Request, type: any): Record<string, any> {
  return {
    ...translateSchema(omit(type._schema, ['behaviors']) as Schema, req),
    layouts: type._schema.layouts || [],
    title: req.i18n(type.title),
    type: 'object',
  };
}

export const handler = async (req: Request, trx: Knex.Transaction) => {
  const Type = models.get('Type');
  const types = await Type.fetchAll({}, { order: 'id' }, trx);

  // Sort on the translated title like Plone
  const json = await types.toJson(req);
  return {
    json: json.sort((a: any, b: any) =>
      a.title.toLowerCase().localeCompare(b.title.toLowerCase()),
    ),
  };
};

export default [
  {
    op: 'get',
    view: '/@types',
    permission: 'View',
    client: 'getTypes',
    cache: 'manage',
    handler: async (req: Request, trx: Knex.Transaction) => {
      checkAuthenticated(req);
      return await handler(req, trx);
    },
  },
  {
    op: 'get',
    view: '/@types/:type',
    permission: 'View',
    client: 'getType',
    cache: 'manage',
    handler: async (req: Request, trx: Knex.Transaction) => {
      checkAuthenticated(req);
      const type = await fetchType(req, trx);
      return {
        headers: {
          'content-type': 'application/json+schema',
        },
        json: typeSchema(req, type),
      };
    },
  },
  {
    op: 'get',
    view: '/@types/:type/:name',
    permission: 'View',
    client: 'getTypeField',
    cache: 'manage',
    handler: async (req: Request, trx: Knex.Transaction) => {
      checkAuthenticated(req);
      const type = await fetchType(req, trx);
      const schema = typeSchema(req, type);
      const field = schema.properties?.[req.params.name];
      const fieldset = schema.fieldsets.find(
        (fieldset: Fieldset) => fieldset.id === req.params.name,
      );
      if (!field && !fieldset) {
        throw new RequestException(404, { error: req.i18n('Not found.') });
      }
      return {
        headers: {
          'content-type': 'application/json+schema',
        },
        json: field || fieldset,
      };
    },
  },
  {
    op: 'post',
    view: '/@types/:type',
    permission: 'Manage Site',
    client: 'addTypeField',
    cache: 'alter',
    handler: async (req: Request, trx: Knex.Transaction) => {
      const type = await fetchType(req, trx);
      const { factory, title, description, required, fieldset_id } =
        req.body || {};
      if (typeof title !== 'string' || title === '') {
        throw new RequestException(400, {
          message: req.i18n('Missing parameter title.'),
        });
      }
      const id =
        typeof req.body.id === 'string' && req.body.id !== ''
          ? req.body.id
          : slugify(title, { lower: true, replacement: '_', strict: true });
      const schema = ownSchema(type);

      // Add a fieldset
      if (factory === 'fieldset') {
        if (type._schema.fieldsets.some((item: Fieldset) => item.id === id)) {
          throw new RequestException(400, {
            message: req.i18n('Fieldset {id} already exists.', { id }),
          });
        }
        const fieldset = {
          id,
          title,
          description: description || '',
          fields: [],
        };
        await saveSchema(
          type,
          { ...schema, fieldsets: [...schema.fieldsets, fieldset] },
          trx,
        );
        return { status: 201, json: fieldset };
      }

      // Add a field
      if (!Object.hasOwn(factories, factory)) {
        throw new RequestException(400, {
          message: req.i18n('Invalid parameter factory.'),
        });
      }
      if (id in (type._schema.properties || {})) {
        throw new RequestException(400, {
          message: req.i18n('Field {id} already exists.', { id }),
        });
      }
      const fieldsets = type._schema.fieldsets as Fieldset[];
      const target =
        (typeof fieldset_id === 'number'
          ? fieldsets[fieldset_id]
          : fieldsets.find((item) => item.id === fieldset_id)) || fieldsets[0];
      const property = {
        ...factories[factory],
        title,
        description: description || '',
        factory,
      } as Property;
      const own = schema.fieldsets.find((item) => item.id === target.id);
      await saveSchema(
        type,
        {
          ...schema,
          fieldsets: own
            ? schema.fieldsets.map((item) =>
                item.id === target.id
                  ? { ...item, fields: [...item.fields, id] }
                  : item,
              )
            : [
                ...schema.fieldsets,
                { ...pick(target, ['id', 'title']), fields: [id] },
              ],
          properties: { ...schema.properties, [id]: property },
          required:
            required === true
              ? [...(schema.required || []), id]
              : schema.required,
        },
        trx,
      );
      return { status: 201, json: property };
    },
  },
  {
    op: 'patch',
    view: '/@types/:type/:name',
    permission: 'Manage Site',
    client: 'updateTypeField',
    cache: 'alter',
    handler: async (req: Request, trx: Knex.Transaction) => {
      const type = await fetchType(req, trx);
      const schema = ownSchema(type);
      const name = req.params.name;
      const body = req.body || {};

      if (schema.properties?.[name]) {
        // Update a field added through the web
        const required = (schema.required || []).filter(
          (field) => field !== name,
        );
        await saveSchema(
          type,
          {
            ...schema,
            properties: {
              ...schema.properties,
              [name]: {
                ...schema.properties[name],
                ...pick(body, [
                  'title',
                  'description',
                  'default',
                  'minLength',
                  'maxLength',
                ]),
              },
            },
            required:
              body.required === true
                ? [...required, name]
                : body.required === false
                  ? required
                  : schema.required,
          },
          trx,
        );
      } else if (schema.fieldsets.some((item) => item.id === name)) {
        // Update a fieldset added through the web
        await saveSchema(
          type,
          {
            ...schema,
            fieldsets: schema.fieldsets.map((item) =>
              item.id === name
                ? { ...item, ...pick(body, ['title', 'description']) }
                : item,
            ),
          },
          trx,
        );
      } else {
        throw new RequestException(404, { error: req.i18n('Not found.') });
      }
      return { status: 204 };
    },
  },
  {
    op: 'delete',
    view: '/@types/:type/:name',
    permission: 'Manage Site',
    client: 'deleteTypeField',
    cache: 'alter',
    handler: async (req: Request, trx: Knex.Transaction) => {
      const type = await fetchType(req, trx);
      const schema = ownSchema(type);
      const name = req.params.name;
      if (schema.properties?.[name]) {
        // Remove a field added through the web
        await saveSchema(
          type,
          {
            ...schema,
            fieldsets: schema.fieldsets.map((item) => ({
              ...item,
              fields: item.fields.filter((field) => field !== name),
            })),
            properties: omit(schema.properties, [name]),
            required: (schema.required || []).filter((field) => field !== name),
          },
          trx,
        );
      } else if (schema.fieldsets.some((item) => item.id === name)) {
        // Remove a fieldset added through the web, with its fields
        const fields =
          schema.fieldsets.find((item) => item.id === name)?.fields || [];
        await saveSchema(
          type,
          {
            ...schema,
            fieldsets: schema.fieldsets.filter((item) => item.id !== name),
            properties: omit(schema.properties || {}, fields),
            required: (schema.required || []).filter(
              (field) => !fields.includes(field),
            ),
          },
          trx,
        );
      } else {
        throw new RequestException(404, { error: req.i18n('Not found.') });
      }
      return { status: 204 };
    },
  },
];
