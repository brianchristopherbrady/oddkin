#!/usr/bin/env node
// The release evidence bundle (release-evidence.v0; RELEASE_FOUNDATION_IMPLEMENTATION_PLAN.md
// RF-09, RF-10): what this checkout would publish, with its hashes, and the checks that ran on it.
//   node scripts/release/evidence.mjs --out <dir> [--allow-dirty] [--ci]
// Writes <dir>/evidence.json and <dir>/EVIDENCE.md. A local run needs no network. Check results
// are read from <dir>/results (vitest-<run>.json, e2e.json) and <dir>/impact (status.json,
// report.json) when CI wrote them; --ci also reads this job's step times from the GitHub API.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { appendFile, mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { arch, platform, release } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const SCHEMA = 'release-evidence.v0';
const ROOT = resolve(fileURLToPath(new URL('../..', import.meta.url)));
// Hashed where a package ships them: the contracts and generated files a release vouches for.
const ARTIFACTS = [
  'custom-elements.json',
  'oddkin.metadata.json',
  'contracts.json',
  'agent/kit.json',
];

// npm through its CLI script and the current Node: no shell. Run directly (not from an npm
// script), npm_execpath is unset; Node installs npm beside itself (Windows) or under ../lib.
const npmCli = [
  process.env['npm_execpath'],
  join(dirname(process.execPath), 'node_modules', 'npm', 'bin', 'npm-cli.js'),
  join(dirname(process.execPath), '..', 'lib', 'node_modules', 'npm', 'bin', 'npm-cli.js'),
].find((path) => path?.endsWith('.js') && existsSync(path));
const run = (file, args, cwd) =>
  execFileSync(file, args, {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    maxBuffer: 256 * 1024 * 1024,
  });
const npm = (args, cwd) => {
  if (!npmCli) throw new Error('npm-cli.js was not found beside this Node binary.');
  return run(process.execPath, [npmCli, ...args], cwd);
};

/** The commit and whether the working tree differs from it (ignored files do not count). */
export function readSource(root = ROOT) {
  const commit = run('git', ['rev-parse', 'HEAD'], root).trim();
  const status = run('git', ['status', '--porcelain'], root);
  const changes = status.split('\n').filter((line) => line.trim()).length;
  return { commit, dirty: changes > 0, changes };
}

/** The publishable packages under packages/, by name. */
export async function listPackages(root = ROOT) {
  const packages = [];
  for (const entry of await readdir(join(root, 'packages'), { withFileTypes: true })) {
    const file = join(root, 'packages', entry.name, 'package.json');
    if (!entry.isDirectory() || !existsSync(file)) continue;
    const manifest = JSON.parse(await readFile(file, 'utf8'));
    if (manifest.private) continue;
    packages.push({
      name: manifest.name,
      version: manifest.version,
      directory: `packages/${entry.name}`,
    });
  }
  return packages.sort((a, b) => a.name.localeCompare(b.name));
}

/** `npm pack --dry-run --json` for the given workspace directories, in one npm run. */
export function packDryRun(directories, root = ROOT) {
  return JSON.parse(
    npm(['pack', '--dry-run', '--json', ...directories.map((dir) => `--workspace=${dir}`)], root),
  );
}

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const readJson = async (path) =>
  existsSync(path) ? JSON.parse(await readFile(path, 'utf8')) : undefined;
const tally = (items, key) => {
  const counts = {};
  for (const item of items) counts[item[key]] = (counts[item[key]] ?? 0) + 1;
  return counts;
};

/** Pass, fail, and skip counts per project from a Playwright JSON report. */
export function summarizePlaywright(report) {
  const projects = new Map();
  const visit = (suite) => {
    for (const spec of suite.specs ?? [])
      for (const test of spec.tests ?? []) {
        const counts = projects.get(test.projectName) ?? {
          passed: 0,
          failed: 0,
          flaky: 0,
          skipped: 0,
        };
        if (test.status === 'expected') counts.passed++;
        else if (test.status === 'unexpected') counts.failed++;
        else if (test.status === 'flaky') counts.flaky++;
        else counts.skipped++;
        projects.set(test.projectName, counts);
      }
    for (const child of suite.suites ?? []) visit(child);
  };
  for (const suite of report.suites ?? []) visit(suite);
  const stats = report.stats ?? {};
  return {
    passed: stats.expected ?? 0,
    failed: stats.unexpected ?? 0,
    flaky: stats.flaky ?? 0,
    skipped: stats.skipped ?? 0,
    seconds: Math.round((stats.duration ?? 0) / 1000),
    projects: [...projects]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([project, counts]) => ({ project, ...counts })),
  };
}

