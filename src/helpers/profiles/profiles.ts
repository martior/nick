/**
 * Profile helper.
 * @module helpers/profiles/profiles
 */

// Type imports
import type { NickPackageConfig, ProfileMetadata } from '../../types';

// External imports
import fs from 'fs';
import { createRequire } from 'module';
import path from 'path';
import { fileURLToPath } from 'url';

// Internal imports
import config from '../config/config';
import { fileExists } from '../fs/fs';
import { stripI18n } from '../i18n/i18n';
import { log } from '../log/log';

/**
 * A resolved profile.
 */
export interface ProfileInfo {
  /** Profile id as used in `config.profiles`: `<package>:<profile>`. */
  id: string;
  /** Name of the package. */
  package: string;
  /** Name of the profile in the package. */
  name: string;
  /** Directory of the profile. */
  path: string;
  /** Directory of the package (with its package.json). */
  packageRoot: string;
  /** The `nick` field of the package.json of the package. */
  packageConfig: NickPackageConfig;
  /** Version of the package. */
  packageVersion: string;
  /** Profile metadata, undefined if the profile has no metadata. */
  metadata?: ProfileMetadata;
}

/**
 * A resolved package.
 */
export interface PackageInfo {
  name: string;
  root: string;
  version: string;
  config: NickPackageConfig;
  /** Default directory of the profiles of the package. */
  profilesDir: string;
}

// Set initalization state
let initialized = false;

// Cache of the resolved profiles of the configuration
let resolved: ProfileInfo[] | undefined;

/**
 * Read a package.json
 * @method readPackageJson
 * @param {string} dir Directory of the package.
 * @returns {any} Contents or undefined.
 */
function readPackageJson(dir: string): any {
  try {
    return JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf-8'));
  } catch {
    return undefined;
  }
}

/**
 * Find the root directory of a package from a file inside it
 * @method findPackageRoot
 * @param {string} file File in the package.
 * @param {string} name Name of the package.
 * @returns {string | undefined} Root directory.
 */
function findPackageRoot(file: string, name: string): string | undefined {
  let dir = path.dirname(file);
  while (dir !== path.dirname(dir)) {
    if (readPackageJson(dir)?.name === name) {
      return dir;
    }
    dir = path.dirname(dir);
  }
  return undefined;
}

/**
 * Resolve a package: the project in the working directory, a dependency of
 * the project, or a package Nick itself can resolve (like `@plone/nick`).
 * @method resolvePackage
 * @param {string} name Name of the package.
 * @returns {PackageInfo} The package.
 */
export function resolvePackage(name: string): PackageInfo {
  const cwd = process.cwd();
  let root: string | undefined;
  let entry: string | undefined;

  if (readPackageJson(cwd)?.name === name) {
    root = cwd;
  }
  if (!root) {
    // Resolve from the project, so add-ons don't have to be dependencies of
    // Nick itself
    const require = createRequire(path.join(cwd, 'package.json'));
    try {
      root = path.dirname(require.resolve(`${name}/package.json`));
    } catch {
      try {
        entry = require.resolve(name);
        root = findPackageRoot(entry, name);
      } catch {
        // Try the next way
      }
    }
  }
  if (!root) {
    try {
      entry = fileURLToPath(import.meta.resolve(name));
      root = findPackageRoot(entry, name);
    } catch {
      // Not resolvable
    }
  }
  if (!root) {
    throw new Error(
      `Cannot resolve package '${name}', not a dependency and not the workspace root`,
    );
  }

  // Find the profiles directory: configured, next to the entry point, or
  // src/profiles
  const pkg = readPackageJson(root) || {};
  const packageConfig: NickPackageConfig = pkg.nick || {};
  let profilesDir: string;
  if (packageConfig.profiles) {
    profilesDir = path.resolve(root, packageConfig.profiles);
  } else {
    if (!entry && root !== cwd) {
      try {
        entry = createRequire(path.join(root, 'package.json')).resolve(name);
      } catch {
        try {
          entry = fileURLToPath(import.meta.resolve(name));
        } catch {
          // No entry point
        }
      }
    }
    profilesDir = entry
      ? path.resolve(path.dirname(entry), 'profiles')
      : path.resolve(root, 'src/profiles');
  }

  return {
    name,
    root,
    version: pkg.version || '0.0.0',
    config: packageConfig,
    profilesDir,
  };
}

/**
 * Split a profile id into its package and profile name. Scoped packages
 * contain a slash, the profile name follows the last colon.
 * @method splitProfileId
 * @param {string} id Profile id.
 * @returns {string[]} Package name and profile name.
 */
export function splitProfileId(id: string): [string, string] {
  const index = id.lastIndexOf(':');
  if (index <= 0 || index === id.length - 1) {
    throw new Error(
      `Invalid profile '${id}', expected '<package>:<profile>' like '@plone/nick:core'`,
    );
  }
  return [id.substring(0, index), id.substring(index + 1)];
}

/**
 * Read the profile metadata of a profile directory
 * @method readMetadata
 * @param {string} profilePath Path of the profile.
 * @returns {Promise<ProfileMetadata | undefined>} Metadata or undefined.
 */
export async function readMetadata(
  profilePath: string,
): Promise<ProfileMetadata | undefined> {
  if (await fileExists(`${profilePath}/metadata`)) {
    return stripI18n((await import(`${profilePath}/metadata`)).default) as any;
  }
  return undefined;
}

