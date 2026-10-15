/**
 * Group seed tests.
 * @module seeds/group/group.test
 */

// External imports
import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { describe, it, expect } from 'vitest';

// Internal imports
import '../../app';
import models from '../../models';
import { seedGroup } from './group';

describe('seedGroup', () => {
  it('imports groups with a long description', async () => {
    const Group = models.get('Group');
    const profile = mkdtempSync(`${tmpdir()}/nick-seed-`);
    const description = 'Long description. '.repeat(30);
    writeFileSync(
      `${profile}/groups.json`,
      JSON.stringify({
        purge: false,
        groups: [{ id: 'migrated', title: 'Migrated', description }],
      }),
    );

    await seedGroup(global.txn!, profile);
    rmSync(profile, { recursive: true, force: true });

    const group = await Group.fetchById('migrated', {}, global.txn!);
    expect(group.description).toBe(description);
  });
});
