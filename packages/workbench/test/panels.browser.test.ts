import { afterEach, describe, expect, it } from 'vitest';
import { settled } from '@oddkin/core/reactive';
import { scopeStats } from '@oddkin/core/scope';
import '../src/panels/component-define.js';
import '../src/panels/foundation-define.js';
import '../src/panels/catalog-define.js';
import {
  buildWorkbenchData,
  type ComponentPageData,
  type WorkbenchData,
} from '../src/data/index.js';
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
          cssProperties: [
            {
              name: '--wb-probe-accent',
              syntax: '<color>',
              default: 'rebeccapurple',
              description: 'Accent.',
            },
            { name: '--wb-probe-gap' },
            { name: 'color', description: 'Declared without the dashes.' },
          ],
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
    // An edit as the reader makes it: input while typing, then change when it is committed.
    element.value = value;
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
  };
  return { panel, root, frames, probe, row, change };
}

/** Pick a value in a row's enumerated control (a select). */
const choose = (row: Element, value: string) => {
  const select = row.querySelector<HTMLSelectElement>('select:not([aria-label^="Write "])')!;
  select.value = value;
  select.dispatchEvent(new Event('change', { bubbles: true }));
};

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
      'source',
      'examples',
      'api',
      'tokens',
      'behavior-and-accessibility',
      'guidance',
      'known-limitations',
    ]);
    const text = root.textContent ?? '';
    expect(root.querySelectorAll('#overview p')[0]?.textContent).toBe('Records writes.');
    expect(text).toContain('Not documented. Supplied by @useFor');
    expect(text).toContain('Not documented. Supplied by @a11y');
    expect(text).toContain('Enter pings.');
    expect(root.querySelector('#known-limitations')?.textContent).toContain('None documented.');
    expect(root.querySelector('#source .wb-register code')?.textContent).toBe(
      `import '${probeUrl}';`,
    );
    expect(
      [...root.querySelectorAll('#source .wb-facts .wb-fact-label')].map((l) => l.textContent),
    ).toEqual(['Package', 'Module', 'Class']);
    // The page links belong to the reference layout only.
    expect(root.querySelector('nav')).toBeNull();
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
    // Every property row: name, types, default, attribute, reflected, control (Figma 33:6755).
    const cells = (n: string) =>
      [...row(n).querySelectorAll('th, td')]
        .slice(1, 5)
        .map((cell) => cell.textContent?.replace(/\s+/g, ' ').trim());
    expect(cells('open')).toEqual(['boolean', 'false', 'open', 'Yes']);
    expect(cells('tone')).toEqual(['calm, loud', 'calm', 'tone', 'No']);
    expect(cells('label')).toEqual(['string | null', "''", 'label', 'No']);
    expect(cells('items')).toEqual(['string[]', 'Unknown', 'Property only', '—']);
    expect(cells('value')).toEqual(['string', "''", 'None', '—']);
    // Each group's header row names it and its columns.
    expect(
      [...root.querySelectorAll('#interactive-example [data-table] thead tr')].map((tr) =>
        [...tr.children].map((th) => th.textContent?.trim()).join(' | '),
      ),
    ).toEqual([
      'Properties | Types | Default | Attribute | Reflected | Control / current value',
      'Slots | Content type | Default | Name | Position | Control / current content',
      'CSS custom properties | Syntax | Default | Description | Control / current value',
    ]);
    expect(row('open').querySelector('th small')?.textContent).toBe('Open.');
    expect(row('tone').querySelector('select')?.value).toBe('');
    expect(row('renderer').textContent).toContain('Requires fixture');
    expect(row('form').textContent).toContain('Read-only');
    expect(row('form').querySelector('input, select, textarea')).toBeNull();
    expect(row('items').querySelector('[data-label="Default"]')?.textContent?.trim()).toBe(
      'Unknown',
    );
    expect(row('label').textContent).toContain('Not documented');
    expect(root.querySelector('[data-card="methods"]')?.textContent).toContain('focusInput');
    expect(root.querySelector('[data-card="parts"]')?.textContent).toContain(
      'control — The control.',
    );
  });

  it('lays out the reference page: section links, no preview tools, nothing absent labelled', async () => {
    const data = probeData();
    const page = data.pages['components/wb-probe'] as ComponentPageData;
    const more = (name: string) => ({
      id: `example:wb-probe/${name}`,
      name,
      definition: { label: name, props: { count: name.length } },
    });
    const { panel, root, probe } = componentPanel({
      ...data,
      pages: {
        ...data.pages,
        'components/wb-probe': {
          ...page,
          // No slots: the reference layout leaves the group out instead of saying so.
          declaration: { ...page.declaration, slots: [] },
          examples: [more('aa'), ...page.examples, more('bbb'), more('cccc')],
        },
      },
    });
    const specimens = new Map<string, HTMLElement>();
    panel.examplePreview = (_page, id) => {
      if (!specimens.has(id))
        specimens.set(id, Object.assign(document.createElement('b'), { textContent: id }));
      return specimens.get(id);
    };
    panel.layout = 'reference';
    await until(() => !!probe()?.isConnected, 'the probe preview');
    await settled();
    const links = [
      ...root.querySelectorAll<HTMLAnchorElement>('nav[aria-label="Page sections"] a'),
    ];
    expect(links.map((a) => a.textContent?.trim())).toEqual([
      'Overview',
      'Controls',
      'Examples',
      'Accessibility',
    ]);
    expect(links[0]!.getAttribute('aria-current')).toBe('true');
    // See code and Reset only: no presets, preview settings, example link, write modes, or log.
    expect(
      [...root.querySelectorAll('.wb-example-bar button')].map((b) => b.textContent?.trim()),
    ).toEqual(['See code', 'Reset']);
    expect(
      root.querySelector('.wb-example-settings, .wb-event-log, select[aria-label^="Write "]'),
    ).toBeNull();
    // What the library does not supply is left out, never labelled or invented.
    expect(root.textContent).not.toContain('Supplied by');
    expect(root.textContent).not.toContain('No slots are declared');
    expect(root.querySelector('[data-table="slots"]')).toBeNull();
    expect(root.querySelector('#guidance, #known-limitations')).toBeNull();
    expect(root.querySelector('[data-card="css-states"]')).toBeNull();
    // Example cards: presets first, fixture-only ones left out, four shown, each with the host's
    // live specimen; the rest are one action away.
    const cards = () =>
      [...root.querySelectorAll('[data-example]')].map((card) =>
        card.getAttribute('data-example')?.replace('example:wb-probe/', ''),
      );
    expect(cards()).toEqual(['default', 'loud', 'aa', 'bbb']);
    expect(
      root.querySelector('[data-example="example:wb-probe/loud"] .wb-specimen')?.textContent,
    ).toBe('example:wb-probe/loud');
    const all = [...root.querySelectorAll<HTMLButtonElement>('#examples button')].find(
      (b) => b.textContent?.trim() === 'Show all 5 examples',
    )!;
    expect(all.getAttribute('aria-expanded')).toBe('false');
    all.click();
    await settled();
    expect(cards()).toEqual(['default', 'loud', 'aa', 'bbb', 'cccc']);
    // A link scrolls its section into view and moves focus to the section's heading.
    links[2]!.click();
    await settled();
    expect(root.activeElement?.id).toBe('examples-title');
    expect(links[2]!.getAttribute('aria-current')).toBe('true');
    // The controls scroll in one named, focusable region of at most 552 px.
    const region = root.querySelector<HTMLElement>(
      '[role="region"][aria-label="Controls and API"]',
    )!;
    expect(region.tabIndex).toBe(0);
    expect(getComputedStyle(region).overflowY).toBe('auto');
    expect(getComputedStyle(region).maxHeight).toBe('552px');
  });

  it('teaches usage: intended use, each mistake with its correct example, authored guidance', async () => {
    const data = probeData();
    const page = data.pages['components/wb-probe'] as ComponentPageData;
    const taught: ComponentPageData = {
      ...page,
      examples: [
        ...page.examples,
        {
          id: 'example:wb-probe/quiet',
          name: 'quiet',
          definition: {
            label: 'Too quiet',
            props: { tone: 'calm' },
            incorrect: { explanation: 'A `calm` tone is never heard.', correct: 'loud' },
          },
        },
      ],
      authored: { notFor: ['Silent pages.'], guidance: 'Prefer one probe per view.' },
    };
    const { panel, root, probe } = componentPanel({
      ...data,
      pages: { ...data.pages, 'components/wb-probe': taught },
    });
    await until(() => !!probe()?.isConnected, 'the probe preview');
    const guidance = root.querySelector('#guidance')!;
    const text = (selector: string) =>
      guidance.querySelector(selector)?.textContent?.replace(/\s+/g, ' ').trim();
    expect(text('[data-coverage="guidance/authored"]')).toBe('Prefer one probe per view.');
    expect(text('[data-coverage="guidance/use-for"]')).toBe('Not documented. Supplied by @useFor.');
    expect(text('[data-coverage="guidance/not-for"]')).toBe('Silent pages.');
    expect(text('[data-pair="example:wb-probe/quiet"]')).toContain(
      'Incorrect: Too quiet example:wb-probe/quiet A calm tone is never heard. Correct: Loud example:wb-probe/loud',
    );
    // Overview no longer repeats intended use.
    expect(root.querySelector('#overview')?.textContent).not.toContain('Use it for');
    [...guidance.querySelectorAll('button')]
      .find((b) => b.textContent === 'Show the correct usage in the preview')!
      .click();
    await until(() => probe()?.textContent === 'Loud!', 'the correct example');
    expect(panel.previewState.preset).toBe('loud');
  });

  it('writes each change once, as an attribute or a property, exactly per contract', async () => {
    const { root, probe, row, change } = componentPanel();
    await until(() => !!probe()?.isConnected, 'the probe preview');
    // The default example sets only slot content: no property or attribute writes.
    expect(probe()!.writes).toEqual([]);
    expect(probe()!.textContent).toBe('Hello');

    // Boolean attribute: presence, never the property.
    expect(row('open').querySelector('input[type="checkbox"]')!.getAttribute('role')).toBe(
      'switch',
    );
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

    // Enum as an attribute (a select); a JSON array property; invalid JSON is reported.
    const tone = () => row('tone').querySelector('select')!;
    expect(tone().value).toBe('');
    start = probe()!.writes.length;
    choose(row('tone'), 'loud');
    expect(await writesAfter(probe, start, 1)).toEqual(['attr tone="loud"']);
    expect(tone().value).toBe('loud');
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
    // It stays hidden until "See code" expands it.
    const codeArea = root.querySelector<HTMLElement>('#wb-example-code')!;
    const toggle = root.querySelector<HTMLButtonElement>(
      'button[aria-controls="wb-example-code"]',
    )!;
    const codeState = () => [
      codeArea.hidden,
      toggle.textContent?.trim(),
      toggle.getAttribute('aria-expanded'),
    ];
    expect(codeState()).toEqual([true, 'See code', 'false']);
    toggle.click();
    await settled();
    expect(codeState()).toEqual([false, 'Hide code', 'true']);
    const code = root.querySelector('.wb-snippet')?.textContent ?? '';
    expect(code).toContain(`import '${probeUrl}';`);
    expect(code).toContain('tone="loud"');
    expect(code).toContain('element.items = ["a","b"];');
    expect(code).toContain('element.count = 0;');
    expect(code).not.toContain('element.label');
    expect(code).toContain("element.addEventListener('wb-ping'");
    expect(code).toContain('<span slot="end">After</span>');
  });

  it('applies edits made while the first preview is still loading, in order, with no error', async () => {
    // The owner's report (2026-10-28): on a cold page, an edit made before the component's module
    // graph has loaded was lost, and the preview kept the example's first values.
    const data = probeData();
    const page = data.pages['components/wb-probe'] as ComponentPageData;
    const slow: ComponentPageData = {
      ...page,
      enrichment: {
        ...page.enrichment,
        registration: new URL('./fixtures/probe-element-slow.ts', import.meta.url).href,
      },
    };
    const { panel, root, probe, row, change } = componentPanel({
      ...data,
      pages: { ...data.pages, 'components/wb-probe': slow },
    });
    // One edit before the frame has even connected, the others while its registration loads.
    await until(() => panel.previews.length === 1, 'the preview frame');
    choose(row('tone'), 'loud');
    await panel.previews[0]!.ready;
    // The mount is out; its registration takes 1.5 s more to load.
    expect(probe()).toBeFalsy();
    change(row('label').querySelector<HTMLInputElement>('input[type="text"]')!, 'Early');
    change(root.querySelector<HTMLInputElement>('tr[data-slot="end"] input')!, 'After');
    await until(() => !!probe()?.isConnected, 'the probe preview');
    await until(() => probe()!.writes.length === 2, 'the two attribute writes');
    // Each edit reaches the mounted element, in order.
    expect(probe()!.writes).toEqual(['attr tone="loud"', 'attr label="Early"']);
    await until(
      () => probe()!.querySelector('[slot="end"]')?.textContent === 'After',
      'the end slot',
    );
    expect(root.querySelector('.wb-status')?.textContent?.trim()).toBe('');
  });

  it('follows text fields as the reader types', async () => {
    const { probe, row, root } = componentPanel();
    await until(() => !!probe()?.isConnected, 'the probe preview');
    const field = row('label').querySelector<HTMLInputElement>('input[type="text"]')!;
    for (const text of ['H', 'Hi']) {
      field.value = text;
      field.dispatchEvent(new Event('input', { bubbles: true }));
    }
    await until(() => probe()!.getAttribute('label') === 'Hi', 'the typed attribute');
    expect(probe()!.writes).toEqual(['attr label="H"', 'attr label="Hi"']);
    const slot = root.querySelector<HTMLInputElement>('tr[data-slot=""] input')!;
    slot.value = 'Typed';
    slot.dispatchEvent(new Event('input', { bubbles: true }));
    await until(() => probe()!.textContent === 'Typed', 'the typed slot');
    // A number field writes once its text is a number, and says why it waits otherwise.
    const count = row('count').querySelector<HTMLInputElement>('input[type="number"]')!;
    count.value = '';
    count.dispatchEvent(new Event('input', { bubbles: true }));
    count.dispatchEvent(new Event('change', { bubbles: true }));
    // An empty attribute is a value.
    await until(() => probe()!.writes.at(-1) === 'attr count=""', 'the empty count attribute');
    expect(row('count').querySelector('[role="alert"]')).toBeNull();
    count.value = '5';
    count.dispatchEvent(new Event('input', { bubbles: true }));
    await until(() => probe()!.writes.at(-1) === 'attr count="5"', 'the typed count attribute');
    // As a property, a field that is not a number yet writes nothing and says why when committed.
    const mode = row('count').querySelector<HTMLSelectElement>(
      'select[aria-label="Write count as"]',
    )!;
    mode.value = 'property';
    mode.dispatchEvent(new Event('change', { bubbles: true }));
    await settled();
    const before = probe()!.writes.length;
    const number = row('count').querySelector<HTMLInputElement>('input[type="number"]')!;
    number.value = '';
    number.dispatchEvent(new Event('input', { bubbles: true }));
    number.dispatchEvent(new Event('change', { bubbles: true }));
    await settled();
    expect(row('count').querySelector('[role="alert"]')?.textContent).toContain(
      'Not written: enter a number',
    );
    number.value = '7';
    number.dispatchEvent(new Event('input', { bubbles: true }));
    await until(() => probe()!.writes.at(-1) === 'prop count=7', 'the typed number');
    expect(probe()!.writes.length).toBe(before + 1);
    await settled();
    expect(row('count').querySelector('[role="alert"]')).toBeNull();
  });

  it('applies presets, logs declared events safely, syncs declared pairs, and resets in a fresh frame', async () => {
    const { panel, root, probe, row, change } = componentPanel();
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

    // Reset: a new frame generation with the preset's authored values; the log is cleared. An edit
    // still on its way to the old frame is dropped with it, without an error.
    const generation = panel.previews[0]!.identity.generation;
    change(row('label').querySelector<HTMLInputElement>('input[type="text"]')!, 'Dropped');
    [...root.querySelectorAll('button')].find((b) => b.textContent === 'Reset')!.click();
    await until(() => panel.previews[0]!.identity.generation === generation + 1, 'a fresh frame');
    await until(() => probe()?.textContent === 'Loud!', 'the reset preset');
    expect(probe()!.writes).toEqual(['prop tone="loud"', 'prop count=3', 'attr label="Hey"']);
    expect(panel.previewState.properties).toEqual({ tone: 'loud', count: 3 });
    expect(root.querySelector('.wb-log li')).toBeNull();
    await new Promise((r) => setTimeout(r, 50));
    expect(root.querySelector('.wb-status')?.textContent?.trim()).toBe('');
  });

  it('copies a versioned example link that restores the configuration', async () => {
    const first = componentPanel();
    await until(() => !!first.probe()?.isConnected, 'the probe preview');
    choose(first.row('tone'), 'loud');
    first.change(
      first.row('label').querySelector<HTMLInputElement>('input[type="text"]')!,
      'Shared',
    );
    await until(() => first.probe()!.writes.length === 2, 'two writes');
    [...first.root.querySelectorAll('button')]
      .find((b) => b.textContent?.trim() === 'Copy example link')!
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
    // The restored value is the select's choice.
    expect(second.row('tone').querySelector('select')?.value).toBe('loud');

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

  it('sets CSS custom properties as the reader types; the code and the link carry them', async () => {
    const first = componentPanel();
    await until(() => !!first.probe()?.isConnected, 'the probe preview');
    const css = (name: string) => first.root.querySelector(`tr[data-css="${name}"]`)!;
    // In the example's controls, with the syntax and default the manifest declares.
    expect(css('--wb-probe-accent').closest('section')?.id).toBe('interactive-example');
    expect(
      css('--wb-probe-accent').querySelector('[data-label="Syntax"]')?.textContent?.trim(),
    ).toBe('<color>');
    expect(
      css('--wb-probe-accent').querySelector('[data-label="Description"]')?.textContent?.trim(),
    ).toBe('Accent.');
    expect(
      css('--wb-probe-accent').querySelector('[data-label="Default"]')?.textContent?.trim(),
    ).toBe('rebeccapurple');
    expect(css('--wb-probe-gap').textContent).toContain('Not documented');
    expect(css('color').querySelector('input')).toBeNull();
    expect(css('color').textContent).toContain('Not editable: not a custom property name.');
    const field = css('--wb-probe-accent').querySelector<HTMLInputElement>('input')!;
    const unset = css('--wb-probe-accent').querySelector('button')!;
    expect(unset.disabled).toBe(true);
    for (const text of ['t', 'teal']) {
      field.value = text;
      field.dispatchEvent(new Event('input', { bubbles: true }));
    }
    const accent = () => first.probe()!.style.getPropertyValue('--wb-probe-accent');
    await until(() => accent() === 'teal', 'the typed value');
    // A style, not a property or an attribute write.
    expect(first.probe()!.writes).toEqual([]);
    expect(first.panel.previewState.styles).toEqual({ '--wb-probe-accent': 'teal' });
    await settled();
    expect(unset.disabled).toBe(false);
    first.root.querySelector<HTMLButtonElement>('button[aria-controls="wb-example-code"]')!.click();
    await settled();
    expect(first.root.querySelector('.wb-snippet')?.textContent).toContain(
      'element.style.setProperty("--wb-probe-accent", "teal");',
    );

    [...first.root.querySelectorAll('button')]
      .find((b) => b.textContent?.trim() === 'Copy example link')!
      .click();
    await until(
      () => !!first.root.querySelector<HTMLInputElement>('input[type="url"]')?.value,
      'the link',
    );
    const link = first.root.querySelector<HTMLInputElement>('input[type="url"]')!.value;
    // Unset removes the value from the element and the state.
    unset.click();
    await until(() => accent() === '', 'the removed value');
    expect(first.panel.previewState.styles).toEqual({});
    await settled();
    expect(field.value).toBe('');
    first.panel.remove();

    history.replaceState(null, '', link);
    const second = componentPanel();
    await until(() => !!second.probe()?.isConnected, 'the shared preview');
    expect(second.probe()!.style.getPropertyValue('--wb-probe-accent')).toBe('teal');
    expect(
      second.root.querySelector<HTMLInputElement>('tr[data-css="--wb-probe-accent"] input')!.value,
    ).toBe('teal');
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
    choose(row('tone'), 'loud');
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
    expect(root.querySelector('odd-card a.wb-card-action')?.getAttribute('href')).toBe(
      '/docs/components/wb-probe',
    );
    expect(root.querySelector('.wb-card-tag')?.textContent).toBe('wb-probe');
    expect(root.querySelector('iframe')).toBeNull();
    expect(root.querySelector('.wb-card-preview')).toBeNull();
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

  it('shows host previews in the cards and lists only the given categories', async () => {
    const data = probeData();
    const panel = document.createElement('oddkin-catalog-panel');
    panel.index = data.index;
    const nodes = new Map<string, Node>();
    panel.preview = (page) => {
      if (!nodes.has(page.id)) nodes.set(page.id, document.createElement('wb-preview-probe'));
      return nodes.get(page.id);
    };
    mounted.push(panel);
    document.body.append(panel);
    const root = panel.shadowRoot!;
    await until(() => !!root.querySelector('.wb-card-preview wb-preview-probe'), 'the preview');
    const node = root.querySelector('wb-preview-probe');
    expect(node).toBe(nodes.get('components/wb-probe'));
    // The preview fills the card's header edge to edge.
    expect(node!.closest('odd-card')!.getAttribute('padding')).toBe('none');
    // A filter change re-renders the cards around the same preview node.
    panel.query = 'probe';
    await settled();
    expect(root.querySelector('wb-preview-probe')).toBe(node);

    const group = data.index.registry.pages.find((p) => p.id === 'components/wb-probe')!.group!;
    panel.groups = ['Not a category'];
    await settled();
    expect(root.querySelector('odd-card')).toBeNull();
    expect([...root.querySelectorAll('.wb-count')].map((c) => c.textContent)).toEqual([
      '0 components',
      '0 categories',
    ]);
    panel.groups = [group];
    await settled();
    expect(root.querySelector('odd-card')).not.toBeNull();
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
