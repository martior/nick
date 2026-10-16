/**
 * Add indexes which cover the permission filter of the catalog.
 * @module migration/catalog_covering_indexes
 */

// Type imports
import type { Knex } from 'knex';

// Internal imports
import {
  createCoveringIndexes,
  dropCoveringIndexes,
} from '../helpers/catalog/catalog';

export const up = async (knex: Knex): Promise<void> => {
  // On a new site the catalog seed creates them once the columns exist
  await createCoveringIndexes(knex);
};

export const down = async (knex: Knex): Promise<void> => {
  await dropCoveringIndexes(knex);
};
