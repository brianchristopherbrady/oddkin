/**
 * One Workbench build from a configuration: the data files, the import maps of the shell and of
 * preview frames, the packages they load, and the shell page (workbench.md §2.1). Used by
 * `workbench dev` now and by `workbench build` (M7).
 */
import { fileURLToPath } from 'node:url';
import type { ResolvedWorkbenchConfig } from '../config/index.js';
import { buildWorkbenchData, pageFile, serializeData } from '../data/build.js';
import {
  createImportMap,
  packageRoot,
  resolveExport,
  type ImportMap,
  type PackageManifest,
} from '../data/import-map.js';
import type { WorkbenchData } from '../data/types.js';
import { DiagnosticList, type WorkbenchDiagnostic } from '../internal/diagnostics.js';
import { loadWorkbenchConfig } from './config.js';
import { frameHtml, shellHtml } from './html.js';
import { loadInputs, type WorkbenchInputs } from './inputs.js';
import { packageGraph, readPackage, type InstalledPackage } from './packages.js';
import { preloadGraph } from './preload.js';

/** This package's root (two levels above `dist/node/` and `src/node/`). */
export const WORKBENCH_DIR = fileURLToPath(new URL('../../', import.meta.url));
/** Node-only dependencies of `@oddkin/workbench`: never part of the shell's module graph. */
const NODE_ONLY = ['@oddkin/analyzer'];
/** Everything the Workbench serves besides the shell lives below `<base>_oddkin/`. */
export const ASSET_DIR = '_oddkin/';
/** The shell's own stylesheet: the default theme's tokens. */
const SHELL_STYLES = { package: '@oddkin/tokens', export: './css/default.css' };
/** The shell page's arrangement classes (`.odd-cluster`, `.odd-grid`, ?; layout-recipes.md ?12). */
const SHELL_LAYOUT = { package: '@oddkin/components', export: './css/layout.css' };

export interface WorkbenchBuild {
  readonly root: string;
  readonly configFile: string | undefined;
  readonly config: ResolvedWorkbenchConfig | undefined;
  readonly data: WorkbenchData | undefined;
  readonly inputs: WorkbenchInputs | undefined;
  /** Generated files below `<base>_oddkin/` by relative path: index, page data, import maps. */
  readonly files: ReadonlyMap<string, string>;
  /** `name@version` → directory for every package the shell or a frame may load. */
  readonly packages: ReadonlyMap<string, string>;
  /** Import map of preview frames: the documented packages and their dependencies. */
  readonly frameImportMap: ImportMap | undefined;
  /** The shell page; undefined without a valid configuration. */
  readonly shell: string | undefined;
  readonly diagnostics: readonly WorkbenchDiagnostic[];
}

export interface BuildOptions {
  /** A configuration file or the directory holding it. Default: the working directory. */
  readonly config?: string;
  /** Point the shell at the live-update stream (dev server). */
  readonly events?: boolean;
}

const versioned = (pkg: InstalledPackage) => `${pkg.name}@${pkg.version}`;

/** Theme Studio's generation worker, next to the data files. */
export const THEME_WORKER = 'theme-studio.worker.js';

/**
 * Workers have no import map, so the generator is imported by URL (its graph has no bare
 * specifiers). Requests are `{ id, draft }`; replies carry plain data only (theming ?8).
 */
const themeWorker = (generator: string) => `import { generate } from ${JSON.stringify(generator)};

self.addEventListener('message', (event) => {
  const { id, draft } = event.data;
  const start = performance.now();
  try {
    const result = generate(draft);
    self.postMessage({ id, ok: result.ok, css: result.css, diagnostics: result.diagnostics, ms: performance.now() - start });
  } catch (error) {
    self.postMessage({ id, ok: false, diagnostics: [{ severity: 'error', code: 'generate.failed', path: '', message: String(error) }], ms: performance.now() - start });
  }
});
`;
/** The manifest fields import maps read, under the name importers use. */
const manifests = (graph: readonly InstalledPackage[]): PackageManifest[] =>
  graph.map((pkg) => ({ ...pkg.manifest, name: pkg.name, version: pkg.version }));

const FONT = /\.(woff2?|ttf|otf)$/i;

/**
 * Preview-frame assets (`assets` in the configuration): package export specifiers such as
 * `@oddkin/tokens/css/default.css`, resolved through the package's `exports` to its versioned
 * URL. Stylesheets are linked and fonts preloaded. Without configured assets, frames load the
 * default token stylesheet when the frame graph has it.
 */
function frameAssets(
  config: ResolvedWorkbenchConfig,
  graph: readonly InstalledPackage[],
  documented: readonly InstalledPackage[],
  base: string,
  out: DiagnosticList,
): { stylesheets: string[]; fonts: string[] } {
  const stylesheets: string[] = [];
  const fonts: string[] = [];
  const specifiers = config.assets.length
    ? config.assets
    : documented.some((pkg) => pkg.name === SHELL_STYLES.package)
      ? [`${SHELL_STYLES.package}${SHELL_STYLES.export.slice(1)}`]
      : [];
  config.assets.forEach((specifier, i) => {
    if (/^(\.{0,2}\/|[a-z]+:)/i.test(specifier))
      out.warn(
        'node.assets.unsupported',
        `Asset "${specifier}" is a path or URL; frames load package export specifiers (for example "@scope/pkg/theme.css") for now.`,
        `/assets/${i}`,
      );
  });
  for (const specifier of specifiers) {
    if (/^(\.{0,2}\/|[a-z]+:)/i.test(specifier)) continue;
    const parts = specifier.split('/');
    const name = specifier.startsWith('@') ? parts.slice(0, 2).join('/') : (parts[0] as string);
    const subpath = `.${specifier.slice(name.length)}`;
    const pkg = graph.find((p) => p.name === name);
    const path = pkg ? resolveExport(pkg.manifest, subpath) : undefined;
    const index = config.assets.indexOf(specifier);
    if (!pkg || !path) {
      out.warn(
        'node.assets.unresolved',
        `Asset "${specifier}" does not resolve: ${pkg ? `${name} does not export "${subpath}"` : `${name} is not a documented package or one of their dependencies`}.`,
        index >= 0 ? `/assets/${index}` : '/assets',
      );
      continue;
    }
    const url = `${packageRoot({ ...pkg.manifest, name: pkg.name, version: pkg.version }, { base, versioned: true })}${path.slice(2)}`;
    if (FONT.test(path)) fonts.push(url);
    else if (/\.css$/i.test(path)) stylesheets.push(url);
    else
      out.warn(
        'node.assets.kind',
        `Asset "${specifier}" is neither a stylesheet nor a font; frames load only those.`,
        index >= 0 ? `/assets/${index}` : '/assets',
      );
  }
  return { stylesheets, fonts };
}

