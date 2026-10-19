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
const oddkinSchema = JSON.parse(
  await readFile(new URL('docs/schemas/oddkin-metadata.v1.schema.json', repo), 'utf8'),
) as object;
const cemAjv = new Ajv({ allErrors: true, strict: false });
const validateCem = cemAjv.compile(cemSchema);
// Same options as tests/schemas: the fact definition's if/then uses "not: { required }".
const oddkinAjv = new Ajv2020({
  allErrors: true,
  strict: true,
  strictRequired: false,
  allowUnionTypes: true,
});
addFormats.default(oddkinAjv);
const validateOddkin = oddkinAjv.compile(oddkinSchema);

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

  it('emits a valid Custom Elements Manifest (pinned 2.1.0 schema) and valid oddkin.metadata.json', () => {
    expect(validateCem(result.manifest), JSON.stringify(validateCem.errors)).toBe(true);
    expect(validateOddkin(result.metadata), JSON.stringify(validateOddkin.errors)).toBe(true);
  });

  it('never executes library modules', () => {
    // alert.ts throws at module evaluation; analysis completed and extracted it.
    expect(declaration(result.manifest, 'AcmeAlert')).toBeDefined();
  });

  it('extracts properties, attributes, reflection, defaults, events, members, slots, parts, CSS properties, and states', () => {
    const panel = declaration(result.manifest, 'AcmePanel');
    expect(panel).toMatchObject({
      tagName: 'acme-panel',
      superclass: { name: 'OddkinElement', package: '@oddkin/core' },
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
    ['core-counter.oddkin.metadata.json', result.metadata],
  ] as const) {
    it(`${file} matches the committed fixture (UPDATE_FIXTURES=1 to regenerate)`, async () => {
      const url = new URL(`./fixtures/${file}`, import.meta.url);
      if (process.env['UPDATE_FIXTURES']) await writeFile(url, stableJson(data));
      expect(stableJson(data)).toBe(await readFile(url, 'utf8'));
    });
  }

  it('is valid and diagnostic-free', () => {
    expect(validateCem(result.manifest)).toBe(true);
    expect(validateOddkin(result.metadata)).toBe(true);
    expect(result.diagnostics).toEqual([]);
  });
});

describe('dynamic definitions and explicit metadata', () => {
  const result = analyze({ project: path('tests/fixtures/analyzer-dynamic/tsconfig.json') });

  it('reports dynamic entries with locations, downgraded to info when explicit metadata covers the class', () => {
    expect(
      result.diagnostics
        .filter((d) => d.source?.file === 'src/elements.ts')
        .map((d) => [d.code, d.severity, d.source?.line]),
    ).toEqual([
      ['analyzer.dynamic.property', 'info', 11],
      ['analyzer.dynamic.property', 'info', 12],
      ['analyzer.dynamic.value', 'info', 13],
    ]);
  });

  it('merges explicit metadata over extracted facts with authored provenance', () => {
    const element = declaration(result.manifest, 'DynamicElement');
    expect(element['description']).toBe(
      'An element whose properties are partly defined at runtime.',
    );
    expect(
      element.members.map((m) => [
        m['name'],
        (m['type'] as { text: string }).text,
        m['default'] ?? null,
      ]),
    ).toEqual([
      ['size', 'number', '3.141592653589793'],
      ['open', 'boolean', 'false'],
      ['tone', 'string | undefined', null],
      ['label', 'string | undefined', null],
    ]);
    const metadata = result.metadata as {
      components: Record<string, { authored?: Array<{ id: string; source: { file: string } }> }>;
    };
    expect(
      metadata.components['component:dynamic-element']?.authored?.map((a) => [a.id, a.source.file]),
    ).toEqual([
      ['property:dynamic-element#tone', 'src/elements.metadata.json'],
      ['property:dynamic-element#label', 'src/elements.metadata.json'],
      ['property:dynamic-element#size', 'src/elements.metadata.json'],
    ]);
    expect(validateOddkin(result.metadata), JSON.stringify(validateOddkin.errors)).toBe(true);
    expect(validateCem(result.manifest)).toBe(true);
  });
});

