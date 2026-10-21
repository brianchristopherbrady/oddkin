import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterAll, describe, expect, it, vi } from 'vitest';
import { analyze, gitHistory } from '../src/index.js';

// The built `oddkin-analyze` command (run `npm run build` first), which `oddkin analyze` delegates to.
vi.setConfig({ testTimeout: 60_000 });

const repo = new URL('../../../', import.meta.url);
const path = (relative: string) => new URL(relative, repo).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const bin = path('packages/analyzer/dist/bin.js');
const project = path('tests/fixtures/analyzer-composed/tsconfig.json');
const shallow =
  execFileSync('git', ['rev-parse', '--is-shallow-repository'], {
    cwd: path('.'),
    encoding: 'utf8',
  }).trim() !== 'false';
const temp = mkdtempSync(join(tmpdir(), 'oddkin-analyze-'));
afterAll(() => rmSync(temp, { recursive: true, force: true }));

function run(name: string, args: string[], env: NodeJS.ProcessEnv = process.env) {
  const out = join(temp, name);
  const result = spawnSync(process.execPath, [bin, project, '--out', out, ...args], {
    encoding: 'utf8',
    env,
  });
  const metadata = JSON.parse(readFileSync(join(out, 'oddkin.metadata.json'), 'utf8')) as {
    docs?: Record<string, unknown>;
  };
  return { status: result.status, stderr: result.stderr, docs: metadata.docs };
}

describe('oddkin-analyze updated dates', () => {
  it('dates pages from git history by default, as analyze() does with gitHistory()', () => {
    const { status, stderr, docs } = run('default', []);
    expect(status).toBe(0);
    const history = gitHistory(dirname(project));
    expect(docs).toEqual(analyze({ project, ...(history ? { history } : {}) }).metadata['docs']);
    if (shallow) return expect(stderr).toContain('no full git history');
    expect(Object.keys(docs ?? {})).toEqual(['components/acme-alert', 'components/acme-panel']);
    expect(stderr).not.toContain('no full git history');
  });

  it('reads no history with --no-history', () => {
    const { status, stderr, docs } = run('none', ['--no-history']);
    expect(status).toBe(0);
    expect(docs).toBeUndefined();
    expect(stderr).not.toContain('no full git history');
  });

  it('says so when there is no repository, and never dates pages by the build', () => {
    const { status, stderr, docs } = run('no-repo', [], {
      ...process.env,
      GIT_DIR: join(temp, 'missing'),
    });
    expect(status).toBe(0);
    expect(docs).toBeUndefined();
    expect(stderr).toContain('no full git history');
  });
});
