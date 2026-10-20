/**
 * Package lookup as Node does it (`node_modules` directories up the tree), and the module graph
 * a document needs: the packages it imports and, transitively, their runtime dependencies.
 */
import { existsSync, readFileSync, realpathSync } from 'node:fs';
import { dirname, join } from 'node:path';
import type { PackageManifest } from '../data/import-map.js';
import { DiagnosticList } from '../internal/diagnostics.js';

export interface PackageJson extends PackageManifest {
  readonly customElements?: string;
  readonly dependencies?: Readonly<Record<string, string>>;
  readonly peerDependencies?: Readonly<Record<string, string>>;
  readonly peerDependenciesMeta?: Readonly<Record<string, { readonly optional?: boolean }>>;
}

export interface InstalledPackage {
  /** The name importers use (the `node_modules` path it was found under). */
  readonly name: string;
  readonly version: string;
  /** Real path of the package root. */
  readonly dir: string;
  readonly manifest: PackageJson;
}

const NAME = /^(?:@[a-z0-9][\w.~-]*\/)?[a-z0-9][\w.~-]*$/i;

/** A package name that is safe to use as a path: `name` or `@scope/name`; no segment starts with a dot. */
export const isPackageName = (name: string): boolean => NAME.test(name);

/** The real directory of package `name` as seen from `from`, or undefined. */
export function findPackageDir(name: string, from: string): string | undefined {
  if (!isPackageName(name)) return undefined;
  for (let dir = from; ;) {
    const candidate = join(dir, 'node_modules', ...name.split('/'));
    if (existsSync(join(candidate, 'package.json'))) return realpathSync(candidate);
    const parent = dirname(dir);
    if (parent === dir) return undefined;
    dir = parent;
  }
}

/** Read the package at `dir`; `name` is how importers refer to it. */
export function readPackage(dir: string, name?: string): InstalledPackage {
  const manifest = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8')) as PackageJson;
  return {
    name: name ?? manifest.name ?? '',
    version: manifest.version ?? '0.0.0',
    dir: realpathSync(dir),
    manifest,
  };
}

interface Pending {
  readonly name: string;
  readonly from: string;
  readonly requiredBy?: string;
  readonly optional?: boolean;
}

/**
 * The packages reachable from `roots` (names looked up from `from`, or packages already read),
 * breadth first in manifest order: each package's `dependencies`, then its other
 * `peerDependencies`, looked up from that package's directory. A package installed twice
 * appears twice; import maps keep the first copy and say so. Names in `skip` (Node-only
 * dependencies of a browser document) are left out with their dependencies.
 */
export function packageGraph(
  roots: readonly (string | InstalledPackage)[],
  from: string,
  out: DiagnosticList,
  options: { readonly skip?: readonly string[] } = {},
): InstalledPackage[] {
  const skip = new Set(options.skip ?? []);
  const graph: InstalledPackage[] = [];
  const seen = new Set<string>();
  const queue: (Pending | InstalledPackage)[] = roots.map((root) =>
    typeof root === 'string' ? { name: root, from } : root,
  );
  const visit = (pkg: InstalledPackage) => {
    if (seen.has(pkg.dir)) return;
    seen.add(pkg.dir);
    graph.push(pkg);
    const dependencies = Object.keys(pkg.manifest.dependencies ?? {});
    const peers = Object.keys(pkg.manifest.peerDependencies ?? {}).filter(
      (peer) => !dependencies.includes(peer),
    );
    for (const name of dependencies) queue.push({ name, from: pkg.dir, requiredBy: pkg.name });
    for (const name of peers) {
      const optional = pkg.manifest.peerDependenciesMeta?.[name]?.optional === true;
      queue.push({ name, from: pkg.dir, requiredBy: pkg.name, optional });
    }
  };
  for (let next = queue.shift(); next; next = queue.shift()) {
    if ('dir' in next) {
      visit(next);
      continue;
    }
    if (skip.has(next.name)) continue;
    const dir = findPackageDir(next.name, next.from);
    if (!dir) {
      if (next.optional) continue;
      if (next.requiredBy)
        out.warn(
          'node.package.missing',
          `${next.requiredBy} depends on ${next.name}, which is not installed; modules that import it fail to load.`,
          `/packages/${next.requiredBy}/dependencies/${next.name}`,
        );
      else
        out.error(
          'node.package.missing',
          `Package "${next.name}" is not installed (looked for node_modules/${next.name} from ${next.from} upwards).`,
          `/library/packages/${next.name}`,
        );
      continue;
    }
    try {
      visit(readPackage(dir, next.name));
    } catch (error) {
      out.error(
        'node.package.unreadable',
        `${next.name}: package.json could not be read (${error instanceof Error ? error.message : String(error)}).`,
        `/packages/${next.name}`,
      );
    }
  }
  return graph;
}
