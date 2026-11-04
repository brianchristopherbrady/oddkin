#!/usr/bin/env node
/**
 * oddkin-analyze <tsconfig> [--out dir] [--name n --version v] [--no-history] [--composition] [--strict] [--json]
 * oddkin-analyze --manifest <custom-elements.json> [--out dir] [--name n --version v] [--composition] [--strict] [--json]
 * Exit codes: 0 success, 1 errors (or warnings with --strict), 2 usage error.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import {
  analyze,
  analyzeManifest,
  compositionFiles,
  gitHistory,
  stableJson,
  writeOutputs,
  type AnalyzerDiagnostic,
} from './index.js';

const USAGE =
  'Usage: oddkin-analyze <tsconfig.json> [--out <dir>] [--name <library> --version <version>] [--no-history] [--composition] [--strict] [--json]\n' +
  '       oddkin-analyze --manifest <custom-elements.json> [--out <dir>] [--name <library> --version <version>] [--composition] [--strict] [--json]\n' +
  '  Updated dates come from git history unless --no-history; without full history (no git, a shallow clone) pages carry only authored @updated dates.\n' +
  '  --manifest: a library not built with Oddkin. Its examples are read against its own manifest, and only oddkin.metadata.json is written (with --composition, also the catalog and schemas).\n' +
  "  --composition: also write the composition catalog (oddkin.composition.json) and its JSON Schemas (schemas/composition/), so composition documents can use the library's elements.";

let parsed;
try {
  parsed = parseArgs({
    allowPositionals: true,
    allowNegative: true,
    options: {
      out: { type: 'string', default: '.' },
      manifest: { type: 'string' },
      name: { type: 'string' },
      version: { type: 'string' },
      history: { type: 'boolean', default: true },
      composition: { type: 'boolean', default: false },
      strict: { type: 'boolean', default: false },
      json: { type: 'boolean', default: false },
      help: { type: 'boolean', short: 'h', default: false },
    },
  });
} catch (error) {
  console.error(`${error instanceof Error ? error.message : String(error)}\n${USAGE}`);
  process.exit(2);
}
const { values, positionals } = parsed;
if (values.help) {
  console.log(USAGE);
  process.exit(0);
}
const [project] = positionals;
if (
  !project === !values.manifest ||
  positionals.length > 1 ||
  (values.name === undefined) !== (values.version === undefined)
) {
  console.error(USAGE);
  process.exit(2);
}
const library =
  values.name && values.version ? { library: { name: values.name, version: values.version } } : {};

let diagnostics: readonly AnalyzerDiagnostic[];
let files: string[];
let manifest: unknown;
let metadata: Record<string, unknown>;
if (values.manifest) {
  let result;
  try {
    result = analyzeManifest({ manifest: values.manifest, ...library });
    manifest = JSON.parse(await readFile(values.manifest, 'utf8')) as unknown;
  } catch (error) {
    console.error(`${error instanceof Error ? error.message : String(error)}\n${USAGE}`);
    process.exit(2);
  }
  await mkdir(values.out, { recursive: true });
  const file = join(values.out, 'oddkin.metadata.json');
  await writeFile(file, stableJson(result.metadata));
  diagnostics = result.diagnostics;
  metadata = result.metadata;
  files = [file];
} else {
  const history = values.history ? gitHistory(dirname(resolve(project as string))) : undefined;
  const result = analyze({
    project: project as string,
    ...library,
    ...(history ? { history } : {}),
  });
  files = await writeOutputs(result, values.out);
  diagnostics = result.diagnostics;
  manifest = result.manifest;
  metadata = result.metadata;
  if (values.history && !history && !values.json)
    console.error(
      'note: no full git history (no repository, or a shallow clone); pages carry only authored @updated dates.',
    );
}
if (values.composition) {
  const name = (metadata['library'] as { name?: unknown } | undefined)?.name;
  const composition = compositionFiles(manifest, {
    ...(typeof name === 'string' ? { title: `${name} composition` } : {}),
  });
  for (const [path, text] of composition.files) {
    const file = join(values.out, ...path.split('/'));
    await mkdir(dirname(file), { recursive: true });
    await writeFile(file, text);
    files.push(file);
  }
  diagnostics = [...diagnostics, ...composition.diagnostics];
}
if (values.json) console.log(JSON.stringify(diagnostics, null, 2));
else {
  for (const d of diagnostics) {
    const at = d.source ? ` ${d.source.file}:${d.source.line}:${d.source.column}` : '';
    console.error(
      `${d.severity} ${d.code}${at}: ${d.message}${d.suggestion ? `\n  → ${d.suggestion}` : ''}`,
    );
  }
  for (const file of files) console.log(`wrote ${file}`);
}
process.exitCode = diagnostics.some(
  (d) => d.severity === 'error' || (values.strict && d.severity === 'warning'),
)
  ? 1
  : 0;
