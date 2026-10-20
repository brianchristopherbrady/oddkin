/**
 * Read what the Workbench documents: each library package's published CEM and enrichment, the
 * token inspection its foundations reference, and authored content (`oddkin.docs.*`).
 */
import { existsSync, readFileSync } from 'node:fs';
import { extname, isAbsolute, join, relative, resolve } from 'node:path';
import { DOCS_SCHEMA, type DocsContent, type ResolvedWorkbenchConfig } from '../config/index.js';
import { resolveExport } from '../data/import-map.js';
import type { LibraryInput, TokenInspectionLike } from '../data/types.js';
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
  /** Files read as data; a change to one rebuilds the data. */
  readonly dataFiles: readonly string[];
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
    libraries.push({
      name,
      version: pkg.version,
      ...(cem ? { cem } : {}),
      ...(metadata ? { metadata } : {}),
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

  const content = await loadContent(root, config, out);
  return {
    libraries,
    graph,
    ...(content.docs ? { docs: content.docs } : {}),
    ...(tokens ? { tokens } : {}),
    dataFiles,
    contentFiles: content.files,
  };
}