/**
 * The check results CI left in `dir`: `results/vitest-<run>.json` (Vitest's JSON reporter),
 * `results/e2e.json` (Playwright's), and `impact/status.json` with `impact/report.json`.
 */
export async function readResults(dir) {
  const tests = [];
  const resultsDir = join(dir, 'results');
  if (existsSync(resultsDir))
    for (const file of (await readdir(resultsDir)).sort()) {
      const match = /^vitest-(.+)\.json$/.exec(file);
      if (!match) continue;
      const report = JSON.parse(await readFile(join(resultsDir, file), 'utf8'));
      tests.push({
        run: match[1],
        total: report.numTotalTests ?? 0,
        passed: report.numPassedTests ?? 0,
        failed: report.numFailedTests ?? 0,
        skipped: (report.numPendingTests ?? 0) + (report.numTodoTests ?? 0),
        success: report.success === true,
      });
    }
  const e2eReport = await readJson(join(resultsDir, 'e2e.json'));
  const status = await readJson(join(dir, 'impact', 'status.json'));
  const report = status && (await readJson(join(dir, 'impact', 'report.json')));
  const impact = status && {
    ...status,
    ...(report && {
      changes: tally(report.changes ?? [], 'classification'),
      coverageGaps: (report.coverageGaps ?? []).length,
      checks: tally(report.checks ?? [], 'state'),
      fullVerification: report.fallback?.reasons ?? null,
    }),
  };
  return {
    tests,
    e2e: e2eReport ? summarizePlaywright(e2eReport) : null,
    impact: impact ?? null,
  };
}

/** This job's finished steps and their times, from the GitHub API (needs `actions: read`). */
export async function readSteps(env = process.env) {
  const repository = env['GITHUB_REPOSITORY'];
  const runId = env['GITHUB_RUN_ID'];
  const token = env['GITHUB_TOKEN'];
  if (!repository || !runId || !token)
    return { state: 'unavailable', reason: 'not a GitHub Actions run with a token' };
  const api = env['GITHUB_API_URL'] ?? 'https://api.github.com';
  const attempt = env['GITHUB_RUN_ATTEMPT'] ?? '1';
  try {
    const response = await fetch(
      `${api}/repos/${repository}/actions/runs/${runId}/attempts/${attempt}/jobs?per_page=100`,
      {
        headers: {
          accept: 'application/vnd.github+json',
          authorization: `Bearer ${token}`,
          'x-github-api-version': '2022-11-28',
        },
      },
    );
    if (!response.ok) return { state: 'unavailable', reason: `GitHub API HTTP ${response.status}` };
    const { jobs = [] } = await response.json();
    const job = jobs.find((candidate) => candidate.name === env['GITHUB_JOB']);
    if (!job) return { state: 'unavailable', reason: `job ${env['GITHUB_JOB']} not found` };
    return {
      state: 'read',
      job: job.name,
      steps: (job.steps ?? [])
        .filter((step) => step.started_at && step.completed_at)
        .map((step) => ({
          name: step.name,
          conclusion: step.conclusion,
          seconds: Math.round((Date.parse(step.completed_at) - Date.parse(step.started_at)) / 1000),
        })),
    };
  } catch (error) {
    return { state: 'unavailable', reason: `GitHub API request failed: ${error.name}` };
  }
}

/** Public CI facts only; nothing else is read from the environment. */
function ciRun(env) {
  if (env['GITHUB_ACTIONS'] !== 'true') return null;
  return {
    provider: 'github-actions',
    repository: env['GITHUB_REPOSITORY'] ?? null,
    workflow: env['GITHUB_WORKFLOW'] ?? null,
    event: env['GITHUB_EVENT_NAME'] ?? null,
    ref: env['GITHUB_REF'] ?? null,
    runId: env['GITHUB_RUN_ID'] ?? null,
    runAttempt: env['GITHUB_RUN_ATTEMPT'] ?? null,
    url:
      env['GITHUB_SERVER_URL'] && env['GITHUB_REPOSITORY'] && env['GITHUB_RUN_ID']
        ? `${env['GITHUB_SERVER_URL']}/${env['GITHUB_REPOSITORY']}/actions/runs/${env['GITHUB_RUN_ID']}`
        : null,
  };
}

/**
 * Collect the evidence for the checkout at `root`. A dirty working tree is refused unless
 * `allowDirty`; either way the evidence records it. `out` is where CI left its results.
 */
