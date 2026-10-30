export declare const SCHEMA: 'release-evidence.v0';

export interface EvidenceSource {
  commit: string;
  dirty: boolean;
  /** Lines `git status --porcelain` reports. */
  changes: number;
}

export interface ListedPackage {
  name: string;
  version: string;
  /** Relative to the repository root, e.g. `packages/core`. */
  directory: string;
}

/** One entry of `npm pack --dry-run --json`, as far as the evidence reads it. */
export interface PackEntry {
  name: string;
  version: string;
  integrity: string;
  shasum: string;
  entryCount: number;
  size: number;
  unpackedSize: number;
}

export interface EvidencePackage extends ListedPackage {
  integrity: string;
  shasum: string;
  files: number;
  size: number;
  unpackedSize: number;
}

export interface EvidenceArtifact {
  path: string;
  sha256: string;
}

export interface VitestRun {
  run: string;
  total: number;
  passed: number;
  failed: number;
  skipped: number;
  success: boolean;
}

export interface PlaywrightCounts {
  passed: number;
  failed: number;
  flaky: number;
  skipped: number;
}

export interface PlaywrightSummary extends PlaywrightCounts {
  seconds: number;
  projects: (PlaywrightCounts & { project: string })[];
}

export interface ImpactEvidence {
  state: 'written' | 'unavailable' | 'failed';
  base: string | null;
  head: string;
  reason?: string;
  /** By classification: incompatible, review, informational. */
  changes?: Record<string, number>;
  coverageGaps?: number;
  /** By state: selected, passed, failed, reused, not-executed, unresolved. */
  checks?: Record<string, number>;
  fullVerification?: string[] | null;
}

export interface CheckResults {
  tests: VitestRun[];
  e2e: PlaywrightSummary | null;
  impact: ImpactEvidence | null;
}

export type StepEvidence =
  | {
      state: 'read';
      job: string;
      steps: { name: string; conclusion: string | null; seconds: number }[];
    }
  | { state: 'unavailable'; reason: string };

export interface ReleaseEvidence {
  schema: 'release-evidence.v0';
  generatedAt: string;
  source: EvidenceSource;
  environment: {
    node: string;
    npm: string;
    os: string;
    ci: {
      provider: 'github-actions';
      repository: string | null;
      workflow: string | null;
      event: string | null;
      ref: string | null;
      runId: string | null;
      runAttempt: string | null;
      url: string | null;
    } | null;
  };
  packages: EvidencePackage[];
  artifacts: EvidenceArtifact[];
  checks:
    | ({ state: 'recorded'; steps: StepEvidence | null } & CheckResults)
    | { state: 'not-run'; reason: string };
}

export type Environment = Record<string, string | undefined>;

export declare function readSource(root?: string): EvidenceSource;
export declare function listPackages(root?: string): Promise<ListedPackage[]>;
export declare function packDryRun(directories: readonly string[], root?: string): PackEntry[];
export declare function summarizePlaywright(report: unknown): PlaywrightSummary;
export declare function readResults(dir: string): Promise<CheckResults>;
export declare function readSteps(env?: Environment): Promise<StepEvidence>;
export declare function collectEvidence(options?: {
  root?: string;
  /** Where CI left `results/` and `impact/`; the bundle is written there too. */
  out?: string;
  allowDirty?: boolean;
  /** Also read this job's step times from the GitHub API. */
  ci?: boolean;
  pack?: (directories: readonly string[], root: string) => PackEntry[];
  env?: Environment;
}): Promise<ReleaseEvidence>;
export declare function renderEvidenceMarkdown(evidence: ReleaseEvidence): string;
export declare function writeEvidence(out: string, evidence: ReleaseEvidence): Promise<void>;
