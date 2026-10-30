import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, it, vi } from 'vitest';
import {
  collectEvidence,
  listPackages,
  readResults,
  readSteps,
  renderEvidenceLine,
  renderEvidenceMarkdown,
  SCHEMA,
  type PackEntry,
  type ReleaseEvidence,
} from '../../scripts/release/evidence.mjs';

const root = fileURLToPath(new URL('../..', import.meta.url));
const temporary: string[] = [];
const tempDir = async (prefix: string) => {
  const dir = await mkdtemp(join(tmpdir(), prefix));
  temporary.push(dir);
  return dir;
};
afterAll(async () => {
  for (const dir of temporary) await rm(dir, { recursive: true, force: true });
});

const sha256 = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');

// npm pack takes tens of seconds per package on Windows, so these tests stand in for it with the
// manifests; the command test at the end compares the real thing with npm.
const fakePack = (directories: readonly string[], at: string): PackEntry[] =>
  directories.map((directory) => {
    const manifest = JSON.parse(readFileSync(join(at, directory, 'package.json'), 'utf8')) as {
      name: string;
      version: string;
    };
    return {
      name: manifest.name,
      version: manifest.version,
      integrity: `sha512-${directory}`,
      shasum: 'f'.repeat(40),
      entryCount: 3,
      size: 2048,
      unpackedSize: 4096,
    };
  });

