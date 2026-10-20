/**
 * `@oddkin/app` root entry: re-exports application ownership (`./app`), resources (`./resource`),
 * commands (`./command`), and the router (`./router`). Imports without DOM globals.
 */
export * from './app/index.js';
export * from './resource/index.js';
export * from './command/index.js';
export * from './router/index.js';

/**
 * Package marker read by the plain-HTML example and the docs app skeleton.
 * @internal
 */
export const packageName = '@oddkin/app';

/** @internal Internal packages this package is allowed to depend on. */
export const internalDependencies: readonly string[] = ['@oddkin/core', '@oddkin/state'];
