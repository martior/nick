/**
 * Modules helper tests.
 * @module helpers/modules/modules.test
 */

// External imports
import { describe, expect, it, vi } from 'vitest';

// Internal imports
import { knex } from '../knex/knex';
import * as migrate from '../migrate/migrate';
import * as drift from '../drift/drift';
import { allModules, parseModules, parseOptions, run } from './modules';

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

  it('should exit non-zero when the schema differs from the snapshot', async () => {
    const migrating = vi.spyOn(migrate, 'migrate').mockResolvedValue();
    const destroy = vi.spyOn(knex, 'destroy').mockResolvedValue(undefined);
    vi.spyOn(drift, 'readSnapshot').mockReturnValue(['table public.job']);
    const describe = vi
      .spyOn(drift, 'describeSchema')
      .mockResolvedValue(['table public.job']);

    expect(await run(['migrate'], { checkSchema: 'snapshot.txt' })).toBe(0);
    describe.mockResolvedValue(['table public.job', 'table public.extra']);
    expect(await run(['migrate'], { checkSchema: 'snapshot.txt' })).toBe(1);
    migrating.mockRestore();
    destroy.mockRestore();
    vi.restoreAllMocks();
  });
});

describe('parseOptions', () => {
  it('should read the schema check option', () => {
    expect(parseOptions(['--modules=migrate'])).toEqual({});
    expect(parseOptions(['--check-schema'])).toEqual({
      checkSchema: 'src/migrations/schema.snapshot.txt',
    });
    expect(parseOptions(['--check-schema=schema.txt'])).toEqual({
      checkSchema: 'schema.txt',
    });
  });
});
