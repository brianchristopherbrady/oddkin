import { afterEach, describe, expect, it } from 'vitest';
import { settled } from '@oddkin/core/reactive';
import { scopeStats } from '@oddkin/core/scope';
import '../src/panels/component-define.js';
import '../src/panels/foundation-define.js';
import '../src/panels/catalog-define.js';
import { buildWorkbenchData, type WorkbenchData } from '../src/data/index.js';
import type { CemPackage, OddkinMetadataLike } from '../src/pages/index.js';
import type { OddkinComponentPanel } from '../src/panels/component.js';
import { previewProtocolStats } from '../src/preview/frame.js';

// The public panels (`@oddkin/workbench/panels/*`) over a probe component that records every
// property assignment and attribute change, so each control's exact write can be asserted.

const frameUrl = new URL('./fixtures/frame-test.html', import.meta.url).href;
const probeUrl = new URL('./fixtures/probe-element.ts', import.meta.url).href;

const probeCem: CemPackage = {
  schemaVersion: '2.1.0',
  modules: [
    {
      kind: 'javascript-module',
      path: 'dist/probe.js',
      declarations: [
        {
          kind: 'class',
          name: 'WbProbe',
          customElement: true,
          tagName: 'wb-probe',
          description: 'Records writes.\n\nUsed by the panel tests.',
          members: [
            {
              kind: 'field',
              name: 'tone',
              type: { text: '"calm" | "loud"' },
              default: "'calm'",
              attribute: 'tone',
              description: 'Tone.',
            },
            {
              kind: 'field',
              name: 'open',
              type: { text: 'boolean' },
              default: 'false',
              attribute: 'open',
              reflects: true,
              description: 'Open.',
            },
            {
              kind: 'field',
              name: 'label',
              type: { text: 'string | null' },
              default: "''",
              attribute: 'label',
            },
            {
              kind: 'field',
              name: 'count',
              type: { text: 'number' },
              default: '0',
              attribute: 'count',
              description: 'Count.',
            },
            { kind: 'field', name: 'items', type: { text: 'string[]' }, description: 'Items.' },
            {
              kind: 'field',
              name: 'value',
              type: { text: 'string' },
              default: "''",
              description: 'Value.',
            },
            { kind: 'field', name: 'renderer', type: { text: '(item: string) => Node' } },
            {
              kind: 'field',
              name: 'form',
              type: { text: 'HTMLFormElement | null' },
              readonly: true,
            },
            { kind: 'field', name: '#secret', privacy: 'private' },
            { kind: 'method', name: 'focusInput', description: 'Focuses the input.' },
          ],
          attributes: [
            { name: 'tone', fieldName: 'tone' },
            { name: 'open', fieldName: 'open' },
            { name: 'label', fieldName: 'label' },
            { name: 'count', fieldName: 'count' },
          ],
          events: [{ name: 'wb-ping', type: { text: 'CustomEvent' }, description: 'Pinged.' }],
          slots: [{ name: '', description: 'Content.' }, { name: 'end' }],
          cssParts: [{ name: 'control', description: 'The control.' }],
        },
      ],
    },
  ],
} as unknown as CemPackage;

const probeMetadata = {
  components: {
    'component:wb-probe': {
      tag: 'wb-probe',
      registration: probeUrl,
      syncPairs: [{ property: 'value', event: 'input' }],
      propertyOnly: [{ property: 'property:wb-probe#items', provenance: 'extracted' }],
      styleMappings: [
        {
          when: 'default',
          part: 'control',
          cssProperty: 'gap',
          token: 'space.sm',
          provenance: 'extracted',
        },
      ],
      tokenReads: [
        { token: 'space.sm', kind: 'declared', readThrough: 'stylesheet' },
        { token: 'space.gone', kind: 'potential', readThrough: 'stylesheet' },
      ],
      keyboard: [{ value: 'Enter pings.', provenance: 'authored' }],
    },
  },
  examples: {
    'example:wb-probe/default': { component: 'component:wb-probe', name: 'default' },
    'example:wb-probe/loud': { component: 'component:wb-probe', name: 'loud' },
    'example:wb-probe/fixtureOnly': { component: 'component:wb-probe', name: 'fixtureOnly' },
  },
} as unknown as OddkinMetadataLike;

