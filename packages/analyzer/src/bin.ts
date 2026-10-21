#!/usr/bin/env node
/**
 * oddkin-analyze <tsconfig> [--out dir] [--name n --version v] [--no-history] [--strict] [--json]
 * Exit codes: 0 success, 1 errors (or warnings with --strict), 2 usage error.
 */
import { dirname, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { analyze, gitHistory, writeOutputs } from './index.js';

const USAGE =
  'Usage: oddkin-analyze <tsconfig.json> [--out <dir>] [--name <library> --version <version>] [--no-history] [--strict] [--json]\n' +
  '  Updated dates come from git history unless --no-history; without full history (no git, a shallow clone) pages carry only authored @updated dates.';

let parsed;
try {
  parsed = parseArgs({
    allowPositionals: true,
    allowNegative: true,
    options: {
      out: { type: 'string', default: '.' },
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
if (!project || (values.name === undefined) !== (values.version === undefined)) {
  console.error(USAGE);
  process.exit(2);
}

const history = values.history ? gitHistory(dirname(resolve(project))) : undefined;
const result = analyze({
  project,
  ...(values.name && values.version
    ? { library: { name: values.name, version: values.version } }
    : {}),
  ...(history ? { history } : {}),
});
const files = await writeOutputs(result, values.out);
if (values.json) console.log(JSON.stringify(result.diagnostics, null, 2));
else {
  if (values.history && !history)
    console.error(
      'note: no full git history (no repository, or a shallow clone); pages carry only authored @updated dates.',
    );
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
