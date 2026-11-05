import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';
import { emitInspectJson, generate } from '@oddkin/tokens/generate';
import { main } from '../src/impact-cli.js';
import {
  compareSnapshots,
  createSnapshot,
  mergeResults,
  type CheckResult,
  type ComparisonSnapshot,
} from '../src/impact.js';
import { clone, library } from './impact.fixture.js';

// Executed results merged into the report (item 851), and the `oddkin-impact` commands.

const run = (browser: string, state: CheckResult['state'], message?: string) => ({
  state,
  ...(message ? { message } : {}),
  conditions: { browser },
});

describe('mergeResults', () => {
  const base = library(1);
  const head = clone(base);
  head.packages[0]!.modules!['dist/button/button.styles.js'] += '// edited\n';
  const report = compareSnapshots(createSnapshot(base), createSnapshot(head), {
    baseline: [
      {
        check: 'example:acme-field/default',
        product: 'p1',
        state: 'passed',
        conditions: { browsers: ['chromium'] },
      },
    ],
  });

  it('passes a check only when every run passed, fails it on any failure, and never invents a pass', () => {
    const merged = mergeResults(report, [
      ...['chromium', 'firefox', 'webkit'].map((b) => ({
        check: 'example:acme-button/default',
        product: 'p1',
        ...run(b, 'passed'),
      })),
      { check: 'example:acme-button/primary', product: 'p1', ...run('chromium', 'passed') },
      {
        check: 'example:acme-button/primary',
        product: 'p1',
        ...run('webkit', 'failed', 'expected 1 to be 2'),
      },
      { check: 'example:acme-dialog/default', product: 'p1', ...run('chromium', 'not-executed') },
    ]);
    const state = (id: string) => merged.checks.find((c) => c.id === id && c.product === 'p1');
    expect(state('example:acme-button/default')).toMatchObject({
      state: 'passed',
      conditions: {
        runs: [{ browser: 'chromium' }, { browser: 'firefox' }, { browser: 'webkit' }],
      },
    });
    expect(state('example:acme-button/primary')).toMatchObject({ state: 'failed' });
    expect(state('example:acme-button/primary')?.reason).toContain('failed: expected 1 to be 2');
    expect(state('example:acme-dialog/default')).toMatchObject({ state: 'not-executed' });
    expect(state('suite:oddkin.button#acme-button')).toMatchObject({
      state: 'not-executed',
      reason: 'its target is affected; no run recorded',
    });
    // A reused check keeps its baseline state and conditions.
    expect(state('example:acme-field/default')).toEqual(
      report.checks.find((c) => c.id === 'example:acme-field/default'),
    );
    expect(merged.checks.filter((c) => c.state === 'selected')).toEqual([]);
  });
});

