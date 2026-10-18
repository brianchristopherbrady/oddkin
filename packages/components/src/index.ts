import { packageName as corePackage } from '@oddkin/core';
import { packageName as tokensPackage } from '@oddkin/tokens';
/**
 * Workspace skeleton marker (M1). Replaced by real entry points when the
 * package's milestone implements them; it is not a public API.
 * @internal
 */
export const packageName = '@oddkin/components';

/** @internal Internal packages this package is allowed to depend on. */
export const internalDependencies: readonly string[] = [corePackage, tokensPackage];
