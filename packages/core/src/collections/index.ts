/**
 * `@mote/core/collections` — keyed nested collections and interaction-state models.
 * DOM-free. Contract: docs/architecture/data-composition.md §3.
 */
export { collection } from './collection.js';
export type {
  Collection,
  CollectionDiagnostic,
  CollectionOptions,
  Entry,
  Key,
} from './collection.js';
export {
  activeModel,
  disabledModel,
  expansionModel,
  selectionModel,
  visibleEntries,
} from './models.js';
export type {
  ActiveModel,
  ActiveOptions,
  ControlledValue,
  DisabledModel,
  ExpansionModel,
  ExpansionOptions,
  SelectionModel,
  SelectionOptions,
} from './models.js';
