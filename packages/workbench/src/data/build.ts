/**
 * Build the Workbench data files from analyzer outputs, configuration, authored content, and the
 * token inspection the foundations reference (workbench.md §2.1). Pure and deterministic: the same
 * inputs give the same files, and no build time enters them.
 */
import {
  resolveWorkbenchConfig,
  type DocsContent,
  type ResolvedWorkbenchConfig,
  type WorkbenchConfig,
} from '../config/index.js';
import { DiagnosticList, isObject, type WorkbenchDiagnostic } from '../internal/diagnostics.js';
import { buildPageRegistry } from '../pages/build.js';
import { FOUNDATIONS } from '../pages/defaults.js';
import type { CemDeclaration, OddkinMetadataLike, PageEntry } from '../pages/types.js';
import {
  DATA_VERSION,
  INDEX_FORMAT,
  PAGE_FORMAT,
  type ComponentPageData,
  type FoundationPageData,
  type InspectedTokenLike,
  type JsonObject,
  type LibraryInput,
  type PageData,
  type TokenInspectionLike,
  type WorkbenchData,
  type WorkbenchIndex,
} from './types.js';

export interface WorkbenchDataInput {
  readonly config: WorkbenchConfig | ResolvedWorkbenchConfig;
  /** The documented packages, in configuration order. */
  readonly libraries: readonly LibraryInput[];
  /** Authored content (`oddkin.docs.ts`). */
  readonly docs?: DocsContent;
  /** The token inspection the foundations reference (their `generation` source). */
  readonly tokens?: TokenInspectionLike;
  /** Diagnostics from reading these inputs; reported first, with the data's own. */
  readonly diagnostics?: readonly WorkbenchDiagnostic[];
}

/** Top-level metadata fields that describe one package rather than a record of facts. */
const PER_PACKAGE = new Set(['schema', 'oddkinVersion', 'library', 'diagnostics']);

/** The data file of a page, relative to the index: `pages/components/odd-button.json`. */
export function pageFile(id: string): string {
  return `pages/${id.split('/').map(encodeURIComponent).join('/')}.json`;
}

/**
 * One metadata view over several packages. Records (components, examples, foundations, …) are
 * merged by id; the same id with different content in two packages keeps the first and is
 * diagnosed. A prefix shared by every package is kept for page titles.
 */
function mergeMetadata(
  libraries: readonly LibraryInput[],
  out: DiagnosticList,
): OddkinMetadataLike {
  const merged: Record<string, Record<string, unknown>> = {};
  const owner = new Map<string, string>();
  const prefixes = new Set<string>();
  for (const library of libraries) {
    const metadata = library.metadata as Record<string, unknown> | undefined;
    if (!metadata) continue;
    const prefix = (metadata['library'] as { prefix?: unknown } | undefined)?.prefix;
    if (typeof prefix === 'string' && prefix) prefixes.add(prefix);
    for (const [field, value] of Object.entries(metadata)) {
      if (PER_PACKAGE.has(field) || !isObject(value)) continue;
      const target = (merged[field] ??= {});
      for (const [id, entry] of Object.entries(value)) {
        if (!(id in target)) {
          target[id] = entry;
          owner.set(`${field}/${id}`, library.name);
        } else if (JSON.stringify(target[id]) !== JSON.stringify(entry)) {
          out.warn(
            'data.metadata.conflict',
            `${library.name} and ${owner.get(`${field}/${id}`)} both describe ${field} "${id}" differently; the first is used.`,
            `/${field}/${id}`,
          );
        }
      }
    }
  }
  return {
    ...merged,
    ...(prefixes.size === 1 ? { library: { prefix: [...prefixes][0] as string } } : {}),
  } as OddkinMetadataLike;
}

interface Declared {
  readonly declaration: CemDeclaration;
  readonly module: string;
  readonly package: string;
}

/** Custom-element declarations by tag; the first package that declares a tag wins, as in the registry. */
function declarations(libraries: readonly LibraryInput[]): Map<string, Declared> {
  const found = new Map<string, Declared>();
  for (const library of libraries) {
    for (const module of library.cem?.modules ?? []) {
      for (const declaration of module.declarations ?? []) {
        if (!declaration.customElement || !declaration.tagName || found.has(declaration.tagName))
          continue;
        found.set(declaration.tagName, { declaration, module: module.path, package: library.name });
      }
    }
  }
  return found;
}

const tokenName = (id: string) => id.replace(/^token:/, '');

function componentPage(
  page: PageEntry,
  declared: Declared,
  metadata: OddkinMetadataLike,
  definitions: ReadonlyMap<string, Readonly<Record<string, JsonObject>>>,
  inspection: ReadonlyMap<string, InspectedTokenLike> | undefined,
): ComponentPageData {
  const tag = declared.declaration.tagName as string;
  const enrichment = Object.values(metadata.components ?? {}).find((c) => c.tag === tag);
  const authored = definitions.get(tag) ?? {};
  const listed = Object.entries(metadata.examples ?? {}).filter(
    ([, example]) => example.component === `component:${tag}`,
  );
  const named = new Set(listed.map(([, example]) => example.name));
  const examples = [
    ...listed.map(([id, example]): JsonObject => {
      const definition = authored[example.name];
      return { id, ...example, ...(definition ? { definition } : {}) };
    }),
    // Examples the metadata does not list yet (no analyzer run since they were authored).
    ...Object.entries(authored)
      .filter(([name]) => !named.has(name))
      .map(([name, definition]): JsonObject => ({
        id: `example:${tag}/${name}`,
        component: `component:${tag}`,
        name,
        definition,
      })),
  ];
  const reads = enrichment?.tokenReads ?? [];
  const seen = new Set<string>();
  const tokens = reads.flatMap((read) => {
    const name = isObject(read) && typeof read['token'] === 'string' ? read['token'] : undefined;
    if (!name || seen.has(name)) return [];
    seen.add(name);
    return [inspection?.get(name) ?? { name, missing: true as const }];
  });
  return {
    format: PAGE_FORMAT,
    version: DATA_VERSION,
    id: page.id,
    kind: 'component',
    tag,
    package: declared.package,
    module: declared.module,
    declaration: declared.declaration as unknown as JsonObject,
    ...(enrichment ? { enrichment: enrichment as unknown as JsonObject } : {}),
    examples,
    ...(tokens.length ? { tokens } : {}),
  };
}

