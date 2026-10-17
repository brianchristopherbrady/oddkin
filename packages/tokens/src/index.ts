/**
 * `@mote/tokens` root entry: theme configuration and the pure generator. DOM-free.
 * Node file I/O and the CLI live in `@mote/tokens/node` (not yet implemented).
 */
export * from './theme/index.js';
export * from './generate/index.js';

/**
 * Workspace skeleton marker (M1), still read by the plain-HTML consumer and packed checks.
 * @internal
 */
export const packageName = '@mote/tokens';

/** @internal Internal packages this package is allowed to depend on. */
export const internalDependencies: readonly string[] = [];
