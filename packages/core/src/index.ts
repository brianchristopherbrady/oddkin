/**
 * `@mote/core` root entry. Re-exports the DOM-free foundations implemented so far.
 * Element, template, and style APIs join this entry as M3 implements them.
 */
export * from './reactive/index.js';
export * from './scope/index.js';
export * from './template/index.js';
export * from './styles/index.js';
export * from './element/index.js';
export { MoteError, reportMoteError, setErrorHandler } from './diagnostics/index.js';
export type { ErrorContext, ErrorHandler } from './diagnostics/index.js';

/**
 * Workspace skeleton marker (M1). Removed once dependent packages import real APIs.
 * @internal
 */
export const packageName = '@mote/core';

/** @internal Internal packages this package is allowed to depend on. */
export const internalDependencies: readonly string[] = [];
