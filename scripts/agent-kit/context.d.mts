export const CONTEXT_SCHEMA: 'https://oddkin.dev/schemas/project-context/v1.json';
export const GENERATOR: { readonly name: string; readonly version: string };

export interface Fingerprint {
  generator: { name: string; version: string };
  schemaVersion: number;
  packages?: Record<string, string>;
  inputs: string;
}

export interface ProjectContext {
  schema: string;
  packages: Array<{
    name: string;
    version: string;
    peerRanges?: Record<string, string>;
    exports?: string[];
    registrations?: Record<string, string>;
    metadata?: string;
  }>;
  components?: Array<{ tag: string; source: string; extends?: string; dependencies?: string[] }>;
  theme?: {
    config?: string;
    themes?: string[];
    modes?: string[];
    densities?: string[];
    profiles?: string[];
    products?: string[];
  };
  recipes: string[];
  examples: string[];
  conventions: { componentLayout: 'folders' | 'colocated' | 'mixed' | 'unknown' };
  commands: Record<string, string>;
  capabilityPaths: Array<
    'core-authoring' | 'tokens-only' | 'components-without-state' | 'application-services'
  >;
  fingerprint: Fingerprint;
  freshness: 'current' | 'stale' | 'unknown';
}

export interface Library {
  name: string;
  version: string;
  dir: string;
  manifest: Record<string, any>;
  metadata: Record<string, any>;
  cem?: Record<string, any>;
  owned: boolean;
}

export interface ContextDiagnostic {
  code: string;
  severity: 'error' | 'warning';
  message: string;
}

export interface Project {
  root: string;
  context: ProjectContext;
  diagnostics: ContextDiagnostic[];
  /** Input path (relative to the root) → SHA-256 of its content. */
  inputs: Map<string, string>;
  libraries: Library[];
  inspection?: { file: string; data: Record<string, any> };
  workspace: Array<{ name: string; dir: string }>;
}

export function exportTarget(manifest: Record<string, any>, subpath: string): string | undefined;
export function resolveProjectContext(
  root: string,
  options?: { themeConfig?: string; inspection?: string },
): Project;
export function inputsHash(inputs: Map<string, string>): string;
