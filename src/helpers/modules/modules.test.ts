/**
 * Modules helper tests.
 * @module helpers/modules/modules.test
 */

// External imports
import { describe, expect, it, vi } from 'vitest';

// Internal imports
import { knex } from '../knex/knex';
import * as migrate from '../migrate/migrate';
import { allModules, parseModules, run } from './modules';

describe('parseModules', () => {
  it('should default to all modules', () => {
    expect(parseModules([], undefined)).toEqual(allModules);
    expect(parseModules(['--modules=all'], undefined)).toEqual(allModules);
  });

  it('should read the modules argument', () => {
    expect(parseModules(['--modules=worker,api'], undefined)).toEqual([
      'api',
      'worker',
    ]);
    expect(parseModules(['--modules', 'migrate'], undefined)).toEqual([
      'migrate',
    ]);
  });

  it('should read NICK_MODULES', () => {
    expect(parseModules([], 'worker')).toEqual(['worker']);
    expect(parseModules(['--modules=api'], 'worker')).toEqual(['api']);
  });

  it('should refuse unknown modules', () => {
    expect(() => parseModules(['--modules=api,listener'], undefined)).toThrow(
      'Unknown module(s): listener',
    );
    expect(() => parseModules(['--modules=,'], undefined)).toThrow();
  });
});

describe('run', () => {
  it('should exit non-zero when migrate fails', async () => {
    const failing = vi
      .spyOn(migrate, 'migrate')
      .mockRejectedValue(new Error('Upgrade failed'));
    const destroy = vi.spyOn(knex, 'destroy').mockResolvedValue(undefined);

    expect(await run(['migrate', 'api'])).toBe(1);
    expect(failing).toHaveBeenCalled();
    expect(destroy).toHaveBeenCalled();
    failing.mockRestore();
    destroy.mockRestore();
  });

  it('should exit zero after migrate only', async () => {
    const migrating = vi.spyOn(migrate, 'migrate').mockResolvedValue();
    const destroy = vi.spyOn(knex, 'destroy').mockResolvedValue(undefined);

    expect(await run(['migrate'])).toBe(0);
    migrating.mockRestore();
    destroy.mockRestore();
  });
});
