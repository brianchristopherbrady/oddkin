/**
 * `oddkin workbench build`: the dev server's URL layout written as files for a static host
 * (workbench.md §2.1, §10). The output directory maps to `hosting.basePath`: the shell at its
 * root, data and the frame document under `_oddkin/`, and each package's published browser files
 * under `_oddkin/m/<name>@<version>/`, copied as published. In history mode every page path, and
 * every legacy path, gets a copy of the shell, so deep links and refreshes load on any static
 * host; `404.html` is the shell too, for hosts that serve it for unknown paths. Legacy paths
 * redirect in the app, which keeps their query (`/playground?component=…`). Hash mode writes
 * the shell once. No Node or analyzer backend is needed to serve the result.
 */
import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import type { Routing } from '../config/index.js';
import { DiagnosticList, type WorkbenchDiagnostic } from '../internal/diagnostics.js';
import { writeGenerated, type GeneratedContent } from './generated.js';
import { readPackage } from './packages.js';
import { ASSET_DIR, buildWorkbench, type WorkbenchBuild } from './workbench.js';

export interface StaticBuildOptions {
  /** A configuration file or the directory holding it. Default: the working directory. */
  readonly config?: string;
  /** Output directory. Default: `.oddkin/workbench-build` in the project. */
  readonly out?: string;
  /** Replaces the configuration's `hosting` values for this build. */
  readonly hosting?: { readonly basePath?: string; readonly routing?: Routing };
}

export interface StaticBuild {
  readonly build: WorkbenchBuild;
  /** The output directory; undefined when nothing was written. */
  readonly out: string | undefined;
  /** Relative paths of every file in the output, sorted. */
  readonly files: readonly string[];
  readonly written: readonly string[];
  readonly removed: readonly string[];
  readonly diagnostics: readonly WorkbenchDiagnostic[];
}

/**
 * Package files a browser loads. Type declarations, sources, and documents stay behind, and so
 * do source maps: only developer tools read them, and they name sources packages do not publish.
 */
const BROWSER_FILE = /\.(m?js|css|json|svg|png|jpe?g|gif|webp|avif|ico|woff2?|ttf|otf)$/i;
const GLOB = /[*?[\]{}!]/;

/** Regular files below `dir` as sorted POSIX paths; links, `node_modules`, and dot entries skipped. */
async function walk(dir: string, prefix = ''): Promise<string[]> {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  const files: string[] = [];
  for (const entry of entries.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))) {
    if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) files.push(...(await walk(join(dir, entry.name), rel)));
    else if (entry.isFile()) files.push(rel);
  }
  return files;
}

/**
 * A package's published browser files: what its `files` field names (as npm packs it), or, for
 * a package installed without one, everything in it.
 */
async function publishedFiles(
  dir: string,
  manifest: object,
  name: string,
  out: DiagnosticList,
): Promise<string[]> {
  const field = (manifest as { readonly files?: unknown }).files;
  const listed = Array.isArray(field)
    ? field.filter((f): f is string => typeof f === 'string')
    : undefined;
  let files: string[];
  if (!listed || listed.some((entry) => GLOB.test(entry))) {
    if (listed)
      out.warn(
        'node.build.filesPattern',
        `${name}: "files" uses patterns; every file in the package is considered.`,
        `/packages/${name}/files`,
      );
    files = await walk(dir);
  } else {
    const all = await walk(dir);
    const roots = listed.map((entry) => entry.replace(/^\.\//, '').replace(/\/+$/, ''));
    files = all.filter(
      (file) =>
        file === 'package.json' ||
        roots.some((root) => file === root || file.startsWith(`${root}/`)),
    );
  }
  return files.filter((file) => BROWSER_FILE.test(file));
}

/** Every path the shell's router answers in history mode (app/routes.ts `shellRoutes`). */
export function shellPaths(build: WorkbenchBuild): string[] {
  const registry = build.data?.index.registry;
  if (!registry) return [];
  const paths = new Set<string>();
  for (const page of registry.pages) {
    if (!page.visible) continue;
    paths.add(page.route);
    for (const legacy of page.legacyRoutes ?? []) paths.add(legacy);
  }
  if (!registry.pages.some((p) => p.id === 'products' && p.visible))
    paths.add('/foundations/products');
  return [...paths]
    .map((path) => path.split('/').filter(Boolean).join('/'))
    .filter(Boolean)
    .sort();
}

/**
 * Build the Workbench and write it as a static app. Writes nothing when the configuration or
 * metadata has errors. The output directory carries the generated-directory marker, so a later
 * build replaces it and an unmarked directory is refused (`GeneratedDirectoryError`).
 */
export async function buildStatic(options: StaticBuildOptions = {}): Promise<StaticBuild> {
  const build = await buildWorkbench({
    ...(options.config ? { config: options.config } : {}),
    ...(options.hosting ? { hosting: options.hosting } : {}),
  });
  const out = new DiagnosticList();
  out.items.push(...build.diagnostics);
  const nothing = { build, out: undefined, files: [], written: [], removed: [] };
  if (!build.config || !build.data || !build.shell || out.items.some((d) => d.severity === 'error'))
    return { ...nothing, diagnostics: out.items };

  const base = build.config.hosting.basePath;
  const files = new Map<string, GeneratedContent>();
  files.set('index.html', build.shell);
  if (build.config.hosting.routing === 'history') {
    for (const path of shellPaths(build)) files.set(`${path}/index.html`, build.shell);
    files.set('404.html', build.shell);
  }
  for (const [path, content] of build.files) files.set(`${ASSET_DIR}${path}`, content);

  const packages = [...build.packages].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  for (const [versioned, dir] of packages) {
    const name = versioned.slice(0, versioned.lastIndexOf('@'));
    for (const file of await publishedFiles(dir, readPackage(dir).manifest, name, out))
      files.set(`${ASSET_DIR}m/${versioned}/${file}`, { source: join(dir, ...file.split('/')) });
  }

  // Every browser file each document's import map names is in the output.
  const prefix = `${base}${ASSET_DIR}`;
  for (const name of ['shell.importmap.json', 'frame.importmap.json']) {
    const map = JSON.parse(build.files.get(name) ?? '{"imports":{}}') as {
      imports: Record<string, string>;
    };
    for (const [specifier, url] of Object.entries(map.imports)) {
      if (!url.startsWith(prefix) || !BROWSER_FILE.test(url)) continue;
      if (!files.has(url.slice(base.length)))
        out.warn(
          'node.build.unpublished',
          `"${specifier}" maps to ${url}, which is not among its package's published files; importing it fails.`,
          `/${name}/imports/${specifier}`,
        );
    }
  }

  const target = options.out ?? join(build.root, '.oddkin', 'workbench-build');
  const sorted = new Map([...files].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
  const { written, removed } = await writeGenerated(target, sorted);
  return {
    build,
    out: target,
    files: [...sorted.keys()],
    written,
    removed,
    diagnostics: out.items,
  };
}