/** A committed checkout with one publishable package and one private one. */
async function fixtureRepo() {
  const dir = await tempDir('oddkin-evidence-repo-');
  await mkdir(join(dir, 'packages', 'demo'), { recursive: true });
  await mkdir(join(dir, 'packages', 'internal'), { recursive: true });
  await writeFile(
    join(dir, 'packages', 'demo', 'package.json'),
    JSON.stringify({ name: '@acme/demo', version: '1.2.3' }),
  );
  await writeFile(
    join(dir, 'packages', 'demo', 'custom-elements.json'),
    '{"schemaVersion":"2.1.0","modules":[]}\n',
  );
  await writeFile(
    join(dir, 'packages', 'internal', 'package.json'),
    JSON.stringify({ name: '@acme/internal', version: '0.0.0', private: true }),
  );
  const git = (...args: string[]) =>
    execFileSync(
      'git',
      ['-c', 'user.name=Evidence', '-c', 'user.email=evidence@example.com', ...args],
      { cwd: dir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
    ).trim();
  git('init', '-q');
  git('add', '.');
  git('commit', '-q', '--no-gpg-sign', '-m', 'fixture');
  return { dir, commit: git('rev-parse', 'HEAD') };
}

describe('release evidence', () => {
  it('records the source, the environment, each publishable package, and the generated files', async () => {
    const { dir, commit } = await fixtureRepo();
    const evidence = await collectEvidence({ root: dir, pack: fakePack, env: {} });
    expect(evidence.schema).toBe(SCHEMA);
    expect(Date.parse(evidence.generatedAt)).not.toBeNaN();
    expect(evidence.source).toEqual({ commit, dirty: false, changes: 0 });
    expect(evidence.environment).toMatchObject({ node: process.version, ci: null });
    expect(evidence.environment.npm).toMatch(/^\d+\.\d+\.\d+/);
    expect(evidence.packages).toEqual([
      {
        name: '@acme/demo',
        version: '1.2.3',
        directory: 'packages/demo',
        integrity: 'sha512-packages/demo',
        shasum: 'f'.repeat(40),
        files: 3,
        size: 2048,
        unpackedSize: 4096,
      },
    ]);
    expect(evidence.artifacts).toEqual([
      {
        path: 'packages/demo/custom-elements.json',
        sha256: sha256(await readFile(join(dir, 'packages', 'demo', 'custom-elements.json'))),
      },
    ]);
    expect(evidence.checks).toEqual({ state: 'not-run', reason: expect.any(String) });
    expect(renderEvidenceLine(evidence)).toBe(
      `Packed 1 package and hashed 1 generated file at commit ${commit.slice(0, 12)} · checks not run`,
    );
  });

  it('refuses a dirty working tree unless told to record it', async () => {
    const { dir } = await fixtureRepo();
    await writeFile(join(dir, 'notes.txt'), 'uncommitted\n');
    await expect(collectEvidence({ root: dir, pack: fakePack, env: {} })).rejects.toThrow(
      /1 uncommitted change/,
    );
    const evidence = await collectEvidence({
      root: dir,
      pack: fakePack,
      env: {},
      allowDirty: true,
    });
    expect(evidence.source).toMatchObject({ dirty: true, changes: 1 });
    expect(renderEvidenceMarkdown(evidence)).toContain('**dirty** (1 uncommitted change(s))');
    expect(renderEvidenceLine(evidence)).toMatch(/ \(dirty\) · checks not run$/);
  });

  it('records this checkout as git reports it, with the eight published packages', async () => {
    const porcelain = execFileSync('git', ['status', '--porcelain'], {
      cwd: root,
      encoding: 'utf8',
    });
    const evidence = await collectEvidence({ allowDirty: true, pack: fakePack, env: {} });
    expect(evidence.source.dirty).toBe(porcelain.trim() !== '');
    expect(evidence.source.commit).toBe(
      execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
    );
    expect(evidence.packages.map((pkg) => pkg.name)).toEqual([
      '@oddkin/ai',
      '@oddkin/analyzer',
      '@oddkin/app',
      '@oddkin/components',
      '@oddkin/core',
      '@oddkin/state',
      '@oddkin/tokens',
      '@oddkin/workbench',
    ]);
    for (const artifact of evidence.artifacts)
      expect(sha256(await readFile(join(root, artifact.path)))).toBe(artifact.sha256);
  });

  it('keeps environment values and sources out of the bundle', async () => {
    const { dir } = await fixtureRepo();
    const canary = `canary-${Math.random().toString(36).slice(2)}`;
    const evidence = await collectEvidence({
      root: dir,
      pack: fakePack,
      env: {
        ODDKIN_EVIDENCE_CANARY: canary,
        GITHUB_TOKEN: canary,
        GITHUB_ACTIONS: 'true',
        GITHUB_REPOSITORY: 'acme/widgets',
        GITHUB_RUN_ID: '7',
        GITHUB_SERVER_URL: 'https://github.example',
      },
    });
    const text = `${JSON.stringify(evidence)}\n${renderEvidenceMarkdown(evidence)}`;
    expect(text).not.toContain(canary);
    expect(text).not.toMatch(/(^|[\s"'`/])src\//m);
    expect(evidence.environment.ci).toMatchObject({
      repository: 'acme/widgets',
      runId: '7',
      url: 'https://github.example/acme/widgets/actions/runs/7',
    });
  });

  it('reads the test results and the change impact that CI leaves beside the evidence', async () => {
    const out = await tempDir('oddkin-evidence-out-');
    await mkdir(join(out, 'results'));
    await mkdir(join(out, 'impact'));
    const vitest = (passed: number, failed: number, skipped: number) =>
      JSON.stringify({
        numTotalTests: passed + failed + skipped,
        numPassedTests: passed,
        numFailedTests: failed,
        numPendingTests: skipped,
        numTodoTests: 0,
        success: failed === 0,
      });
    await writeFile(join(out, 'results', 'vitest-node.json'), vitest(3, 0, 0));
    await writeFile(join(out, 'results', 'vitest-chromium.json'), vitest(8, 1, 1));
    await writeFile(join(out, 'results', 'notes.txt'), 'not a result');
    await writeFile(
      join(out, 'results', 'e2e.json'),
      JSON.stringify({
        stats: { expected: 2, unexpected: 1, flaky: 1, skipped: 1, duration: 12_300 },
        suites: [
          {
            title: 'a.spec.ts',
            specs: [
              {
                title: 'one',
                tests: [
                  { projectName: 'chromium', status: 'expected' },
                  { projectName: 'firefox', status: 'unexpected' },
                ],
              },
            ],
            suites: [
              {
                title: 'group',
                specs: [
                  {
                    title: 'two',
                    tests: [
                      { projectName: 'chromium', status: 'flaky' },
                      { projectName: 'firefox', status: 'expected' },
                      { projectName: 'firefox', status: 'skipped' },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      }),
    );
    const base = 'a'.repeat(40);
    const head = 'b'.repeat(40);
    await writeFile(
      join(out, 'impact', 'status.json'),
      JSON.stringify({ state: 'written', base, head }),
    );
    await writeFile(
      join(out, 'impact', 'report.json'),
      JSON.stringify({
        changes: [
          { classification: 'review' },
          { classification: 'informational' },
          { classification: 'review' },
        ],
        coverageGaps: [{ item: 'module:x', reason: 'not supplied' }],
        checks: [{ state: 'selected' }, { state: 'selected' }, { state: 'reused' }],
      }),
    );

    const results = await readResults(out);
    expect(results.tests).toEqual([
      { run: 'chromium', total: 10, passed: 8, failed: 1, skipped: 1, success: false },
      { run: 'node', total: 3, passed: 3, failed: 0, skipped: 0, success: true },
    ]);
    expect(results.e2e).toEqual({
      passed: 2,
      failed: 1,
      flaky: 1,
      skipped: 1,
      seconds: 12,
      projects: [
        { project: 'chromium', passed: 1, failed: 0, flaky: 1, skipped: 0 },
        { project: 'firefox', passed: 1, failed: 1, flaky: 0, skipped: 1 },
      ],
    });
    expect(results.impact).toEqual({
      state: 'written',
      base,
      head,
      changes: { review: 2, informational: 1 },
      coverageGaps: 1,
      checks: { selected: 2, reused: 1 },
      fullVerification: null,
    });

    const { dir, commit } = await fixtureRepo();
    const evidence = await collectEvidence({ root: dir, out, pack: fakePack, env: {} });
    expect(evidence.checks).toEqual({ state: 'recorded', ...results, steps: null });
    const markdown = renderEvidenceMarkdown(evidence);
    expect(markdown).toContain('| chromium | 8 | 1 | 1 |');
    expect(markdown).toContain('| firefox | 1 | 1 | 0 | 1 |');
    expect(markdown).toContain(`Change impact: written against \`${base.slice(0, 12)}\``);
    expect(markdown).not.toContain('Not run');
    expect(renderEvidenceLine(evidence)).toBe(
      `Packed 1 package and hashed 1 generated file at commit ${commit.slice(0, 12)} · Vitest: chromium 8 passed (1 failed), node 3 passed · e2e: 2 passed (1 failed), 1 flaky · change impact: written`,
    );
  });

  it("reads this job's step times from GitHub, and says when it cannot", async () => {
    expect(await readSteps({})).toEqual({
      state: 'unavailable',
      reason: 'not a GitHub Actions run with a token',
    });
    const requests: string[] = [];
    vi.stubGlobal('fetch', async (url: string, init: { headers: Record<string, string> }) => {
      requests.push(url);
      expect(init.headers['authorization']).toBe('Bearer token-value');
      return new Response(
        JSON.stringify({
          jobs: [
            { name: 'other', steps: [] },
            {
              name: 'verify',
              steps: [
                {
                  name: 'Run npm run lint',
                  conclusion: 'success',
                  started_at: '2026-10-29T00:00:00Z',
                  completed_at: '2026-10-29T00:00:32Z',
                },
                {
                  name: 'Run node scripts/release/evidence.mjs',
                  conclusion: null,
                  started_at: '2026-10-29T00:01:00Z',
                  completed_at: null,
                },
              ],
            },
          ],
        }),
      );
    });
    try {
      const env = {
        GITHUB_REPOSITORY: 'acme/widgets',
        GITHUB_RUN_ID: '7',
        GITHUB_RUN_ATTEMPT: '2',
        GITHUB_JOB: 'verify',
        GITHUB_TOKEN: 'token-value',
      };
      expect(await readSteps(env)).toEqual({
        state: 'read',
        job: 'verify',
        steps: [{ name: 'Run npm run lint', conclusion: 'success', seconds: 32 }],
      });
      expect(requests).toEqual([
        'https://api.github.com/repos/acme/widgets/actions/runs/7/attempts/2/jobs?per_page=100',
      ]);
      expect(await readSteps({ ...env, GITHUB_JOB: 'missing' })).toEqual({
        state: 'unavailable',
        reason: 'job missing not found',
      });
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

// npm pack takes minutes for the eight packages on a loaded Windows machine: CI runs this, and
// ODDKIN_RELEASE_TESTS=1 runs it locally.
describe.skipIf(!process.env['CI'] && !process.env['ODDKIN_RELEASE_TESTS'])(
  'the evidence command on this checkout',
  () => {
    it('writes the bundle, with each package as npm packs it', async () => {
      const out = await tempDir('oddkin-evidence-cli-');
      execFileSync(
        process.execPath,
        [join(root, 'scripts', 'release', 'evidence.mjs'), '--out', out, '--allow-dirty'],
        { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] },
      );
      expect(existsSync(join(out, 'EVIDENCE.md'))).toBe(true);
      const evidence = JSON.parse(
        await readFile(join(out, 'evidence.json'), 'utf8'),
      ) as ReleaseEvidence;
      const npmCli = [
        join(dirname(process.execPath), 'node_modules', 'npm', 'bin', 'npm-cli.js'),
        join(dirname(process.execPath), '..', 'lib', 'node_modules', 'npm', 'bin', 'npm-cli.js'),
      ].find((path) => existsSync(path));
      expect(npmCli).toBeDefined();
      const listed = await listPackages();
      expect(evidence.packages.map((pkg) => pkg.name)).toEqual(listed.map((pkg) => pkg.name));
      for (const pkg of evidence.packages) {
        // Each package packed on its own, independently of the script's one workspace run.
        const [packed] = JSON.parse(
          execFileSync(process.execPath, [npmCli!, 'pack', '--dry-run', '--json'], {
            cwd: join(root, pkg.directory),
            encoding: 'utf8',
            stdio: ['ignore', 'pipe', 'pipe'],
            maxBuffer: 256 * 1024 * 1024,
          }),
        ) as PackEntry[];
        expect([pkg.name, pkg.version, pkg.integrity, pkg.files]).toEqual([
          packed!.name,
          packed!.version,
          packed!.integrity,
          packed!.entryCount,
        ]);
      }
    }, 1_800_000);
  },
);
