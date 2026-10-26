/**
 * `@oddkin/components/composition`: interfaces described as data, for agents generating
 * structured output and saved compositions. Validates documents against the published catalog
 * and renders them without executable values. Never imported by element entries.
 * Contract: docs/architecture/data-composition.md §8; schemas in `schemas/composition/`.
 */
export {
  COMPOSITION_VERSION,
  validateComposition,
  type CompositionDiagnostic,
  type CompositionDocument,
  type CompositionElement,
  type CompositionLimits,
  type CompositionNode,
  type CompositionValidation,
} from './validate.js';
export {
  renderComposition,
  type CompositionAction,
  type RenderCompositionOptions,
  type RenderedComposition,
} from './render.js';
export { CATALOG } from './catalog.js';
export {
  NATIVE,
  type Catalog,
  type ElementEntry,
  type NativeEntry,
  type ValueType,
} from './vocabulary.js';