function probeData(): WorkbenchData {
  const { data, diagnostics } = buildWorkbenchData({
    config: { library: { packages: ['@probe/ui'] }, hosting: { routing: 'hash' } },
    libraries: [
      {
        name: '@probe/ui',
        version: '1.0.0',
        cem: probeCem,
        metadata: probeMetadata,
        examples: [
          {
            component: 'wb-probe',
            examples: {
              default: { label: 'Default', slots: { default: 'Hello' }, preset: true },
              loud: {
                label: 'Loud',
                props: { tone: 'loud', count: 3 },
                attributes: { label: 'Hey' },
                slots: { default: 'Loud!' },
                preset: true,
                guidance: 'Use when it must be heard.',
              },
              fixtureOnly: { label: 'Fixture only', hasFixture: true },
            },
          },
        ],
      },
    ],
    tokens: {
      tokens: [
        { name: 'space.sm', cssVariable: '--odd-space-sm', value: '0.75rem', origin: 'preset' },
      ],
    },
  });
  if (!data) throw new Error(JSON.stringify(diagnostics));
  return data;
}

async function until(check: () => boolean, what: string) {
  for (let i = 0; i < 400 && !check(); i++) await new Promise((r) => setTimeout(r, 10));
  if (!check()) throw new Error(`timed out waiting for ${what}`);
}

const mounted: HTMLElement[] = [];
afterEach(async () => {
  for (const element of mounted.splice(0)) element.remove();
  await settled();
  history.replaceState(null, '', location.pathname + location.search);
});

interface Probe extends HTMLElement {
  readonly writes: string[];
}

function componentPanel(data = probeData()) {
  const panel = document.createElement('oddkin-component-panel');
  panel.page = data.pages['components/wb-probe'] as never;
  panel.index = data.index;
  panel.href = (route) => `#${route}`;
  panel.frameUrl = frameUrl;
  mounted.push(panel);
  document.body.append(panel);
  const root = panel.shadowRoot!;
  const frames = () => [...root.querySelectorAll('iframe')];
  const probe = (i = 0) =>
    frames()[i]?.contentDocument?.querySelector('wb-probe') as Probe | null | undefined;
  const row = (name: string) => root.querySelector(`tr[data-row="property:wb-probe#${name}"]`)!;
  const change = (
    element: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement,
    value: string,
  ) => {
    element.value = value;
    element.dispatchEvent(new Event('change', { bubbles: true }));
  };
  return { panel, root, frames, probe, row, change };
}

/** Wait for `n` new writes and return them. */
async function writesAfter(probe: () => Probe | null | undefined, start: number, n: number) {
  await until(() => (probe()?.writes.length ?? 0) >= start + n, `${n} write(s)`);
  await new Promise((r) => setTimeout(r, 30));
  return probe()!.writes.slice(start);
}