export async function collectEvidence({
  root = ROOT,
  out,
  allowDirty = false,
  ci = false,
  pack = packDryRun,
  env = process.env,
} = {}) {
  const source = readSource(root);
  if (source.dirty && !allowDirty)
    throw new Error(
      `The working tree has ${source.changes} uncommitted change(s): commit them, or pass --allow-dirty to record them in the evidence.`,
    );
  const listed = await listPackages(root);
  const packed = pack(
    listed.map((pkg) => pkg.directory),
    root,
  );
  const packages = listed.map(({ name, version, directory }) => {
    const entry = packed.find((candidate) => candidate.name === name);
    if (!entry) throw new Error(`npm pack reported nothing for ${name}.`);
    if (entry.version !== version)
      throw new Error(`npm pack reported ${name}@${entry.version}; its manifest says ${version}.`);
    return {
      name,
      version,
      directory,
      integrity: entry.integrity,
      shasum: entry.shasum,
      files: entry.entryCount,
      size: entry.size,
      unpackedSize: entry.unpackedSize,
    };
  });
  const artifacts = [];
  for (const { directory } of packages)
    for (const file of ARTIFACTS) {
      const path = join(root, directory, file);
      if (existsSync(path))
        artifacts.push({ path: `${directory}/${file}`, sha256: sha256(await readFile(path)) });
    }
  const results = out ? await readResults(out) : { tests: [], e2e: null, impact: null };
  const steps = ci ? await readSteps(env) : null;
  const recorded = results.tests.length > 0 || results.e2e || results.impact || steps;
  return {
    schema: SCHEMA,
    generatedAt: new Date().toISOString(),
    source,
    environment: {
      node: process.version,
      npm: npm(['--version'], root).trim(),
      os: `${platform()} ${release()} ${arch()}`,
      ci: ciRun(env),
    },
    packages,
    artifacts,
    checks: recorded
      ? { state: 'recorded', ...results, steps }
      : {
          state: 'not-run',
          reason: 'No check results were supplied; CI writes them beside the evidence.',
        },
  };
}

const bytes = (value) =>
  value >= 1024 * 1024
    ? `${(value / 1024 / 1024).toFixed(1)} MB`
    : `${Math.round(value / 1024).toLocaleString('en-US')} kB`;
const duration = (seconds) =>
  seconds >= 60 ? `${Math.floor(seconds / 60)} min ${seconds % 60} s` : `${seconds} s`;
const counts = (record) =>
  Object.entries(record)
    .map(([key, value]) => `${value} ${key}`)
    .join(', ') || 'none';

/** A readable summary of `evidence`, for EVIDENCE.md and a CI job summary. */
export function renderEvidenceMarkdown(evidence) {
  const { source, environment, checks } = evidence;
  const lines = [
    '# Release evidence',
    '',
    `Schema \`${evidence.schema}\`, generated ${evidence.generatedAt}. Full values are in evidence.json.`,
    '',
    `- Commit: \`${source.commit}\`, ${source.dirty ? `**dirty** (${source.changes} uncommitted change(s))` : 'clean'}`,
    `- Node ${environment.node}, npm ${environment.npm}, ${environment.os}`,
    environment.ci
      ? `- CI: ${environment.ci.url ?? environment.ci.provider} (${environment.ci.event}, ${environment.ci.ref})`
      : '- A local run',
    '',
    '## Packages',
    '',
    '| Package | Version | Files | Size | Unpacked | Integrity |',
    '| --- | --- | --- | --- | --- | --- |',
    ...evidence.packages.map(
      (pkg) =>
        `| ${pkg.name} | ${pkg.version} | ${pkg.files.toLocaleString('en-US')} | ${bytes(pkg.size)} | ${bytes(pkg.unpackedSize)} | \`${pkg.integrity.slice(0, 22)}…\` |`,
    ),
    '',
    '## Generated files',
    '',
    '| File | SHA-256 |',
    '| --- | --- |',
    ...evidence.artifacts.map((artifact) => `| ${artifact.path} | \`${artifact.sha256}\` |`),
    '',
    '## Checks',
    '',
  ];
  if (checks.state === 'not-run') {
    lines.push(`Not run: ${checks.reason}`, '');
    return `${lines.join('\n')}\n`;
  }
  if (checks.tests.length)
    lines.push(
      '| Vitest run | Passed | Failed | Skipped |',
      '| --- | --- | --- | --- |',
      ...checks.tests.map(
        (run) => `| ${run.run} | ${run.passed} | ${run.failed} | ${run.skipped} |`,
      ),
      '',
    );
  if (checks.e2e)
    lines.push(
      `Playwright, ${duration(checks.e2e.seconds)}:`,
      '',
      '| Project | Passed | Failed | Flaky | Skipped |',
      '| --- | --- | --- | --- | --- |',
      ...checks.e2e.projects.map(
        (project) =>
          `| ${project.project} | ${project.passed} | ${project.failed} | ${project.flaky} | ${project.skipped} |`,
      ),
      '',
    );
  if (checks.impact)
    lines.push(
      `Change impact: ${checks.impact.state}${checks.impact.base ? ` against \`${String(checks.impact.base).slice(0, 12)}\`` : ''}${checks.impact.reason ? ` (${checks.impact.reason})` : ''}.`,
      ...(checks.impact.changes
        ? [
            `Changes: ${counts(checks.impact.changes)}. Checks: ${counts(checks.impact.checks)}. Coverage gaps: ${checks.impact.coverageGaps}.`,
          ]
        : []),
      '',
    );
  if (checks.steps?.state === 'read')
    lines.push(
      `Steps of job \`${checks.steps.job}\` until this one:`,
      '',
      '| Step | Result | Time |',
      '| --- | --- | --- |',
      ...checks.steps.steps.map(
        (step) => `| ${step.name} | ${step.conclusion} | ${duration(step.seconds)} |`,
      ),
      '',
    );
  else if (checks.steps) lines.push(`Step times unavailable: ${checks.steps.reason}.`, '');
  return `${lines.join('\n')}\n`;
}

