import type { Fingerprint, Project } from './context.mjs';

export const KIT_SCHEMA: 'https://oddkin.dev/schemas/agent-kit/v1.json';
export const GUIDE_BUDGET: number;

export interface KitManifest {
  schema: string;
  library: { name: string; version: string };
  fingerprint: Fingerprint;
  metadata: { file: string; sha256: string };
  guide: { path: string; budgetBytes: number; bytes: number };
  entries: Array<{
    id: string;
    path: string;
    kind:
      | 'component'
      | 'choosing'
      | 'tokens'
      | 'recipe'
      | 'stylesheet'
      | 'model'
      | 'composition'
      | 'task'
      | 'json';
    provenance: 'extracted' | 'authored' | 'verified';
    notAuthored?: boolean;
  }>;
  packaging?: Array<'agent-skills' | 'agents-md' | 'ide-instructions' | 'llms-txt'>;
}

export interface KitFile {
  path: string;
  text: string;
  entry: KitManifest['entries'][number];
}

export function kitDirName(name: string): string;
export function refreshCommand(name: string, out: string): string;
export function metadataHash(dir: string): string;
export function generateKit(
  project: Project,
  name: string,
  options?: { packaged?: boolean; extra?: KitFile[] },
): { files: Map<string, string>; manifest: KitManifest };
export function writeKit(dir: string, files: Map<string, string>): void;
export function checkKit(
  dir: string,
  project: Project,
  name: string,
): { status: 'current' | 'stale' | 'missing'; changed: string[] };
export function main(argv?: string[]): Promise<number>;
