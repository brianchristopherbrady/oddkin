/**
 * oddkin-tokens — init | build | check.
 * Exit codes: 0 success, 1 diagnostics (errors, or warnings with --strict), 2 usage error.
 */
import { access, writeFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import {
  buildTheme,
  formatDiagnostics,
  loadConfig,
  OUTPUT_FORMATS,
  STARTER_CONFIG,
  type OutputFormat,
} from './index.js';
import { generate, isLayerName, type Diagnostic } from '../generate/index.js';

const USAGE = `Usage:
  oddkin-tokens init [file]                 Write a starter oddkin.theme.json (never overwrites)
  oddkin-tokens build <config> [options]    Validate and write outputs
  oddkin-tokens check <config> [options]    Validate only

Options:
  --out <dir>          Output directory for build (default: tokens)
  --format <list>      Comma-separated: ${OUTPUT_FORMATS.join(', ')} (default: all)
  --css-layer <name>   Cascade layer for the CSS (default: odd.tokens; "none" for unlayered)
  --strict             Treat warnings as errors
  --json               Print diagnostics as JSON
  -h, --help           Show this help`;

interface Io {
  readonly out: (text: string) => void;
  readonly err: (text: string) => void;
}

const stdio: Io = {
  out: (text) => process.stdout.write(`${text}\n`),
  err: (text) => process.stderr.write(`${text}\n`),
};

function report(diagnostics: readonly Diagnostic[], json: boolean, io: Io): void {
  if (json) io.out(JSON.stringify(diagnostics, null, 2));
  else if (diagnostics.length) io.err(formatDiagnostics(diagnostics));
}

function failed(diagnostics: readonly Diagnostic[], strict: boolean): boolean {
  return diagnostics.some((d) => d.severity === 'error' || (strict && d.severity === 'warning'));
}

/** Run the CLI with arguments (without `node` and the script path). Returns the exit code. */
export async function run(argv: readonly string[], io: Io = stdio): Promise<number> {
  let parsed;
  try {
    parsed = parseArgs({
      args: [...argv],
      allowPositionals: true,
      options: {
        out: { type: 'string', default: 'tokens' },
        format: { type: 'string' },
        'css-layer': { type: 'string' },
        strict: { type: 'boolean', default: false },
        json: { type: 'boolean', default: false },
        help: { type: 'boolean', short: 'h', default: false },
      },
    });
  } catch (error) {
    io.err(`${error instanceof Error ? error.message : String(error)}\n\n${USAGE}`);
    return 2;
  }
  const { values, positionals } = parsed;
  const [command, target] = positionals;
  if (values.help || !command) {
    (values.help ? io.out : io.err)(USAGE);
    return values.help ? 0 : 2;
  }

  if (command === 'init') {
    const file = target ?? 'oddkin.theme.json';
    try {
      await access(file);
      io.err(`${file} already exists; not overwriting.`);
      return 1;
    } catch {
      await writeFile(file, STARTER_CONFIG);
      io.out(`Wrote ${file}. Next: oddkin-tokens build ${file} --out tokens`);
      return 0;
    }
  }

  if (command !== 'build' && command !== 'check') {
    io.err(`Unknown command "${command}".\n\n${USAGE}`);
    return 2;
  }
  if (!target) {
    io.err(`${command} needs a configuration file.\n\n${USAGE}`);
    return 2;
  }
  const formats = values.format?.split(',').map((f) => f.trim()) ?? [...OUTPUT_FORMATS];
  const unknown = formats.filter((f) => !OUTPUT_FORMATS.includes(f as OutputFormat));
  if (unknown.length) {
    io.err(`Unknown format(s): ${unknown.join(', ')}. Use ${OUTPUT_FORMATS.join(', ')}.`);
    return 2;
  }
  const layerOption = values['css-layer'];
  if (layerOption !== undefined && layerOption !== 'none' && !isLayerName(layerOption)) {
    io.err(`--css-layer "${layerOption}" is not a cascade layer name (e.g. odd.tokens) or none.`);
    return 2;
  }
  const cssLayer =
    layerOption === undefined ? undefined : layerOption === 'none' ? false : layerOption;

  const loaded = await loadConfig(target);
  if (loaded.diagnostics.length) {
    report(loaded.diagnostics, values.json, io);
    return 1;
  }

  if (command === 'check') {
    const { diagnostics } = generate(loaded.config);
    report(diagnostics, values.json, io);
    const bad = failed(diagnostics, values.strict);
    if (!bad && !values.json)
      io.out(
        `${target}: valid${diagnostics.length ? ` with ${diagnostics.length} warning(s)` : ''}.`,
      );
    return bad ? 1 : 0;
  }

  const { result, files } = await buildTheme(loaded.config, {
    outDir: values.out,
    formats: formats as OutputFormat[],
    ...(cssLayer === undefined ? {} : { cssLayer }),
  });
  report(result.diagnostics, values.json, io);
  if (failed(result.diagnostics, values.strict)) return 1;
  if (!values.json) for (const file of files) io.out(`wrote ${file}`);
  return 0;
}
