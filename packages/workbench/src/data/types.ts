/**
 * Workbench data files (workbench.md §2.1): a small index the shell loads first, and one data
 * file per page that its route loads lazily. Internal formats shared by the Node tooling and the
 * browser shell of the same Workbench version; `version` changes when a shape changes.
 */
import type { WorkbenchDiagnostic } from '../internal/diagnostics.js';
import type { JsonValue } from '../protocol/index.js';
import type { CemPackage, OddkinMetadataLike, PageKind, PageRegistry } from '../pages/types.js';

export const INDEX_FORMAT = 'oddkin.workbench-index';
export const PAGE_FORMAT = 'oddkin.workbench-page';
export const DATA_VERSION = 1;

/** A JSON object as read from a published file. */
export type JsonObject = { readonly [key: string]: unknown };

/** One documented package and its published outputs. */
export interface LibraryInput {
  readonly name: string;
  readonly version: string;
  /** Its standard Custom Elements Manifest (`customElements`). */
  readonly cem?: CemPackage;
  /** Its `oddkin.metadata.json`, when the package publishes Oddkin enrichment. */
  readonly metadata?: OddkinMetadataLike;
  /** Authored example sets as data (`toExamplesJSON()` of each `defineExamples` module). */
  readonly examples?: readonly ExampleSetLike[];
}

/** One component's examples as plain data (`@oddkin/workbench/examples` `ExamplesJSON`). */
export interface ExampleSetLike {
  readonly component: string;
  readonly examples: Readonly<Record<string, JsonObject>>;
}

/** A token as published by a token inspection (`@oddkin/tokens/inspect/*.json`). */
export interface InspectedTokenLike {
  readonly name: string;
  readonly cssVariable?: string;
  readonly category?: string;
  readonly type?: string;
  readonly origin?: string;
  readonly definition?: unknown;
  readonly value?: unknown;
  readonly description?: string;
}

export interface TokenInspectionLike {
  readonly theme?: string;
  readonly tokens: readonly InspectedTokenLike[];
}

export interface WorkbenchBranding {
  readonly name: string;
  readonly logo?: string;
  readonly links: readonly { readonly label: string; readonly href: string }[];
}

export interface WorkbenchIndex {
  readonly format: typeof INDEX_FORMAT;
  readonly version: typeof DATA_VERSION;
  readonly branding: WorkbenchBranding;
  /** The documented packages, in configuration order. */
  readonly libraries: readonly {
    readonly name: string;
    readonly version: string;
    readonly prefix?: string;
  }[];
  readonly registry: PageRegistry;
  /** Page id → its data file, relative to the index. Visible pages only. */
  readonly pages: Readonly<Record<string, string>>;
  readonly diagnostics: readonly WorkbenchDiagnostic[];
}

interface PageDataBase {
  readonly format: typeof PAGE_FORMAT;
  readonly version: typeof DATA_VERSION;
  readonly id: string;
}

/** A component page: its published facts, verbatim, for the detail panels to present. */
export interface ComponentPageData extends PageDataBase {
  readonly kind: 'component';
  readonly tag: string;
  /** The package whose manifest declares the element. */
  readonly package: string;
  /** The CEM module that declares it. */
  readonly module: string;
  /** The CEM declaration, verbatim. */
  readonly declaration: JsonObject;
  /** The Oddkin enrichment entry, verbatim, when published. */
  readonly enrichment?: JsonObject;
  /**
   * Authored examples for the element (metadata `examples`), verbatim, with their ids. When the
   * example set was loaded, `definition` holds its values (label, props, attributes, slots,
   * preset, guidance, incorrect, `hasFixture`).
   */
  readonly examples: readonly JsonObject[];
  /**
   * The tokens the component reads (`tokenReads`), resolved from the token inspection in their
   * order. A token missing from the inspection keeps only its name (`missing: true`).
   */
  readonly tokens?: readonly (InspectedTokenLike & { readonly missing?: true })[];
  /**
   * Authored content for the page (`oddkin.docs.ts`): intended use and section guidance. Absent
   * when nothing is authored.
   */
  readonly authored?: {
    readonly useFor?: readonly string[];
    readonly notFor?: readonly string[];
    readonly guidance?: string;
  };
}

/** A foundation page: its metadata and the referenced tokens from the token inspection. */
export interface FoundationPageData extends PageDataBase {
  readonly kind: 'foundation';
  /** The foundation's metadata entry, verbatim. */
  readonly foundation: JsonObject;
  /**
   * The tokens the foundation lists, in its order. A token missing from the inspection keeps
   * only its name (`missing: true`); its value is never guessed.
   */
  readonly tokens: readonly (InspectedTokenLike & { readonly missing?: true })[];
}

/** Overview, tool, products, and home pages: their content comes from the index for now. */
export interface BasicPageData extends PageDataBase {
  readonly kind: Exclude<PageKind, 'component' | 'foundation'>;
}

/** A specimen role played by a documented component in one of its examples. */
export interface SpecimenRole {
  readonly role: string;
  /** Visible caption. */
  readonly label: string;
  readonly tag: string;
  /** The component's published registration entry. */
  readonly registration: string;
  /** The example whose values the specimen uses. */
  readonly example: `example:${string}/${string}`;
  readonly properties: Readonly<Record<string, JsonValue>>;
  readonly attributes: Readonly<Record<string, string>>;
  readonly slots: Readonly<Record<string, string>>;
  /** Mapped by `themeStudio.preview.roles` or claimed by the example (`previewRoles`). */
  readonly source: 'config' | 'example';
}

/** Theme Studio (workbench.md ?6): the baseline configuration, its generator, and specimens. */
export interface ThemeStudioPageData extends PageDataBase {
  readonly kind: 'tool';
  readonly studio: {
    /** The baseline theme configuration's JSON model. */
    readonly config?: JsonObject;
    /** The configuration file, as `themeStudio.themeConfig` names it. */
    readonly source?: string;
    /** URL of the generation worker (the library's own `@oddkin/tokens/generate`). */
    readonly worker?: string;
    readonly roles: readonly SpecimenRole[];
    /** Absent inputs, each with what supplies it; shown on the page, never guessed. */
    readonly missing: readonly { readonly item: string; readonly supply: string }[];
  };
}

export type PageData = ComponentPageData | FoundationPageData | ThemeStudioPageData | BasicPageData;

export interface WorkbenchData {
  readonly index: WorkbenchIndex;
  /** Page id → data, for every entry of `index.pages`. */
  readonly pages: Readonly<Record<string, PageData>>;
}

/** Re-exported for callers that build the registry input themselves. */
export type { CemPackage, OddkinMetadataLike };
