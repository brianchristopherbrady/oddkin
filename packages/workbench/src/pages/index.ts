/**
 * `@mote/workbench/pages` — the page registry (ADR 0023): one build-time source for routes,
 * primary navigation, sidebars, overview cards, search, visibility, and legacy redirects.
 * DOM-free; the M5 shell renders from it.
 */
export { buildPageRegistry } from './build.js';
export type { RegistryInput } from './build.js';
export {
  cards,
  href,
  onThisPage,
  primaryNavigation,
  resolveLegacyRoute,
  searchEntries,
  sidebar,
  staticRedirects,
} from './navigation.js';
export type { RedirectResult } from './navigation.js';
export { FOUNDATIONS } from './defaults.js';
export { PAGE_REGISTRY_SCHEMA } from './types.js';
export type {
  Availability,
  CemDeclaration,
  CemPackage,
  DocMetaLike,
  FactLike,
  FoundationMetaLike,
  MoteMetadataLike,
  PageEntry,
  PageKind,
  PageRegistry,
  SectionEntry,
} from './types.js';
export type { WorkbenchDiagnostic } from '../internal/diagnostics.js';
