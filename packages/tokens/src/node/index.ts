/**
 * `@oddkin/tokens/node` — file I/O around the pure generator: config loading and writing
 * outputs. Node only. The generator itself is `@oddkin/tokens/generate`.
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

const NOT_JSON_SUGGESTION =
  'The CLI and Theme Studio generate from the same JSON model: compute values in the module, but export plain objects, arrays, strings, finite numbers, booleans, and null.';

/**
 * Copy a configuration into its JSON-compatible model (what `JSON.parse(JSON.stringify(value))`
 * gives), reporting each value JSON would drop or change instead of changing it silently.
 */
function jsonModel(
  value: unknown,
  path: string,
  file: string,
  ancestors: object[],
  diagnostics: Diagnostic[],
): unknown {
  const reject = (what: string, where = path): undefined => {
    diagnostics.push({
      code: 'config.notJson',
      severity: 'error',
      path: where,
      message: `${file}: ${what} is not JSON data.`,
      suggestion: NOT_JSON_SUGGESTION,
    });
    return undefined;
  };
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  // `+ 0` turns -0 into 0, as JSON does.
  if (typeof value === 'number')
    return Number.isFinite(value) ? value + 0 : reject(`The number ${value}`);
  if (typeof value !== 'object') return reject(`A value of type ${typeof value}`);
  if (ancestors.includes(value)) return reject('A reference back to an enclosing value (a cycle)');
  const inner = [...ancestors, value];
  const at = (key: string | number) =>
    `${path}/${String(key).replace(/~/g, '~0').replace(/\//g, '~1')}`;
  if (Array.isArray(value)) {
    return Array.from({ length: value.length }, (_, i) =>
      i in value
        ? jsonModel(value[i], at(i), file, inner, diagnostics)
        : reject('An empty array slot', at(i)),
    );
  }
  const prototype = Object.getPrototypeOf(value) as object | null;
  if (prototype !== Object.prototype && prototype !== null) {
    const name = (prototype as { constructor?: { name?: unknown } }).constructor?.name;
    return reject(`A ${typeof name === 'string' && name ? name : 'non-plain'} object`);
  }
  const entries: Array<[string, unknown]> = [];
  for (const key of Object.keys(value)) {
    const child = (value as Record<string, unknown>)[key];
    if (child !== undefined)
      entries.push([key, jsonModel(child, at(key), file, inner, diagnostics)]);
  }
  // `fromEntries` defines own properties, so a `__proto__` key stays data, as in JSON.parse.
  return Object.fromEntries(entries);
}

/**
 * Load a configuration from `.json`, `.js`/`.mjs` (default export), or `.ts`/`.mts`, as its
 * JSON-compatible model: a plain-data copy, or `config.notJson` errors with the path of each value
 * JSON cannot represent (functions, class instances, non-finite numbers, cycles, …).
 * TypeScript configs rely on Node's type stripping (erasable syntax only; no type
 * checking or path aliases) — type-check them separately or precompile to JS.
 * JS and TS configs are trusted code: loading them executes them.
 */
export async function loadConfig(file: string): Promise<LoadResult> {
  const path = resolve(file);
  const extension = extname(path);
  try {
    let config: unknown;
    if (extension === '.json') config = JSON.parse(await readFile(path, 'utf8')) as unknown;
    else if (['.js', '.mjs', '.ts', '.mts'].includes(extension)) {
      const module = (await import(pathToFileURL(path).href)) as { default?: unknown };
      if (module.default === undefined)
        return loadError(
          file,
          'has no default export.',
          'Export the configuration: export default defineTheme({ … }).',
        );
      config = module.default;
    } else
      return loadError(
        file,
        `unsupported extension "${extension}".`,
        'Use .json, .js, .mjs, .ts, or .mts.',
      );
    const diagnostics: Diagnostic[] = [];
    const model = jsonModel(config, '', file, [], diagnostics);
    return diagnostics.length ? { config: undefined, diagnostics } : { config: model, diagnostics };
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
  /** CSS cascade layer (default `odd.tokens`); `false` writes unlayered CSS. */
  readonly cssLayer?: string | false;
}

export interface BuildResult {
  readonly result: GenerateResult;
  /** Paths written, in a stable order. Empty when generation failed. */
  readonly files: readonly string[];
}

/** Generate and write outputs: `<name>.css`, `<name>.refs.ts`, `<name>.values.ts`, `<name>.inspect.json`. */
export async function buildTheme(config: unknown, options: BuildOptions): Promise<BuildResult> {
  const result = generate(
    config,
    options.cssLayer === undefined ? {} : { css: { layer: options.cssLayer } },
  );
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
  "$schema": "./node_modules/@oddkin/tokens/schema/theme-config.v1.schema.json",
  "name": "default",
  "brand": { "primary": "#5b46e8" }
}
`;
