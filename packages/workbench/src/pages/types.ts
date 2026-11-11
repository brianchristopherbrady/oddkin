/** Page registry contracts (`page-registry.v1`, ADR 0023, workbench-pages.md §2). */
// Types only: generated from the canonical oddkin-metadata v1 schema, they import nothing
// (packages.md, dependency rules).
import type {
  Category,
  Component,
  DocMeta,
  ExampleRef,
  Fact,
  Foundation,
  OddkinMetadata,
  ProductRef,
} from '@oddkin/analyzer/metadata/types';

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
  /**
   * Component pages: the package the component installs from, the first documented package whose
   * manifest declares the tag. Set by the Workbench data (`buildWorkbenchData`), which knows the
   * packages; its card shows it.
   */
  readonly package?: string;
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
    readonly exports?: readonly {
      readonly kind: string;
      readonly name: string;
      /** Where the exported value is declared; another module for a re-export. */
      readonly declaration?: { readonly name?: string; readonly module?: string };
    }[];
  }[];
}

// The oddkin-metadata v1 views Workbench reads: the fields it uses of the types generated from the
// canonical schema (`@oddkin/analyzer/metadata/types`). Merged views of several packages leave
// per-package fields out, so every field is optional here.

export interface FactLike<T> extends Pick<Fact, 'known' | 'provenance'> {
  readonly value?: T;
}

export interface FoundationMetaLike extends Pick<Foundation, 'sections' | 'tokens'> {
  /** A foundation id (`Foundation['id']`); a library's own foundations may add others. */
  readonly id: string;
}

export type DocMetaLike = DocMeta;

/** The oddkin-metadata v1 fields the registry reads. */
export interface OddkinMetadataLike {
  readonly library?: Partial<Pick<OddkinMetadata['library'], 'name' | 'prefix'>>;
  readonly components?: Readonly<
    Record<
      string,
      Pick<Component, 'tag'> &
        Partial<
          Pick<
            Component,
            'category' | 'tokenReads' | 'styleMappings' | 'a11y' | 'keyboard' | 'limitations'
          >
        >
    >
  >;
  readonly tokens?: OddkinMetadata['tokens'];
  readonly examples?: Readonly<
    Record<string, Pick<ExampleRef, 'component' | 'name'> & Partial<Pick<ExampleRef, 'incorrect'>>>
  >;
  readonly foundations?: Readonly<Record<string, FoundationMetaLike>>;
  readonly categories?: Readonly<Record<string, Category>>;
  readonly products?: Readonly<Record<string, Pick<ProductRef, 'id' | 'source'>>>;
  readonly docs?: Readonly<Record<string, DocMetaLike>>;
}