/** Build everything the Workbench serves or writes for one configuration. Never throws for bad input. */
export async function buildWorkbench(options: BuildOptions = {}): Promise<WorkbenchBuild> {
  const loaded = await loadWorkbenchConfig(options.config);
  const empty = {
    root: loaded.root,
    configFile: loaded.file,
    data: undefined,
    inputs: undefined,
    files: new Map<string, string>(),
    packages: new Map<string, string>(),
    frameImportMap: undefined,
    shell: undefined,
  };
  const config = loaded.config;
  if (!config) return { ...empty, config, diagnostics: loaded.diagnostics };

  const out = new DiagnosticList();
  const inputs = await loadInputs(loaded.root, config, out);
  const base = `${config.hosting.basePath}${ASSET_DIR}m/`;
  const self = readPackage(WORKBENCH_DIR, '@oddkin/workbench');
  const graphs = new DiagnosticList();
  const shellGraph = packageGraph([self], WORKBENCH_DIR, graphs, { skip: NODE_ONLY });
  const shell = createImportMap(manifests(shellGraph), { base, versioned: true });
  const frame = createImportMap(manifests([...inputs.graph, ...shellGraph]), {
    base,
    versioned: true,
  });
  // Theme Studio generates with the documented library's own generator, in a Worker.
  const generator = frame.importMap.imports['@oddkin/tokens/generate'];
  const worker = generator ? `${config.hosting.basePath}${ASSET_DIR}${THEME_WORKER}` : undefined;
  const { data, diagnostics } = buildWorkbenchData({
    config,
    libraries: inputs.libraries,
    ...(inputs.docs ? { docs: inputs.docs } : {}),
    ...(inputs.tokens ? { tokens: inputs.tokens } : {}),
    theme: { ...inputs.theme, ...(worker ? { worker } : {}) },
    diagnostics: out.items,
  });
  const result = new DiagnosticList();
  result.items.push(...diagnostics, ...graphs.items, ...shell.diagnostics, ...frame.diagnostics);
  if (!data) return { ...empty, config, inputs, diagnostics: result.items };

  const packages = new Map<string, string>();
  for (const pkg of [...shellGraph, ...inputs.graph])
    if (!packages.has(versioned(pkg))) packages.set(versioned(pkg), pkg.dir);

  const roots = new Map([...packages].map(([name, dir]) => [`${base}${name}/`, dir]));
  const files = new Map<string, string>([['index.json', serializeData(data.index)]]);
  for (const [id, page] of Object.entries(data.pages)) files.set(pageFile(id), serializeData(page));
  if (generator) files.set(THEME_WORKER, themeWorker(generator));
  files.set('frame.importmap.json', `${JSON.stringify(frame.importMap, null, 2)}\n`);
  files.set('shell.importmap.json', `${JSON.stringify(shell.importMap, null, 2)}\n`);
  const assetsForFrames = frameAssets(
    config,
    [...inputs.graph, ...shellGraph],
    inputs.graph,
    base,
    result,
  );
  files.set(
    'frame.html',
    frameHtml({
      title: `${data.index.branding.name} preview`,
      importMap: frame.importMap,
      module: '@oddkin/workbench/frame',
      preload: preloadGraph(frame.importMap, '@oddkin/workbench/frame', roots),
      ...assetsForFrames,
    }),
  );

  const shellStylesheets = [SHELL_STYLES, SHELL_LAYOUT].flatMap(
    ({ package: name, export: path }) => {
      const pkg = shellGraph.find((entry) => entry.name === name);
      const file = pkg && resolveExport(pkg.manifest, path);
      return pkg && file ? [`${packageRoot(pkg, { base, versioned: true })}${file.slice(2)}`] : [];
    },
  );
  const assets = `${config.hosting.basePath}${ASSET_DIR}`;
  return {
    root: loaded.root,
    configFile: loaded.file,
    config,
    data,
    inputs,
    files,
    packages,
    frameImportMap: frame.importMap,
    shell: shellHtml({
      title: data.index.branding.name,
      ...(config.content.defaultLocale ? { lang: config.content.defaultLocale } : {}),
      importMap: shell.importMap,
      stylesheets: shellStylesheets,
      index: `${assets}index.json`,
      ...(options.events ? { events: `${assets}events` } : {}),
      module: '@oddkin/workbench/app/define',
      preload: preloadGraph(shell.importMap, '@oddkin/workbench/app/define', roots),
    }),
    diagnostics: result.items,
  };
}

/** A diagnostic as one line: `error code /path: message`. */
export function formatDiagnostic(d: WorkbenchDiagnostic): string {
  return `${d.severity} ${d.code}${d.path ? ` ${d.path}` : ''}: ${d.message}`;
}
