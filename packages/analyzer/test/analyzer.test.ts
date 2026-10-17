import { Ajv2020 } from 'ajv/dist/2020.js';
import { Ajv } from 'ajv';
import addFormats from 'ajv-formats';
import { readFile, writeFile } from 'node:fs/promises';
import { describe, expect, it, vi } from 'vitest';
import { analyze, stableJson } from '../src/index.js';

// Each analysis builds a TypeScript program (~1 s); allow for parallel test load.
vi.setConfig({ testTimeout: 30_000 });

const repo = new URL('../../../', import.meta.url);
const path = (relative: string) => new URL(relative, repo).pathname.replace(/^\/([A-Za-z]:)/, '$1');

const cemSchema = JSON.parse(
  await readFile(new URL('node_modules/custom-elements-manifest/schema.json', repo), 'utf8'),
) as object;
const moteSchema = JSON.parse(
  await readFile(new URL('docs/schemas/mote-metadata.v1.schema.json', repo), 'utf8'),
) as object;
const cemAjv = new Ajv({ allErrors: true, strict: false });
const validateCem = cemAjv.compile(cemSchema);
// Same options as tests/schemas: the fact definition's if/then uses "not: { required }".
const moteAjv = new Ajv2020({
  allErrors: true,
  strict: true,
  strictRequired: false,
  allowUnionTypes: true,
});
addFormats.default(moteAjv);
const validateMote = moteAjv.compile(moteSchema);

type Declaration = Record<string, unknown> & {
  name: string;
  members: Array<Record<string, unknown>>;
};
const declarations = (manifest: Record<string, unknown>) =>
  (manifest['modules'] as Array<{ declarations: Declaration[] }>).flatMap((m) => m.declarations);
const declaration = (manifest: Record<string, unknown>, name: string) =>
  declarations(manifest).find((d) => d.name === name) as Declaration;

