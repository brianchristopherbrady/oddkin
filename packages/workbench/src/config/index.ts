/**
 * `@mote/workbench/config` — `defineWorkbenchConfig` and `defineDocs` with types matching the
 * `workbench-config.v1` and `docs-content.v1` schemas, plus default resolution and validation.
 * DOM-free. Values here describe presentation; generated facts always come from metadata
 * and token inspection (ADR 0024).
 */
import { DiagnosticList, isObject, type WorkbenchDiagnostic } from '../internal/diagnostics.js';

export type { WorkbenchDiagnostic } from '../internal/diagnostics.js';

export type Routing = 'history' | 'hash';
export type ProductPlacement = 'foundations' | 'primary';

export type ProductSource =
  | { readonly theme: string; readonly product: string }
  | { readonly package: string; readonly export?: string }
  | { readonly manifest: string; readonly version: string };

export interface WorkbenchConfig {
  readonly $schema?: string;
  readonly library: { readonly packages: readonly string[]; readonly cem?: readonly string[] };
  readonly branding?: {
    readonly name?: string;
    readonly logo?: string;
    readonly theme?: string;
    readonly links?: readonly { readonly label: string; readonly href: string }[];
  };
  readonly hosting?: { readonly basePath?: string; readonly routing?: Routing };
  readonly navigation?: {
    readonly home?: boolean;
    /** Ordered section ids; defaults to foundations, components, theme-studio. */
    readonly primary?: readonly string[];
    readonly legacyRedirects?: boolean;
  };
  readonly categories?: {
    readonly definitions?: readonly {
      readonly id: string;
      readonly label: string;
      readonly description?: string;
      readonly order?: number;
    }[];
    /** tag → category id overrides. */
    readonly assign?: Readonly<Record<string, string>>;
    readonly fallback?: string;
  };
  readonly themeStudio?: {
    readonly enabled?: boolean;
    readonly route?: string;
    readonly themeConfig?: string;
    readonly preview?: {
      readonly recipe?: string;
      readonly roles?: Readonly<
        Record<
          string,
          | string
          | { readonly component: string; readonly example?: string; readonly adapter?: string }
        >
      >;
    };
  };
  readonly products?: {
    readonly enabled?: boolean;
    readonly placement?: readonly ProductPlacement[];
    readonly sources?: readonly { readonly id: string; readonly from: ProductSource }[];
    readonly discovery?: { readonly workspace?: boolean; readonly exclude?: readonly string[] };
  };
  readonly content?: {
    readonly files?: readonly string[];
    readonly locales?: readonly string[];
    readonly defaultLocale?: string;
  };
  readonly assets?: readonly string[];
}

/** A configuration with every default applied. */
export interface ResolvedWorkbenchConfig {
  readonly library: WorkbenchConfig['library'];
  readonly branding: NonNullable<WorkbenchConfig['branding']>;
  readonly hosting: { readonly basePath: string; readonly routing: Routing };
  readonly navigation: {
    readonly home: boolean;
    readonly primary: readonly string[];
    readonly legacyRedirects: boolean;
  };
  readonly categories: {
    readonly definitions: NonNullable<NonNullable<WorkbenchConfig['categories']>['definitions']>;
    readonly assign: Readonly<Record<string, string>>;
    readonly fallback: string;
  };
  readonly themeStudio: {
    readonly enabled: boolean;
    readonly route: string;
    readonly themeConfig?: string;
    readonly preview: NonNullable<NonNullable<WorkbenchConfig['themeStudio']>['preview']>;
  };
  readonly products: {
    readonly enabled: boolean;
    readonly placement: readonly ProductPlacement[];
    readonly sources: NonNullable<NonNullable<WorkbenchConfig['products']>['sources']>;
    readonly discovery: { readonly workspace: boolean; readonly exclude: readonly string[] };
  };
  readonly content: NonNullable<WorkbenchConfig['content']>;
  readonly assets: readonly string[];
}

/** Identity with types, for `mote.config.ts`. */
export function defineWorkbenchConfig(config: WorkbenchConfig): WorkbenchConfig {
  return config;
}

export const DEFAULT_PRIMARY = ['foundations', 'components', 'theme-studio'] as const;
export const KNOWN_SECTIONS = [
  'home',
  'foundations',
  'components',
  'theme-studio',
  'products',
  'guides',
];
const TOP_LEVEL = new Set([
  '$schema',
  'library',
  'branding',
  'hosting',
  'navigation',
  'categories',
  'themeStudio',
  'products',
  'content',
  'assets',
]);
const BASE_PATH = /^\/(.*\/)?$/;

/**
 * Validate a configuration (from `mote.config.*` or JSON) and apply defaults. Returns
 * `config: undefined` when there are errors.
 */
