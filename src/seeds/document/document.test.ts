/**
 * Document seed tests.
 * @module seeds/document/document.test
 */

// External imports
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { describe, it, expect, afterEach } from 'vitest';

// Internal imports
import '../../app';
import models from '../../models';
import { seedDocument } from './document';

/**
 * Write a profile with the given documents.
 * @param {Object} documents Documents by filename.
 * @returns {string} Path of the profile.
 */
const writeProfile = (documents: Record<string, any>): string => {
  const path = mkdtempSync(`${tmpdir()}/nick-seed-`);
  mkdirSync(`${path}/documents`);
  Object.keys(documents).map((filename) =>
    writeFileSync(
      `${path}/documents/${filename}`,
      JSON.stringify(documents[filename]),
    ),
  );
  return path;
};

describe('seedDocument', () => {
  let profile: string;

  afterEach(() => {
    rmSync(profile, { recursive: true, force: true });
  });

  it('uses the path of the document when specified', async () => {
    const Document = models.get('Document');
    profile = writeProfile({
      'news.report~2epdf.json': {
        path: '/news/report.pdf',
        uuid: '5b5e1c3e-2c6a-4f7e-9b1a-3f0d4a2c1e01',
        type: 'Page',
        title: 'Report',
      },
    });

    await seedDocument(global.txn!, profile);

    const document = await Document.fetchOne(
      { path: '/news/report.pdf' },
      {},
      global.txn!,
    );
    expect(document.id).toBe('report.pdf');
    expect(document.uuid).toBe('5b5e1c3e-2c6a-4f7e-9b1a-3f0d4a2c1e01');
    const parent = await Document.fetchOne({ path: '/news' }, {}, global.txn!);
    expect(document.parent).toBe(parent.uuid);
  });
});
