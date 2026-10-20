import { Ajv2020 } from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterAll, describe, expect, it, vi } from 'vitest';
import { componentPages } from '../src/docs.js';
import { analyze, gitHistory, type SourceHistory } from '../src/index.js';

vi.setConfig({ testTimeout: 30_000 });

const repo = new URL('../../../', import.meta.url);
const path = (relative: string) => new URL(relative, repo).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const ajv = new Ajv2020({
  allErrors: true,
  strict: true,
  strictRequired: false,
  allowUnionTypes: true,
});
addFormats.default(ajv);
const validate = ajv.compile(
  JSON.parse(readFileSync(path('docs/schemas/oddkin-metadata.v1.schema.json'), 'utf8')) as object,
);

/** A history that knows only `dates` and records every file it is asked about. */
const fakeHistory = (dates: Record<string, string>) => {
  const asked: string[] = [];
  const history: SourceHistory = {
    lastChanged(files) {
      asked.push(...files);
      return new Map(files.flatMap((f) => (dates[f] ? [[f, dates[f]] as const] : [])));
    },
  };
  return { history, asked };
};
type Docs = Record<string, { updated: Record<string, unknown> }> | undefined;

describe('updated dates from source history', () => {
  const project = path('tests/fixtures/analyzer-composed/tsconfig.json');

  it('declares each page’s sources: class chain, definitions, template, styles, registration, examples', () => {
    const result = analyze({ project });
    const pages = Object.fromEntries(
      componentPages(result.extraction, result.examples).map((p) => [p.page, p.files]),
    );
    expect(pages).toEqual({
      'components/acme-panel': [
        'src/panel/panel.define.ts',
        'src/panel/panel.definition.ts',
        'src/panel/panel.examples.ts',
        'src/panel/panel.styles.ts',
        'src/panel/panel.template.ts',
        'src/panel/panel.ts',
      ],
      // Recomposed from the panel: its base class, template, styles, and definition count;
      // the panel's examples do not.
      'components/acme-alert': [
        'src/alert/alert.define.ts',
        'src/alert/alert.definition.ts',
        'src/alert/alert.ts',
        'src/panel/panel.definition.ts',
        'src/panel/panel.styles.ts',
        'src/panel/panel.template.ts',
        'src/panel/panel.ts',
      ],
    });
  });

  it('declares only this library’s files, not those of the packages it builds on', () => {
    const root = path('tests/fixtures/analyzer-product');
    const result = analyze({ project: join(root, 'tsconfig.json') });
    const files = componentPages(result.extraction, result.examples).flatMap((p) => p.files);
    expect(files.length).toBeGreaterThan(0);
    for (const file of files) expect(existsSync(join(root, file)), file).toBe(true);
  });

  it('declares the explicit metadata file that supplies a class’s facts', () => {
    const result = analyze({ project: path('tests/fixtures/analyzer-dynamic/tsconfig.json') });
    const page = componentPages(result.extraction, result.examples).find(
      (p) => p.page === 'components/dynamic-element',
    );
    expect(page?.files).toContain('src/elements.metadata.json');
  });

  it('dates a page by the last change to any of its sources', () => {
    const { history, asked } = fakeHistory({
      'src/panel/panel.examples.ts': '2026-05-01',
      'src/panel/panel.ts': '2026-04-01',
      'src/panel/panel.styles.ts': '2026-02-01',
      'src/alert/alert.ts': '2026-03-01',
    });
    const result = analyze({ project, history });
    expect(result.metadata['docs']).toEqual({
      'components/acme-alert': { updated: { value: '2026-04-01', provenance: 'extracted' } },
      'components/acme-panel': { updated: { value: '2026-05-01', provenance: 'extracted' } },
    });
    // One query for all pages.
    expect(new Set(asked).size).toBe(asked.length);
    expect(validate(result.metadata), JSON.stringify(validate.errors)).toBe(true);
  });

  it('omits dates without history, and pages whose sources have none', () => {
    expect(analyze({ project }).metadata['docs']).toBeUndefined();
    const { history } = fakeHistory({ 'src/alert/alert.ts': '2026-03-01' });
    expect(Object.keys(analyze({ project, history }).metadata['docs'] as object)).toEqual([
      'components/acme-alert',
    ]);
  });

  it('dates foundation pages by the theme’s declared sources', () => {
    const tokens = {
      inspection: {
        theme: 'acme',
        modes: ['light'],
        tokens: [
          {
            name: 'space.sm',
            cssVariable: '--acme-space-sm',
            category: 'foundation',
            type: 'dimension',
            origin: 'preset',
            definition: '0.5rem',
            value: '0.5rem',
          },
        ],
      },
      source: { package: '@acme/tokens', export: './inspect.json' },
    };
    const { history } = fakeHistory({ '/theme.json': '2026-06-01', '/presets.ts': '2026-07-01' });
    const dated = analyze({
      project,
      history,
      tokens: { ...tokens, sources: ['/theme.json', '/presets.ts'] },
    }).metadata['docs'] as Docs;
    expect(dated?.['foundations/spacing']).toEqual({
      updated: { value: '2026-07-01', provenance: 'extracted' },
    });
    const undeclared = analyze({ project, history, tokens }).metadata['docs'] as Docs;
    expect(undeclared?.['foundations/spacing']).toBeUndefined();
  });
});

