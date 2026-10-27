/**
 * Schema helper.
 * @module helpers/schema/schema
 */

// External imports
import { compact } from 'es-toolkit/array';
import { mapValues } from 'es-toolkit/object';
import { isUndefined } from 'es-toolkit/compat';

// Internal imports
import { Fieldset, Property, Schema, Request } from '../../types';

/**
 * Merge schemas
 * @method mergeSchemas
 * @param {Array} schemas Array of schemas
 * @returns {Schema} Merged schemas.
 */
export function mergeSchemas(
  ...schemas: { name: string; data: Schema }[]
): Schema {
  const fieldsets: Fieldset[] = [];
  let properties: { [key: string]: Property } = {};
  let required: string[] = [];
  let behaviors: string[] = [];
  let layouts: string[] = [];

  schemas.map((schema) => {
    if (schema.data.fieldsets) {
      schema.data.fieldsets.map((fieldset) => {
        // Find fieldset
        const index = fieldsets.findIndex((entry) => entry.id === fieldset.id);

        // Check if already exists
        if (index !== -1) {
          // Append fields
          fieldsets[index].fields = [
            ...fieldsets[index].fields,
            ...fieldset.fields,
          ];
        } else {
          // Add new fieldset
          fieldsets.push({
            behavior: schema.name,
            ...fieldset,
          });
        }
      });
    }
    properties = {
      ...properties,
      ...mapValues(schema.data.properties || [], (property: any) => ({
        behavior: schema.name,
        ...property,
      })),
    };
    if (schema.data.required) {
      required = [...required, ...schema.data.required];
    }
    if (schema.data.behaviors) {
      behaviors = [...behaviors, ...schema.data.behaviors];
    }
    if (schema.data.layouts) {
      layouts = [...layouts, ...schema.data.layouts];
    }
  });
  return {
    fieldsets,
    properties,
    required,
    ...(behaviors.length > 0 ? { behaviors } : {}),
    ...(layouts.length > 0 ? { layouts } : {}),
  };
}

/**
 * Translate the schema
 * @method translateSchema
 * @param {Schema} schema Schema object.
 * @param {Request} req Request object.
 * @returns {Schema} Translated schema.
 */
export function translateSchema(schema: Schema, req: Request): Schema {
  return {
    ...schema,
    fieldsets: schema.fieldsets.map((fieldset) => ({
      ...fieldset,
      title: req.i18n(fieldset.title),
    })),
    properties: mapValues(schema.properties as any, (property: Property) => ({
      ...property,
      title: req.i18n(property.title),
      description: req.i18n(property.description || ''),
    })),
  };
}

/**
 * Format schema to html
 * @method schemaToHtml
 * @param {Schema} schema Schema object.
 * @param {any} data Data of the schema.
 * @returns {string} Schema in html schema.
 */
export function schemaToHtml(schema: Schema, data: any): string {
  return schema.fieldsets
    .map(
      (fieldset) =>
        `<table>${fieldset.id === 'default' ? '' : `<tr><th colspan="2">${fieldset.title}</th>`}</tr>${fieldset.fields.map((field) => `<tr><th>${schema.properties?.[field].title || ''}</th><td>${isUndefined(data[field]) ? '' : data[field]}</td></tr>`).join('\n')}</table>`,
    )
    .join('\n');
}

/**
 * Get factory fields.
 * @method getFactoryFields
 * @param {Schema} schema Schema object.
 * @param {string} factory Factory field.
 * @returns {string[]} Array of fields with given factory.
 */
export function getFactoryFields(schema: Schema, factory: string): string[] {
  const properties: any = schema.properties || {};

  // Get factory fields
  const factoryFields = Object.keys(properties).map((property) =>
    properties[property].factory === factory ? property : false,
  );
  return compact(factoryFields) as string[];
}

export interface ValidationError {
  field: string;
  message: string;
  error: 'ValidationError';
}

/**
 * Check if a value is a plain object.
 * @method isPlainObject
 * @param {any} value Value to check.
 * @returns {boolean} True if the value is a plain object.
 */
function isPlainObject(value: any): boolean {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Validate the values of fields against the schema, like the zope.schema
 * validation of plone.restapi. Only fields in the schema are validated;
 * fields with a vocabulary (Choice) or a file are not type checked.
 * @method validateFields
 * @param {Object} data Field values.
 * @param {Schema} schema Schema object.
 * @param {Function} i18n Translation function.
 * @returns {ValidationError[]} List of errors.
 */
export function validateFields(
  data: Record<string, any>,
  schema: Schema,
  i18n: (id: string) => string,
): ValidationError[] {
  const properties: Record<string, Property> = schema.properties || {};
  const required = schema.required || [];
  const errors: ValidationError[] = [];
  const error = (field: string, message: string) =>
    errors.push({ field, message, error: 'ValidationError' });

  Object.keys(data)
    .filter((field) => field in properties)
    .forEach((field) => {
      const value = data[field];
      const property = properties[field];

      // Null is only allowed for fields which are not required
      if (value === null || typeof value === 'undefined') {
        if (required.includes(field)) {
          error(field, i18n('Required input is missing.'));
        }
        return;
      }

      // Check type
      if (['Choice', 'File', 'Image'].includes(property.factory)) {
        return;
      }
      const valid =
        {
          string: typeof value === 'string',
          boolean: typeof value === 'boolean',
          integer: Number.isInteger(value),
          number: typeof value === 'number',
          array: Array.isArray(value),
          dict: isPlainObject(value),
          object: isPlainObject(value),
        }[property.type as string] ?? true;
      if (!valid) {
        error(field, i18n('Object is of wrong type.'));
        return;
      }

      // Check constraints of strings
      if (typeof value === 'string') {
        if (property.factory === 'Text line (String)' && /[\r\n]/.test(value)) {
          error(field, i18n('Constraint not satisfied'));
        } else if (
          typeof property.maxLength === 'number' &&
          value.length > property.maxLength
        ) {
          error(field, i18n('Value is too long'));
        }
      }
    });
  return errors;
}

/**
 * Normalize the strings of field values to the NFC unicode form, as Plone
 * does for text fields.
 * @method normalizeFields
 * @param {Object} data Field values.
 * @param {Schema} schema Schema object.
 * @returns {Object} Normalized field values.
 */
export function normalizeFields(
  data: Record<string, any>,
  schema: Schema,
): Record<string, any> {
  const properties: Record<string, Property> = schema.properties || {};
  return mapValues(data, (value: any, field: string) =>
    typeof value === 'string' && properties[field]?.type === 'string'
      ? value.normalize('NFC')
      : value,
  );
}
