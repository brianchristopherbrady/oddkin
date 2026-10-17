/**
 * `@mote/tokens/node` — file I/O around the pure generator: config loading and writing
 * outputs. Node only. The generator itself is `@mote/tokens/generate`.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { extname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  emitConditionsModule,
  emitInspectJson,
  emitRefsModule,
  emitValuesModule,
  generate,
  type Diagnostic,
  type GenerateResult,
} from '../generate/index.js';

export type OutputFormat = 'css' | 'ts' | 'json';
export const OUTPUT_FORMATS: readonly OutputFormat[] = ['css', 'ts', 'json'];

export interface LoadResult {
  readonly config: unknown;
  readonly diagnostics: readonly Diagnostic[];
}

const loadError = (path: string, message: string, suggestion?: string): LoadResult => ({
  config: undefined,
  diagnostics: [
    suggestion
      ? {
          code: 'config.load',
          severity: 'error',
          path: '',
          message: `${path}: ${message}`,
          suggestion,
        }
      : { code: 'config.load', severity: 'error', path: '', message: `${path}: ${message}` },
  ],
});

/**
 * Load a configuration from `.json`, `.js`/`.mjs` (default export), or `.ts`/`.mts`.
 * TypeScript configs rely on Node's type stripping (erasable syntax only; no type
 * checking or path aliases) — type-check them separately or precompile to JS.
 * JS and TS configs are trusted code: loading them executes them.
 */
export async function loadConfig(file: string): Promise<LoadResult> {
  const path = resolve(file);
  const extension = extname(path);
  try {
    if (extension === '.json')
      return { config: JSON.parse(await readFile(path, 'utf8')) as unknown, diagnostics: [] };
    if (['.js', '.mjs', '.ts', '.mts'].includes(extension)) {
      const module = (await import(pathToFileURL(path).href)) as { default?: unknown };
      if (module.default === undefined)
        return loadError(
          file,
          'has no default export.',
          'Export the configuration: export default defineTheme({ … }).',
        );
      return { config: module.default, diagnostics: [] };
    }
    return loadError(
      file,
      `unsupported extension "${extension}".`,
      'Use .json, .js, .mjs, .ts, or .mts.',
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const hint = ['.ts', '.mts'].includes(extension)
      ? 'TypeScript configs need Node with type stripping (Node 24.12 or later) and erasable syntax only; otherwise precompile to .js.'
      : undefined;
    return loadError(file, message, hint);
  }
}

export interface BuildOptions {
  readonly outDir: string;
  readonly formats?: readonly OutputFormat[];
}

export interface BuildResult {
  readonly result: GenerateResult;
  /** Paths written, in a stable order. Empty when generation failed. */
  readonly files: readonly string[];
}

/** Generate and write outputs: `<name>.css`, `<name>.refs.ts`, `<name>.values.ts`, `<name>.inspect.json`. */
export async function buildTheme(config: unknown, options: BuildOptions): Promise<BuildResult> {
  const result = generate(config);
  if (!result.ok || !result.theme || result.css === undefined) return { result, files: [] };
  const formats = options.formats ?? OUTPUT_FORMATS;
  const name = result.theme.name;
  const outputs: Array<[string, string]> = [];
  if (formats.includes('css')) outputs.push([`${name}.css`, result.css]);
  if (formats.includes('ts'))
    outputs.push(
      [`${name}.refs.ts`, emitRefsModule(result.theme)],
      [`${name}.values.ts`, emitValuesModule(result.theme)],
      [`${name}.conditions.ts`, emitConditionsModule(result.theme)],
    );
  if (formats.includes('json'))
    outputs.push([`${name}.inspect.json`, emitInspectJson(result.theme, result.diagnostics)]);
  await mkdir(options.outDir, { recursive: true });
  const files: string[] = [];
  for (const [file, text] of outputs) {
    const path = join(options.outDir, file);
    await writeFile(path, text);
    files.push(path);
  }
  return { result, files };
}

/** Readable diagnostics, one per line, with suggestions indented. */
export function formatDiagnostics(diagnostics: readonly Diagnostic[]): string {
  return diagnostics
    .map(
      (d) =>
        `${d.severity} ${d.code}${d.path ? ` ${d.path}` : ''}: ${d.message}${d.suggestion ? `\n  → ${d.suggestion}` : ''}`,
    )
    .join('\n');
}

export const STARTER_CONFIG = `{
  "$schema": "./node_modules/@mote/tokens/schema/theme-config.v1.schema.json",
  "name": "default",
  "brand": { "primary": "#5b46e8" }
}
`;
