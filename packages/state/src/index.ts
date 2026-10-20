/**
 * `@oddkin/state` root entry: re-exports the store (`./store`). Inspection (`./inspect`) and,
 * when they land, persistence stay separate imports. DOM-free.
 */
export * from './store/index.js';

/**
 * Package marker read by the plain-HTML example and the docs app skeleton.
 * @internal
 */
export const packageName = '@oddkin/state';

/** @internal Internal packages this package is allowed to depend on. */
export const internalDependencies: readonly string[] = ['@oddkin/core'];