export function resolveWorkbenchConfig(input: unknown): {
  config: ResolvedWorkbenchConfig | undefined;
  diagnostics: WorkbenchDiagnostic[];
} {
  const out = new DiagnosticList();
  if (!isObject(input)) {
    out.error('config.invalid', 'The Workbench configuration must be an object.');
    return { config: undefined, diagnostics: out.items };
  }
  for (const key of Object.keys(input)) {
    if (TOP_LEVEL.has(key)) continue;
    out.error(
      'config.key.unknown',
      key === 'playground'
        ? 'There is no Playground destination: interactive examples live on each component page. Remove "playground"; legacy /playground links redirect to Components.'
        : `Unknown configuration key "${key}".`,
      `/${key}`,
    );
  }
  const c = input as unknown as WorkbenchConfig;
  const packages = c.library?.packages;
  if (
    !Array.isArray(packages) ||
    packages.length === 0 ||
    !packages.every((p) => typeof p === 'string')
  ) {
    out.error(
      'config.library.missing',
      'library.packages must list at least one package to document.',
      '/library/packages',
    );
  }
  const basePath = c.hosting?.basePath ?? '/';
  if (!BASE_PATH.test(basePath)) {
    out.error(
      'config.basePath.invalid',
      `hosting.basePath "${basePath}" must start and end with "/" (for example "/docs/").`,
      '/hosting/basePath',
    );
  }
  const routing = c.hosting?.routing ?? 'history';
  if (routing !== 'history' && routing !== 'hash') {
    out.error(
      'config.routing.invalid',
      'hosting.routing must be "history" or "hash".',
      '/hosting/routing',
    );
  }
  const primary = c.navigation?.primary ?? DEFAULT_PRIMARY;
  primary.forEach((section, i) => {
    if (!KNOWN_SECTIONS.includes(section)) {
      out.warn(
        'config.navigation.unknown',
        `navigation.primary entry "${section}" is not a Workbench section (${KNOWN_SECTIONS.join(', ')}).`,
        `/navigation/primary/${i}`,
      );
    }
  });
  const definitions = c.categories?.definitions ?? [];
  const seen = new Set<string>();
  definitions.forEach((d, i) => {
    if (seen.has(d.id)) {
      out.error(
        'config.category.duplicate',
        `Category id "${d.id}" is defined twice.`,
        `/categories/definitions/${i}`,
      );
    }
    seen.add(d.id);
  });
  for (const [tag, id] of Object.entries(c.categories?.assign ?? {})) {
    if (!seen.has(id)) {
      out.error(
        'config.category.unknown',
        `categories.assign maps <${tag}> to "${id}", which is not in categories.definitions.`,
        `/categories/assign/${tag}`,
      );
    }
  }
  const route = c.themeStudio?.route ?? '/theme-studio';
  if (!route.startsWith('/')) {
    out.error(
      'config.route.invalid',
      `themeStudio.route "${route}" must start with "/".`,
      '/themeStudio/route',
    );
  }
  const placement = c.products?.placement ?? ['foundations'];
  placement.forEach((p, i) => {
    if (p !== 'foundations' && p !== 'primary') {
      out.error(
        'config.products.placement',
        `products.placement "${String(p)}" must be "foundations" or "primary".`,
        `/products/placement/${i}`,
      );
    }
  });
  const productIds = new Set<string>();
  (c.products?.sources ?? []).forEach((source, i) => {
    if (productIds.has(source.id)) {
      out.error(
        'config.product.duplicate',
        `Product id "${source.id}" is configured twice.`,
        `/products/sources/${i}`,
      );
    }
    productIds.add(source.id);
  });
  if (out.hasErrors) return { config: undefined, diagnostics: out.items };

  const themeConfig = c.themeStudio?.themeConfig;
  return {
    config: {
      library: c.library,
      branding: c.branding ?? {},
      hosting: { basePath, routing },
      navigation: {
        home: c.navigation?.home ?? false,
        primary,
        legacyRedirects: c.navigation?.legacyRedirects ?? true,
      },
      categories: {
        definitions,
        assign: c.categories?.assign ?? {},
        fallback: c.categories?.fallback ?? 'Other components',
      },
      themeStudio: {
        enabled: c.themeStudio?.enabled ?? true,
        route,
        ...(themeConfig === undefined ? {} : { themeConfig }),
        preview: c.themeStudio?.preview ?? {},
      },
      products: {
        enabled: c.products?.enabled ?? false,
        placement,
        sources: c.products?.sources ?? [],
        discovery: {
          workspace: c.products?.discovery?.workspace ?? false,
          exclude: c.products?.discovery?.exclude ?? [],
        },
      },
      content: c.content ?? {},
      assets: c.assets ?? [],
    },
    diagnostics: out.items,
  };
}

// ---------------------------------------------------------------------------
// Authored content (mote.docs.ts / Markdown front matter), docs-content.v1

export const DOCS_SCHEMA = 'https://mote.dev/schemas/docs-content/v1.json';

export interface SectionContent {
  readonly title?: string;
  readonly guidance?: string;
  readonly visible?: boolean;
  readonly order?: number;
  /** `example:<tag>/<name>` references. */
  readonly examples?: readonly string[];
}

export interface PageContent {
  readonly title?: string;
  readonly eyebrow?: string;
  readonly summary?: string;
  readonly intro?: string;
  readonly tags?: readonly string[];
  /** ISO date (YYYY-MM-DD), declared by the author. */
  readonly updated?: string;
  readonly order?: number;
  readonly visible?: boolean;
  readonly useFor?: readonly string[];
  readonly notFor?: readonly string[];
  readonly sections?: Readonly<Record<string, SectionContent>>;
}

export interface DocsContent {
  readonly schema: typeof DOCS_SCHEMA;
  readonly locale?: string;
  /** Renamed page/section id → current id. */
  readonly aliases?: Readonly<Record<string, string>>;
  /** Keyed by stable page id (`foundations/spacing`, `components/<tag>`, `theme-studio`). */
  readonly pages: Readonly<Record<string, PageContent>>;
}

/** Identity with types, for `mote.docs.ts`; fills in the schema id. */
export function defineDocs(content: Omit<DocsContent, 'schema'>): DocsContent {
  return { schema: DOCS_SCHEMA, ...content };
}
