export interface Diagnostic {
  code: string;
  message: string;
  file?: string;
  fix?: string;
}

export interface PackageRule {
  kind: 'browser' | 'node' | 'mixed';
  allow: string[];
  domFree?: string[];
  nodeEntries?: string[];
  nodeSources?: string[];
  nodeOnlyDependencies?: string[];
  /** Development-only sources such as `*.examples.ts`, which may also import `allow`. */
  devSources?: { suffix: string; allow: string[] };
  /**
   * Opt-in framework typings: sources under `sources` may import `allow` packages for types only,
   * and `entries` must be types-only exports (no JavaScript).
   */
  typeOnly?: { sources: string; entries: string[]; allow: string[] };
  /**
   * Types-only exports of a Node package that browser code may import with `import type` only:
   * no JavaScript, and a declaration file that imports nothing.
   */
  browserTypes?: string[];
}

export interface BoundaryConfig {
  packages: Record<string, PackageRule>;
}

export function checkBoundaries(
  root: string,
  options?: { config?: BoundaryConfig; artifacts?: boolean },
): Promise<{
  diagnostics: Diagnostic[];
  packages: string[];
  stats: { sourceFiles: number; importsScanned: number };
}>;
