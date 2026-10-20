/**
 * `@oddkin/app/resource` — async reads driven by a reactive source, with generations, abort, and
 * stale-result guards. DOM-free. Contract: docs/architecture/core-contracts.md §8.
 */
export { resource } from './resource.js';
export type { LoadContext, Loaded, Resource, ResourceOptions, ResourceState } from './resource.js';
