/**
 * Controlpanel seed tests.
 * @module seeds/controlpanel/controlpanel.test
 */

// External imports
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { describe, it, expect } from 'vitest';

// Internal imports
import '../../app';
import models from '../../models';
import { seedControlpanel } from './controlpanel';

describe('seedControlpanel', () => {
  it('replaces lists and merges other settings', async () => {
    const Controlpanel = models.get('Controlpanel');
    const profile = mkdtempSync(`${tmpdir()}/nick-seed-`);
    mkdirSync(`${profile}/controlpanels`);
    writeFileSync(
      `${profile}/controlpanels/language.json`,
      JSON.stringify({
        id: 'language',
        data: { available_languages: ['de'], multilingual: true },
      }),
    );

    await seedControlpanel(global.txn!, profile);
    rmSync(profile, { recursive: true, force: true });

    const controlpanel = await Controlpanel.fetchById(
      'language',
      {},
      global.txn!,
    );
    expect(controlpanel.data).toMatchObject({
      default_language: 'en',
      available_languages: ['de'],
      multilingual: true,
    });
  });
});
