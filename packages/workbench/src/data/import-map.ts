/**
 * Import maps from package `exports` (workbench.md §2.1): the shell and each preview frame load
 * published package files as they are, without a bundler, and resolve bare specifiers through an
 * import map generated from the packages in their module graph.
 */
import { DiagnosticList, isObject, type WorkbenchDiagnostic } from '../internal/diagnostics.js';

/** The `package.json` fields that decide how a package's modules are addressed. */
export interface PackageManifest {
  readonly name: string;
  readonly version?: string;
  readonly exports?: unknown;
  readonly main?: string;
  readonly module?: string;
}

export interface ImportMapOptions {
  /** URL prefix under which every package root is served, as `${base}${name}/`. Ends with `/`. */
  readonly base: string;
  /**
   * Serve each package root as `${base}${name}@${version}/`, so documents that load different
   * copies of one package never share a URL. Default false.
   */
  readonly versioned?: boolean;
  /**
   * Active export conditions. Within each conditions object, keys keep their declared priority
   * (as in Node); `default` always applies. Default: development, browser, import.
   */
  readonly conditions?: readonly string[];
}

/** The URL prefix of a package root under `base`. */
export function packageRoot(
  pkg: PackageManifest,
  options: Pick<ImportMapOptions, 'base' | 'versioned'>,
): string {
  return options.versioned
    ? `${options.base}${pkg.name}@${pkg.version ?? '0.0.0'}/`
    : `${options.base}${pkg.name}/`;
}

export interface ImportMap {
  readonly imports: Readonly<Record<string, string>>;
}

/** Development first, so previews and the shell keep their diagnostics. */
export const DEFAULT_CONDITIONS = ['development', 'browser', 'import'] as const;

/** Resolve one export target: a path, `null` (excluded), or `undefined` (no condition applies). */
export function resolveTarget(
  target: unknown,
  conditions: ReadonlySet<string>,
): string | null | undefined {
  if (typeof target === 'string') return target;
  if (target === null) return null;
  if (Array.isArray(target)) {
    for (const item of target) {
      const resolved = resolveTarget(item, conditions);
      if (resolved !== undefined) return resolved;
    }
    return undefined;
  }
  if (isObject(target)) {
    for (const [condition, value] of Object.entries(target)) {
      if (condition !== 'default' && !conditions.has(condition)) continue;
      const resolved = resolveTarget(value, conditions);
      if (resolved !== undefined) return resolved;
    }
  }
  return undefined;
}

/** `exports` as a subpath map, or `undefined` when the package declares none. */
function subpaths(
  pkg: PackageManifest,
  out: DiagnosticList,
): Readonly<Record<string, unknown>> | undefined {
  const { exports } = pkg;
  if (exports === undefined) return undefined;
  if (typeof exports === 'string' || Array.isArray(exports) || exports === null)
    return { '.': exports };
  if (!isObject(exports)) {
    out.warn(
      'data.importMap.exports',
      `${pkg.name}: "exports" is not a string, array, or object.`,
      `/${pkg.name}/exports`,
    );
    return {};
  }
  const keys = Object.keys(exports);
  const relative = keys.filter((key) => key.startsWith('.'));
  if (relative.length === 0) return { '.': exports };
  if (relative.length !== keys.length) {
    out.warn(
      'data.importMap.exports',
      `${pkg.name}: "exports" mixes subpaths and conditions; Node rejects it, so it is skipped.`,
      `/${pkg.name}/exports`,
    );
    return {};
  }
  return exports;
}

/**
 * The package-relative file (`./dist/x.js`) that an export subpath (`.` or `./x`) resolves to,
 * as Node resolves it: exact keys first, then the pattern with the longest prefix. Without
 * `exports`, every file is reachable and `.` is `module`, `main`, or `./index.js`.
 */
export function resolveExport(
  pkg: PackageManifest,
  subpath: string,
  conditions: readonly string[] = DEFAULT_CONDITIONS,
): string | undefined {
  const map = subpaths(pkg, new DiagnosticList());
  if (map === undefined) {
    if (subpath !== '.') return subpath;
    const main = pkg.module ?? pkg.main ?? './index.js';
    return main.startsWith('./') ? main : `./${main}`;
  }
  const active = new Set(conditions);
  const relative = (target: unknown) =>
    typeof target === 'string' && target.startsWith('./') ? target : undefined;
  if (Object.hasOwn(map, subpath)) return relative(resolveTarget(map[subpath], active));
  let best: { key: string; prefix: string; suffix: string } | undefined;
  for (const key of Object.keys(map)) {
    const star = key.indexOf('*');
    if (star === -1) continue;
    const prefix = key.slice(0, star);
    const suffix = key.slice(star + 1);
    const matches =
      subpath.length >= prefix.length + suffix.length &&
      subpath.startsWith(prefix) &&
      subpath.endsWith(suffix);
    if (matches && (!best || prefix.length > best.prefix.length)) best = { key, prefix, suffix };
  }
  if (!best) return undefined;
  const target = relative(resolveTarget(map[best.key], active));
  const match = subpath.slice(best.prefix.length, subpath.length - best.suffix.length);
  return target?.replaceAll('*', match);
}

