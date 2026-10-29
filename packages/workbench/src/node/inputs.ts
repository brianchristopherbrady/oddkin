/**
 * Read what the Workbench documents: each library package's published CEM and enrichment, the
 * token inspection its foundations reference, and authored content (`oddkin.docs.*`).
 */
import { existsSync, readFileSync } from 'node:fs';
import { extname, isAbsolute, join, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { DOCS_SCHEMA, type DocsContent, type ResolvedWorkbenchConfig } from '../config/index.js';
import { resolveExport } from '../data/import-map.js';
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

export interface WorkbenchInputs {
  readonly libraries: readonly LibraryInput[];
  /** The documented packages and their runtime dependencies: what preview frames load. */
  readonly graph: readonly InstalledPackage[];
  readonly docs?: DocsContent;
  readonly tokens?: TokenInspectionLike;
  /** Theme Studio's baseline: `themeStudio.themeConfig` as its JSON model. */
  readonly theme?: { readonly config: JsonObject; readonly source: string };
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
      metadata = readJson(metadataFile, out, 'node.metadata.invalid') as OddkinMetadataLike;
      dataFiles.push(metadataFile);
    }
    const examples = await loadExampleSets(pkg.dir, metadata, out, dataFiles, exampleFiles);
    libraries.push({
      name,
      version: pkg.version,
      ...(cem ? { cem } : {}),
      ...(metadata ? { metadata } : {}),
      ...(examples.length ? { examples } : {}),
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

  const theme = await loadThemeConfig(root, config, graph, out, dataFiles);
  const content = await loadContent(root, config, out);
  return {
    ...(theme ? { theme } : {}),
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
 * `themeStudio.themeConfig` as the JSON-compatible model, loaded with the project's own
 * `@oddkin/tokens/node` `loadConfig()` (theming-and-styling.md ?9): the CLI and Theme Studio
 * start from the same model. JS and TS configurations are trusted project code.
 */
async function loadThemeConfig(
  root: string,
  config: ResolvedWorkbenchConfig,
  graph: readonly InstalledPackage[],
  out: DiagnosticList,
  dataFiles: string[],
): Promise<{ config: JsonObject; source: string } | undefined> {
  const source = config.themeStudio.themeConfig;
  if (!source) return undefined;
  const file = resolve(root, source);
  const path = '/themeStudio/themeConfig';
  if (!existsSync(file)) {
    out.warn('node.themeStudio.config', `themeStudio.themeConfig: ${file} does not exist.`, path);
    return undefined;
  }
  dataFiles.push(file);
  const dir =
    graph.find((pkg) => pkg.name === '@oddkin/tokens')?.dir ??
    findPackageDir('@oddkin/tokens', root);
  const entry = dir ? resolveExport(readPackage(dir).manifest, './node') : undefined;
  if (!dir || !entry) {
    out.warn(
      'node.themeStudio.loader',
      'themeStudio.themeConfig needs @oddkin/tokens (its ./node export) installed to load the configuration.',
      path,
    );
    return undefined;
  }
  try {
    const tokens = (await import(pathToFileURL(join(dir, entry)).href)) as {
      loadConfig(file: string): Promise<{
        config: unknown;
        diagnostics: readonly { severity?: string; path?: string; message?: string }[];
      }>;
    };
    const result = await tokens.loadConfig(file);
    for (const d of result.diagnostics)
      out.warn('node.themeStudio.config', `${source}${d.path ?? ''}: ${d.message ?? ''}`, path);
    if (!isObject(result.config)) return undefined;
    return { config: result.config as JsonObject, source };
  } catch (error) {
    out.warn(
      'node.themeStudio.config',
      `themeStudio.themeConfig: ${error instanceof Error ? error.message : String(error)}`,
      path,
    );
    return undefined;
  }
}