describe('analyzer on a fixture library', () => {
  const result = analyze({ project: path('tests/fixtures/analyzer-library/tsconfig.json') });

  it('emits a valid Custom Elements Manifest (pinned 2.1.0 schema) and valid mote.metadata.json', () => {
    expect(validateCem(result.manifest), JSON.stringify(validateCem.errors)).toBe(true);
    expect(validateMote(result.metadata), JSON.stringify(validateMote.errors)).toBe(true);
  });

  it('never executes library modules', () => {
    // alert.ts throws at module evaluation; analysis completed and extracted it.
    expect(declaration(result.manifest, 'AcmeAlert')).toBeDefined();
  });

  it('extracts properties, attributes, reflection, defaults, events, members, slots, parts, CSS properties, and states', () => {
    const panel = declaration(result.manifest, 'AcmePanel');
    expect(panel).toMatchObject({
      tagName: 'acme-panel',
      superclass: { name: 'MoteElement', package: '@mote/core' },
      description: 'A surface with a heading and actions.',
      events: [
        {
          name: 'acme-dismiss',
          type: { text: 'CustomEvent<{ reason: "button" | "escape"; }>' },
          description: 'Fired when the user dismisses the panel.',
        },
      ],
      slots: [
        { name: '', description: 'Panel content.' },
        { name: 'heading', description: 'The panel heading.' },
      ],
      cssParts: [
        { name: 'body', description: 'The content area.' },
        { name: 'dismiss', description: '' },
        { name: 'frame', description: '' },
      ],
      cssProperties: [{ name: '--acme-panel-gap', description: 'Space between regions.' }],
      cssStates: [{ name: 'closed', description: '' }],
    });
    expect(panel.members).toEqual([
      {
        kind: 'field',
        name: 'dismissible',
        type: { text: 'boolean' },
        default: 'false',
        description: 'Shows a dismiss button.',
        attribute: 'dismissible',
        reflects: true,
      },
      {
        kind: 'field',
        name: 'tone',
        type: { text: '"neutral" | "info"' },
        default: "'neutral'",
        attribute: 'tone',
        reflects: true,
      },
      {
        kind: 'method',
        name: 'close',
        description: 'Close the panel as if the user dismissed it.',
      },
    ]);
  });

  it('follows inheritance across files with inheritedFrom references', () => {
    const alert = declaration(result.manifest, 'AcmeAlert');
    expect(alert.superclass).toEqual({ name: 'AcmePanel', module: 'dist/panel.js' });
    expect(
      alert.members.map((m) => [
        m['name'],
        (m['inheritedFrom'] as { name?: string } | undefined)?.name ?? null,
      ]),
    ).toEqual([
      ['dismissible', 'AcmePanel'],
      ['tone', 'AcmePanel'],
      ['live', null],
      ['items', null],
      ['close', null],
    ]);
    expect(alert['attributes']).toContainEqual({
      name: 'live-mode',
      type: { text: '"polite" | "assertive"' },
      fieldName: 'live',
      default: "'polite'",
    });
    expect(
      (alert['attributes'] as Array<{ fieldName: string }>).some((a) => a.fieldName === 'items'),
    ).toBe(false);
    expect((alert['events'] as Array<{ inheritedFrom?: unknown }>)[0]?.inheritedFrom).toEqual({
      name: 'AcmePanel',
      module: 'dist/panel.js',
    });
  });

  it('records registrations, package export specifiers, recipes, models, authored facts, and dynamic definitions', () => {
    const metadata = result.metadata as Record<string, Record<string, Record<string, unknown>>>;
    expect(Object.keys(metadata['components'] ?? {})).toEqual([
      'component:acme-alert',
      'component:acme-panel',
    ]);
    expect(metadata['components']?.['component:acme-panel']).toMatchObject({
      registration: '@acme/ui',
      category: 'category:containers',
      a11y: [
        {
          value: 'Uses a labelled region; provide a heading.',
          provenance: 'authored',
          source: { file: 'src/panel.ts', line: 18 },
        },
      ],
    });
    expect(metadata['components']?.['component:acme-alert']?.['related']).toEqual([
      'component:acme-panel',
    ]);
    expect(metadata['recipes']?.['recipe:panel']).toMatchObject({
      regions: { root: { helper: 'stack' }, actions: { helper: 'row' } },
      variants: { tone: ['info'] },
      parts: ['actions'],
    });
    expect(metadata['models']?.['model:acme.message']).toEqual({
      name: 'acme.message',
      version: 1,
      schema: 'schemas/acme.message.v1.json',
      kinds: ['text', 'link'],
    });
    expect(result.diagnostics.map((d) => [d.code, d.source?.file, d.source?.line])).toEqual([
      ['analyzer.dynamic.tagName', 'src/index.ts', 13],
    ]);
    const exportsOfIndex = (
      result.manifest['modules'] as Array<{
        path: string;
        exports: Array<{ kind: string; name: string }>;
      }>
    ).find((m) => m.path === 'dist/index.js');
    expect(
      exportsOfIndex?.exports
        .filter((e) => e.kind === 'custom-element-definition')
        .map((e) => e.name),
    ).toEqual(['acme-panel', 'acme-alert']);
    expect(exportsOfIndex?.exports.filter((e) => e.kind === 'js').map((e) => e.name)).toEqual([
      'AcmeAlert',
      'AcmePanel',
    ]);
  });

  it('is deterministic and supports incremental reuse of the previous program', () => {
    const again = analyze({ project: path('tests/fixtures/analyzer-library/tsconfig.json') });
    expect(stableJson(again.manifest)).toBe(stableJson(result.manifest));
    expect(stableJson(again.metadata)).toBe(stableJson(result.metadata));
    const incremental = analyze({
      project: path('tests/fixtures/analyzer-library/tsconfig.json'),
      oldProgram: result.program,
    });
    expect(stableJson(incremental.manifest)).toBe(stableJson(result.manifest));
  });
});

describe('analyzer on the core-counter example', () => {
  const result = analyze({
    project: path('examples/core-counter/tsconfig.json'),
    library: { name: 'core-counter', version: '0.0.0' },
  });

  for (const [file, data] of [
    ['core-counter.custom-elements.json', result.manifest],
    ['core-counter.mote.metadata.json', result.metadata],
  ] as const) {
    it(`${file} matches the committed fixture (UPDATE_FIXTURES=1 to regenerate)`, async () => {
      const url = new URL(`./fixtures/${file}`, import.meta.url);
      if (process.env['UPDATE_FIXTURES']) await writeFile(url, stableJson(data));
      expect(stableJson(data)).toBe(await readFile(url, 'utf8'));
    });
  }

  it('is valid and diagnostic-free', () => {
    expect(validateCem(result.manifest)).toBe(true);
    expect(validateMote(result.metadata)).toBe(true);
    expect(result.diagnostics).toEqual([]);
  });
});

describe('dynamic definitions', () => {
  it('reports locations instead of guessing', () => {
    const result = analyze({ project: path('tests/fixtures/analyzer-dynamic/tsconfig.json') });
    expect(result.diagnostics.map((d) => [d.code, d.source?.line])).toEqual([
      ['analyzer.dynamic.property', 10],
      ['analyzer.dynamic.property', 11],
      ['analyzer.dynamic.value', 12],
    ]);
    expect(
      declaration(result.manifest, 'DynamicElement').members.map((m) => [
        m['name'],
        m['default'] ?? null,
      ]),
    ).toEqual([
      ['size', null],
      ['open', 'false'],
    ]);
  });
});
