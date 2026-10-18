import type { VerificationReport } from '../packages/analyzer/dist/index.js';

export declare const BROWSERS: readonly string[];
/** Hash of the files the contract test runs (package sources, core and tokens development builds). */
export declare function implementationHash(root: string, pkgDir: string): string;
/**
 * Attach current evidence to `<pkgDir>/oddkin.metadata.json`; returns the report. With
 * `requireAll`, every component in the metadata must have current evidence.
 */
export declare function attach(
  root: string,
  pkgDir: string,
  test: string,
  options?: { requireAll?: boolean },
): VerificationReport;
