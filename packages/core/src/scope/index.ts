/**
 * `@mote/core/scope` — ownership and cleanup. DOM-free.
 * Contract: docs/architecture/core-contracts.md §4; ADR 0004.
 */
export { Scope, createScope } from './scope.js';
export type { Cleanup, Controller, Release, ScopeOptions, ScopedEffect } from './scope.js';
