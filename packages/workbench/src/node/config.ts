/**
 * Load `oddkin.config.*` and authored content files. JS and TS files are trusted project code:
 * loading them executes them. TypeScript relies on Node's type stripping (erasable syntax only).
 */
import { existsSync, statSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { dirname, extname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { resolveWorkbenchConfig, type ResolvedWorkbenchConfig } from '../config/index.js';
import { DiagnosticList, type WorkbenchDiagnostic } from '../internal/diagnostics.js';

export const CONFIG_FILES = [
  'oddkin.config.ts',
  'oddkin.config.mts',
  'oddkin.config.js',
  'oddkin.config.mjs',
  'oddkin.config.json',
] as const;

const MODULES = new Set(['.ts', '.mts', '.js', '.mjs']);
let reloads = 0;

/**
 * A module's default export, or a JSON file's value. Modules are imported under a fresh URL each
 * time, so an edited file is read again (modules it imports are not reloaded).
 */
export async function loadDefault(file: string): Promise<unknown> {
  const extension = extname(file);
  if (extension === '.json') return JSON.parse(await readFile(file, 'utf8')) as unknown;
  if (!MODULES.has(extension))
    throw new Error(`unsupported extension "${extension}"; use .ts, .mts, .js, .mjs, or .json.`);
  const url = `${pathToFileURL(file).href}?oddkin=${++reloads}`;
  const module = (await import(url)) as { default?: unknown };
  if (module.default === undefined) throw new Error('has no default export.');
  return module.default;
}

/** Why loading failed, with a hint for TypeScript files. */
export function loadFailure(file: string, error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  const hint = ['.ts', '.mts'].includes(extname(file))
    ? ' TypeScript files need Node 24.12 or later with erasable syntax only; otherwise compile them to .js.'
    : '';
  return `${file}: ${message}${hint}`;
}

export interface LoadedConfig {
  /** The configuration file, when one was found. */
  readonly file: string | undefined;
  /** The project root: the configuration file's directory. */
  readonly root: string;
  /** The resolved configuration; undefined when it is missing or invalid. */
  readonly config: ResolvedWorkbenchConfig | undefined;
  readonly diagnostics: WorkbenchDiagnostic[];
}

/** Find and load the configuration from a file, or from the first `CONFIG_FILES` entry in a directory. */
export async function loadWorkbenchConfig(target = '.'): Promise<LoadedConfig> {
  const out = new DiagnosticList();
  const path = resolve(target);
  let file: string | undefined = path;
  if (existsSync(path) && statSync(path).isDirectory()) {
    file = CONFIG_FILES.map((name) => join(path, name)).find((candidate) => existsSync(candidate));
    if (!file) {
      out.error(
        'node.config.missing',
        `No Workbench configuration in ${path} (looked for ${CONFIG_FILES.join(', ')}).`,
      );
      return { file: undefined, root: path, config: undefined, diagnostics: out.items };
    }
  } else if (!existsSync(path)) {
    out.error('node.config.missing', `${path} does not exist.`);
    return { file: undefined, root: dirname(path), config: undefined, diagnostics: out.items };
  }
  const root = dirname(file);
  let raw: unknown;
  try {
    raw = await loadDefault(file);
  } catch (error) {
    out.error('node.config.load', loadFailure(file, error));
    return { file, root, config: undefined, diagnostics: out.items };
  }
  const { config, diagnostics } = resolveWorkbenchConfig(raw);
  return { file, root, config, diagnostics: [...out.items, ...diagnostics] };
}