const plural = (count, word) => `${count} ${word}${count === 1 ? '' : 's'}`;

/** The evidence in one line, for a CI annotation on the run's page. */
export function renderEvidenceLine(evidence) {
  const { source, checks } = evidence;
  const parts = [
    `Packed ${plural(evidence.packages.length, 'package')} and hashed ${plural(evidence.artifacts.length, 'generated file')} at commit ${source.commit.slice(0, 12)}${source.dirty ? ' (dirty)' : ''}`,
  ];
  if (checks.state === 'not-run') parts.push('checks not run');
  else {
    if (checks.tests.length)
      parts.push(
        `Vitest: ${checks.tests.map((run) => `${run.run} ${run.passed} passed${run.failed ? ` (${run.failed} failed)` : ''}`).join(', ')}`,
      );
    if (checks.e2e)
      parts.push(
        `e2e: ${checks.e2e.passed} passed${checks.e2e.failed ? ` (${checks.e2e.failed} failed)` : ''}${checks.e2e.flaky ? `, ${checks.e2e.flaky} flaky` : ''}`,
      );
    if (checks.impact) parts.push(`change impact: ${checks.impact.state}`);
    if (checks.steps)
      parts.push(
        checks.steps.state === 'read'
          ? `step times: ${plural(checks.steps.steps.length, 'step')}`
          : 'step times unavailable',
      );
  }
  return parts.join(' · ');
}

/** Write evidence.json and EVIDENCE.md into `out`. */
export async function writeEvidence(out, evidence) {
  await mkdir(out, { recursive: true });
  await writeFile(join(out, 'evidence.json'), `${JSON.stringify(evidence, null, 2)}\n`);
  await writeFile(join(out, 'EVIDENCE.md'), renderEvidenceMarkdown(evidence));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const at = args.indexOf('--out');
  const out = at >= 0 ? args[at + 1] : undefined;
  if (!out) {
    console.error('Usage: node scripts/release/evidence.mjs --out <dir> [--allow-dirty] [--ci]');
    process.exit(2);
  }
  try {
    const dir = resolve(out);
    const evidence = await collectEvidence({
      out: dir,
      allowDirty: args.includes('--allow-dirty'),
      ci: args.includes('--ci'),
    });
    await writeEvidence(dir, evidence);
    if (args.includes('--ci') && process.env['GITHUB_STEP_SUMMARY'])
      await appendFile(process.env['GITHUB_STEP_SUMMARY'], renderEvidenceMarkdown(evidence));
    if (args.includes('--ci') && process.env['GITHUB_ACTIONS'] === 'true')
      console.log(
        `::notice title=Release evidence::${renderEvidenceLine(evidence).replace(/%/g, '%25')}`,
      );
    console.log(
      `Release evidence: ${join(out, 'evidence.json')} (${evidence.packages.length} packages, ${evidence.artifacts.length} files hashed, commit ${evidence.source.commit.slice(0, 12)}${evidence.source.dirty ? ', dirty' : ''}; checks ${evidence.checks.state}).`,
    );
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}
