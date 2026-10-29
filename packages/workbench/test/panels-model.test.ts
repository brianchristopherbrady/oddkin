import { readFileSync } from 'node:fs';
import { Ajv2020 } from 'ajv/dist/2020.js';
import { describe, expect, it } from 'vitest';
import type { ComponentPageData } from '../src/data/index.js';
import {
  classifyType,
  componentFacts,
  decodeShare,
  defaultWriteMode,
  encodeShare,
  initialState,
  intendedUse,
  pageCoverage,
  presets,
  sharePayload,
  snippet,
  unionMembers,
  usagePairs,
} from '../src/panels/model.js';

const page = (overrides: Partial<ComponentPageData> = {}): ComponentPageData => ({
  format: 'oddkin.workbench-page',
  version: 1,
  id: 'components/x-box',
  kind: 'component',
  tag: 'x-box',
  package: '@x/ui',
  module: 'dist/box.js',
  declaration: {
    members: [
      { kind: 'field', name: 'tone', type: { text: "'a' | 'b'" }, attribute: 'tone' },
      { kind: 'field', name: 'open', type: { text: 'boolean' }, attribute: 'open', reflects: true },
      { kind: 'field', name: 'items', type: { text: 'string[]' } },
      { kind: 'field', name: 'size', type: { text: 'number | undefined' }, attribute: 'size' },
      { kind: 'field', name: 'node', type: { text: 'Node | null' } },
      { kind: 'field', name: 'form', type: { text: 'HTMLFormElement' }, readonly: true },
      { kind: 'field', name: 'hidden2', privacy: 'protected', type: { text: 'string' } },
      { kind: 'field', name: 'shared', static: true, type: { text: 'string' } },
      { kind: 'method', name: 'show' },
    ],
    attributes: [
      { name: 'tone', fieldName: 'tone' },
      { name: 'legacy-mode', type: { text: 'boolean' } },
    ],
    events: [{ name: 'x-change' }],
    slots: [{ name: '' }, { name: 'end' }],
  },
  enrichment: {
    registration: '@x/ui/define/box',
    propertyOnly: [{ property: 'property:x-box#items' }],
    syncPairs: [{ property: 'tone', event: 'x-change' }, { property: 1 }],
  },
  examples: [
    {
      id: 'example:x-box/default',
      name: 'default',
      definition: { label: 'Default', slots: { default: 'Hi <b>' }, preset: true },
    },
    {
      id: 'example:x-box/fancy',
      name: 'fancy',
      definition: { label: 'Fancy', props: { tone: 'b' }, attributes: { open: '' }, preset: true },
    },
    { id: 'example:x-box/wired', name: 'wired', definition: { label: 'Wired', hasFixture: true } },
    { id: 'example:x-box/bare', name: 'bare', incorrect: { correct: 'default' } },
  ],
  ...overrides,
});

const shareSchema = () =>
  new Ajv2020({ strict: true, strictRequired: false, allowUnionTypes: true }).compile(
    JSON.parse(
      readFileSync(
        new URL('../../../docs/schemas/share-payload.v1.schema.json', import.meta.url),
        'utf8',
      ),
    ) as object,
  );

