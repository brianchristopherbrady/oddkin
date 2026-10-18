import type { VerificationReport } from '../packages/analyzer/dist/index.js';

export declare const BROWSERS: readonly string[];
/** Packages whose contract test records evidence, with the Oddkin builds its page runs. */
export declare const CONTRACT_TESTS: Readonly<
  Record<string, { readonly test: string; readonly dependencies: readonly string[] }>
>;
/**
 * Hash of the files a contract test runs: the package's sources and the development builds of
 * `dependencies` (default core and tokens).
 */
export declare function implementationHash(
  root: string,
  pkgDir: string,
  dependencies?: readonly string[],
): string;
/**
 * Attach current evidence to `<pkgDir>/oddkin.metadata.json`; returns the report. With
 * `requireAll`, every component in the metadata must have current evidence.
 */
export declare function attach(
  root: string,
  pkgDir: string,
  options?: { requireAll?: boolean },
): VerificationReport;
