#!/usr/bin/env node
/**
 * oddkin-analyze <tsconfig> [--out dir] [--name n --version v] [--no-history] [--strict] [--json]
 * oddkin-analyze --manifest <custom-elements.json> [--out dir] [--name n --version v] [--strict] [--json]
 * Exit codes: 0 success, 1 errors (or warnings with --strict), 2 usage error.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import {
  analyze,
  analyzeManifest,
  gitHistory,
  stableJson,
  writeOutputs,
  type AnalyzerDiagnostic,
} from './index.js';

const USAGE =
  'Usage: oddkin-analyze <tsconfig.json> [--out <dir>] [--name <library> --version <version>] [--no-history] [--strict] [--json]\n' +
  '       oddkin-analyze --manifest <custom-elements.json> [--out <dir>] [--name <library> --version <version>] [--strict] [--json]\n' +
  '  Updated dates come from git history unless --no-history; without full history (no git, a shallow clone) pages carry only authored @updated dates.\n' +
  '  --manifest: a library not built with Oddkin. Its examples are read against its own manifest, and only oddkin.metadata.json is written.';

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
if (values.manifest) {
  let result;
  try {
    result = analyzeManifest({ manifest: values.manifest, ...library });
  } catch (error) {
    console.error(`${error instanceof Error ? error.message : String(error)}\n${USAGE}`);
    process.exit(2);
  }
  await mkdir(values.out, { recursive: true });
  const file = join(values.out, 'oddkin.metadata.json');
  await writeFile(file, stableJson(result.metadata));
  diagnostics = result.diagnostics;
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
  if (values.history && !history && !values.json)
    console.error(
      'note: no full git history (no repository, or a shallow clone); pages carry only authored @updated dates.',
    );
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
