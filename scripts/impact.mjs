// Change impact for this repository (change-impact-and-verification.md §2), local only:
//
//   node scripts/impact.mjs snapshot [--out .oddkin/impact/snapshot.json]
//       Snapshot the built packages (run `npm run build` first) with the default theme.
//   node scripts/impact.mjs compare <base.json> [<head.json>] [--run]
//       Compare with the current build (or <head.json>); with --run, execute the selected checks
//       in Chromium, Firefox, and WebKit through Vitest and merge their results into the report.
//
// Reports are written to .oddkin/impact/report.json and report.md. Exit code 1 when a merged
// check failed. Uses the `oddkin-impact` binary from @oddkin/analyzer.
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { emitInspectJson, generate } from '../packages/tokens/dist/generate/index.js';

const DIR = '.oddkin/impact';
const BIN = 'packages/analyzer/dist/impact-bin.js';
const PACKAGES = ['packages/components', 'packages/ai'];
const THEME = 'packages/tokens/themes/default.theme.json';

const fail = (message) => {
  console.error(message);
  process.exit(2);
};
const version = (dir) => JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8')).version;
const cli = (args) => {
  const result = spawnSync(process.execPath, [BIN, ...args], { encoding: 'utf8' });
  if (result.status === 2) fail(result.stderr || result.stdout);
  return result;
};

function snapshot(out) {
  if (!existsSync(BIN)) fail('Build first: npm run build');
  mkdirSync(DIR, { recursive: true });
  const config = JSON.parse(readFileSync(THEME, 'utf8'));
  const result = generate(config);
  if (!result.ok) fail(JSON.stringify(result.diagnostics));
  const inspection = join(DIR, 'default.inspect.json');
  writeFileSync(inspection, emitInspectJson(result.theme, result.diagnostics));
  const suite = readFileSync('packages/workbench/src/conformance/button.ts', 'utf8');
  const suiteVersion = /version: '([^']+)'/.exec(suite)?.[1] ?? '0.0.0';
  const run = cli([
    'snapshot',
    ...PACKAGES,
    '--theme',
    THEME,
    '--inspection',
    inspection,
    '--suite',
    `oddkin.button@${suiteVersion}:odd-button`,
    '--tool',
    `analyzer=${version('packages/analyzer')}`,
    '--tool',
    `tokens=${version('packages/tokens')}`,
    '--tool',
    `core=${version('packages/core')}`,
    '--out',
    out,
  ]);
  console.log(run.stdout.trim());
}

const [command, ...rest] = process.argv.slice(2);
const flag = (name) => rest.includes(name);
const option = (name) => {
  const at = rest.indexOf(name);
  return at >= 0 ? rest[at + 1] : undefined;
};
const positionals = rest.filter(
  (arg, i) => !arg.startsWith('--') && !rest[i - 1]?.startsWith('--out'),
);

if (command === 'snapshot') {
  snapshot(option('--out') ?? join(DIR, 'snapshot.json'));
} else if (command === 'compare') {
  const [base, given] = positionals;
  if (!base) fail('Usage: node scripts/impact.mjs compare <base.json> [<head.json>] [--run]');
  const head = given ?? join(DIR, 'head.json');
  if (!given) snapshot(head);
  const report = join(DIR, 'report.json');
  const markdown = join(DIR, 'report.md');
  let result = cli(['compare', base, head, '--json', report, '--markdown', markdown]);
  if (flag('--run')) {
    const selected = JSON.parse(readFileSync(report, 'utf8')).checks.filter(
      (c) => c.state === 'selected',
    );
    const results = join(DIR, 'results');
    rmSync(results, { recursive: true, force: true });
    const selection = join(DIR, 'selection.json');
    writeFileSync(
      selection,
      `${JSON.stringify({ checks: selected.map(({ id, product }) => ({ id, ...(product ? { product } : {}) })) }, null, 2)}\n`,
    );
    try {
      if (selected.length) {
        const run = spawnSync(
          'npx',
          ['vitest', 'run', '--project', 'browser', 'tests/impact/selected.browser.test.ts'],
          { stdio: 'inherit', shell: process.platform === 'win32' },
        );
        if (run.status !== 0) console.error(`Vitest exited with ${run.status}; merging what ran.`);
      }
    } finally {
      rmSync(selection, { force: true });
    }
    const files = existsSync(results)
      ? readdirSync(results).map((file) => join(results, file))
      : [];
    result = cli([
      'compare',
      base,
      head,
      ...files.flatMap((file) => ['--results', file]),
      '--json',
      report,
      '--markdown',
      markdown,
    ]);
  }
  console.log(result.stdout);
  console.log(`Report: ${report}, ${markdown}`);
  process.exitCode = result.status ?? 0;
} else {
  fail(
    'Usage: node scripts/impact.mjs snapshot [--out <file>] | compare <base.json> [<head.json>] [--run]',
  );
}