describe('detail model', () => {
  it('splits unions at the top level only', () => {
    expect(unionMembers(`'a|b' | Map<string, 1 | 2> | { x: 1 | 2 }`)).toEqual([
      "'a|b'",
      'Map<string, 1 | 2>',
      '{ x: 1 | 2 }',
    ]);
  });

  it('classifies declared types into controls, never guessing', () => {
    expect(classifyType(`"x" | 'y'`)).toEqual({
      control: 'enum',
      values: ['x', 'y'],
      nullable: false,
    });
    expect(classifyType('boolean')).toEqual({ control: 'boolean', nullable: false });
    expect(classifyType('string | null')).toEqual({ control: 'string', nullable: true });
    expect(classifyType('number | undefined')).toEqual({ control: 'number', nullable: false });
    expect(classifyType('readonly string[]')).toEqual({ control: 'json', nullable: false });
    expect(classifyType('string | number')).toEqual({ control: 'fixture', nullable: false });
    expect(classifyType('(x: string) => void')).toEqual({ control: 'fixture', nullable: false });
    expect(classifyType('null | undefined')).toEqual({ control: 'fixture', nullable: true });
  });

  it('projects public instance fields and attribute-only entries into API rows', () => {
    const facts = componentFacts(page());
    expect(facts.rows.map((r) => [r.id, r.control, r.attribute ?? null])).toEqual([
      ['property:x-box#tone', 'enum', 'tone'],
      ['property:x-box#open', 'boolean', 'open'],
      ['property:x-box#items', 'json', null],
      ['property:x-box#size', 'number', 'size'],
      ['property:x-box#node', 'fixture', null],
      ['property:x-box#form', 'readonly', null],
      ['property:x-box#legacy-mode', 'boolean', 'legacy-mode'],
    ]);
    const [tone, open, items, , , , legacy] = facts.rows;
    expect(open!.reflects).toBe(true);
    expect(items!.propertyOnly).toBe(true);
    expect(defaultWriteMode(tone!)).toBe('attribute');
    expect(defaultWriteMode(items!)).toBe('property');
    expect(defaultWriteMode(legacy!)).toBe('attribute');
    expect(facts.methods.map((m) => m.name)).toEqual(['show']);
    expect(facts.slots.map((s) => s.name)).toEqual(['', 'end']);
    expect(facts.syncPairs).toEqual([{ property: 'tone', event: 'x-change' }]);
  });

  it('builds presets from published example values and starts from the default', () => {
    const entries = presets(page());
    expect(entries.map((p) => [p.name, p.label, !!p.state, p.requiresFixture])).toEqual([
      ['default', 'Default', true, false],
      ['fancy', 'Fancy', true, false],
      ['wired', 'Wired', false, true],
      ['bare', 'bare', false, false],
    ]);
    expect(entries[3]!.incorrect).toEqual({ correct: 'default' });
    expect(initialState(page())).toEqual({
      preset: 'default',
      attributes: {},
      properties: {},
      slots: { '': 'Hi <b>' },
    });
    expect(initialState(page({ examples: [] }))).toEqual({
      preset: 'default',
      attributes: {},
      properties: {},
      slots: {},
    });
  });

  it('writes plain HTML and JavaScript snippets with escaped values', () => {
    const code = snippet(
      page(),
      {
        preset: 'fancy',
        attributes: { open: '', tone: 'a"b' },
        properties: { items: ['x'] },
        slots: { '': '<i>', end: 'E' },
      },
      { settings: { mode: 'dark', direction: 'rtl' } },
    );
    expect(code).toBe(`<script type="module">
  import '@x/ui/define/box';

  const element = document.querySelector('x-box');
  element.items = ["x"];
  element.addEventListener('x-change', (event) => console.log(event.type, event.detail));
</script>
<div data-odd-mode="dark" dir="rtl">
  <x-box open tone="a&quot;b">
    &lt;i&gt;
    <span slot="end">E</span>
  </x-box>
</div>
`);
    expect(snippet(page({ enrichment: {} }), initialState(page()))).toContain(
      'No registration entry is published for <x-box>',
    );
  });

  it('writes share links in the share-payload.v1 shape and validates them on the way back', () => {
    const validate = shareSchema();
    const payload = sharePayload(
      'x-box',
      {
        preset: 'fancy',
        attributes: { tone: 'b' },
        properties: { items: ['é'], size: 0 },
        slots: { '': 'Hi', end: 'E' },
      },
      { mode: 'dark', direction: 'rtl', width: 640 },
    );
    expect(payload).toEqual({
      v: 1,
      kind: 'component',
      component: 'x-box',
      preset: 'fancy',
      props: { items: ['é'], size: 0 },
      attributes: { tone: 'b' },
      slots: { default: 'Hi', end: 'E' },
      preview: { mode: 'dark', direction: 'rtl', width: 640 },
    });
    expect(validate(payload), JSON.stringify(validate.errors)).toBe(true);
    const minimal = sharePayload('x-box', initialState(page({ examples: [] })), {
      sameAsSite: true,
      width: 'fill',
    });
    expect(validate(minimal), JSON.stringify(validate.errors)).toBe(true);
    expect(minimal).not.toHaveProperty('props');

    const decoded = decodeShare(page(), encodeShare(payload));
    expect(decoded).toEqual({
      state: {
        preset: 'fancy',
        attributes: { tone: 'b' },
        properties: { items: ['é'], size: 0 },
        slots: { '': 'Hi', end: 'E' },
      },
      preview: { mode: 'dark', direction: 'rtl', width: 640 },
      problems: [],
    });
  });

  it('makes fixture examples presets when the page names its example module', () => {
    const wired = (data: ComponentPageData) => presets(data).find((p) => p.name === 'wired')!;
    expect(wired(page())).toMatchObject({ fixture: true, requiresFixture: true });
    expect(wired(page())).not.toHaveProperty('state');
    const served = page({ exampleModule: '/_oddkin/examples/x-box.js' });
    expect(wired(served)).toMatchObject({
      fixture: true,
      requiresFixture: false,
      state: { preset: 'wired', attributes: {}, properties: {}, slots: {} },
    });
    expect(snippet(served, wired(served).state!)).toContain(
      '// The "wired" example also runs setup code: its fixture in defineExamples.',
    );
    expect(snippet(served, initialState(served))).not.toContain('setup code');
  });

  it('carries declared CSS custom properties in snippets and share links', () => {
    const styled = page({
      declaration: {
        ...page().declaration,
        cssProperties: [
          { name: '--x-box-accent', syntax: '<color>', default: 'teal', description: 'Accent.' },
          { name: '--x-box-gap', type: { text: 'length' } },
          { name: 'color' },
        ],
      },
    });
    expect(componentFacts(styled).cssProperties).toEqual([
      { name: '--x-box-accent', description: 'Accent.', type: '<color>', default: 'teal' },
      { name: '--x-box-gap', type: 'length' },
      { name: 'color' },
    ]);
    const state = { ...initialState(styled), styles: { '--x-box-accent': 'a"b' } };
    expect(snippet(styled, state)).toContain(
      `  element.style.setProperty("--x-box-accent", "a\\"b");`,
    );
    const payload = sharePayload('x-box', state);
    expect(payload.styles).toEqual({ '--x-box-accent': 'a"b' });
    const validate = shareSchema();
    expect(validate(payload), JSON.stringify(validate.errors)).toBe(true);
    expect(validate({ ...payload, styles: { color: 'red' } })).toBe(false);
    // Only declared custom properties come back; a declared name that is not one is dropped too.
    const decoded = decodeShare(
      styled,
      encodeShare({
        ...payload,
        styles: { ...payload.styles, '--x-box-other': '1', color: 'red' },
      }),
    );
    expect(decoded.state?.styles).toEqual({ '--x-box-accent': 'a"b' });
    expect(decoded.problems).toEqual([
      'Ignored CSS custom property "--x-box-other".',
      'Ignored CSS custom property "color".',
    ]);
    // None set: neither the link nor the state names any.
    const plain = sharePayload('x-box', initialState(styled));
    expect(plain).not.toHaveProperty('styles');
    expect(decodeShare(styled, encodeShare(plain)).state).not.toHaveProperty('styles');
  });

  it('drops what the contract does not declare, and rejects foreign or unsupported links', () => {
    const encoded = encodeShare({
      v: 1,
      kind: 'component',
      component: 'x-box',
      preset: 'fancy',
      attributes: { tone: 'b', secret: 'x' },
      props: { items: ['é'], node: 1, form: 2, size: 0 },
      slots: { end: 'E', nope: 'N' },
      preview: { mode: 'dark', width: 99999, sameAsSite: false },
    });
    const { state, preview, problems } = decodeShare(page(), encoded);
    expect(state).toEqual({
      preset: 'fancy',
      attributes: { tone: 'b' },
      properties: { items: ['é'], size: 0 },
      slots: { end: 'E' },
    });
    expect(preview).toEqual({ mode: 'dark' });
    expect(problems).toEqual([
      'Ignored slot "nope".',
      'Ignored attribute "secret".',
      'Ignored property "node".',
      'Ignored property "form".',
    ]);
    expect(decodeShare(page(), 'not base64!').problems).toEqual(['The preview link is not valid.']);
    const other = encodeShare(sharePayload('y-box', initialState(page())));
    expect(decodeShare(page(), other)).toEqual({
      problems: ['The preview link is for another component.'],
    });
    for (const unsupported of [
      { v: 2, kind: 'component', component: 'x-box' },
      { v: 1, kind: 'theme', config: {} },
    ])
      expect(
        decodeShare(page(), Buffer.from(JSON.stringify(unsupported)).toString('base64url'))
          .problems,
      ).toEqual(['The preview link uses an unsupported version.']);
  });

  it('gives every page item a state: documented, declared none, or missing with its source', () => {
    const states = (data: ComponentPageData) =>
      Object.fromEntries(pageCoverage(data).map((item) => [item.id, item.state]));
    expect(states(page())).toEqual({
      'overview/description': 'missing',
      'source/register': 'documented',
      'interactive-example/presets': 'documented',
      'interactive-example/preview': 'documented',
      'api/properties': 'documented',
      'api/slots': 'documented',
      'api/events': 'documented',
      'api/methods': 'documented',
      'api/parts': 'none',
      'api/css-properties': 'none',
      'api/css-states': 'none',
      'examples/examples': 'documented',
      'tokens/style-mappings': 'none',
      'tokens/token-reads': 'none',
      'behavior-and-accessibility/a11y': 'missing',
      'behavior-and-accessibility/keyboard': 'missing',
      'guidance/use-for': 'missing',
      'guidance/not-for': 'missing',
      'guidance/usage-pairs': 'documented',
      'source/module': 'documented',
      'known-limitations/limitations': 'none',
    });
    const coverage = pageCoverage(page());
    const at = (id: string) => coverage.find((item) => item.id === id);
    expect(at('guidance/use-for')).toEqual({
      id: 'guidance/use-for',
      section: 'guidance',
      state: 'missing',
      source: '@useFor',
    });
    expect(at('api/parts')).toMatchObject({ state: 'none', empty: 'None declared.' });
    // Entries listed without a description are named, so their rows can say so.
    expect(at('api/slots')?.undocumented).toEqual(['(default)', 'end']);
    expect(at('api/properties')?.undocumented).toContain('legacy-mode');
    // The editable properties and slots render as the interactive example's controls.
    expect([at('api/properties')?.section, at('api/slots')?.section]).toEqual([
      'interactive-example',
      'interactive-example',
    ]);
    expect(at('api/events')?.section).toBe('api');
    expect(at('api/css-properties')).toMatchObject({
      section: 'interactive-example',
      state: 'none',
      empty: 'No CSS custom properties are declared.',
    });
    // In page order (Figma 20:2190): the example's controls, Source and package, the examples,
    // then the reference cards.
    expect(coverage.map((item) => item.id).slice(3, 13)).toEqual([
      'api/properties',
      'api/slots',
      'api/css-properties',
      'source/module',
      'source/register',
      'examples/examples',
      'api/events',
      'api/parts',
      'api/methods',
      'api/css-states',
    ]);

    // Nothing registered and no examples: the preview, the import, presets, and examples are missing.
    const bare = states(page({ enrichment: {}, examples: [] }));
    expect(bare).toMatchObject({
      'source/register': 'missing',
      'interactive-example/preview': 'missing',
      'interactive-example/presets': 'missing',
      'examples/examples': 'missing',
      'guidance/usage-pairs': 'missing',
    });
    // An example set without published values lists examples but has no presets.
    expect(
      states(page({ examples: [{ id: 'example:x-box/default', name: 'default' }] })),
    ).toMatchObject({
      'interactive-example/presets': 'missing',
      'examples/examples': 'documented',
    });
  });

  it('pairs each explained mistake with the correct example it names, by name or id', () => {
    expect(usagePairs(page()).map((p) => [p.incorrect.name, p.correct?.name])).toEqual([
      ['bare', 'default'],
    ]);
    const byId = page({
      examples: [
        { id: 'example:x-box/good', name: 'good', definition: { label: 'Good' } },
        { id: 'example:x-box/bad', name: 'bad', incorrect: { correct: 'example:x-box/good' } },
        { id: 'example:x-box/lost', name: 'lost', incorrect: { correct: 'example:x-box/gone' } },
      ],
    });
    expect(usagePairs(byId).map((p) => [p.incorrect.name, p.correct?.name])).toEqual([
      ['bad', 'good'],
      ['lost', undefined],
    ]);
  });

  it('takes intended use from authored content over the enrichment, and lists authored guidance', () => {
    const enriched = page({
      enrichment: { useFor: [{ value: 'Grouping.' }], notFor: ['Navigation.'] },
    });
    expect(intendedUse(enriched)).toEqual({ useFor: ['Grouping.'], notFor: ['Navigation.'] });
    const authored = page({
      enrichment: { useFor: [{ value: 'Grouping.' }] },
      authored: { useFor: ['Authored.'], guidance: 'Prefer one per view.' },
    });
    expect(intendedUse(authored)).toEqual({ useFor: ['Authored.'], notFor: [] });
    expect(pageCoverage(authored).find((item) => item.id === 'guidance/authored')?.state).toBe(
      'documented',
    );
    expect(pageCoverage(enriched).some((item) => item.id === 'guidance/authored')).toBe(false);
  });
});