describe('<oddkin-component-panel>', () => {
  it('is an open shadow-DOM panel that renders every supplied section', async () => {
    const { panel, root, probe } = componentPanel();
    expect(panel.shadowRoot?.mode).toBe('open');
    await until(() => !!probe()?.isConnected, 'the probe preview');
    const sections = [...root.querySelectorAll('section')].map((s) => s.id);
    expect(sections).toEqual([
      'overview',
      'interactive-example',
      'api',
      'examples',
      'tokens',
      'behavior-and-accessibility',
      'source',
      'known-limitations',
    ]);
    const text = root.textContent ?? '';
    expect(root.querySelectorAll('#overview p')[0]?.textContent).toBe('Records writes.');
    expect(text).toContain('Not documented. Supplied by @useFor');
    expect(text).toContain('Not documented. Supplied by @a11y');
    expect(text).toContain('Enter pings.');
    expect(root.querySelector('#known-limitations')?.textContent).toContain('None documented.');
    expect(root.querySelector(`#overview pre`)?.textContent).toBe(`import '${probeUrl}';`);
    // Tokens: declared mappings and every read, with unknown values never guessed.
    const reads = [...root.querySelectorAll('[data-table="token-reads"] tbody tr')].map((tr) =>
      [...tr.querySelectorAll('td')].map((td) => td.textContent?.replace(/\s+/g, ' ').trim()),
    );
    expect(reads).toEqual([
      ['space.sm --odd-space-sm', 'declared', 'stylesheet', '0.75rem'],
      ['space.gone', 'potential', 'stylesheet', 'Unknown'],
    ]);
    expect(root.querySelectorAll('[data-table="style-mappings"] tbody tr')).toHaveLength(1);
    // Examples: authored ones listed; a fixture-only example is labelled, not applied.
    const examples = [...root.querySelectorAll('[data-example]')].map((li) =>
      li.getAttribute('data-example'),
    );
    expect(examples).toEqual([
      'example:wb-probe/default',
      'example:wb-probe/loud',
      'example:wb-probe/fixtureOnly',
    ]);
    expect(
      root.querySelector('[data-example="example:wb-probe/fixtureOnly"]')?.textContent,
    ).toContain('Requires fixture');
    // API rows: private members are skipped; a function needs a fixture; read-only is inspect-only.
    expect(
      [...root.querySelectorAll('tr[data-row]')].map((tr) => tr.getAttribute('data-row')),
    ).toEqual(
      ['tone', 'open', 'label', 'count', 'items', 'value', 'renderer', 'form'].map(
        (n) => `property:wb-probe#${n}`,
      ),
    );
    const { row } = {
      row: (n: string) => root.querySelector(`tr[data-row="property:wb-probe#${n}"]`)!,
    };
    expect(row('open').querySelector('th small')?.textContent).toBe('attr open, reflects');
    expect(row('items').querySelector('th small')?.textContent).toBe('property only');
    expect(row('renderer').textContent).toContain('Requires fixture');
    expect(row('form').textContent).toContain('Read-only');
    expect(row('form').querySelector('input, select, textarea')).toBeNull();
    expect(row('items').querySelector('[data-label="Default"]')?.textContent?.trim()).toBe(
      'Unknown',
    );
    expect(row('label').textContent).toContain('Not documented');
    expect(root.querySelector('[data-table="methods"]')?.textContent).toContain('focusInput');
  });

  it('writes each change once, as an attribute or a property, exactly per contract', async () => {
    const { root, probe, row, change } = componentPanel();
    await until(() => !!probe()?.isConnected, 'the probe preview');
    // The default example sets only slot content: no property or attribute writes.
    expect(probe()!.writes).toEqual([]);
    expect(probe()!.textContent).toBe('Hello');

    // Boolean attribute: presence, never the property.
    let start = probe()!.writes.length;
    row('open').querySelector<HTMLInputElement>('input[type="checkbox"]')!.click();
    expect(await writesAfter(probe, start, 1)).toEqual(['attr open=""']);
    start = probe()!.writes.length;
    row('open').querySelector<HTMLInputElement>('input[type="checkbox"]')!.click();
    expect(await writesAfter(probe, start, 1)).toEqual(['attr open=null']);

    // The same row as a boolean property: one assignment, no attribute written back.
    change(
      row('open').querySelector<HTMLSelectElement>('select[aria-label="Write open as"]')!,
      'property',
    );
    await settled();
    start = probe()!.writes.length;
    row('open').querySelector<HTMLInputElement>('input[type="checkbox"]')!.click();
    expect(await writesAfter(probe, start, 1)).toEqual(['prop open=true']);

    // '' is a value; Unset removes the attribute.
    start = probe()!.writes.length;
    change(row('label').querySelector<HTMLInputElement>('input[type="text"]')!, '');
    expect(await writesAfter(probe, start, 1)).toEqual(['attr label=""']);
    expect(row('label').textContent).toContain('empty string');
    start = probe()!.writes.length;
    [...row('label').querySelectorAll('button')]
      .find((b) => b.textContent?.trim() === 'Unset')!
      .click();
    expect(await writesAfter(probe, start, 1)).toEqual(['attr label=null']);

    // 0 is a number, not unset; a nullable property can be set to null.
    change(
      row('count').querySelector<HTMLSelectElement>('select[aria-label="Write count as"]')!,
      'property',
    );
    await settled();
    start = probe()!.writes.length;
    change(row('count').querySelector<HTMLInputElement>('input[type="number"]')!, '0');
    expect(await writesAfter(probe, start, 1)).toEqual(['prop count=0']);
    change(
      row('label').querySelector<HTMLSelectElement>('select[aria-label="Write label as"]')!,
      'property',
    );
    await settled();
    start = probe()!.writes.length;
    [...row('label').querySelectorAll('button')]
      .find((b) => b.textContent?.trim() === 'Set null')!
      .click();
    expect(await writesAfter(probe, start, 1)).toEqual(['prop label=null']);
    // Unsetting a property cannot un-assign it: a clean instance is mounted without it.
    const assigned = probe();
    [...row('label').querySelectorAll('button')]
      .find((b) => b.textContent?.trim() === 'Unset')!
      .click();
    await until(() => probe() !== assigned && !!probe()?.isConnected, 'a clean instance');
    expect(probe()!.writes).toEqual(['prop open=true', 'prop count=0']);

    // Enum as an attribute; a JSON array property; invalid JSON is reported and not written.
    start = probe()!.writes.length;
    change(row('tone').querySelector<HTMLSelectElement>('select[aria-label^="tone"]')!, 'loud');
    expect(await writesAfter(probe, start, 1)).toEqual(['attr tone="loud"']);
    start = probe()!.writes.length;
    change(row('items').querySelector('textarea')!, '["a","b"]');
    expect(await writesAfter(probe, start, 1)).toEqual(['prop items=["a","b"]']);
    start = probe()!.writes.length;
    change(row('items').querySelector('textarea')!, '{');
    await settled();
    expect(row('items').querySelector('[role="alert"]')?.textContent).toContain('Not written');
    await new Promise((r) => setTimeout(r, 50));
    expect(probe()!.writes.length).toBe(start);

    // Slot editors write light-DOM text, nothing else.
    start = probe()!.writes.length;
    change(root.querySelector<HTMLInputElement>('tr[data-slot="end"] input')!, 'After');
    await until(
      () => probe()!.querySelector('[slot="end"]')?.textContent === 'After',
      'the end slot',
    );
    expect(probe()!.writes.length).toBe(start);

    // The snippet reproduces the configuration with public imports and property assignments.
    const code = root.querySelector('.wb-snippet')?.textContent ?? '';
    expect(code).toContain(`import '${probeUrl}';`);
    expect(code).toContain('tone="loud"');
    expect(code).toContain('element.items = ["a","b"];');
    expect(code).toContain('element.count = 0;');
    expect(code).not.toContain('element.label');
    expect(code).toContain("element.addEventListener('wb-ping'");
    expect(code).toContain('<span slot="end">After</span>');
  });

  it('applies presets, logs declared events safely, syncs declared pairs, and resets in a fresh frame', async () => {
    const { panel, root, probe, change } = componentPanel();
    await until(() => !!probe()?.isConnected, 'the probe preview');
    const preset = [...root.querySelectorAll<HTMLSelectElement>('#interactive-example select')][0]!;
    expect([...preset.options].map((o) => o.value)).toEqual(['default', 'loud']);
    change(preset, 'loud');
    await until(() => probe()?.textContent === 'Loud!', 'the loud preset');
    expect(probe()!.writes).toEqual(['prop tone="loud"', 'prop count=3', 'attr label="Hey"']);

    probe()!.shadowRoot!.querySelector('button')!.click();
    await until(() => !!root.querySelector('.wb-log li'), 'the event log entry');
    const entry = root.querySelector('.wb-log li')!.textContent ?? '';
    expect(entry).toContain('wb-ping');
    expect(entry).toContain('bubbles');
    expect(entry).toContain('[Circular]');
    expect(entry).toContain('<wb-probe>');
    expect(entry).toContain('[Function handler]');
    expect(entry).toContain('[Error: boom]');
    expect(entry).toContain('"[Map]":1');

    // A declared sync pair mirrors the value; the host never writes it back.
    const input = probe()!.shadowRoot!.querySelector('input')!;
    input.value = 'typed';
    input.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
    await until(() => panel.previewState.properties['value'] === 'typed', 'the synced value');
    await new Promise((r) => setTimeout(r, 50));
    expect(probe()!.writes.some((w) => w.startsWith('prop value'))).toBe(false);

    // Reset: a new frame generation with the preset's authored values; the log is cleared.
    const generation = panel.previews[0]!.identity.generation;
    [...root.querySelectorAll('button')].find((b) => b.textContent === 'Reset')!.click();
    await until(() => panel.previews[0]!.identity.generation === generation + 1, 'a fresh frame');
    await until(() => probe()?.textContent === 'Loud!', 'the reset preset');
    expect(probe()!.writes).toEqual(['prop tone="loud"', 'prop count=3', 'attr label="Hey"']);
    expect(panel.previewState.properties).toEqual({ tone: 'loud', count: 3 });
    expect(root.querySelector('.wb-log li')).toBeNull();
  });

  it('copies a versioned example link that restores the configuration', async () => {
    const first = componentPanel();
    await until(() => !!first.probe()?.isConnected, 'the probe preview');
    first.change(
      first.row('tone').querySelector<HTMLSelectElement>('select[aria-label^="tone"]')!,
      'loud',
    );
    first.change(
      first.row('label').querySelector<HTMLInputElement>('input[type="text"]')!,
      'Shared',
    );
    await until(() => first.probe()!.writes.length === 2, 'two writes');
    [...first.root.querySelectorAll('button')]
      .find((b) => b.textContent === 'Copy example link')!
      .click();
    await until(
      () => !!first.root.querySelector<HTMLInputElement>('input[type="url"]')?.value,
      'the link',
    );
    const link = first.root.querySelector<HTMLInputElement>('input[type="url"]')!.value;
    expect(link).toMatch(/#\/components\/wb-probe\?preview=[\w-]+$/);
    first.panel.remove();

    history.replaceState(null, '', link);
    const second = componentPanel();
    await until(() => !!second.probe()?.isConnected, 'the shared preview');
    expect(second.panel.previewState.attributes).toEqual({ tone: 'loud', label: 'Shared' });
    expect(second.probe()!.writes).toEqual(['attr tone="loud"', 'attr label="Shared"']);

    // A link for another component, or naming undeclared properties, never writes them.
    second.panel.remove();
    const payload = btoa(
      JSON.stringify({
        v: 1,
        kind: 'component',
        component: 'wb-probe',
        preset: 'default',
        props: { secret: 1 },
      }),
    );
    history.replaceState(null, '', `#/components/wb-probe?preview=${payload.replace(/=+$/, '')}`);
    const third = componentPanel();
    await until(() => !!third.probe()?.isConnected, 'the third preview');
    expect(third.probe()!.writes).toEqual([]);
    expect(third.root.querySelector('.wb-status')?.textContent).toContain(
      'Ignored property "secret"',
    );
  });

  it('shows light and dark side by side and releases every frame and scope when removed', async () => {
    const before = scopeStats();
    const frames = previewProtocolStats().liveFrames;
    const { panel, root, probe, row, change } = componentPanel();
    await until(() => !!probe()?.isConnected, 'the probe preview');
    const pair = [...root.querySelectorAll<HTMLLabelElement>('#interactive-example label')]
      .find((label) => label.textContent?.includes('Light and dark'))!
      .querySelector('input')!;
    pair.click();
    await until(() => !!probe(0)?.isConnected && !!probe(1)?.isConnected, 'two previews');
    expect(
      panel.previews.map((p) => p.iframe.contentDocument?.documentElement.dataset['oddMode']),
    ).toEqual(['light', 'dark']);
    expect(previewProtocolStats().liveFrames).toBe(frames + 2);
    change(row('tone').querySelector<HTMLSelectElement>('select[aria-label^="tone"]')!, 'loud');
    await until(
      () => probe(0)!.getAttribute('tone') === 'loud' && probe(1)!.getAttribute('tone') === 'loud',
      'both previews updated',
    );
    // Settings change instances in place: the same element keeps its identity.
    const element = probe(0);
    const direction = [
      ...root.querySelectorAll<HTMLSelectElement>('#interactive-example select'),
    ].find((s) => [...s.options].some((o) => o.value === 'rtl'))!;
    change(direction, 'rtl');
    await until(() => probe(0)!.closest('[dir]')?.getAttribute('dir') === 'rtl', 'right to left');
    expect(probe(0)).toBe(element);

    panel.remove();
    await settled();
    expect(previewProtocolStats().liveFrames).toBe(frames);
    expect(scopeStats()).toEqual(before);
  });
});

describe('<oddkin-catalog-panel>', () => {
  it('filters in its open shadow root, reports the filter, and lays cards out by width', async () => {
    const data = probeData();
    const panel = document.createElement('oddkin-catalog-panel');
    panel.index = data.index;
    panel.href = (route) => `/docs${route}`;
    mounted.push(panel);
    document.body.append(panel);
    const root = panel.shadowRoot!;
    expect(root.mode).toBe('open');
    await until(() => !!root.querySelector('odd-card a'), 'the cards');
    expect(root.querySelector('odd-card a')?.getAttribute('href')).toBe(
      '/docs/components/wb-probe',
    );
    expect(root.querySelector('iframe')).toBeNull();
    const events: unknown[] = [];
    document.addEventListener(
      'oddkin-catalog-filter',
      (e) => events.push((e as CustomEvent).detail),
      { once: true },
    );
    const search = root.querySelector<HTMLInputElement>('.wb-catalog-filters input')!;
    search.value = 'nothing-matches';
    search.dispatchEvent(new Event('input', { bubbles: true }));
    await until(() => !!root.querySelector('[role="status"]'), 'no results');
    expect(events).toEqual([{ query: 'nothing-matches', category: '' }]);
    expect(panel.query).toBe('nothing-matches');
    panel.query = '';
    await settled();

    const columns = async (width: number) => {
      panel.style.display = 'block';
      panel.style.inlineSize = `${width}px`;
      await new Promise((r) => requestAnimationFrame(() => r(undefined)));
      return getComputedStyle(root.querySelector('.wb-cards')!).gridTemplateColumns.split(' ')
        .length;
    };
    expect(await columns(400)).toBe(1);
    expect(await columns(640)).toBe(2);
    expect(await columns(1000)).toBe(3);
  });
});

/** A library with only spacing tokens, for the foundation panel. */
function spacingLibrary(
  name: string,
  tokens: { name: string; value: string; origin: string }[],
  vocabulary?: { name: string; token: string }[],
) {
  const { data, diagnostics } = buildWorkbenchData({
    config: { library: { packages: [name] }, hosting: { routing: 'hash' } },
    libraries: [
      {
        name,
        version: '1.0.0',
        cem: { schemaVersion: '2.1.0', modules: [] } as unknown as CemPackage,
        metadata: {
          foundations: {
            'foundation:spacing': {
              id: 'spacing',
              sections: [
                { id: 'scale', available: true },
                { id: 'semantic-vocabulary', available: Boolean(vocabulary) },
              ],
              generation: {
                value: { theme: name, origins: ['configured'] },
                provenance: 'extracted',
              },
              tokens: tokens.map((t) => t.name),
              ...(vocabulary ? { vocabularies: [{ id: 'semantic', entries: vocabulary }] } : {}),
            },
          },
        } as unknown as OddkinMetadataLike,
      },
    ],
    tokens: {
      tokens: tokens.map((t) => ({ ...t, cssVariable: `--${t.name.replace(/\./g, '-')}` })),
    },
  });
  if (!data) throw new Error(JSON.stringify(diagnostics));
  return data;
}

describe('<oddkin-foundation-panel>', () => {
  it('derives two different, correct Spacing pages from two libraries without template changes', async () => {
    const multiples = spacingLibrary(
      '@four/ui',
      [
        { name: 'gap.4', value: '16px', origin: 'generated' },
        { name: 'gap.1', value: '4px', origin: 'generated' },
        { name: 'gap.2', value: '8px', origin: 'generated' },
        { name: 'gap.8', value: '32px', origin: 'override' },
      ],
      [{ name: 'stack.gap', token: 'gap.2' }],
    );
    const ratio = spacingLibrary('@ratio/ui', [
      { name: 'space.s', value: '0.5rem', origin: 'preset' },
      { name: 'space.m', value: '0.75rem', origin: 'preset' },
      { name: 'space.l', value: '1.125rem', origin: 'preset' },
    ]);
    const render = async (data: WorkbenchData) => {
      const panel = document.createElement('oddkin-foundation-panel');
      panel.page = data.pages['foundations/spacing'] as never;
      panel.index = data.index;
      mounted.push(panel);
      document.body.append(panel);
      await settled();
      return panel.shadowRoot!;
    };
    const a = await render(multiples);
    const b = await render(ratio);
    const text = (root: ShadowRoot, selector: string) =>
      root.querySelector(selector)?.textContent?.replace(/\s+/g, ' ').trim();
    expect(text(a, '.wb-intro')).toBe(
      "4 steps from 4px to 32px, generated from the theme's configured values.",
    );
    expect(text(b, '.wb-intro')).toBe(
      "3 steps from 0.5rem to 1.125rem, generated from the theme's configured values.",
    );
    expect(text(a, '.wb-context')).toContain('Showing the saved baseline (theme @four/ui)');
    const rows = (root: ShadowRoot) =>
      [...root.querySelectorAll('[data-table="scale"] tbody tr')].map((tr) => [
        tr.getAttribute('data-token'),
        tr.querySelector('[data-label="Value"]')?.textContent?.trim(),
        tr.querySelector('[data-label="Origin"]')?.textContent?.trim(),
      ]);
    expect(rows(a)).toEqual([
      ['gap.1', '4px', 'generated'],
      ['gap.2', '8px', 'generated'],
      ['gap.4', '16px', 'generated'],
      ['gap.8', '32px', 'override'],
    ]);
    expect(rows(b).map((r) => r[0])).toEqual(['space.s', 'space.m', 'space.l']);
    // Samples are proportional to the values at the page's root size.
    const widths = [...a.querySelectorAll<HTMLElement>('[data-table="scale"] .wb-bar')].map(
      (bar) => bar.getBoundingClientRect().width,
    );
    expect(widths.map((w) => Math.round(w))).toEqual([4, 8, 16, 32]);
    expect(a.querySelector('[data-table="scale"] .wb-bar')?.getAttribute('aria-label')).toBe(
      '4px, 13% of the largest step',
    );
    // The vocabulary appears only where declared.
    expect(text(a, '[data-table="semantic"] tbody tr')).toBe('stack.gap gap.2 8px');
    expect(b.querySelector('#semantic-vocabulary')).toBeNull();
  });
});