describe('oddkin-impact', () => {
  const dir = mkdtempSync(join(tmpdir(), 'oddkin-impact-'));
  afterAll(() => rmSync(dir, { recursive: true, force: true }));
  const path = (name: string) => join(dir, name);
  const components = fileURLToPath(new URL('../../components/', import.meta.url));
  const theme = fileURLToPath(new URL('../../tokens/themes/default.theme.json', import.meta.url));
  writeFileSync(
    path('default.inspect.json'),
    emitInspectJson(generate(JSON.parse(readFileSync(theme, 'utf8'))).theme!),
  );
  const io = () => {
    const out: string[] = [];
    const err: string[] = [];
    return { out, err, io: { out: (t: string) => out.push(t), err: (t: string) => err.push(t) } };
  };
  const snapshot = (out: string) =>
    main(
      [
        'snapshot',
        components,
        '--theme',
        theme,
        '--inspection',
        path('default.inspect.json'),
        '--suite',
        'oddkin.button@0.1.0:odd-button',
        '--tool',
        'analyzer=0.1.0',
        '--out',
        path(out),
      ],
      io().io,
    );

  it('writes a snapshot of a built package and compares two snapshots', () => {
    expect(snapshot('base.json')).toBe(0);
    expect(snapshot('head.json')).toBe(0);
    const base = JSON.parse(readFileSync(path('base.json'), 'utf8')) as ComparisonSnapshot;
    expect(base.unresolved).toEqual([]);
    expect(base.versions).toEqual({ analyzer: '0.1.0' });
    const { out, io: streams } = io();
    expect(main(['compare', path('base.json'), path('head.json')], streams)).toBe(0);
    expect(out.join('\n')).toContain('0 changes (0 incompatible)');
  });

  it('merges result files and exits 1 when a selected check failed', () => {
    const head = JSON.parse(readFileSync(path('head.json'), 'utf8')) as ComparisonSnapshot;
    const style =
      'style:@oddkin/components/dist/side-nav/side-nav.structural.styles.js#sideNavStructuralStyles';
    writeFileSync(
      path('edited.json'),
      JSON.stringify({
        ...head,
        items: {
          ...head.items,
          [style]: { ...head.items[style], hash: `sha256-${'0'.repeat(64)}` },
        },
      }),
    );
    writeFileSync(
      path('results.json'),
      JSON.stringify([
        { check: 'example:odd-side-nav/default', ...run('chromium', 'failed', 'boom') },
        { check: 'example:odd-side-nav/wide', ...run('chromium', 'passed') },
      ]),
    );
    const { out, io: streams } = io();
    const code = main(
      [
        'compare',
        path('base.json'),
        path('edited.json'),
        '--results',
        path('results.json'),
        '--json',
        path('report.json'),
        '--markdown',
        path('report.md'),
      ],
      streams,
    );
    expect(code).toBe(1);
    const report = JSON.parse(readFileSync(path('report.json'), 'utf8')) as {
      checks: { id: string; state: string }[];
    };
    expect(Object.fromEntries(report.checks.map((c) => [c.id, c.state]))).toEqual({
      'example:odd-side-nav/controlled': 'not-executed',
      'example:odd-side-nav/currentInGroup': 'not-executed',
      'example:odd-side-nav/declarative': 'not-executed',
      'example:odd-side-nav/default': 'failed',
      'example:odd-side-nav/regions': 'not-executed',
      'example:odd-side-nav/wide': 'passed',
    });
    expect(readFileSync(path('report.md'), 'utf8')).toBe(out.join('\n'));
  });

  it('reports usage errors with exit code 2', () => {
    const { err, io: streams } = io();
    expect(main(['snapshot', components], streams)).toBe(2);
    expect(main(['compare', path('base.json')], streams)).toBe(2);
    expect(main(['explain'], streams)).toBe(2);
    expect(main(['snapshot', components, '--out', path('x.json'), '--suite', 'bad'], streams)).toBe(
      2,
    );
    expect(err.at(-1)).toContain('--suite bad');
  });

  it('records the revision and dirty state of the repository --source names', () => {
    const repo = path('repo');
    mkdirSync(repo);
    const git = (...args: string[]) =>
      execFileSync(
        'git',
        ['-c', 'user.name=Oddkin', '-c', 'user.email=oddkin@example.invalid', ...args],
        { cwd: repo, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] },
      ).trim();
    git('init', '-q');
    writeFileSync(join(repo, 'a.txt'), 'a\n');
    git('add', 'a.txt');
    git('-c', 'commit.gpgsign=false', 'commit', '-q', '-m', 'a');
    const revision = git('rev-parse', 'HEAD');
    const source = (out: string) => {
      expect(main(['snapshot', components, '--source', repo, '--out', path(out)], io().io)).toBe(0);
      return (JSON.parse(readFileSync(path(out), 'utf8')) as ComparisonSnapshot).source;
    };
    expect(source('clean.json')).toEqual({ revision, dirty: false });
    // A tracked file changed, then an untracked one: either makes the tree dirty.
    writeFileSync(join(repo, 'a.txt'), 'b\n');
    expect(source('edited.json')).toEqual({ revision, dirty: true });
    git('checkout', '--', 'a.txt');
    writeFileSync(join(repo, 'new.txt'), 'new\n');
    expect(source('untracked.json')).toEqual({ revision, dirty: true });
    // The report says where each side was built.
    const { out, io: streams } = io();
    expect(main(['compare', path('clean.json'), path('edited.json')], streams)).toBe(0);
    expect(out.join('\n')).toContain(
      `- Base: \`${revision.slice(0, 12)}\`\n- Head: \`${revision.slice(0, 12)}\`, with uncommitted changes\n`,
    );
    // A directory in no repository is a usage error, not a snapshot without provenance.
    const outside = mkdtempSync(join(tmpdir(), 'oddkin-no-repo-'));
    try {
      const { err, io: failing } = io();
      expect(
        main(['snapshot', components, '--source', outside, '--out', path('x.json')], failing),
      ).toBe(2);
      expect(err.join('\n')).toContain('not in a git repository');
    } finally {
      rmSync(outside, { recursive: true, force: true });
    }
  });

  it("snapshots metadata only for the manifest's elements, and stops at a schema it does not read", () => {
    const pkg = path('stale-package');
    mkdirSync(pkg);
    writeFileSync(
      join(pkg, 'package.json'),
      JSON.stringify({ name: 'x-ui', version: '1.0.0', customElements: 'custom-elements.json' }),
    );
    writeFileSync(
      join(pkg, 'custom-elements.json'),
      JSON.stringify({
        schemaVersion: '2.1.0',
        modules: [
          {
            kind: 'javascript-module',
            path: 'a.js',
            declarations: [{ kind: 'class', name: 'A', customElement: true, tagName: 'x-a' }],
          },
        ],
      }),
    );
    const metadata = (schema: string) =>
      JSON.stringify({
        schema,
        components: { 'component:x-gone': { tag: 'x-gone', registration: 'x-ui/gone' } },
        examples: {
          'example:x-gone/default': { component: 'component:x-gone', name: 'default' },
        },
      });
    writeFileSync(
      join(pkg, 'oddkin.metadata.json'),
      metadata('https://oddkin.dev/schemas/oddkin-metadata/v1.json'),
    );
    const stale = io();
    expect(main(['snapshot', pkg, '--out', path('stale.json')], stale.io)).toBe(0);
    expect(stale.err.map((line) => line.split(':')[0])).toEqual([
      'warning metadata.component.undeclared',
      'warning metadata.example.undeclared',
    ]);
    const items = Object.keys(
      (JSON.parse(readFileSync(path('stale.json'), 'utf8')) as ComparisonSnapshot).items,
    );
    expect(items).toContain('component:x-a');
    expect(items.filter((id) => id.includes('x-gone'))).toEqual([]);
    // Metadata of a later schema is not read, and the snapshot is not written without it.
    writeFileSync(
      join(pkg, 'oddkin.metadata.json'),
      metadata('https://oddkin.dev/schemas/oddkin-metadata/v2.json'),
    );
    const later = io();
    expect(main(['snapshot', pkg, '--out', path('later.json')], later.io)).toBe(2);
    expect(later.err[0]).toMatch(
      /^error metadata\.schema\.unsupported: x-ui\/oddkin\.metadata\.json/,
    );
    expect(later.err.at(-1)).toContain('could not be read');
  });
});
