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
import { contractIndex } from './contracts.js';
import { foundationsFrom, type InspectionSource, type TokenInspection } from './foundations.js';
import { extractExamples, findExampleFiles, type ExampleInfo } from './examples.js';

export type { ExampleInfo } from './examples.js';
export {
  contractIndex,
  contractPackage,
  resolveContract,
  type ContractEntry,
  type ContractIndex,
  type ResolvedContract,
} from './contracts.js';
export {
  UNKNOWN_REFERENCE,
  authoredTexts,
  checkReferences,
  referenceIndex,
  type AuthoredText,
  type ReferenceIndex,
  type ReferenceSources,
} from './references.js';

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
export { foundationsFrom } from './foundations.js';
export type { InspectedToken, InspectionSource, TokenInspection } from './foundations.js';

export const ANALYZER_VERSION = '0.0.0';

/** Core contracts every element relies on (`@oddkin/core/CONTRACTS.md`). */
export const ELEMENT_CONTRACTS = [
  'contract:core/binding-rule',
  'contract:core/properties',
  'contract:core/events',
  'contract:core/lifecycle',
  'contract:core/update-complete',
  'contract:core/scope',
] as const;
const COMPOSITION_CONTRACT = 'contract:core/composition';

export interface AnalyzeOptions {
  /** tsconfig.json of the library to analyze. */
  readonly project: string;
  /** Package root (module paths are relative to it); defaults to the tsconfig directory. */
  readonly root?: string;
  /** Library identity; defaults to the root package.json. */
  readonly library?: Partial<LibraryInfo> & { readonly name: string; readonly version: string };
  /** Reuse a previous program for incremental analysis. */
  readonly oldProgram?: ts.Program;
  /**
   * Example files (`*.examples.ts`). Defaults to those under the program's `rootDir`; they are
   * development-only sources, so they need not be in the program.
   */
  readonly examples?: readonly string[];
  /** A theme's token inspection; `foundations` metadata references it without recomputing. */
  readonly tokens?: { readonly inspection: TokenInspection; readonly source: InspectionSource };
}

export interface AnalyzeResult {
  readonly manifest: Record<string, unknown>;
  readonly metadata: Record<string, unknown>;
  readonly diagnostics: readonly AnalyzerDiagnostic[];
  readonly extraction: Extraction;
  readonly examples: readonly ExampleInfo[];
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
    // Module paths are those of the emitted (development) build; with a dev/prod split
    // (ADR 0031) the `development` target is the one that matches them.
    const conditions = (target ?? {}) as Record<string, unknown>;
    const files =
      typeof target === 'string'
        ? [target]
        : [conditions['development'], conditions['default'], conditions['import']];
    const specifier = subpath === '.' ? name : `${name}${subpath.slice(1)}`;
    for (const file of files)
      if (typeof file === 'string' && name && !targets.has(file.replace(/^\.\//, '')))
        targets.set(file.replace(/^\.\//, ''), specifier as string);
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
  const exampleFiles =
    options.examples?.map((file) => resolve(root, file)) ??
    findExampleFiles(program.getCompilerOptions().rootDir ?? projectDir);
  const found = extractExamples(exampleFiles, root);
  const registered = new Set(extraction.registrations.map((r) => r.tag));
  const exampleDiagnostics: AnalyzerDiagnostic[] = [...found.diagnostics];
  for (const example of found.examples)
    if (!registered.has(example.component))
      exampleDiagnostics.push({
        code: 'analyzer.examples.unknownComponent',
        severity: 'warning',
        message: `Example "${example.name}" is for <${example.component}>, which this library does not register.`,
        source: example.location,
      });
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
  // Every element relies on the core contracts its base class implements; composed definitions
  // also on the composition contract. Sections come from the installed @oddkin/core.
  const referenced = extraction.components.length
    ? [...ELEMENT_CONTRACTS, ...(extraction.definitions.length ? [COMPOSITION_CONTRACT] : [])]
    : [];
  const coreContracts = referenced.length ? contractIndex('@oddkin/core', root) : undefined;
  const contractDiagnostics: AnalyzerDiagnostic[] = referenced
    .filter((id) => !coreContracts?.contracts[id])
    .map((id) => ({
      code: 'analyzer.contract.unresolved',
      severity: 'warning',
      message: coreContracts
        ? `${id} is not in @oddkin/core ${coreContracts.version}'s contracts.json.`
        : `${id} cannot be resolved: @oddkin/core/contracts.json is not installed for ${root}.`,
    }));
  const diagnostics = sortDiagnostics([
    ...configDiagnostics,
    ...extraction.diagnostics,
    ...exampleDiagnostics,
    ...contractDiagnostics,
  ]);
  const examples = Object.fromEntries(
    [...found.examples]
      .sort((a, b) => (`${a.component}/${a.name}` < `${b.component}/${b.name}` ? -1 : 1))
      .map((e) => [
        `example:${e.component}/${e.name}`,
        {
          component: `component:${e.component}`,
          name: e.name,
          file: e.file,
          ...(e.hasFixture ? { hasFixture: true } : {}),
          ...(e.previewRoles ? { previewRoles: e.previewRoles.map((role) => `role:${role}`) } : {}),
          ...(e.incorrect
            ? {
                incorrect: {
                  diagnostic: e.incorrect.diagnostic,
                  correct: `example:${e.component}/${e.incorrect.correct}`,
                },
              }
            : {}),
          ...(e.uses ? { uses: e.uses.map((tag) => `component:${tag}`) } : {}),
        },
      ]),
  );
  const { diagnostics: metadataDiagnostics, ...metadata } = buildMetadata(
    { ...extraction, diagnostics },
    paths,
    library,
    ANALYZER_VERSION,
  );
  const components = Object.fromEntries(
    Object.entries((metadata['components'] ?? {}) as Record<string, Record<string, unknown>>).map(
      ([id, component]) => [
        id,
        {
          ...component,
          contracts: [
            ...ELEMENT_CONTRACTS,
            ...(component['definition'] ? [COMPOSITION_CONTRACT] : []),
          ],
        },
      ],
    ),
  );
  const contracts = Object.fromEntries(
    referenced.flatMap((id) => {
      const entry = coreContracts?.contracts[id];
      return entry ? [[id, { package: '@oddkin/core', file: 'CONTRACTS.md', ...entry }]] : [];
    }),
  );
  return {
    manifest: buildManifest(extraction, paths),
    metadata: {
      ...metadata,
      ...(referenced.length ? { components, contracts } : {}),
      ...(options.tokens
        ? { foundations: foundationsFrom(options.tokens.inspection, options.tokens.source) }
        : {}),
      ...(found.examples.length ? { examples } : {}),
      diagnostics: metadataDiagnostics,
    },
    diagnostics,
    extraction,
    examples: found.examples,
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
export { attachVerification } from './verification.js';
export type { ResultRecord, VerificationInputs, VerificationReport } from './verification.js';