/**
 * Resolve a single profile
 * @method resolveProfile
 * @param {string} id Profile id.
 * @returns {Promise<ProfileInfo>} The profile.
 */
export async function resolveProfile(id: string): Promise<ProfileInfo> {
  const [packageName, profileName] = splitProfileId(id);
  const pkg = resolvePackage(packageName);
  const profilePath = path.resolve(pkg.profilesDir, profileName);
  return {
    id,
    package: packageName,
    name: profileName,
    path: profilePath,
    packageRoot: pkg.root,
    packageConfig: pkg.config,
    packageVersion: pkg.version,
    metadata: fs.existsSync(profilePath)
      ? await readMetadata(profilePath)
      : undefined,
  };
}

/**
 * The configured profiles: the PROFILES environment variable (a comma
 * separated list) or `profiles` in config.ts
 * @method configuredProfiles
 * @returns {string[]} Profile ids.
 */
export function configuredProfiles(): string[] {
  const env = process.env.PROFILES;
  if (env && env.trim() !== '') {
    return env
      .split(',')
      .map((profile) => profile.trim())
      .filter((profile) => profile !== '');
  }
  return config.settings.profiles;
}

/**
 * Resolve profiles and order them by their dependencies (`dependencies` in
 * metadata.json). Dependencies which are not listed are added. Otherwise
 * the order of the list is kept. A dependency cycle is an error.
 * @method resolveProfiles
 * @param {string[]} ids Profile ids (default: the configured profiles).
 * @param {function} resolve Resolves one profile (default: resolveProfile).
 * @returns {Promise<ProfileInfo[]>} Profiles in installation order.
 */
export async function resolveProfiles(
  ids: string[] = configuredProfiles(),
  resolve: (id: string) => Promise<ProfileInfo> = resolveProfile,
): Promise<ProfileInfo[]> {
  const profiles: { [id: string]: ProfileInfo } = {};
  const ordered: ProfileInfo[] = [];
  const done = new Set<string>();

  const get = async (id: string): Promise<ProfileInfo> => {
    if (!profiles[id]) {
      profiles[id] = await resolve(id);
    }
    return profiles[id];
  };

  const visit = async (id: string, trail: string[]): Promise<void> => {
    if (done.has(id)) {
      return;
    }
    if (trail.includes(id)) {
      throw new Error(
        `Profile dependency cycle: ${[...trail.slice(trail.indexOf(id)), id].join(' -> ')}`,
      );
    }
    let profile: ProfileInfo;
    try {
      profile = await get(id);
    } catch (err: any) {
      throw new Error(
        trail.length > 0
          ? `Profile ${trail[trail.length - 1]} depends on ${id}: ${err.message}`
          : err.message,
        { cause: err },
      );
    }
    for (const dependency of profile.metadata?.dependencies || []) {
      await visit(dependency, [...trail, id]);
    }
    done.add(id);
    ordered.push(profile);
  };

  for (const id of ids) {
    await visit(id, []);
  }
  return ordered;
}

/**
 * Get the configured profiles in installation order (cached)
 * @method getProfiles
 * @returns {Promise<ProfileInfo[]>} Profiles.
 */
export async function getProfiles(): Promise<ProfileInfo[]> {
  if (!resolved) {
    resolved = await resolveProfiles();
    resolved
      .filter((profile) => !fs.existsSync(profile.path))
      .map((profile) =>
        log.warn(`Profile ${profile.id} not found at ${profile.path}`),
      );
  }
  return resolved;
}

/**
 * Get the packages of the configured profiles in installation order
 * @method getPackages
 * @param {ProfileInfo[]} profiles Profiles (default: the configured ones).
 * @returns {Promise<PackageInfo[]>} Packages.
 */
export async function getPackages(
  profiles?: ProfileInfo[],
): Promise<PackageInfo[]> {
  const packages: PackageInfo[] = [];
  for (const profile of profiles || (await getProfiles())) {
    if (!packages.find((pkg) => pkg.name === profile.package)) {
      packages.push(resolvePackage(profile.package));
    }
  }
  return packages;
}

/**
 * Map asynchronous but in order through profiles
 * @method mapProfiles
 * @param {function} callback Callback function
 * @returns {Promise<any>} Promise which returns when all callbacks are done
 */
export async function mapProfiles(
  callback: (profile: string, index: number) => Promise<any>,
): Promise<any[]> {
  const output = [];
  const profiles = await getProfiles();

  // Loop through profiles
  for (let i = 0; i < profiles.length; i++) {
    output.push(await callback(profiles[i].path, i));
  }

  // Return output
  return output;
}

/**
 * Run the init step of a profile
 * @method initProfile
 * @param {string} profilePath Path of the profile.
 * @returns {Promise<void>} Promise which returns when done.
 */
export async function initProfile(profilePath: string): Promise<void> {
  if (await fileExists(`${profilePath}/index`)) {
    const profileModule = await import(`${profilePath}/index`);
    if (profileModule.init) {
      await profileModule.init();
    }
  }
}

/**
 * Run init step for all profiles
 * @method initProfiles
 * @returns {Promise<void>} Promise which returns when all init steps are done
 */
export async function initProfiles(): Promise<void> {
  if (!initialized) {
    await mapProfiles(async (profilePath) => {
      try {
        await initProfile(profilePath);
      } catch (error) {
        log.error(`Error loading profile at ${profilePath}`, error);
      }
    });
    initialized = true;
  }
}
