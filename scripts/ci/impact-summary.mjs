#!/usr/bin/env node
// CI: the change impact of this push or pull request against its base (IMPLEMENTATION_PLAN.md
// CF.2; change-impact-and-verification.md §2.7), in the job summary and the evidence artifact.
//   IMPACT_BASE=<commit> node scripts/ci/impact-summary.mjs --out <dir>
// Writes <dir>/status.json, and report.json and report.md when the comparison ran. Exits 1 only
// when the comparison itself failed; a push without a usable base is recorded, not failed.
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { appendFile, copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const args = process.argv.slice(2);
const at = args.indexOf('--out');
if (at < 0 || !args[at + 1]) {
  console.error('Usage: IMPACT_BASE=<commit> node scripts/ci/impact-summary.mjs --out <dir>');
  process.exit(2);
}
const out = resolve(args[at + 1]);
const base = process.env['IMPACT_BASE']?.trim() ?? '';
const head = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
// GitHub keeps 1 MiB of summary per step: a longer report is cut there and kept whole in <dir>.
const SUMMARY_LIMIT = 900_000;

async function finish(status, markdown, code) {
  await mkdir(out, { recursive: true });
  await writeFile(join(out, 'status.json'), `${JSON.stringify(status, null, 2)}\n`);
  const summary = process.env['GITHUB_STEP_SUMMARY'];
  if (summary) await appendFile(summary, `## Change impact\n\n${markdown}\n`);
  console.log(markdown);
  process.exit(code);
}

// A new branch's first push has no `before` (all zeros), and a pull request always has a base.
if (!/^[0-9a-f]{40}$/.test(base) || /^0+$/.test(base))
  await finish(
    { state: 'unavailable', base: base || null, head, reason: 'no base revision to compare with' },
    'No base revision to compare with (a new branch, or its first push).',
    0,
  );
if (spawnSync('git', ['cat-file', '-e', `${base}^{commit}`], { cwd: root }).status !== 0)
  await finish(
    { state: 'unavailable', base, head, reason: 'the base commit is not in this clone' },
    `The base commit \`${base.slice(0, 12)}\` is not in this clone (a force push?).`,
    0,
  );

const result = spawnSync(
  process.execPath,
  [join(root, 'scripts', 'impact.mjs'), 'compare', '--base-ref', base],
  { cwd: root, stdio: 'inherit' },
);
const report = join(root, '.oddkin', 'impact', 'report.json');
const markdownReport = join(root, '.oddkin', 'impact', 'report.md');
if (result.status !== 0 || !existsSync(report) || !existsSync(markdownReport))
  await finish(
    {
      state: 'failed',
      base,
      head,
      reason: `scripts/impact.mjs exited with ${result.status ?? result.signal}`,
    },
    `The comparison with \`${base.slice(0, 12)}\` failed (scripts/impact.mjs exited with ${result.status ?? result.signal}); see this step's log.`,
    1,
  );

await mkdir(out, { recursive: true });
await copyFile(report, join(out, 'report.json'));
await copyFile(markdownReport, join(out, 'report.md'));
let markdown = (await readFile(markdownReport, 'utf8')).replace(/^# [^\n]*\n+/, '');
if (markdown.length > SUMMARY_LIMIT)
  markdown = `${markdown.slice(0, SUMMARY_LIMIT)}\n\n(Cut here; the whole report is in the release-evidence artifact.)`;
await finish(
  { state: 'written', base, head },
  `Against \`${base.slice(0, 12)}\`, without running the selected checks (CI runs every check):\n\n${markdown}`,
  0,
);