describe('compose() definitions in a folder-structured library', () => {
  const composed = analyze({ project: path('tests/fixtures/analyzer-composed/tsconfig.json') });
  const colocated = analyze({ project: path('tests/fixtures/analyzer-library/tsconfig.json') });
  const anyModule = (value: unknown) =>
    JSON.parse(JSON.stringify(value).replaceAll(/"module":"[^"]*"/g, '"module":"*"')) as unknown;

  it('records colocated examples by parsing them, though the program excludes them', () => {
    expect((composed.metadata as { examples?: unknown }).examples).toEqual({
      'example:acme-panel/default': {
        component: 'component:acme-panel',
        name: 'default',
        file: 'src/panel/panel.examples.ts',
        previewRoles: ['role:surface'],
      },
      'example:acme-panel/dismissible': {
        component: 'component:acme-panel',
        name: 'dismissible',
        file: 'src/panel/panel.examples.ts',
        hasFixture: true,
      },
      'example:acme-panel/dismissibleFalse': {
        component: 'component:acme-panel',
        name: 'dismissibleFalse',
        file: 'src/panel/panel.examples.ts',
        incorrect: { diagnostic: 'usage.boolean.false', correct: 'example:acme-panel/default' },
      },
      'example:acme-panel/withAlert': {
        component: 'component:acme-panel',
        name: 'withAlert',
        file: 'src/panel/panel.examples.ts',
        hasFixture: true,
        uses: ['component:acme-alert'],
      },
    });
    expect(composed.program.getSourceFiles().some((f) => f.fileName.endsWith('.examples.ts'))).toBe(
      false,
    );
  });

  it('reports examples it cannot read statically and examples of unknown elements', () => {
    const dynamic = analyze({ project: path('tests/fixtures/analyzer-dynamic/tsconfig.json') });
    expect(
      dynamic.diagnostics
        .filter((d) => d.source?.file === 'src/dynamic.examples.ts')
        .map((d) => [d.code, d.severity, d.source?.line]),
    ).toEqual([
      ['analyzer.examples.dynamic', 'warning', 9],
      ['analyzer.examples.dynamic', 'warning', 10],
      ['analyzer.examples.unknownComponent', 'warning', 11],
      ['analyzer.examples.dynamic', 'warning', 13],
    ]);
    expect(Object.keys((dynamic.metadata as { examples: object }).examples)).toEqual([
      'example:acme-missing/default',
      'example:dynamic-element/roles',
    ]);
  });

  it('emits valid, diagnostic-free outputs without executing modules', () => {
    expect(validateCem(composed.manifest), JSON.stringify(validateCem.errors)).toBe(true);
    expect(validateOddkin(composed.metadata), JSON.stringify(validateOddkin.errors)).toBe(true);
    expect(composed.diagnostics).toEqual([]);
  });

  it('describes each element exactly as the equivalent colocated class does', () => {
    for (const name of ['AcmePanel', 'AcmeAlert']) {
      expect(anyModule(declaration(composed.manifest, name))).toEqual(
        anyModule(declaration(colocated.manifest, name)),
      );
    }
  });

  it('excludes @internal members used only by templates', () => {
    const names = declaration(composed.manifest, 'AcmePanel').members.map((m) => m['name']);
    expect(names).not.toContain('onDismissClick');
  });

  it('records registrations from define(definition) entries with their export specifiers', () => {
    const metadata = composed.metadata as {
      components: Record<string, { registration: string; definition?: Record<string, unknown> }>;
    };
    expect(metadata.components['component:acme-panel']?.registration).toBe(
      '@acme/ui-composed/define/panel',
    );
    expect(metadata.components['component:acme-panel']?.definition).toEqual({
      ref: { module: 'dist/panel/panel.definition.js', name: 'panelDefinition' },
      template: { module: 'dist/panel/panel.template.js', name: 'panelTemplate' },
      styles: [{ module: 'dist/panel/panel.styles.js', name: 'panelStyles' }],
    });
    expect(metadata.components['component:acme-alert']?.definition).toEqual({
      ref: { module: 'dist/alert/alert.definition.js', name: 'alertDefinition' },
      extends: 'component:acme-panel',
      template: { module: 'dist/panel/panel.template.js', name: 'panelTemplate' },
      styles: [{ module: 'dist/panel/panel.styles.js', name: 'panelStyles' }],
      dependencies: { panel: 'component:acme-panel' },
    });
    const exportsOf = (path: string) =>
      (composed.manifest['modules'] as Array<{ path: string; exports: Array<{ kind: string }> }>)
        .find((m) => m.path === path)
        ?.exports.map((e) => e.kind);
    expect(exportsOf('dist/panel/panel.define.js')).toEqual(['custom-element-definition']);
    expect(exportsOf('dist/panel/index.js')).toEqual(['js']);
  });

  it('takes slots, parts, CSS properties, and token reads from the template and styles', () => {
    const metadata = composed.metadata as {
      components: Record<string, { tokenReads?: Array<{ token: string }> }>;
    };
    expect(metadata.components['component:acme-panel']?.tokenReads?.map((t) => t.token)).toEqual([
      '--odd-color-text-primary',
      'layout.inset',
    ]);
    expect(declaration(composed.manifest, 'AcmePanel')['cssParts']).toEqual([
      { name: 'body', description: 'The content area.' },
      { name: 'dismiss', description: '' },
      { name: 'frame', description: '' },
    ]);
  });

  it('reports definitions it cannot resolve', () => {
    const dynamic = analyze({ project: path('tests/fixtures/analyzer-dynamic/tsconfig.json') });
    expect(
      dynamic.diagnostics
        .filter((d) => d.source?.file === 'src/definitions.ts')
        .map((d) => [d.code, d.source?.line]),
    ).toEqual([
      ['analyzer.dynamic.tagName', 7],
      ['analyzer.dynamic.registration', 10],
      ['analyzer.dynamic.definition', 13],
    ]);
    const registered = Object.keys(
      (dynamic.metadata as { components: Record<string, unknown> }).components,
    );
    expect(registered).toEqual([
      'component:dyn-events',
      'component:dyn-keyed',
      'component:dynamic-element',
    ]);
  });

  it('records an event intent it cannot read literally as unknown, with a diagnostic', () => {
    const dynamic = analyze({ project: path('tests/fixtures/analyzer-dynamic/tsconfig.json') });
    expect(
      dynamic.diagnostics
        .filter((d) => d.source?.file === 'src/events.ts')
        .map((d) => [d.code, d.source?.line]),
    ).toEqual([
      ['analyzer.dynamic.value', 10],
      ['analyzer.event.undeclared', 25],
      ['analyzer.event.key', 33],
    ]);
    const metadata = dynamic.metadata as {
      components: Record<string, { events?: unknown }>;
    };
    expect(metadata.components['component:dyn-events']?.events).toEqual([
      { event: 'event:dyn-events#dyn-computed', intent: { known: false, provenance: 'extracted' } },
    ]);
  });

  it('reports an event the element emits without declaring it', () => {
    const dynamic = analyze({ project: path('tests/fixtures/analyzer-dynamic/tsconfig.json') });
    const undeclared = dynamic.diagnostics.filter((d) => d.code === 'analyzer.event.undeclared');
    expect(undeclared.map((d) => [d.severity, d.source?.file, d.source?.line])).toEqual([
      ['warning', 'src/events.ts', 25],
    ]);
    expect(undeclared[0]?.message).toContain('"dyn-undeclared"');
    // The declared event it also emits is not reported, and nothing is added to the contract.
    expect(
      (declaration(dynamic.manifest, 'EventsElement')['events'] as { name: string }[]).map(
        (e) => e.name,
      ),
    ).toEqual(['dyn-computed']);
  });

  it('reports a static events key that differs from the event name once listeners are typed', () => {
    const dynamic = analyze({ project: path('tests/fixtures/analyzer-dynamic/tsconfig.json') });
    const keys = dynamic.diagnostics.filter((d) => d.code === 'analyzer.event.key');
    expect(keys.map((d) => [d.severity, d.source?.line])).toEqual([['warning', 33]]);
    expect(keys[0]?.message).toContain('"pinged" differs from the event name "dyn-undeclared"');
    // EventsElement keys by variable name ({ computedIntent }) but declares no typed listeners.
    expect(keys.some((d) => d.message.startsWith('EventsElement'))).toBe(false);
  });
});

describe('lifecycle and customization facts', () => {
  const result = analyze({ project: path('tests/fixtures/analyzer-lifecycle/tsconfig.json') });
  const metadata = result.metadata as {
    components: Record<string, Record<string, unknown>>;
  };

  it('records authored deprecations with stable replacement ids, in CEM and metadata', () => {
    expect(validateCem(result.manifest), JSON.stringify(validateCem.errors)).toBe(true);
    expect(validateOddkin(result.metadata), JSON.stringify(validateOddkin.errors)).toBe(true);
    const at = (line: number, column: number) => ({ file: 'src/banner.ts', line, column });
    expect(metadata.components['component:acme-banner']?.['deprecations']).toEqual([
      {
        id: 'property:acme-banner#kind',
        reason: 'Use `tone`; `kind` maps to the same values.',
        replacement: 'property:acme-banner#tone',
        migration: 'migrations/2.0.md#banner-kind',
        provenance: 'authored',
        source: at(29, 6),
      },
      {
        id: 'event:acme-banner#acme-close',
        reason: 'Listen for `acme-dismiss` instead; it carries the reason.',
        replacement: 'event:acme-banner#acme-dismiss',
        provenance: 'authored',
        source: at(5, 4),
      },
    ]);
    expect(metadata.components['component:acme-notice']?.['deprecations']).toEqual([
      {
        id: 'component:acme-notice',
        reason: 'Use `<acme-banner>`.',
        replacement: 'component:acme-banner',
        migration: 'migrations/2.0.md#notice',
        provenance: 'authored',
        source: at(43, 4),
      },
    ]);
    // Standard CEM carries the reasons, so any CEM consumer can warn.
    const banner = declaration(result.manifest, 'AcmeBanner') as unknown as {
      members: { name: string; deprecated?: unknown }[];
      attributes: { name: string; deprecated?: unknown }[];
      events: { name: string; deprecated?: unknown }[];
    };
    expect(banner.members.filter((m) => m.deprecated).map((m) => m.name)).toEqual(['kind']);
    expect(banner.attributes.filter((a) => a.deprecated).map((a) => a.name)).toEqual(['kind']);
    expect(banner.events.filter((e) => e.deprecated).map((e) => e.name)).toEqual(['acme-close']);
    expect(declaration(result.manifest, 'AcmeNotice')['deprecated']).toBe('Use `<acme-banner>`.');
    // @since says when something was introduced, not when it was deprecated.
    expect(metadata.components['component:acme-banner']?.['since']).toEqual({
      value: '1.0.0',
      provenance: 'authored',
      source: at(24, 4),
    });
  });

  it('records customization paths, with ladder levels only when authored and valid', () => {
    expect(metadata.components['component:acme-banner']?.['customization']).toEqual({
      levels: {
        value: [1, 2],
        provenance: 'authored',
        source: { file: 'src/banner.ts', line: 25, column: 4 },
      },
      variables: ['cssprop:acme-banner#--acme-banner-gap'],
      parts: ['part:acme-banner#body'],
      slots: ['slot:acme-banner#default'],
    });
    expect(metadata.components['component:acme-notice']?.['customization']).toEqual({
      levels: { known: false, provenance: 'extracted' },
      variables: [],
      parts: [],
      slots: [],
    });
    expect(result.diagnostics.map((d) => [d.code, d.severity, d.source?.line])).toEqual([
      ['analyzer.tag.invalid', 'warning', 47],
    ]);
  });
});
