/**
 * `@oddkin/state` root entry: re-exports the store (`./store`) and context (`./context`).
 * Inspection (`./inspect`) and, when it lands, persistence stay separate imports. Imports without
 * DOM globals.
 */
export * from './store/index.js';
export * from './context/index.js';

/**
 * Package marker read by the plain-HTML example and the docs app skeleton.
 * @internal
 */
export const packageName = '@oddkin/state';

/** @internal Internal packages this package is allowed to depend on. */
export const internalDependencies: readonly string[] = ['@oddkin/core'];
