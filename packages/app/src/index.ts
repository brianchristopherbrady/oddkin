import { packageName as corePackage } from '@oddkin/core';
import { packageName as statePackage } from '@oddkin/state';
/**
 * Workspace skeleton marker (M1). Replaced by real entry points when the
 * package's milestone implements them; it is not a public API.
 * @internal
 */
export const packageName = '@oddkin/app';

/** @internal Internal packages this package is allowed to depend on. */
export const internalDependencies: readonly string[] = [corePackage, statePackage];
