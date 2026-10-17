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
