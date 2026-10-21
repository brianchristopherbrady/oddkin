import type { Fingerprint, Project } from './context.mjs';

export const KIT_SCHEMA: 'https://oddkin.dev/schemas/agent-kit/v1.json';
export const GUIDE_BUDGET: number;

export interface KitManifest {
  schema: string;
  library: { name: string; version: string };
  fingerprint: Fingerprint;
  guide: { path: string; budgetBytes: number; bytes: number };
  entries: Array<{
    id: string;
    path: string;
    kind: 'component' | 'choosing' | 'tokens' | 'recipe' | 'model' | 'task' | 'json';
    provenance: 'extracted' | 'authored' | 'verified';
    notAuthored?: boolean;
  }>;
}

export function kitDirName(name: string): string;
export function refreshCommand(name: string, out: string): string;
export function generateKit(
  project: Project,
  name: string,
): { files: Map<string, string>; manifest: KitManifest };
export function writeKit(dir: string, files: Map<string, string>): void;
export function checkKit(
  dir: string,
  project: Project,
  name: string,
): { status: 'current' | 'stale' | 'missing'; changed: string[] };
export function main(argv?: string[]): Promise<number>;
