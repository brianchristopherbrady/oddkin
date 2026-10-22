/** Types for scripts/vocabulary.mjs (ADR 0045). */
export interface VocabularyFinding {
  readonly code: string;
  readonly tag: string;
  readonly name: string;
  readonly message: string;
}
export const ATTRIBUTES: Record<
  string,
  { type?: 'string' | 'boolean'; values?: string[]; families?: Record<string, string[]> }
>;
export const SYNONYMS: Record<string, string>;
export const SLOT_SYNONYMS: Record<string, string>;
export const NATIVE_EVENTS: string[];
export const NATIVE_MEMBERS: string[];
export function checkDeclaration(declaration: unknown): VocabularyFinding[];
export function checkManifest(manifest: unknown): VocabularyFinding[];