describe('authored updated dates', () => {
  const project = path('tests/fixtures/analyzer-docs/tsconfig.json');
  const { history } = fakeHistory({ 'src/index.ts': '2026-09-09' });
  const result = analyze({ project, history });

  it('prefer an @updated tag to source history, with its location', () => {
    const docs = result.metadata['docs'] as Docs;
    expect(docs?.['components/acme-dated']).toEqual({
      updated: {
        value: '2026-03-14',
        provenance: 'authored',
        source: { file: 'src/index.ts', line: 9, column: 4 },
      },
    });
    expect(validate(result.metadata), JSON.stringify(validate.errors)).toBe(true);
  });

  it('report a date that is not on the calendar and fall back to source history', () => {
    expect(result.diagnostics).toEqual([
      expect.objectContaining({
        code: 'analyzer.tag.invalid',
        severity: 'warning',
        message: expect.stringContaining('AcmeMisdated: @updated needs a calendar date'),
        source: expect.objectContaining({ file: 'src/index.ts', line: 16 }),
      }),
    ]);
    expect((result.metadata['docs'] as Docs)?.['components/acme-misdated']).toEqual({
      updated: { value: '2026-09-09', provenance: 'extracted' },
    });
  });
});

describe('gitHistory', () => {
  const temp = mkdtempSync(join(tmpdir(), 'oddkin-history-'));
  afterAll(() => rmSync(temp, { recursive: true, force: true }));
  const git = (cwd: string, args: string[], date?: string) =>
    execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@example.com', ...args], {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      env: { ...process.env, ...(date ? { GIT_AUTHOR_DATE: date, GIT_COMMITTER_DATE: date } : {}) },
    });
  // Two commits: a.txt and lib/b.txt, then a.txt again; c.txt is never committed.
  const source = join(temp, 'source');
  mkdirSync(join(source, 'lib'), { recursive: true });
  git(source, ['init', '-q']);
  writeFileSync(join(source, 'a.txt'), '1');
  writeFileSync(join(source, 'lib', 'b.txt'), '1');
  git(source, ['add', '.']);
  git(source, ['commit', '-q', '-m', 'one'], '2026-01-02T23:30:00-08:00');
  writeFileSync(join(source, 'a.txt'), '2');
  git(source, ['commit', '-q', '-am', 'two'], '2026-03-04T10:00:00+02:00');
  writeFileSync(join(source, 'c.txt'), '1');

  it("reads each committed file's last commit date in the committer's time zone", () => {
    const dates = gitHistory(source)?.lastChanged(['a.txt', 'lib/b.txt', 'c.txt', 'none.txt']);
    expect(Object.fromEntries(dates ?? [])).toEqual({
      'a.txt': '2026-03-04',
      'lib/b.txt': '2026-01-02',
    });
  });

  it('resolves files against the root it was given, inside the repository', () => {
    const dates = gitHistory(join(source, 'lib'))?.lastChanged(['b.txt', join(source, 'a.txt')]);
    expect(Object.fromEntries(dates ?? [])).toEqual({
      'b.txt': '2026-01-02',
      [join(source, 'a.txt')]: '2026-03-04',
    });
  });

  it('is unavailable in a shallow clone and outside a repository', () => {
    const clone = join(temp, 'clone');
    git(temp, ['clone', '-q', '--depth', '1', pathToFileURL(source).href, clone]);
    expect(gitHistory(clone)).toBeUndefined();
    const plain = join(temp, 'plain');
    mkdirSync(plain);
    expect(gitHistory(plain)).toBeUndefined();
  });
});