function foundationPage(
  page: PageEntry,
  foundation: JsonObject,
  inspection: ReadonlyMap<string, InspectedTokenLike> | undefined,
  out: DiagnosticList,
): FoundationPageData {
  const listed = Array.isArray(foundation['tokens']) ? (foundation['tokens'] as unknown[]) : [];
  const tokens = listed
    .filter((id): id is string => typeof id === 'string')
    .map((id) => {
      const name = tokenName(id);
      const token = inspection?.get(name);
      if (token) return token;
      // Without an inspection, one diagnostic covers every page (see buildWorkbenchData).
      if (inspection) {
        out.warn(
          'data.token.missing',
          `${page.id} lists token "${name}", which the token inspection does not contain; its value is shown as unknown.`,
          `/pages/${page.id}/tokens/${name}`,
        );
      }
      return { name, missing: true as const };
    });
  return {
    format: PAGE_FORMAT,
    version: DATA_VERSION,
    id: page.id,
    kind: 'foundation',
    foundation,
    tokens,
  };
}

/**
 * Build the index and the visible pages' data. `data` is undefined only when the configuration
 * is invalid; every other problem is a diagnostic and leaves the affected value unknown.
 */
export function buildWorkbenchData(input: WorkbenchDataInput): {
  data: WorkbenchData | undefined;
  diagnostics: WorkbenchDiagnostic[];
} {
  const out = new DiagnosticList();
  const loading = input.diagnostics ?? [];
  const { config, diagnostics: configDiagnostics } = resolveWorkbenchConfig(input.config);
  if (!config) return { data: undefined, diagnostics: [...loading, ...configDiagnostics] };
  const metadata = mergeMetadata(input.libraries, out);
  const { registry, diagnostics: registryDiagnostics } = buildPageRegistry({
    config,
    cem: input.libraries.flatMap((library) => (library.cem ? [library.cem] : [])),
    metadata,
    ...(input.docs ? { docs: input.docs } : {}),
  });
  // The registry resolves the same configuration again; its diagnostics include the config's.
  out.items.unshift(...loading, ...registryDiagnostics);
  if (!registry) return { data: undefined, diagnostics: out.items };

  const declared = declarations(input.libraries);
  const inspection = input.tokens
    ? new Map(input.tokens.tokens.map((token) => [token.name, token] as const))
    : undefined;
  if (!inspection && Object.keys(metadata.foundations ?? {}).length > 0) {
    out.warn(
      'data.tokens.missing',
      'Foundations reference tokens, but no token inspection was supplied; their values are shown as unknown.',
      '/foundations',
    );
  }
  const pages: Record<string, PageData> = {};
  const files: Record<string, string> = {};
  const definitions = new Map<string, Readonly<Record<string, JsonObject>>>();
  for (const library of input.libraries)
    for (const set of library.examples ?? []) {
      const tag = set.component.replace(/^component:/, '');
      if (!definitions.has(tag)) definitions.set(tag, set.examples);
    }
  for (const page of registry.pages) {
    if (!page.visible) continue;
    let data: PageData;
    if (page.kind === 'component') {
      const entry = declared.get(page.id.slice('components/'.length));
      if (!entry) continue;
      data = componentPage(page, entry, metadata, definitions, inspection);
    } else if (page.kind === 'foundation') {
      const id = FOUNDATIONS.find((f) => `foundations/${f.slug}` === page.id)?.id;
      const foundation = id ? metadata.foundations?.[`foundation:${id}`] : undefined;
      if (!foundation) continue;
      data = foundationPage(page, foundation as unknown as JsonObject, inspection, out);
    } else {
      data = { format: PAGE_FORMAT, version: DATA_VERSION, id: page.id, kind: page.kind };
    }
    pages[page.id] = data;
    files[page.id] = pageFile(page.id);
  }

  const first = input.libraries[0];
  const index: WorkbenchIndex = {
    format: INDEX_FORMAT,
    version: DATA_VERSION,
    branding: {
      name: config.branding.name ?? first?.name ?? 'Workbench',
      ...(config.branding.logo ? { logo: config.branding.logo } : {}),
      links: config.branding.links ?? [],
    },
    libraries: input.libraries.map((library) => {
      const prefix = (library.metadata?.library as { prefix?: unknown } | undefined)?.prefix;
      return {
        name: library.name,
        version: library.version,
        ...(typeof prefix === 'string' && prefix ? { prefix } : {}),
      };
    }),
    registry,
    pages: files,
    diagnostics: out.items,
  };
  return { data: { index, pages }, diagnostics: out.items };
}

/** Serialize a data file: two-space JSON with a final newline, so output is byte-stable. */
export function serializeData(value: WorkbenchIndex | PageData): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}
