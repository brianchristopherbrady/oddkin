/**
 * `@oddkin/state/store` — optional shared stores on Oddkin's reactive graph. DOM-free.
 * Contract: docs/architecture/core-contracts.md §7.
 */
export { action, createStore, shallowEqual } from './store.js';
export type { SelectOptions, Store, StoreOptions } from './store.js';