/**
 * The bare specifier that reaches the package-relative `file` (`chip.js`, `./dist/x.js`) through
 * the package's `exports`: an exact subpath first, then a pattern that Node resolves back to the
 * file. Without `exports`, every file is reachable. `undefined` when no export reaches the file.
 */
export function exportedSpecifier(
  pkg: PackageManifest,
  file: string,
  conditions: readonly string[] = DEFAULT_CONDITIONS,
): string | undefined {
  const path = file.startsWith('./') ? file : `./${file.replace(/^\/+/, '')}`;
  const specifier = (subpath: string) =>
    subpath === '.' ? pkg.name : `${pkg.name}/${subpath.slice(2)}`;
  const map = subpaths(pkg, new DiagnosticList());
  if (map === undefined) return specifier(path);
  const active = new Set(conditions);
  for (const [key, target] of Object.entries(map))
    if (!key.includes('*') && resolveTarget(target, active) === path) return specifier(key);
  for (const [key, target] of Object.entries(map)) {
    const resolved = resolveTarget(target, active);
    if (!key.includes('*') || typeof resolved !== 'string') continue;
    const star = resolved.indexOf('*');
    if (star === -1) continue;
    const prefix = resolved.slice(0, star);
    const suffix = resolved.slice(star + 1);
    if (path.length < prefix.length + suffix.length) continue;
    if (!path.startsWith(prefix) || !path.endsWith(suffix)) continue;
    const subpath = key.replaceAll('*', path.slice(prefix.length, path.length - suffix.length));
    // A more specific key may map the subpath elsewhere or exclude it.
    if (resolveExport(pkg, subpath, conditions) === path) return specifier(subpath);
  }
  return undefined;
}

/**
 * The import map for `packages`, in the order given: a package name seen again (another copy of
 * the same package) is skipped with a diagnostic, since one document can load one copy per
 * specifier. Subpath patterns become prefix mappings when the prefix mapping is exact.
 */
export function createImportMap(
  packages: readonly PackageManifest[],
  options: ImportMapOptions,
): { importMap: ImportMap; diagnostics: WorkbenchDiagnostic[] } {
  if (!options.base.endsWith('/'))
    throw new TypeError(`createImportMap: base "${options.base}" must end with "/".`);
  const out = new DiagnosticList();
  const conditions = new Set(options.conditions ?? DEFAULT_CONDITIONS);
  const imports: Record<string, string> = {};
  const seen = new Map<string, string | undefined>();
  for (const pkg of packages) {
    if (seen.has(pkg.name)) {
      const first = seen.get(pkg.name);
      if (first !== pkg.version) {
        out.warn(
          'data.importMap.duplicate',
          `${pkg.name} is in the module graph as ${first ?? 'an unversioned copy'} and ${pkg.version ?? 'an unversioned copy'}; the document loads ${first ?? 'the first'} only.`,
          `/${pkg.name}`,
        );
      }
      continue;
    }
    seen.set(pkg.name, pkg.version);
    const root = packageRoot(pkg, options);
    const map = subpaths(pkg, out);
    if (map === undefined) {
      const main = pkg.module ?? pkg.main;
      if (main) imports[pkg.name] = root + main.replace(/^\.\//, '');
      imports[`${pkg.name}/`] = root;
      continue;
    }
    for (const [key, target] of Object.entries(map)) {
      if (key === './package.json') continue;
      const resolved = resolveTarget(target, conditions);
      if (typeof resolved !== 'string') continue;
      if (!resolved.startsWith('./')) {
        out.warn(
          'data.importMap.target',
          `${pkg.name}: export "${key}" points at "${resolved}", which is not a relative path; skipped.`,
          `/${pkg.name}/exports/${key}`,
        );
        continue;
      }
      const star = key.indexOf('*');
      if (star === -1) {
        imports[key === '.' ? pkg.name : `${pkg.name}/${key.slice(2)}`] = root + resolved.slice(2);
        continue;
      }
      const keyPrefix = key.slice(0, star);
      const targetStar = resolved.indexOf('*');
      const targetPrefix = resolved.slice(0, targetStar);
      if (
        targetStar === -1 ||
        !keyPrefix.endsWith('/') ||
        !targetPrefix.endsWith('/') ||
        key.slice(star + 1) !== resolved.slice(targetStar + 1)
      ) {
        out.warn(
          'data.importMap.pattern',
          `${pkg.name}: export pattern "${key}" → "${resolved}" has no exact import-map prefix; skipped.`,
          `/${pkg.name}/exports/${key}`,
        );
        continue;
      }
      imports[`${pkg.name}/${keyPrefix.slice(2)}`] = root + targetPrefix.slice(2);
    }
  }
  const sorted: Record<string, string> = {};
  for (const key of Object.keys(imports).sort()) sorted[key] = imports[key] as string;
  return { importMap: { imports: sorted }, diagnostics: out.items };
}
