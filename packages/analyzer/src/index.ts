/**
 * `@oddkin/analyzer` — Node-only static analysis of Oddkin component libraries. Uses the
 * TypeScript 5.9 compiler API (in-process, stable API; ADR 0018) and never imports or
 * executes the analyzed modules. Contract: docs/architecture/metadata-and-analyzer.md.
 */
import { existsSync, readFileSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join, relative, resolve, sep } from 'node:path';
import ts from 'typescript';
import {
  buildManifest,
  buildMetadata,
  sortDiagnostics,
  stableJson,
  type LibraryInfo,
  type ModulePaths,
} from './emit.js';
import { extract, type AnalyzerDiagnostic, type Extraction } from './extract.js';

export type {
  AnalyzerDiagnostic,
  ComponentInfo,
  DefinitionInfo,
  SourceRef,
  EventInfo,
  Extraction,
  PropertyInfo,
} from './extract.js';
export type { LibraryInfo } from './emit.js';

export const ANALYZER_VERSION = '0.0.0';

export interface AnalyzeOptions {
  /** tsconfig.json of the library to analyze. */
  readonly project: string;
  /** Package root (module paths are relative to it); defaults to the tsconfig directory. */
  readonly root?: string;
  /** Library identity; defaults to the root package.json. */
  readonly library?: Partial<LibraryInfo> & { readonly name: string; readonly version: string };
  /** Reuse a previous program for incremental analysis. */
  readonly oldProgram?: ts.Program;
}

export interface AnalyzeResult {
  readonly manifest: Record<string, unknown>;
  readonly metadata: Record<string, unknown>;
  readonly diagnostics: readonly AnalyzerDiagnostic[];
  readonly extraction: Extraction;
  readonly program: ts.Program;
}

/** Create a TypeScript program for a tsconfig (TypeScript 5.9 compiler API). */
export function createProgram(
  project: string,
  oldProgram?: ts.Program,
): { program: ts.Program; diagnostics: AnalyzerDiagnostic[] } {
  const diagnostics: AnalyzerDiagnostic[] = [];
  const config = ts.getParsedCommandLineOfConfigFile(
    resolve(project),
    {},
    {
      ...ts.sys,
      onUnRecoverableConfigFileDiagnostic: (d) =>
        diagnostics.push({
          code: 'analyzer.config.invalid',
          severity: 'error',
          message: ts.flattenDiagnosticMessageText(d.messageText, '\n'),
        }),
    },
  );
  if (!config)
    throw new Error(`Cannot read ${project}: ${diagnostics.map((d) => d.message).join('; ')}`);
  for (const d of config.errors)
    diagnostics.push({
      code: 'analyzer.config.invalid',
      severity: 'error',
      message: ts.flattenDiagnosticMessageText(d.messageText, '\n'),
    });
  const program = ts.createProgram({
    rootNames: config.fileNames,
    options: { ...config.options, noEmit: true },
    ...(config.projectReferences ? { projectReferences: config.projectReferences } : {}),
    ...(oldProgram ? { oldProgram } : {}),
  });
  return { program, diagnostics };
}

function modulePaths(
  program: ts.Program,
  root: string,
  manifest: Record<string, unknown> | undefined,
): ModulePaths {
  const options = program.getCompilerOptions();
  const outDir = options.outDir;
  const rootDir = options.rootDir ?? root;
  const moduleOf = (sourceFile: string) => {
    const absolute = resolve(root, sourceFile);
    const output = outDir ? join(outDir, relative(rootDir, absolute)) : absolute;
    return relative(root, output)
      .split(sep)
      .join('/')
      .replace(/\.(m|c)?tsx?$/, (_, m: string | undefined) => `.${m ?? ''}js`);
  };
  const exportsField = (manifest?.['exports'] ?? {}) as Record<string, unknown>;
  const name = manifest?.['name'] as string | undefined;
  const targets = new Map<string, string>();
  for (const [subpath, target] of Object.entries(
    typeof exportsField === 'object' ? exportsField : {},
  )) {
    const file =
      typeof target === 'string'
        ? target
        : ((target as Record<string, unknown>)?.['default'] ??
          (target as Record<string, unknown>)?.['import']);
    if (typeof file === 'string' && name)
      targets.set(file.replace(/^\.\//, ''), subpath === '.' ? name : `${name}${subpath.slice(1)}`);
  }
  return { moduleOf, specifierOf: (modulePath) => targets.get(modulePath) };
}

/** Analyze a library without executing it. */
export function analyze(options: AnalyzeOptions): AnalyzeResult {
  const projectDir = dirname(resolve(options.project));
  const root = resolve(options.root ?? projectDir);
  const manifestPath = join(root, 'package.json');
  const packageJson = existsSync(manifestPath)
    ? (JSON.parse(readFileSync(manifestPath, 'utf8')) as Record<string, unknown>)
    : undefined;
  const { program, diagnostics: configDiagnostics } = createProgram(
    options.project,
    options.oldProgram,
  );
  const extraction = extract(program, root);
  const paths = modulePaths(program, root, packageJson);
  const name = options.library?.name ?? (packageJson?.['name'] as string | undefined) ?? 'library';
  const version =
    options.library?.version ?? (packageJson?.['version'] as string | undefined) ?? '0.0.0';
  const library: LibraryInfo = {
    name,
    version,
    ...(options.library?.prefix ? { prefix: options.library.prefix } : {}),
    packages: options.library?.packages ?? [
      { name, version, customElements: './custom-elements.json' },
    ],
  };
  const diagnostics = sortDiagnostics([...configDiagnostics, ...extraction.diagnostics]);
  return {
    manifest: buildManifest(extraction, paths),
    metadata: buildMetadata({ ...extraction, diagnostics }, paths, library, ANALYZER_VERSION),
    diagnostics,
    extraction,
    program,
  };
}

/** Write `custom-elements.json` and `oddkin.metadata.json` into `outDir`. */
export async function writeOutputs(result: AnalyzeResult, outDir: string): Promise<string[]> {
  await mkdir(outDir, { recursive: true });
  const files: Array<[string, unknown]> = [
    ['custom-elements.json', result.manifest],
    ['oddkin.metadata.json', result.metadata],
  ];
  const written: string[] = [];
  for (const [file, data] of files) {
    const path = join(outDir, file);
    await writeFile(path, stableJson(data));
    written.push(path);
  }
  return written;
}

export { stableJson } from './emit.js';
