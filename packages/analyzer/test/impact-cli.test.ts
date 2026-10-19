import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
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
});
