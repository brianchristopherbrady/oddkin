/**
 * `@oddkin/analyzer/kit`: agent kits generated from published metadata (agent-tooling.md §4–5):
 * the project context, a library's kit with its freshness check, the kit a component package
 * ships, and the managed AGENTS.md section. The `oddkin-kit` command runs the same functions.
 */
export {
  CONTEXT_SCHEMA,
  GENERATOR,
  exportTarget,
  inputsHash,
  resolveProjectContext,
  type ContextDiagnostic,
  type Fingerprint,
  type InspectionSource,
  type Library,
  type Project,
  type ProjectContext,
} from './context.js';
export {
  GUIDE_BUDGET,
  KIT_SCHEMA,
  checkKit,
  generateKit,
  kitDirName,
  metadataHash,
  refreshCommand,
  writeKit,
  type KitEntry,
  type KitFile,
  type KitManifest,
} from './kit.js';
export { PACKAGE_KIT_DIR, compositionReference, llmsText, packageKit } from './package-kit.js';
export { BEGIN, END, lineDiff, renderSection, updateAgentsMd } from './agents-md.js';
export { USAGE, main, type Io } from './cli.js';
