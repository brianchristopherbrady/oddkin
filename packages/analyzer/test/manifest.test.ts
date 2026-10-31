import { Ajv2020 } from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { spawnSync } from 'node:child_process';
import { cpSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it, vi } from 'vitest';
import { analyzeManifest, stableJson } from '../src/index.js';

// A library not built with Oddkin, with examples of its own (ADR 0048 §3): `analyzeManifest` and
// `oddkin-analyze --manifest` read its example files against its own manifest and write only
// oddkin.metadata.json. The command needs the build (`npm run build`).
vi.setConfig({ testTimeout: 60_000 });

const repo = new URL('../../../', import.meta.url);
const path = (relative: string) => new URL(relative, repo).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const FIXTURE = path('tests/consumers/workbench/plain-widgets');
const bin = path('packages/analyzer/dist/bin.js');
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
const OTHER = `import { defineExamples } from '@oddkin/workbench/examples';
export default defineExamples('plain-other', { basic: { label: 'Basic' } });
`;

const temps: string[] = [];
afterAll(() => temps.forEach((dir) => rmSync(dir, { recursive: true, force: true })));
/** A copy of @plain/widgets (plain custom elements, a hand-written manifest, an example file). */
function library(files: Record<string, string> = {}): string {
  const dir = mkdtempSync(join(tmpdir(), 'oddkin-manifest-'));
  temps.push(dir);
  cpSync(FIXTURE, dir, { recursive: true });
  for (const [file, text] of Object.entries(files)) writeFileSync(join(dir, file), text);
  return dir;
}

describe('analyzeManifest: examples for a library not built with Oddkin', () => {
  it('records the examples against the manifest, and describes no components', () => {
    const { metadata, diagnostics } = analyzeManifest({
      manifest: join(library(), 'custom-elements.json'),
    });
    expect(validate(metadata), JSON.stringify(validate.errors)).toBe(true);
    expect(diagnostics).toEqual([]);
    expect(metadata['library']).toEqual({
      name: '@plain/widgets',
      version: '1.0.0',
      packages: [
        { name: '@plain/widgets', version: '1.0.0', customElements: './custom-elements.json' },
      ],
    });
    // The manifest stays the only description of the components.
    expect(metadata['components']).toEqual({});
    expect(Object.keys(metadata).sort()).toEqual([
      'components',
      'diagnostics',
      'examples',
      'library',
      'oddkinVersion',
      'schema',
    ]);
    expect(metadata['examples']).toEqual({
      'example:plain-chip/basic': {
        component: 'component:plain-chip',
        name: 'basic',
        file: 'chip.examples.js',
        definition: { label: 'Basic', attributes: { label: 'Draft' }, preset: true },
      },
      'example:plain-chip/info': {
        component: 'component:plain-chip',
        name: 'info',
        file: 'chip.examples.js',
        definition: { label: 'Info', attributes: { label: 'Beta', tone: 'info' }, preset: true },
      },
      'example:plain-chip/removable': {
        component: 'component:plain-chip',
        name: 'removable',
        file: 'chip.examples.js',
        hasFixture: true,
        definition: {
          label: 'Removable',
          attributes: { label: 'Status: open', removable: '' },
          guidance: 'The chip asks to be removed with plain-remove; the page removes it.',
          hasFixture: true,
        },
      },
    });
  });

  it('warns about an example for a tag the manifest does not declare', () => {
    const { metadata, diagnostics } = analyzeManifest({
      manifest: join(library({ 'other.examples.js': OTHER }), 'custom-elements.json'),
    });
    expect(diagnostics).toEqual([
      {
        code: 'analyzer.examples.unknownComponent',
        severity: 'warning',
        message:
          'Example "basic" is for <plain-other>, which custom-elements.json does not declare.',
        source: { file: 'other.examples.js', line: 2, column: 48 },
      },
    ]);
    expect(metadata['diagnostics']).toEqual(diagnostics);
    expect(validate(metadata), JSON.stringify(validate.errors)).toBe(true);
  });

  it('refuses a file that is not a Custom Elements Manifest', () => {
    const dir = library({ 'other.json': '{"schemaVersion":"2.1.0"}' });
    expect(() => analyzeManifest({ manifest: join(dir, 'other.json') })).toThrow(
      /is not a Custom Elements Manifest: it has no modules/,
    );
  });
});

describe('oddkin-analyze --manifest', () => {
  const run = (...args: string[]) =>
    spawnSync(process.execPath, [bin, ...args], { encoding: 'utf8' });

  it('writes only oddkin.metadata.json, as analyzeManifest describes it', () => {
    const dir = library();
    const out = join(dir, 'out');
    const result = run('--manifest', join(dir, 'custom-elements.json'), '--out', out);
    expect(result.status, result.stderr).toBe(0);
    expect(readdirSync(out)).toEqual(['oddkin.metadata.json']);
    expect(readFileSync(join(out, 'oddkin.metadata.json'), 'utf8')).toBe(
      stableJson(analyzeManifest({ manifest: join(dir, 'custom-elements.json') }).metadata),
    );
    // The library's own manifest is untouched.
    expect(readFileSync(join(dir, 'custom-elements.json'), 'utf8')).toBe(
      readFileSync(join(FIXTURE, 'custom-elements.json'), 'utf8'),
    );
  });

  it('fails on a warning with --strict, and refuses a tsconfig beside --manifest or a file that is no manifest', () => {
    const dir = library({ 'other.examples.js': OTHER, 'other.json': '{}' });
    const manifest = join(dir, 'custom-elements.json');
    const out = join(dir, 'out');
    const strict = run('--manifest', manifest, '--out', out, '--strict');
    expect(strict.status).toBe(1);
    expect(strict.stderr).toContain(
      'warning analyzer.examples.unknownComponent other.examples.js:2:48',
    );
    expect(run('tsconfig.json', '--manifest', manifest, '--out', out).status).toBe(2);
    const invalid = run('--manifest', join(dir, 'other.json'), '--out', out);
    expect(invalid.status).toBe(2);
    expect(invalid.stderr).toContain('is not a Custom Elements Manifest');
  });
});
