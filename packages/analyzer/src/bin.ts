#!/usr/bin/env node
/**
 * oddkin-analyze <tsconfig> [--out dir] [--name n --version v] [--strict] [--json]
 * Exit codes: 0 success, 1 errors (or warnings with --strict), 2 usage error.
 */
import { parseArgs } from 'node:util';
import { analyze, writeOutputs } from './index.js';

const USAGE =
  'Usage: oddkin-analyze <tsconfig.json> [--out <dir>] [--name <library> --version <version>] [--strict] [--json]';

let parsed;
try {
  parsed = parseArgs({
    allowPositionals: true,
    options: {
      out: { type: 'string', default: '.' },
      name: { type: 'string' },
      version: { type: 'string' },
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
if (!project || (values.name === undefined) !== (values.version === undefined)) {
  console.error(USAGE);
  process.exit(2);
}

const result = analyze({
  project,
  ...(values.name && values.version
    ? { library: { name: values.name, version: values.version } }
    : {}),
});
const files = await writeOutputs(result, values.out);
if (values.json) console.log(JSON.stringify(result.diagnostics, null, 2));
else {
  for (const d of result.diagnostics) {
    const at = d.source ? ` ${d.source.file}:${d.source.line}:${d.source.column}` : '';
    console.error(
      `${d.severity} ${d.code}${at}: ${d.message}${d.suggestion ? `\n  → ${d.suggestion}` : ''}`,
    );
  }
  for (const file of files) console.log(`wrote ${file}`);
}
process.exitCode = result.diagnostics.some(
  (d) => d.severity === 'error' || (values.strict && d.severity === 'warning'),
)
  ? 1
  : 0;
