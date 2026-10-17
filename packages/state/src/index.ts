import { isReadable } from '@mote/core/reactive';

/**
 * Workspace skeleton marker (M1). Replaced by real entry points when the
 * package's milestone implements them; it is not a public API.
 * @internal
 */
export const packageName = '@mote/state';

/** @internal Internal packages this package is allowed to depend on. */
export const internalDependencies: readonly string[] = ['@mote/core'];

/**
 * @internal Skeleton link to the DOM-free reactive entry the store builds on (M6),
 * so the state package never evaluates core's element base class.
 */
export const readableCheck: typeof isReadable = isReadable;
