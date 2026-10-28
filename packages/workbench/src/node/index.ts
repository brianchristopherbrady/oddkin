/**
 * `@oddkin/workbench/node` — the Workbench's Node tooling (workbench.md §2.1, §10): configuration
 * and input loading, package graphs, the marked generated directory, one-shot and static builds,
 * the dev server, and the `oddkin` command. Node only; never part of a browser graph.
 */
export { analyzerBin, run, USAGE } from './cli.js';
export type { CliIO } from './cli.js';
export { CONFIG_FILES, loadDefault, loadWorkbenchConfig } from './config.js';
export type { LoadedConfig } from './config.js';
export { GeneratedDirectoryError, MARKER, writeGenerated } from './generated.js';
export type { GeneratedContent } from './generated.js';
export { shellHtml } from './html.js';
export type { ShellDocument } from './html.js';
export { DOCS_FILES, loadInputs } from './inputs.js';
export type { WorkbenchInputs } from './inputs.js';
export { findPackageDir, isPackageName, packageGraph, readPackage } from './packages.js';
export type { InstalledPackage, PackageJson } from './packages.js';
export { DEFAULT_PORT, DevServerError, startDevServer } from './server.js';
export type { DevServer, DevServerOptions, UpdateEvent } from './server.js';
export { buildStatic, embedFiles, shellPaths } from './static.js';
export type { StaticBuild, StaticBuildOptions } from './static.js';
export { ASSET_DIR, buildWorkbench, formatDiagnostic, WORKBENCH_DIR } from './workbench.js';
export type { BuildOptions, WorkbenchBuild } from './workbench.js';
