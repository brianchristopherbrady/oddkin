/**
 * `@oddkin/app/lifecycle` — page suspension and back/forward cache restoration as an explicit
 * application service. Importing it adds no listener. Imports without DOM globals.
 * Contract: docs/architecture/core-contracts.md §9.1; ADR 0035.
 */
export { pageLifecycle } from './lifecycle.js';
export type { PageLifecycle, PageLifecycleOptions, PageLifecycleState } from './lifecycle.js';
