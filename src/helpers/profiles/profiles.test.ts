/**
 * Profile helper tests.
 * @module helpers/profiles/profiles.test
 */

// External imports
import { afterEach, describe, expect, it } from 'vitest';

// Internal imports
import type { ProfileInfo } from './profiles';
import {
  configuredProfiles,
  resolvePackage,
  resolveProfiles,
  splitProfileId,
} from './profiles';

/**
 * A fake resolver for profiles with the given dependencies
 * @method resolver
 * @param {Object} dependencies Dependencies per profile id.
 * @returns {function} Resolver.
 */
const resolver =
  (dependencies: { [id: string]: string[] }) =>
  async (id: string): Promise<ProfileInfo> => {
    if (!dependencies[id]) {
      throw new Error(`Cannot resolve package '${splitProfileId(id)[0]}'`);
    }
    const [pkg, name] = splitProfileId(id);
    return {
      id,
      package: pkg,
      name,
      path: `/profiles/${name}`,
      packageRoot: '/',
      packageConfig: {},
      packageVersion: '1.0.0',
      metadata: { id, version: 1000, dependencies: dependencies[id] },
    };
  };

describe('Profiles', () => {
  afterEach(() => {
    delete process.env.PROFILES;
  });

  it('should split profile ids', () => {
    expect(splitProfileId('@plone/nick:core')).toEqual(['@plone/nick', 'core']);
    expect(splitProfileId('my_project:default')).toEqual([
      'my_project',
      'default',
    ]);
    expect(() => splitProfileId('@plone/nick')).toThrow('Invalid profile');
  });

  it('should resolve packages', async () => {
    const core = resolvePackage('@plone/nick');
    expect(core.profilesDir.endsWith('/src/profiles')).toBe(true);

    expect(() => resolvePackage('@plone/does-not-exist')).toThrow(
      "Cannot resolve package '@plone/does-not-exist'",
    );
  });

  it('should order profiles by their dependencies', async () => {
    const resolve = resolver({
      'a:default': ['core:core'],
      'b:default': ['a:default', 'core:core'],
      'core:core': [],
      'c:default': [],
    });
    const ids = async (list: string[]) =>
      (await resolveProfiles(list, resolve)).map((profile) => profile.id);

    // Dependencies come first and are added when missing
    expect(await ids(['b:default', 'c:default'])).toEqual([
      'core:core',
      'a:default',
      'b:default',
      'c:default',
    ]);

    // The order of the list is kept otherwise
    expect(await ids(['core:core', 'c:default', 'a:default'])).toEqual([
      'core:core',
      'c:default',
      'a:default',
    ]);
  });

  it('should refuse dependency cycles and missing dependencies', async () => {
    await expect(
      resolveProfiles(
        ['a:default'],
        resolver({
          'a:default': ['b:default'],
          'b:default': ['c:default'],
          'c:default': ['a:default'],
        }),
      ),
    ).rejects.toThrow(
      'Profile dependency cycle: a:default -> b:default -> c:default -> a:default',
    );
    await expect(
      resolveProfiles(['a:default'], resolver({ 'a:default': ['x:default'] })),
    ).rejects.toThrow(
      "Profile a:default depends on x:default: Cannot resolve package 'x'",
    );
  });

  it('should read the profiles from the PROFILES variable', () => {
    process.env.PROFILES = '@plone/nick:core, @acme/nick-addon:default,';
    expect(configuredProfiles()).toEqual([
      '@plone/nick:core',
      '@acme/nick-addon:default',
    ]);
    delete process.env.PROFILES;
    expect(configuredProfiles()[0]).toBe('@plone/nick:core');
  });
});
