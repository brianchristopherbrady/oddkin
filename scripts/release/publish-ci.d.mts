export declare const OIDC_DIST_TAG_NPM: string;

export declare function tarballName(name: string, version: string): string;

export declare function integrityOf(bytes: Uint8Array): string;

export declare function unverified(
  evidence: { packages?: { name: string; version: string; integrity: string }[] } | undefined,
  packed: readonly { spec: string; integrity: string }[],
): string[];

export declare function atLeast(version: string, minimum: string): boolean;

export declare function ciProblems(options: {
  env: Record<string, string | undefined>;
  npmVersion: string;
  live: boolean;
}): string[];

export interface PlannedPackage {
  name: string;
  version: string;
  /** Not on npm at this version yet. */
  publish: boolean;
  /** `latest` moves to this version. */
  latest: boolean;
}

export declare function renderSummary(
  plan: readonly PlannedPackage[],
  options: { live: boolean },
): string;
