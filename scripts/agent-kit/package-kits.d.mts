import type { Project } from './context.mjs';
import type { KitFile, KitManifest } from './kit.mjs';

export const PACKAGE_KIT_DIR: 'agent';
type Library = Project['libraries'][number];
export function compositionReference(library: Library): Promise<KitFile | undefined>;
export function llmsText(library: Library, manifest: KitManifest): string;
export function packageKit(
  project: Project,
  library: Library,
): Promise<{ dir: string; files: Map<string, string>; manifest: KitManifest }>;
export function main(argv?: string[]): Promise<number>;
