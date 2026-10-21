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
import { shellHtml } from './html.js';
import { loadInputs, type WorkbenchInputs } from './inputs.js';
import { packageGraph, readPackage, type InstalledPackage } from './packages.js';

/** This package's root (two levels above `dist/node/` and `src/node/`). */
export const WORKBENCH_DIR = fileURLToPath(new URL('../../', import.meta.url));
/** Node-only dependencies of `@oddkin/workbench`: never part of the shell's module graph. */
const NODE_ONLY = ['@oddkin/analyzer'];
/** Everything the Workbench serves besides the shell lives below `<base>_oddkin/`. */
export const ASSET_DIR = '_oddkin/';
/** The shell's own stylesheet: the default theme's tokens. */
const SHELL_STYLES = { package: '@oddkin/tokens', export: './css/default.css' };

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
/** The manifest fields import maps read, under the name importers use. */
const manifests = (graph: readonly InstalledPackage[]): PackageManifest[] =>
  graph.map((pkg) => ({ ...pkg.manifest, name: pkg.name, version: pkg.version }));

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
  const { data, diagnostics } = buildWorkbenchData({
    config,
    libraries: inputs.libraries,
    ...(inputs.docs ? { docs: inputs.docs } : {}),
    ...(inputs.tokens ? { tokens: inputs.tokens } : {}),
    diagnostics: out.items,
  });
  const result = new DiagnosticList();
  result.items.push(...diagnostics);
  if (!data) return { ...empty, config, inputs, diagnostics: result.items };

  const base = `${config.hosting.basePath}${ASSET_DIR}m/`;
  const frame = createImportMap(manifests(inputs.graph), { base, versioned: true });
  result.items.push(...frame.diagnostics);
  const self = readPackage(WORKBENCH_DIR, '@oddkin/workbench');
  const shellGraph = packageGraph([self], WORKBENCH_DIR, result, { skip: NODE_ONLY });
  const shell = createImportMap(manifests(shellGraph), { base, versioned: true });
  result.items.push(...shell.diagnostics);

  const packages = new Map<string, string>();
  for (const pkg of [...shellGraph, ...inputs.graph])
    if (!packages.has(versioned(pkg))) packages.set(versioned(pkg), pkg.dir);

  const files = new Map<string, string>([['index.json', serializeData(data.index)]]);
  for (const [id, page] of Object.entries(data.pages)) files.set(pageFile(id), serializeData(page));
  files.set('frame.importmap.json', `${JSON.stringify(frame.importMap, null, 2)}\n`);
  files.set('shell.importmap.json', `${JSON.stringify(shell.importMap, null, 2)}\n`);

  const tokens = shellGraph.find((pkg) => pkg.name === SHELL_STYLES.package);
  const stylesheet = tokens && resolveExport(tokens.manifest, SHELL_STYLES.export);
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
      stylesheets:
        tokens && stylesheet
          ? [`${packageRoot(tokens, { base, versioned: true })}${stylesheet.slice(2)}`]
          : [],
      index: `${assets}index.json`,
      ...(options.events ? { events: `${assets}events` } : {}),
      module: '@oddkin/workbench/app/define',
    }),
    diagnostics: result.items,
  };
}

/** A diagnostic as one line: `error code /path: message`. */
export function formatDiagnostic(d: WorkbenchDiagnostic): string {
  return `${d.severity} ${d.code}${d.path ? ` ${d.path}` : ''}: ${d.message}`;
}
