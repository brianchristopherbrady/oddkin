/**
 * Read what the Workbench documents: each library package's published CEM and enrichment, the
 * token inspection its foundations reference, and authored content (`oddkin.docs.*`).
 */
import { existsSync, readFileSync } from 'node:fs';
import { extname, isAbsolute, join, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { compositionCatalog } from '@oddkin/analyzer/composition';
import { checkMetadata } from '@oddkin/analyzer/metadata';
import { DOCS_SCHEMA, type DocsContent, type ResolvedWorkbenchConfig } from '../config/index.js';
import { exportedSpecifier, resolveExport, type PackageManifest } from '../data/import-map.js';
import type {
  ExampleSetLike,
  JsonObject,
  LibraryInput,
  TokenInspectionLike,
} from '../data/types.js';
import { toExamplesJSON, type ExampleSet } from '../examples/index.js';
import { DiagnosticList, isObject } from '../internal/diagnostics.js';
import type { CemPackage, OddkinMetadataLike } from '../pages/types.js';
import { loadDefault, loadFailure } from './config.js';
import { findPackageDir, packageGraph, readPackage, type InstalledPackage } from './packages.js';

export const DOCS_FILES = [
  'oddkin.docs.ts',
  'oddkin.docs.mts',
  'oddkin.docs.js',
  'oddkin.docs.mjs',
  'oddkin.docs.json',
] as const;

/** A configured theme, loaded. */
export interface ThemeInput {
  /** Its name in `themeStudio.themes`; none for `themeStudio.themeConfig`. */
  readonly name?: string;
  /** The merged model: the file on its bases. */
  readonly config: JsonObject;
  /** As the configuration writes it. */
  readonly source: string;
  /** The theme file's absolute path. */
  readonly file: string;
  /**
   * Its files from the root base to the theme file (P1.1 `extends`), each with its absolute path
   * and its own model as written; one when it extends no base.
   */
  readonly layers: readonly { readonly file: string; readonly config: JsonObject }[];
}

export interface WorkbenchInputs {
  readonly libraries: readonly LibraryInput[];
  /** The documented packages and their runtime dependencies: what preview frames load. */
  readonly graph: readonly InstalledPackage[];
  readonly docs?: DocsContent;
  readonly tokens?: TokenInspectionLike;
  /** Theme Studio's baseline: the first configured theme (`themes[0]`). */
  readonly theme?: ThemeInput;
  /** Every configured theme: `themeStudio.themeConfig` first, then `themeStudio.themes`. */
  readonly themes?: readonly ThemeInput[];
  /** Files read as data; a change to one rebuilds the data. */
  readonly dataFiles: readonly string[];
  /** Each loaded example set's source file, by component tag. */
  readonly exampleFiles: ReadonlyMap<string, string>;
  /** Authored content files that were read or attempted (watched with the configuration). */
  readonly contentFiles: readonly string[];
}

const inside = (file: string, dir: string) => {
  const rel = relative(dir, file);
  return rel !== '' && !rel.startsWith('..') && !isAbsolute(rel);
};

function readJson(file: string, out: DiagnosticList, code: string): unknown {
  try {
    return JSON.parse(readFileSync(file, 'utf8')) as unknown;
  } catch (error) {
    out.error(code, `${file}: ${error instanceof Error ? error.message : String(error)}`);
    return undefined;
  }
}

interface InspectionSource {
  readonly package: string;
  readonly export: string;
}

/** The token inspections the libraries' foundations reference, in order. */
function inspectionSources(libraries: readonly LibraryInput[]): InspectionSource[] {
  const found = new Map<string, InspectionSource>();
  for (const library of libraries) {
    for (const foundation of Object.values(library.metadata?.foundations ?? {})) {
      const generation = (foundation as { generation?: { value?: { source?: unknown } } })
        .generation;
      const source = generation?.value?.source;
      if (!isObject(source)) continue;
      const { package: name, export: subpath } = source;
      if (typeof name === 'string' && typeof subpath === 'string')
        found.set(`${name}#${subpath}`, { package: name, export: subpath });
    }
  }
  return [...found.values()];
}

async function loadContent(
  root: string,
  config: ResolvedWorkbenchConfig,
  out: DiagnosticList,
): Promise<{ docs?: DocsContent; files: string[] }> {
  const files = config.content.files
    ? config.content.files.map((file) => resolve(root, file))
    : DOCS_FILES.map((name) => join(root, name))
        .filter((file) => existsSync(file))
        .slice(0, 1);
  const pages: Record<string, DocsContent['pages'][string]> = {};
  const aliases: Record<string, string> = {};
  let locale: string | undefined;
  const loaded: string[] = [];
  for (const file of files) {
    if (!existsSync(file)) {
      out.error('node.content.missing', `Content file ${file} does not exist.`, '/content/files');
      continue;
    }
    if (extname(file) === '.md') {
      out.warn(
        'node.content.unsupported',
        `${file}: Markdown content is not read yet; use oddkin.docs.ts or JSON.`,
        '/content/files',
      );
      continue;
    }
    let value: unknown;
    try {
      value = await loadDefault(file);
    } catch (error) {
      out.error('node.content.load', loadFailure(file, error), '/content/files');
      continue;
    }
    if (!isObject(value) || !isObject(value['pages'])) {
      out.error(
        'node.content.invalid',
        `${file}: authored content must be an object with "pages" (use defineDocs).`,
        '/content/files',
      );
      continue;
    }
    loaded.push(file);
    const content = value as unknown as DocsContent;
    for (const [id, page] of Object.entries(content.pages)) {
      if (id in pages)
        out.warn(
          'node.content.duplicate',
          `${file} describes page "${id}" again; the first file's content is kept.`,
          `/pages/${id}`,
        );
      else pages[id] = page;
    }
    for (const [from, to] of Object.entries(content.aliases ?? {})) aliases[from] ??= to;
    locale ??= content.locale;
  }
  if (loaded.length === 0) return { files };
  return {
    docs: {
      schema: DOCS_SCHEMA,
      ...(locale ? { locale } : {}),
      ...(Object.keys(aliases).length ? { aliases } : {}),
      pages,
    },
    files,
  };
}

/**
 * The example sets (`defineExamples` modules) the metadata names, as data. Example modules are
 * trusted project code; a package that does not ship them (a published build without sources)
 * keeps its examples listed without values.
 */
async function loadExampleSets(
  dir: string,
  metadata: OddkinMetadataLike | undefined,
  out: DiagnosticList,
  dataFiles: string[],
  exampleFiles: Map<string, string>,
): Promise<ExampleSetLike[]> {
  const files = new Set<string>();
  for (const example of Object.values(metadata?.examples ?? {})) {
    const file = (example as { file?: unknown }).file;
    if (typeof file === 'string' && file) files.add(file);
  }
  const sets: ExampleSetLike[] = [];
  for (const file of files) {
    const path = resolve(dir, file);
    if (!inside(path, dir) || !existsSync(path)) continue;
    dataFiles.push(path);
    let value: unknown;
    try {
      value = await loadDefault(path);
    } catch (error) {
      out.warn('node.examples.load', loadFailure(path, error), '/examples');
      continue;
    }
    if (
      !isObject(value) ||
      typeof value['component'] !== 'string' ||
      !isObject(value['examples'])
    ) {
      out.warn(
        'node.examples.invalid',
        `${path}: the default export is not an example set (use defineExamples).`,
        '/examples',
      );
      continue;
    }
    sets.push(toExamplesJSON(value as unknown as ExampleSet) as unknown as ExampleSetLike);
    exampleFiles.set(value['component'], path);
  }
  return sets;
}

/**
 * Each element's registering module from the standard CEM: the module whose exports hold its
 * `custom-element-definition`, as an import specifier through the package's `exports`. When no
 * export reaches that module, the shortest export of a module that re-exports from it (an ES
 * re-export loads the module). A module that nothing reaches is left out, since no consumer could
 * import it either. The agent kits resolve registrations the same way (`@oddkin/analyzer/kit`).
 */
function cemRegistrations(
  manifest: PackageManifest,
  cem: CemPackage | undefined,
): Record<string, string> {
  const found: Record<string, string> = {};
  const modules = cem?.modules ?? [];
  const clean = (path: string) => path.replace(/^\.?\/+/, '');
  for (const module of modules)
    for (const entry of module.exports ?? []) {
      if (entry.kind !== 'custom-element-definition' || !entry.name || found[entry.name]) continue;
      const specifier =
        exportedSpecifier(manifest, module.path) ??
        modules
          .filter(
            (other) =>
              clean(other.path) !== clean(module.path) &&
              (other.exports ?? []).some(
                (e) =>
                  typeof e.declaration?.module === 'string' &&
                  clean(e.declaration.module) === clean(module.path),
              ),
          )
          .map((other) => exportedSpecifier(manifest, other.path))
          .filter((s): s is string => Boolean(s))
          .sort((a, b) => a.length - b.length || (a < b ? -1 : 1))[0];
      if (specifier) found[entry.name] = specifier;
    }
  return found;
}

/** Read every input of the Workbench data for the configuration at `root`. */
export async function loadInputs(
  root: string,
  config: ResolvedWorkbenchConfig,
  out: DiagnosticList,
): Promise<WorkbenchInputs> {
  const graph = packageGraph(config.library.packages, root, out);
  const byName = new Map<string, InstalledPackage>();
  for (const pkg of graph) if (!byName.has(pkg.name)) byName.set(pkg.name, pkg);
  const explicitCem = (config.library.cem ?? []).map((file) => resolve(root, file));
  const dataFiles: string[] = [];
  const exampleFiles = new Map<string, string>();
  const libraries: LibraryInput[] = [];
  for (const name of config.library.packages) {
    const pkg = byName.get(name);
    if (!pkg) continue;
    const declared = pkg.manifest.customElements;
    const cemFile = declared
      ? join(pkg.dir, declared)
      : explicitCem.find((file) => inside(file, pkg.dir));
    let cem: CemPackage | undefined;
    if (cemFile && existsSync(cemFile)) {
      cem = readJson(cemFile, out, 'node.cem.invalid') as CemPackage | undefined;
      dataFiles.push(cemFile);
    } else {
      out.warn(
        'node.cem.missing',
        cemFile
          ? `${name}: its Custom Elements Manifest ${cemFile} does not exist; build the package first.`
          : `${name} declares no Custom Elements Manifest; add "customElements" to its package.json or list the file in library.cem.`,
        `/library/packages/${name}`,
      );
    }
    const metadataPath = resolveExport(pkg.manifest, './oddkin.metadata.json');
    const metadataFile = metadataPath ? join(pkg.dir, metadataPath) : undefined;
    let metadata: OddkinMetadataLike | undefined;
    if (metadataFile && existsSync(metadataFile)) {
      const read = readJson(metadataFile, out, 'node.metadata.invalid');
      dataFiles.push(metadataFile);
      // The manifest says which elements exist; stale or unknown metadata is reported, not read.
      if (read !== undefined) {
        const checked = checkMetadata(
          isObject(read) ? read : {},
          cem,
          `${name}/${(metadataPath as string).replace(/^\.\//, '')}`,
        );
        for (const d of checked.diagnostics)
          out[d.severity === 'error' ? 'error' : 'warn'](
            d.code,
            d.message,
            `/library/packages/${name}`,
          );
        metadata = checked.metadata as OddkinMetadataLike | undefined;
      }
    }
    const examples = await loadExampleSets(pkg.dir, metadata, out, dataFiles, exampleFiles);
    // Importers use the name the package is installed under.
    const registrations = cemRegistrations({ ...(pkg.manifest as PackageManifest), name }, cem);
    const renderer = resolveExport(pkg.manifest, './composition');
    const own = renderer !== undefined && existsSync(join(pkg.dir, renderer));
    // Without a renderer of its own, @oddkin/components' renders the catalog generated from the
    // package's manifest (P1.6), as `oddkin-analyze --composition` writes it.
    const catalog = !own && cem ? compositionCatalog(cem).catalog : {};
    libraries.push({
      name,
      version: pkg.version,
      ...(cem ? { cem } : {}),
      ...(metadata ? { metadata } : {}),
      ...(examples.length ? { examples } : {}),
      ...(Object.keys(registrations).length ? { registrations } : {}),
      ...(own
        ? { composition: `${name}/composition` }
        : Object.keys(catalog).length
          ? {
              composition: '@oddkin/components/composition',
              catalog: catalog as unknown as JsonObject,
            }
          : {}),
    });
  }
  for (const file of explicitCem) {
    if (!graph.some((pkg) => inside(file, pkg.dir)))
      out.warn(
        'node.cem.unattributed',
        `library.cem lists ${file}, which is not inside any documented package; it is ignored.`,
        '/library/cem',
      );
  }

  let tokens: TokenInspectionLike | undefined;
  const sources = inspectionSources(libraries);
  if (sources.length > 1) {
    out.warn(
      'node.tokens.sources',
      `Foundations reference ${sources.length} token inspections; ${sources[0]?.package}${(sources[0]?.export ?? '').slice(1)} is used.`,
      '/foundations',
    );
  }
  const source = sources[0];
  if (source) {
    const dir = byName.get(source.package)?.dir ?? findPackageDir(source.package, root);
    const path = dir ? resolveExport(readPackage(dir).manifest, source.export) : undefined;
    const file = dir && path ? join(dir, path) : undefined;
    if (file && existsSync(file)) {
      const value = readJson(file, out, 'node.tokens.invalid');
      if (isObject(value) && Array.isArray(value['tokens']))
        tokens = value as unknown as TokenInspectionLike;
      dataFiles.push(file);
    } else {
      out.warn(
        'node.tokens.missing',
        `The token inspection ${source.package}${source.export.slice(1)} that the foundations reference was not found.`,
        '/foundations',
      );
    }
  }

  const themes = await loadThemes(root, config, graph, out, dataFiles);
  const content = await loadContent(root, config, out);
  return {
    ...(themes[0] ? { theme: themes[0], themes } : {}),
    libraries,
    graph,
    ...(content.docs ? { docs: content.docs } : {}),
    ...(tokens ? { tokens } : {}),
    dataFiles,
    exampleFiles,
    contentFiles: content.files,
  };
}

/**
 * Each configured theme as its JSON-compatible model, `themeStudio.themeConfig` first, then
 * `themeStudio.themes` by name, loaded with the project's own `@oddkin/tokens/node`
 * `loadConfig()` (theming-and-styling.md §9): the CLI and Theme Studio start from the same model.
 * JS and TS configurations are trusted project code.
 */
async function loadThemes(
  root: string,
  config: ResolvedWorkbenchConfig,
  graph: readonly InstalledPackage[],
  out: DiagnosticList,
  dataFiles: string[],
): Promise<ThemeInput[]> {
  const { themeConfig, themes } = config.themeStudio;
  const sources: { readonly name?: string; readonly source: string; readonly key: string }[] = [
    ...(themeConfig ? [{ source: themeConfig, key: 'themeConfig' }] : []),
    ...Object.entries(themes).map(([name, source]) => ({ name, source, key: `themes/${name}` })),
  ];
  if (!sources.length) return [];
  const dir =
    graph.find((pkg) => pkg.name === '@oddkin/tokens')?.dir ??
    findPackageDir('@oddkin/tokens', root);
  const entry = dir ? resolveExport(readPackage(dir).manifest, './node') : undefined;
  const loaded: ThemeInput[] = [];
  for (const { source, key, ...named } of sources) {
    const file = resolve(root, source);
    const path = `/themeStudio/${key}`;
    const label = `themeStudio.${key.replace('/', '.')}`;
    if (!existsSync(file)) {
      out.warn('node.themeStudio.config', `${label}: ${file} does not exist.`, path);
      continue;
    }
    if (!dataFiles.includes(file)) dataFiles.push(file);
    if (!dir || !entry) {
      out.warn(
        'node.themeStudio.loader',
        `${label} needs @oddkin/tokens (its ./node export) installed to load the configuration.`,
        path,
      );
      continue;
    }
    try {
      const tokens = (await import(pathToFileURL(join(dir, entry)).href)) as {
        loadConfig(file: string): Promise<{
          config: unknown;
          diagnostics: readonly { severity?: string; path?: string; message?: string }[];
          layers?: readonly { file: string; config: unknown }[];
        }>;
      };
      const result = await tokens.loadConfig(file);
      for (const d of result.diagnostics)
        out.warn('node.themeStudio.config', `${source}${d.path ?? ''}: ${d.message ?? ''}`, path);
      if (!isObject(result.config)) continue;
      // A loader without layers (before P1.1's `extends`) read the file alone.
      const layers = (result.layers ?? [{ file, config: result.config }]).map((layer) => ({
        file: layer.file,
        config: (isObject(layer.config) ? layer.config : {}) as JsonObject,
      }));
      for (const layer of layers) if (!dataFiles.includes(layer.file)) dataFiles.push(layer.file);
      loaded.push({ ...named, config: result.config as JsonObject, source, file, layers });
    } catch (error) {
      out.warn(
        'node.themeStudio.config',
        `${label}: ${error instanceof Error ? error.message : String(error)}`,
        path,
      );
    }
  }
  return loaded;
}
