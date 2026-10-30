/** Page registry contracts (`page-registry.v1`, ADR 0023, workbench-pages.md §2). */

export const PAGE_REGISTRY_SCHEMA = 'https://oddkin.dev/schemas/page-registry/v1.json';

export type PageKind =
  'home' | 'overview' | 'foundation' | 'component' | 'tool' | 'products' | 'guide';
export type Availability = 'full' | 'partial' | 'unavailable';

export interface SectionEntry {
  /** Stable section id; drives "On this page" anchors and authored content keys. */
  readonly id: string;
  readonly title: string;
  readonly visible: boolean;
  readonly source: 'generated' | 'built-in' | 'authored';
}

export interface PageEntry {
  /** Stable id, e.g. `foundations/spacing`, `components/acme-button`, `theme-studio`. */
  readonly id: string;
  /** Relative to the base path, starting with `/`. */
  readonly route: string;
  readonly section: string;
  readonly kind: PageKind;
  readonly eyebrow?: string;
  readonly title: string;
  readonly summary?: string;
  /** Sidebar and catalog group (component category). */
  readonly group?: string;
  readonly tags?: readonly string[];
  /** ISO date, only from authored content or source history (ADR 0027); never build time. */
  readonly updated?: string;
  readonly order?: number;
  readonly visible: boolean;
  readonly availability: Availability;
  /** Where the page appears. All false when the page is not visible. */
  readonly nav: {
    readonly primary?: boolean;
    readonly sidebar?: boolean;
    readonly card?: boolean;
    readonly search?: boolean;
  };
  readonly sections: readonly SectionEntry[];
  /** Old routes that redirect here. */
  readonly legacyRoutes?: readonly string[];
}

export interface PageRegistry {
  readonly schema: typeof PAGE_REGISTRY_SCHEMA;
  readonly basePath: string;
  readonly routing: 'history' | 'hash';
  /** Ordered ids of visible pages shown in primary navigation. */
  readonly primaryNav: readonly string[];
  readonly pages: readonly PageEntry[];
}

// ---------------------------------------------------------------------------
// Inputs (structural: standard CEM and the oddkin-metadata v1 JSON contract)

export interface CemDeclaration {
  readonly kind: string;
  readonly name: string;
  readonly customElement?: boolean;
  readonly tagName?: string;
  readonly summary?: string;
  readonly description?: string;
  readonly members?: readonly {
    readonly kind: string;
    readonly name: string;
    readonly privacy?: string;
    readonly static?: boolean;
  }[];
  readonly attributes?: readonly { readonly name: string }[];
  readonly events?: readonly { readonly name: string }[];
  readonly slots?: readonly { readonly name: string }[];
  readonly cssParts?: readonly { readonly name: string }[];
  readonly cssProperties?: readonly { readonly name: string }[];
  readonly cssStates?: readonly { readonly name: string }[];
}

/** A Custom Elements Manifest (schema 2.x); only the fields the registry reads. */
export interface CemPackage {
  readonly modules: readonly {
    readonly path: string;
    readonly declarations?: readonly CemDeclaration[];
    /** The module's exports; a `custom-element-definition` names a tag the module registers. */
    readonly exports?: readonly { readonly kind: string; readonly name: string }[];
  }[];
}

export interface FactLike<T> {
  readonly value?: T;
  readonly known?: boolean;
  readonly provenance: 'extracted' | 'authored' | 'observed' | 'verified';
}

export interface FoundationMetaLike {
  readonly id: string;
  readonly sections: readonly {
    readonly id: string;
    readonly available: boolean;
    readonly reason?: string;
  }[];
  readonly tokens: readonly string[];
}

export interface DocMetaLike {
  readonly title?: FactLike<string>;
  readonly summary?: FactLike<string>;
  readonly tags?: readonly string[];
  readonly updated?: FactLike<string>;
  readonly order?: number;
  readonly visible?: boolean;
}

/** The oddkin-metadata v1 fields the registry reads. */
export interface OddkinMetadataLike {
  readonly library?: { readonly name?: string; readonly prefix?: string };
  readonly components?: Readonly<
    Record<
      string,
      {
        readonly tag: string;
        readonly category?: string;
        readonly tokenReads?: readonly unknown[];
        readonly styleMappings?: readonly unknown[];
        readonly a11y?: unknown;
        readonly keyboard?: unknown;
        readonly limitations?: readonly unknown[];
      }
    >
  >;
  readonly tokens?: unknown;
  readonly examples?: Readonly<
    Record<
      string,
      { readonly component: string; readonly name: string; readonly incorrect?: object }
    >
  >;
  readonly foundations?: Readonly<Record<string, FoundationMetaLike>>;
  readonly categories?: Readonly<
    Record<
      string,
      { readonly label: string; readonly description?: string; readonly order?: number }
    >
  >;
  readonly products?: Readonly<Record<string, { readonly id: string; readonly source: string }>>;
  readonly docs?: Readonly<Record<string, DocMetaLike>>;
}
