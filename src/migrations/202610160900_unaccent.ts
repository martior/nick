/**
 * Unaccent migration.
 * @module migration/unaccent
 */

// Type imports
import type { Knex } from 'knex';

export const up = async (knex: Knex): Promise<void> => {
  // Create the nick text search configuration as a copy of the default one
  // and fold accents if the unaccent extension is available.
  await knex.raw(`
    DO $$
    DECLARE
      dictionaries text;
    BEGIN
      EXECUTE format(
        'CREATE TEXT SEARCH CONFIGURATION nick (COPY = %s)',
        current_setting('default_text_search_config')::regconfig
      );
      BEGIN
        CREATE EXTENSION IF NOT EXISTS unaccent;
        SELECT string_agg(map.mapdict::regdictionary::text, ', ' ORDER BY map.mapseqno)
          INTO dictionaries
          FROM pg_ts_config_map map
          WHERE map.mapcfg = 'nick'::regconfig
            AND map.maptokentype = (
              SELECT tokid FROM ts_token_type('default') WHERE alias = 'word'
            );
        EXECUTE format(
          'ALTER TEXT SEARCH CONFIGURATION nick ALTER MAPPING FOR hword, hword_part, word WITH unaccent, %s',
          coalesce(dictionaries, 'simple')
        );
      EXCEPTION WHEN others THEN
        RAISE NOTICE 'unaccent is not available, accents will not be folded';
      END;
    END $$;
  `);

  // Fold the accents of the already indexed text
  const unaccent = await knex.raw(
    `SELECT 1 FROM pg_extension WHERE extname = 'unaccent'`,
  );
  if (unaccent.rows.length > 0) {
    const indexes = await knex('index')
      .select('id')
      .where({ type: 'text', metadata: false });
    for (const index of indexes) {
      await knex.raw(
        `UPDATE catalog SET ?? = (
          SELECT coalesce(string_agg(
            '''' || replace(replace(
              CASE WHEN unaccent(lexeme) = lexeme THEN lexeme ELSE coalesce(
                (tsvector_to_array(to_tsvector('nick', lexeme)))[1],
                unaccent(lexeme)
              ) END,
              '\\', '\\\\'), '''', '''''') || '''' ||
            coalesce(':' || array_to_string(positions, ','), ''),
            ' '
          ), '')::tsvector
          FROM unnest(??)
        ) WHERE ?? IS NOT NULL`,
        [index.id, index.id, index.id],
      );
    }
  }
};

export const down = async (knex: Knex): Promise<void> => {
  await knex.raw('DROP TEXT SEARCH CONFIGURATION IF EXISTS nick');
};
