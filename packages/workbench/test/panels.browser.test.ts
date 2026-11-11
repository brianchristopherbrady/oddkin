import { afterEach, describe, expect, it, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import { settled } from '@oddkin/core/reactive';
import { createScope, scopeStats } from '@oddkin/core/scope';
import { render } from '@oddkin/core/template';
import '../src/panels/component-define.js';
import '../src/panels/foundation-define.js';
import '../src/panels/catalog-define.js';
import '../src/panels/theme-studio-define.js';
import {
  buildWorkbenchData,
  type ComponentPageData,
  type WorkbenchData,
} from '../src/data/index.js';
import type { ThemeStudioPageData } from '../src/data/types.js';
import type { CemPackage, OddkinMetadataLike } from '../src/pages/index.js';
import type { OddkinComponentPanel } from '../src/panels/component.js';
import { getPath } from '../src/panels/theme-model.js';
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

/** The default theme, as a host page links it, so spacing and controls have their sizes. */
async function linkTheme(): Promise<HTMLLinkElement> {
  const theme = document.createElement('link');
  theme.rel = 'stylesheet';
  theme.href = new URL('../../tokens/dist/css/default.css', import.meta.url).href;
  await new Promise((resolve, reject) => {
    theme.onload = resolve;
    theme.onerror = reject;
    document.head.append(theme);
  });
  mounted.push(theme);
  return theme;
}

/** Two frames: the layout a width change starts has been done. */
const painted = () =>
  new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));

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

  it("shows the sections a host's tabs list and keeps the others, the frame included", async () => {
    const { panel, root, frames, probe } = componentPanel();
    panel.layout = 'reference';
    // The space between sections is a token; this page loads no theme.
    panel.style.setProperty('--odd-space-2xl', '48px');
    await until(() => !!probe()?.isConnected, 'the probe preview');
    await settled();
    const frame = frames()[0];
    const shown = () =>
      [...root.querySelectorAll<HTMLElement>('.wb-content > section')]
        .filter((section) => !section.hidden && section.offsetHeight > 0)
        .map((section) => section.id);
    const nav = () => root.querySelector('nav[aria-label="Page sections"]');
    expect(nav()).not.toBeNull();
    // Agent 3's tabs: Controls, then Examples, then Overview, which shows the example again.
    panel.sections = ['interactive-example', 'api'];
    await settled();
    expect(shown()).toEqual(['interactive-example', 'api']);
    // The tabs replace the panel's own section links.
    expect(nav()).toBeNull();
    // The first section shown starts at the top: no space above it for the hidden ones.
    const first = root.querySelector<HTMLElement>('#interactive-example')!;
    expect(getComputedStyle(first).marginBlockStart).toBe('0px');
    panel.sections = ['examples', 'tokens'];
    await settled();
    expect(shown()).toEqual(['examples', 'tokens']);
    expect(getComputedStyle(root.querySelector('#examples')!).marginBlockStart).toBe('0px');
    expect(getComputedStyle(root.querySelector('#tokens')!).marginBlockStart).toBe('48px');
    panel.sections = ['overview', 'interactive-example', 'guidance'];
    await settled();
    expect(shown()).toEqual(['overview', 'interactive-example']);
    // Never reloaded: the same frame, and the same live element in it.
    expect(frames()[0]).toBe(frame);
    expect(probe()?.isConnected).toBe(true);
    panel.sections = null;
    await settled();
    expect(shown()).toContain('behavior-and-accessibility');
    expect(nav()).not.toBeNull();
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

  it("runs a fixture example from the page's example module", async () => {
    const data = probeData();
    const page = data.pages['components/wb-probe'] as ComponentPageData;
    const exampleModule = new URL('./fixtures/probe-examples.ts', import.meta.url).href;
    const { root, probe, change } = componentPanel({
      ...data,
      pages: { ...data.pages, 'components/wb-probe': { ...page, exampleModule } },
    });
    await until(() => !!probe()?.isConnected, 'the probe preview');
    const preset = root.querySelector<HTMLSelectElement>('.wb-example-bar select')!;
    expect([...preset.options].map((o) => o.value)).toEqual(['default', 'loud', 'fixtureOnly']);
    expect(
      root.querySelector('[data-example="example:wb-probe/fixtureOnly"]')?.textContent,
    ).not.toContain('Requires fixture');
    change(preset, 'fixtureOnly');
    await until(() => probe()?.textContent === 'Set up by its fixture', 'the fixture');
    expect(root.querySelector('.wb-snippet')?.textContent).toContain(
      '// The "fixtureOnly" example also runs setup code',
    );
  });

  it('shows the element with a note when the example module cannot load', async () => {
    const data = probeData();
    const page = data.pages['components/wb-probe'] as ComponentPageData;
    const exampleModule = new URL('./fixtures/missing-examples.js', import.meta.url).href;
    const { root, probe, change } = componentPanel({
      ...data,
      pages: { ...data.pages, 'components/wb-probe': { ...page, exampleModule } },
    });
    await until(() => !!probe()?.isConnected, 'the probe preview');
    change(root.querySelector<HTMLSelectElement>('.wb-example-bar select')!, 'fixtureOnly');
    const status = () => root.querySelector('#interactive-example .wb-status');
    await until(() => /setup did not run/.test(status()?.textContent ?? ''), 'the setup note');
    expect(status()?.getAttribute('role')).not.toBe('alert');
    expect(probe()?.isConnected).toBe(true);
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

  // Continuity (responsiveness.md): a change of the panel's width keeps the field being edited, its
  // caret and the focus, and the preview frame and its element, which do not reload.
  it('keeps the field being edited, its focus, and the preview while the panel changes width', async () => {
    await linkTheme();
    const { panel, root, frames, probe, row } = componentPanel();
    await until(() => !!probe()?.isConnected, 'the probe preview');
    const field = row('label').querySelector<HTMLInputElement>('input[type="text"]')!;
    await userEvent.fill(field, 'Hello there');
    field.setSelectionRange(5, 5);
    await until(() => probe()!.getAttribute('label') === 'Hello there', 'the typed label');
    const [frame] = frames();
    const [doc, element] = [frame!.contentDocument, probe()];
    const density = () => {
      const style = getComputedStyle(field);
      return [style.paddingInlineStart, style.paddingBlockStart, style.fontSize];
    };
    const first = density();
    for (const width of [1000, 600, 360, 1000, 360]) {
      panel.style.inlineSize = `${width}px`;
      await settled();
      await painted();
      expect(row('label').querySelector('input[type="text"]')).toBe(field);
      expect(field.value).toBe('Hello there');
      expect(root.activeElement).toBe(field);
      expect([field.selectionStart, field.selectionEnd]).toEqual([5, 5]);
      expect(frames()[0]).toBe(frame);
      expect(frame!.contentDocument).toBe(doc);
      expect(probe()).toBe(element);
      expect(density()).toEqual(first);
      expect(panel.scrollWidth).toBeLessThanOrEqual(panel.clientWidth + 1);
    }
    await userEvent.keyboard('!');
    await until(() => probe()!.getAttribute('label') === 'Hello! there', 'typing at the caret');
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

describe('<oddkin-theme-studio-panel>', () => {
  const button = new URL('./fixtures/frame-element.ts', import.meta.url).href;
  const item = (role: string, label: string, text: string) => ({
    role,
    label,
    tag: 'fixture-button',
    registration: button,
    example: `example:fixture-button/${role}` as const,
    properties: { label: text },
    attributes: {},
    slots: {},
  });
  const starter = {
    version: 1,
    root: [{ element: 'p', children: ['Hello'] }, { element: 'fixture-button' }],
  };
  const studioPage = (): ThemeStudioPageData => ({
    format: 'oddkin.workbench-page',
    version: 1,
    id: 'theme-studio',
    kind: 'tool',
    studio: {
      config: { brand: { primary: '#123456' } },
      worker: new URL('./fixtures/theme-worker.ts', import.meta.url).href,
      roles: [{ ...item('primaryAction', 'Primary action', 'Save'), source: 'example' }],
      screens: {
        components: [
          {
            tag: 'fixture-button',
            title: 'Fixture button',
            items: [item('default', 'Default', 'Go'), item('quiet', 'Quiet', 'Later')],
            omitted: ['With setup'],
          },
        ],
        composition: {
          renderer: new URL('./fixtures/frame-renderer.ts', import.meta.url).href,
          registrations: { 'fixture-button': button },
          // Generated for a package without a renderer of its own (P1.6).
          catalog: {
            'fixture-button': { attributes: {}, properties: {}, fixed: [], slots: [], events: [] },
          },
          stylesheets: [new URL('./fixtures/frame-screen.css', import.meta.url).href],
          starters: [{ id: 'hello', title: 'Hello', document: starter }],
        },
      },
      missing: [],
    },
  });

  it('shows each screen in light and dark frames, under the generated theme', async () => {
    const before = scopeStats();
    const frames = previewProtocolStats().liveFrames;
    const panel = document.createElement('oddkin-theme-studio-panel');
    panel.frameUrl = frameUrl;
    panel.page = studioPage();
    mounted.push(panel);
    document.body.append(panel);
    const root = panel.shadowRoot!;
    const docs = () => panel.previews.map((preview) => preview.iframe.contentDocument);
    const shown = (selector: string) =>
      docs().length === 2 && docs().every((doc) => !!doc?.querySelector(selector));
    const text = (doc: Document | null | undefined) =>
      doc?.querySelector('[data-oddkin-preview] > p')?.textContent;
    // The generated CSS is each frame's theme sheet, and it stays across screens.
    const themed = () =>
      docs().every((doc) =>
        [...(doc?.adoptedStyleSheets ?? [])].some((sheet) =>
          [...sheet.cssRules].some((rule) => rule.cssText.includes('#123456')),
        ),
      );
    await until(() => shown('figure[data-role="primaryAction"] > fixture-button'), 'specimens');
    await until(themed, 'the generated theme');
    expect(docs().map((doc) => doc?.documentElement.dataset['oddMode'])).toEqual(['light', 'dark']);

    const select = () => root.querySelector<HTMLSelectElement>('#ts-screen')!;
    expect([...select().options].map((option) => option.textContent?.trim())).toEqual([
      'Role specimens',
      'Fixture button',
      'Hello',
      'Your document',
    ]);
    const pick = (value: string) => {
      select().value = value;
      select().dispatchEvent(new Event('change', { bubbles: true }));
    };
    pick('component:fixture-button');
    await until(() => shown('figure[data-role="quiet"] > fixture-button'), 'the component');
    expect(docs()[1]?.querySelectorAll('figure')).toHaveLength(2);
    expect(root.querySelector('#live-preview')?.textContent).toContain('With setup');
    expect(themed()).toBe(true);

    pick('composition:hello');
    await until(() => shown('[data-oddkin-preview] > fixture-button'), 'the starter');
    // The document's stylesheets, linked once in each frame.
    const sheet = new URL('./fixtures/frame-screen.css', import.meta.url).href;
    const linked = () => docs().map((doc) => doc?.querySelectorAll(`link[href="${sheet}"]`).length);
    expect(linked()).toEqual([1, 1]);
    const editor = () => root.querySelector<HTMLTextAreaElement>('#ts-composition')!;
    expect(JSON.parse(editor().value)).toEqual(starter);
    const type = (value: string) => {
      editor().value = value;
      editor().dispatchEvent(new Event('input', { bubbles: true }));
    };
    type('{ "version": 1, "root": [{ "element": "p", "children": ["Edited"] }] }');
    await until(() => docs().every((doc) => text(doc) === 'Edited'), 'the edit in both frames');
    // Latest wins: a burst of edits renders only the newest once the frame is free.
    const sent: string[] = [];
    const light = panel.previews[0]!;
    const request = light.request.bind(light);
    Object.assign(light, {
      request: (kind: string, payload?: unknown) => {
        if (kind === 'composition') sent.push(JSON.stringify(payload));
        return request(kind as never, payload as never);
      },
    });
    for (let i = 1; i <= 20; i++)
      type(`{ "version": 1, "root": [{ "element": "p", "children": ["Edit ${i}"] }] }`);
    await until(() => docs().every((doc) => text(doc) === 'Edit 20'), 'the newest edit');
    expect(sent).toHaveLength(1);
    expect(linked()).toEqual([1, 1]);
    expect(sent[0]).toContain('Edit 20');
    // The catalog goes with each document, for the frame to add to the renderer's own.
    expect(JSON.parse(sent[0]!).catalog).toEqual(studioPage().studio.screens?.composition?.catalog);
    // A render that takes the focus into a frame (a modal dialog) gives it back to the editor.
    editor().focus();
    type(
      '{ "version": 1, "root": [{ "element": "p", "attributes": { "tabindex": "0", "data-focus": "" }, "children": ["Focus"] }] }',
    );
    await until(() => docs().every((doc) => text(doc) === 'Focus'), 'the focusing document');
    await until(() => root.activeElement === editor(), 'the focus back in the editor');
    // Text that does not parse keeps the document shown and says why.
    type('{ "version": ');
    await settled();
    expect(root.querySelector('#ts-composition-note')?.textContent).toContain('Not rendered');
    expect(text(docs()[0])).toBe('Focus');
    // A refused document renders nothing, and its diagnostics name the path.
    type('{ "version": 1, "root": [{ "element": "b" }] }');
    const problems = () => root.querySelector('[aria-label="Composition diagnostics"]');
    await until(() => !!problems(), 'the diagnostics');
    expect(problems()?.textContent).toContain('/root/0/element');
    expect(text(docs()[0])).toBeUndefined();

    // Each composition screen keeps its own text; the reader's own starts empty.
    pick('composition:');
    await settled();
    expect(JSON.parse(editor().value)).toEqual({ version: 1, root: [] });
    expect(problems()).toBeNull();
    pick('composition:hello');
    await settled();
    expect(editor().value).toContain('"b"');

    pick('specimens');
    await until(() => shown('figure[data-role="primaryAction"]'), 'specimens again');
    expect(themed()).toBe(true);
    expect(previewProtocolStats().liveFrames).toBe(frames + 2);
    panel.remove();
    await settled();
    expect(previewProtocolStats().liveFrames).toBe(frames);
    expect(scopeStats()).toEqual(before);
  });

  it('offers the corner shape, pill controls, and gamut as choices that write the draft', async () => {
    const panel = document.createElement('oddkin-theme-studio-panel');
    const page = studioPage();
    panel.frameUrl = frameUrl;
    panel.page = {
      ...page,
      studio: {
        ...page.studio,
        config: { brand: { primary: '#123456' }, radius: { scale: 1.25 } },
      },
    };
    mounted.push(panel);
    document.body.append(panel);
    const root = panel.shadowRoot!;
    const choice = (path: string) =>
      root.querySelector<HTMLSelectElement>(`select[data-path="${path}"]`)!;
    await until(() => !!choice('/radius/scale'), 'the shape group');
    const options = (path: string) =>
      [...choice(path).options].map((o) => [o.value, o.textContent?.trim(), o.selected]);
    // A value the choice does not offer, set in the JSON, is kept and shown as itself.
    expect(options('/radius/scale')).toEqual([
      ['', 'Not set (generated)', false],
      ['0', 'Square', false],
      ['0.5', 'Subtle', false],
      ['1', 'Standard', false],
      ['2', 'Round', false],
      ['3', 'Extra round', false],
      ['1.25', '1.25', true],
    ]);
    const pick = async (path: string, value: string) => {
      choice(path).value = value;
      choice(path).dispatchEvent(new Event('change', { bubbles: true }));
      await settled();
    };
    const draft = () => JSON.parse(root.querySelector<HTMLTextAreaElement>('#ts-json')!.value);
    await pick('/radius/scale', '0');
    expect(draft().radius).toEqual({ scale: 0 });
    expect(options('/radius/scale').map(([value, , selected]) => [value, selected])).toEqual([
      ['', false],
      ['0', true],
      ['0.5', false],
      ['1', false],
      ['2', false],
      ['3', false],
    ]);
    // Pill controls are an override of control.radius, also a row of the overrides table.
    await pick('/overrides/control.radius', '{radius.full}');
    expect(draft().overrides).toEqual({ 'control.radius': '{radius.full}' });
    expect(root.querySelector('[data-group="overrides"] tbody th')?.textContent).toContain(
      'control.radius',
    );
    expect(
      root.querySelector(`#${CSS.escape('ts-overrides-control.radius-origin')}`)?.textContent,
    ).toContain('explicit override');
    await pick('/gamut', 'p3');
    expect(draft().gamut).toBe('p3');
    // The empty choice removes the value: the generator's default applies.
    await pick('/overrides/control.radius', '');
    expect(draft().overrides).toEqual({});
    expect(choice('/overrides/control.radius').value).toBe('');
  });

  it('shows the generated ramps and contrast pairs of the theme shown, failures first', async () => {
    const panel = document.createElement('oddkin-theme-studio-panel');
    panel.frameUrl = frameUrl;
    panel.page = studioPage();
    mounted.push(panel);
    document.body.append(panel);
    const root = panel.shadowRoot!;
    const cells = (selector: string) =>
      [...root.querySelectorAll(selector)].map((cell) =>
        cell.textContent?.replace(/\s+/g, ' ').trim(),
      );
    await until(() => !!root.querySelector('#ramps') && !!root.querySelector('#contrast'), 'views');
    // The reference's order: Generate, Ramps, Live preview, Contrast, then Export; a wide panel
    // sets the first two beside the other two.
    expect([...root.querySelectorAll('.wb-content section[id]')].map((s) => s.id)).toEqual([
      'generate',
      'ramps',
      'live-preview',
      'contrast',
      'export',
      'method',
    ]);
    // A column per ramp as the generator lists them, a row per step in numeric order.
    expect(cells('#ramps thead th')).toEqual(['Step', 'neutral', 'brand']);
    expect(cells('#ramps tbody th')).toEqual(['0', '500', '1000']);
    expect(cells('#ramps tbody tr:nth-child(2) td')).toEqual(['', '#123456']);
    expect(cells('#ts-contrast-summary')).toEqual([
      '2 role pairs for the theme: 1 pass, 1 fail, 0 exempt.',
    ]);
    expect(cells('#contrast tbody tr:first-child > *')).toEqual([
      'color.text.primary on color.canvas',
      'dark',
      'Aa',
      '1.60:1',
      '4.5:1, 1.4.3',
      'fail',
    ]);
    expect(
      [...root.querySelectorAll('#contrast tbody tr')].map((row) =>
        row.getAttribute('data-status'),
      ),
    ).toEqual(['fail', 'pass']);
    // The sample: the pair's foreground on its background.
    const sample = root.querySelector('#contrast tbody tr:first-child svg')!;
    expect([...sample.querySelectorAll('[fill]')].map((e) => e.getAttribute('fill'))).toEqual([
      '#ffffff',
      '#cccccc',
    ]);
    expect(root.querySelector('#ramps svg rect')?.getAttribute('fill')).toBe('#ffffff');
    // An edit updates the views; an invalid draft keeps the last valid ones.
    const primary = root.querySelector<HTMLInputElement>('#ts-brand-primary')!;
    const set = (value: string) => {
      primary.value = value;
      primary.dispatchEvent(new Event('change', { bubbles: true }));
    };
    set('#0a7d33');
    await until(() => cells('#ramps tbody tr:nth-child(2) td')[1] === '#0a7d33', 'the edit');
    set('invalid');
    await until(() => !!root.querySelector('#live-preview [role="alert"]'), 'the invalid draft');
    expect(cells('#ramps tbody tr:nth-child(2) td')[1]).toBe('#0a7d33');
    expect(root.querySelector('#contrast')).not.toBeNull();
  });

  it("opens a team's own app with the draft, and sends it each newer CSS", async () => {
    // The app's window: an iframe whose script records what it receives and sends what the test
    // hands it, so its messages come from that window.
    const app = document.createElement('iframe');
    app.srcdoc = `<script>
      window.received = [];
      addEventListener('message', (event) => {
        if (event.data && event.data.relay) parent.postMessage(event.data.relay, '*');
        else window.received.push(event.data);
      });
    </script>`;
    const loaded = new Promise((resolve) => app.addEventListener('load', resolve, { once: true }));
    document.body.append(app);
    await loaded;
    const appWindow = app.contentWindow as Window & { received: { css?: string }[] };
    const open = vi.spyOn(window, 'open').mockReturnValue(appWindow);
    try {
      const page = studioPage();
      const url = `${location.origin}/app/`;
      const panel = document.createElement('oddkin-theme-studio-panel');
      panel.frameUrl = frameUrl;
      panel.page = { ...page, studio: { ...page.studio, app: url } };
      mounted.push(panel);
      document.body.append(panel);
      const root = panel.shadowRoot!;
      const button = () =>
        [...root.querySelectorAll('#live-preview button')].find((b) =>
          b.textContent?.includes('with the draft'),
        );
      const status = () => root.querySelector('#ts-app-status')?.textContent?.trim();
      await until(() => !!button() && !!panel.generation?.delivered, 'the app button');
      expect(button()?.textContent?.trim()).toBe(`Open ${url} with the draft`);
      (button() as HTMLButtonElement).click();
      expect(open).toHaveBeenCalledWith(url, 'oddkin-theme-app');
      await settled();
      expect(status()).toBe(`Opened ${url}; waiting for its @oddkin/workbench/theme-link.`);
      // A ready message from another window than the app's is not taken.
      const ready = { protocol: 'oddkin.theme-link', version: 1, type: 'ready' };
      window.postMessage(ready, '*');
      await new Promise((resolve) => setTimeout(resolve, 100));
      expect(appWindow.received).toEqual([]);
      // The app's: it gets the newest CSS at once, then each newer one, at its origin.
      appWindow.postMessage({ relay: ready }, '*');
      await until(() => appWindow.received.length === 1, 'the CSS');
      expect(appWindow.received[0]).toEqual({
        protocol: 'oddkin.theme-link',
        version: 1,
        type: 'css',
        css: ':root { --fixture-primary: #123456; }',
      });
      await settled();
      expect(status()).toBe(`Showing the draft in ${location.origin}.`);
      const primary = root.querySelector<HTMLInputElement>('#ts-brand-primary')!;
      primary.value = '#0a7d33';
      primary.dispatchEvent(new Event('change', { bubbles: true }));
      await until(() => appWindow.received.length === 2, 'the newer CSS');
      expect(appWindow.received[1]?.css).toBe(':root { --fixture-primary: #0a7d33; }');
      // A closed app gets nothing more, and the page says so.
      app.remove();
      primary.value = '#0a7d34';
      primary.dispatchEvent(new Event('change', { bubbles: true }));
      await until(() => status() === 'The app is closed.', 'the closed app');
    } finally {
      open.mockRestore();
      app.remove();
    }
  });

  it("takes the app's ready message only from the app's origin", async () => {
    const app = document.createElement('iframe');
    app.srcdoc = `<script>
      window.received = [];
      addEventListener('message', (event) => {
        if (event.data && event.data.relay) parent.postMessage(event.data.relay, '*');
        else window.received.push(event.data);
      });
    </script>`;
    const loaded = new Promise((resolve) => app.addEventListener('load', resolve, { once: true }));
    document.body.append(app);
    await loaded;
    const appWindow = app.contentWindow as Window & { received: unknown[] };
    const open = vi.spyOn(window, 'open').mockReturnValue(appWindow);
    try {
      // The window opened is at this page's origin, not the configured app's.
      const page = studioPage();
      const panel = document.createElement('oddkin-theme-studio-panel');
      panel.frameUrl = frameUrl;
      panel.page = { ...page, studio: { ...page.studio, app: 'http://app.invalid:5173/' } };
      mounted.push(panel);
      document.body.append(panel);
      const root = panel.shadowRoot!;
      const button = () =>
        [...root.querySelectorAll<HTMLButtonElement>('#live-preview button')].find((b) =>
          b.textContent?.includes('with the draft'),
        );
      await until(() => !!button() && !!panel.generation?.delivered, 'the app button');
      button()!.click();
      appWindow.postMessage(
        { relay: { protocol: 'oddkin.theme-link', version: 1, type: 'ready' } },
        '*',
      );
      await new Promise((resolve) => setTimeout(resolve, 200));
      expect(appWindow.received).toEqual([]);
      expect(root.querySelector('#ts-app-status')?.textContent).toContain('waiting');
    } finally {
      open.mockRestore();
      app.remove();
    }
  });

  it('saves the draft to the theme file after showing the diff, when the dev server offers it', async () => {
    const requests: Record<string, unknown>[] = [];
    let version = 'v1';
    let lines = ['@@ -1,1 +1,1 @@', '-{ "primary": "#123456" }', '+{ "primary": "#0a7d33" }'];
    let gate: Promise<void> | undefined;
    // Replies the panel has read, so a test can wait for one it held back.
    let delivered = 0;
    const fetchOriginal = globalThis.fetch;
    const json = (status: number, value: unknown) => {
      const response = new Response(JSON.stringify(value), {
        status,
        headers: { 'content-type': 'application/json' },
      });
      const read = response.json.bind(response);
      response.json = async () => {
        const body: unknown = await read();
        delivered++;
        return body;
      };
      return response;
    };
    const spy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      if (String(input) !== '/save-theme') return fetchOriginal(input, init);
      const request = JSON.parse(String(init?.body)) as Record<string, unknown>;
      requests.push(request);
      await gate;
      if (request['write'] !== true) return json(200, { file: 'theme.json', version, lines });
      if (request['version'] !== version) return json(409, { file: 'theme.json', version, lines });
      return json(200, { file: 'theme.json', version: 'v3', lines: [], written: true });
    });
    try {
      const base = studioPage();
      const panel = document.createElement('oddkin-theme-studio-panel');
      panel.frameUrl = frameUrl;
      panel.page = {
        ...base,
        studio: { ...base.studio, save: { file: 'theme.json', url: '/save-theme' } },
      };
      mounted.push(panel);
      document.body.append(panel);
      const root = panel.shadowRoot!;
      const button = (text: string) =>
        [...root.querySelectorAll('button')].find((b) => b.textContent?.includes(text));
      const status = () => root.querySelector('#export')?.textContent ?? '';
      const diff = () => root.querySelector('[aria-label="Changes to theme.json"]');
      await until(() => button('Save to theme.json')?.disabled === false, 'the save button');

      button('Save to theme.json')!.click();
      await until(() => !!diff(), 'the diff');
      expect(diff()?.querySelector('pre')?.textContent).toBe(lines.join('\n'));
      expect(status()).toContain('Review the changes to theme.json, then write it.');
      expect(requests).toEqual([{ file: 'theme.json', config: base.studio.config }]);

      // The file changed on disk after the diff was shown: the new diff, and nothing written.
      version = 'v2';
      lines = [...lines, '+{ "name": "edited elsewhere" }'];
      // A write waits for the generator to accept the draft.
      await until(() => button('Write theme.json')?.disabled === false, 'the write button');
      button('Write theme.json')!.click();
      await until(() => status().includes('changed on disk'), 'the conflict');
      expect(diff()?.querySelector('pre')?.textContent).toContain('edited elsewhere');
      button('Write theme.json')!.click();
      await until(() => status().includes('Saved theme.json.'), 'the write');
      expect(requests.slice(1)).toEqual([
        { file: 'theme.json', config: base.studio.config, version: 'v1', write: true },
        { file: 'theme.json', config: base.studio.config, version: 'v2', write: true },
      ]);
      expect(diff()).toBeNull();

      lines = [];
      button('Save to theme.json')!.click();
      await until(() => status().includes('theme.json already holds this draft.'), 'no change');
      // A new draft makes a diff shown out of date.
      lines = ['@@ -1,1 +1,1 @@', '-a', '+b'];
      button('Save to theme.json')!.click();
      await until(() => !!diff(), 'another diff');
      const field = root.querySelector<HTMLInputElement>('#ts-brand-primary')!;
      field.value = '#222222';
      field.dispatchEvent(new Event('change', { bubbles: true }));
      await settled();
      expect(diff()).toBeNull();
      expect(status()).not.toContain('Review the changes');

      // A review answered after a newer draft is dropped. The newer draft can be reviewed while
      // it is generating (the click that ends an edit), and written once it is generated.
      let answer!: () => void;
      gate = new Promise<void>((resolve) => (answer = resolve));
      button('Save to theme.json')!.click();
      await until(() => requests.length === 6, 'the held review');
      field.value = '#333333';
      field.dispatchEvent(new Event('change', { bubbles: true }));
      await panel.updateComplete;
      expect(root.querySelector('#ts-export-note')?.textContent).toContain('Generating');
      expect(button('Save to theme.json')!.disabled).toBe(false);
      gate = undefined;
      let read = delivered;
      answer();
      await until(() => delivered === read + 1, 'the held reply');
      await settled();
      expect(diff()).toBeNull();
      expect(status()).not.toContain('Review the changes');
      button('Save to theme.json')!.click();
      await until(() => !!diff(), "the newer draft's diff");
      expect(requests[6]).toEqual({ file: 'theme.json', config: panel.draft });
      await until(() => button('Write theme.json')?.disabled === false, 'the write button');

      // JSON that does not parse is not the draft: neither reviewed nor written.
      const json = root.querySelector<HTMLTextAreaElement>('#ts-json')!;
      const text = json.value;
      json.value = '{ "brand": ';
      json.dispatchEvent(new Event('input', { bubbles: true }));
      await panel.updateComplete;
      expect(button('Save to theme.json')!.disabled).toBe(true);
      expect(button('Write theme.json')!.disabled).toBe(true);
      json.value = text;
      json.dispatchEvent(new Event('input', { bubbles: true }));
      // A draft the generator refuses can be reviewed, not written.
      field.value = 'invalid';
      field.dispatchEvent(new Event('change', { bubbles: true }));
      await until(() => status().includes('This draft is invalid'), 'the refusal');
      expect(button('Save to theme.json')!.disabled).toBe(false);
      button('Save to theme.json')!.click();
      await until(() => !!diff(), "the refused draft's diff");
      expect(button('Write theme.json')!.disabled).toBe(true);

      // A conflict answered after a newer draft shows no diff for the older one.
      field.value = '#444444';
      field.dispatchEvent(new Event('change', { bubbles: true }));
      button('Save to theme.json')!.click();
      await until(() => !!diff(), 'a diff to write');
      await until(() => button('Write theme.json')?.disabled === false, 'the write button');
      version = 'v9';
      const sent = requests.length;
      gate = new Promise<void>((resolve) => (answer = resolve));
      button('Write theme.json')!.click();
      await until(() => requests.length === sent + 1, 'the held write');
      field.value = '#555555';
      field.dispatchEvent(new Event('change', { bubbles: true }));
      gate = undefined;
      read = delivered;
      answer();
      await until(() => delivered === read + 1, 'the held conflict');
      await settled();
      expect(diff()).toBeNull();
      expect(status()).not.toContain('changed on disk');
    } finally {
      spy.mockRestore();
    }
  });

  it('edits each file of a theme on a base: generated on its bases, saved alone', async () => {
    const requests: Record<string, unknown>[] = [];
    const fetchOriginal = globalThis.fetch;
    const spy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      if (String(input) !== '/save-theme') return fetchOriginal(input, init);
      const request = JSON.parse(String(init?.body)) as Record<string, unknown>;
      requests.push(request);
      const reply = { file: request['file'], version: 'v1', lines: ['@@ -1 +1 @@', '-a', '+b'] };
      return new Response(JSON.stringify(reply), {
        headers: { 'content-type': 'application/json' },
      });
    });
    try {
      const page = studioPage();
      const baseTheme = {
        brand: { primary: '#123456', neutral: '#777777' },
        spacing: { strategy: 'multiples', unit: '4px' },
        radius: { scale: 2 },
        overrides: { 'color.canvas': { light: '#ffffff', dark: '#000000' } },
      };
      const product = { extends: './base.theme.json', brand: { neutral: '#888888' } };
      const files = [
        { file: 'base.theme.json', config: baseTheme, save: '/save-theme' },
        {
          file: 'product.theme.json',
          config: product,
          base: 'base.theme.json',
          save: '/save-theme',
        },
      ];
      const panel = document.createElement('oddkin-theme-studio-panel');
      panel.frameUrl = frameUrl;
      panel.page = { ...page, studio: { ...page.studio, files } };
      mounted.push(panel);
      document.body.append(panel);
      const root = panel.shadowRoot!;
      const docs = () => panel.previews.map((preview) => preview.iframe.contentDocument);
      const themed = (value: string) =>
        docs().length === 2 &&
        docs().every((doc) =>
          [...(doc?.adoptedStyleSheets ?? [])].some((sheet) =>
            [...sheet.cssRules].some((rule) => rule.cssText.includes(value)),
          ),
        );
      const input = (id: string) => root.querySelector<HTMLInputElement>(`#${id}`)!;
      const origin = (id: string) => root.querySelector(`#${id}-origin`)?.textContent?.trim();
      const set = (target: HTMLInputElement, value: string) => {
        target.value = value;
        target.dispatchEvent(new Event('change', { bubbles: true }));
      };
      const picker = () => root.querySelector<HTMLSelectElement>('#ts-file')!;
      const open = (file: string) => {
        picker().value = file;
        picker().dispatchEvent(new Event('change', { bubbles: true }));
      };
      const label = (file: string) =>
        [...picker().options]
          .find((o) => o.value === file)
          ?.textContent?.replace(/\s+/g, ' ')
          .trim();
      const status = () => root.querySelector('#ts-impact')?.textContent?.trim();

      // The theme file is edited first, as written: the base's values are not in its draft.
      await until(() => themed('#123456'), "the base's primary, generated under the product");
      await until(() => !!root.querySelector('#ts-file'), 'the file picker');
      expect(panel.draft).toEqual(product);
      expect([label('base.theme.json'), label('product.theme.json'), picker().value]).toEqual([
        'base.theme.json (base)',
        'product.theme.json',
        'product.theme.json',
      ]);
      expect(root.querySelector('#ts-file-note')?.textContent).toContain(
        'Builds on base.theme.json',
      );
      expect([input('ts-brand-primary').value, input('ts-brand-primary').placeholder]).toEqual([
        '',
        '#123456 (from base.theme.json)',
      ]);
      expect(origin('ts-brand-primary')).toBe('foundation input · from base.theme.json');
      expect([input('ts-brand-neutral').value, origin('ts-brand-neutral')]).toEqual([
        '#888888',
        'foundation input · set in this file',
      ]);
      expect(input('ts-spacing-unit').placeholder).toBe('4px (from base.theme.json)');
      // A choice the draft inherits names the base's option.
      expect(
        root.querySelector<HTMLSelectElement>('#ts-radius-scale')?.options[0]?.textContent?.trim(),
      ).toBe('Round (from base.theme.json)');
      expect(origin('ts-radius-scale')).toBe('foundation input · from base.theme.json');
      const canvas = root.querySelector('[data-group="overrides"] tbody tr')!;
      expect(canvas.querySelector('th')?.textContent).toContain('from base.theme.json');
      expect(canvas.querySelector('input')?.placeholder).toBe('#ffffff (from base.theme.json)');
      expect(root.querySelector('#ts-json')).toHaveProperty(
        'value',
        JSON.stringify(product, null, 2),
      );
      expect(root.querySelector('#generate')?.textContent?.replace(/\s+/g, ' ')).toContain(
        'Draft of product.theme.json.',
      );
      // Edits made while a draft is generating are generated on the bases too.
      const delivered = panel.generation!.delivered;
      set(input('ts-brand-neutral'), '#999999');
      set(input('ts-brand-neutral'), '#888888');
      await until(() => panel.generation!.delivered === delivered + 1, 'the newest draft');
      expect(panel.generation!.superseded).toBeGreaterThan(0);
      expect(themed('#123456')).toBe(true);

      // A spacing field it inherits: the file takes the whole spacing, then the edit.
      set(input('ts-spacing-unit'), '8px');
      await settled();
      expect(panel.draft).toEqual({ ...product, spacing: { strategy: 'multiples', unit: '8px' } });
      expect(origin('ts-spacing-unit')).toBe('foundation input · set in this file');
      // Clearing a value it inherits changes nothing.
      set(input('ts-brand-primary'), '');
      await settled();
      expect(panel.draft).not.toHaveProperty(['brand', 'primary']);
      expect(label('product.theme.json')).toBe('product.theme.json (edited)');

      // The base: its own draft, and the products an edit to it changes.
      open('base.theme.json');
      await settled();
      expect(panel.draft).toEqual(baseTheme);
      expect(root.querySelector('#generate')?.textContent?.replace(/\s+/g, ' ')).toContain(
        'Draft of base.theme.json.',
      );
      expect(root.querySelector('#export')?.textContent).toContain('Download base.theme.json');
      expect(root.querySelector('#ts-file-note')?.textContent).toContain(
        'Products on it: product.theme.json.',
      );
      expect(origin('ts-brand-primary')).toBe('foundation input · set in this file');
      set(input('ts-brand-primary'), '#222222');
      await until(() => themed('#222222'), 'the edited base');
      await until(() => !!status(), 'the products it changes');
      expect(status()).toBe('This edit changes product.theme.json.');

      // The product, generated on the edited base; then a primary of its own.
      open('product.theme.json');
      await until(() => themed('#222222'), 'the product on the edited base');
      expect(input('ts-brand-primary').placeholder).toBe('#222222 (from base.theme.json)');
      expect(status()).toBe('');
      set(input('ts-brand-primary'), '#0a7d33');
      await until(() => themed('#0a7d33'), "the product's own primary");
      open('base.theme.json');
      set(input('ts-brand-primary'), '#333333');
      await until(
        () => status() === 'This edit changes no product. Unchanged: product.theme.json.',
        'unchanged',
      );

      // Saving writes the file edited, its own draft alone.
      const save = (file: string) =>
        [...root.querySelectorAll('button')].find((b) =>
          b.textContent?.includes(`Save to ${file}`),
        );
      await until(() => save('base.theme.json')?.disabled === false, 'the save button');
      save('base.theme.json')!.click();
      await until(() => requests.length === 1, 'the review');
      expect(requests[0]).toEqual({
        file: 'base.theme.json',
        config: { ...baseTheme, brand: { primary: '#333333', neutral: '#777777' } },
      });
      open('product.theme.json');
      await until(() => save('product.theme.json')?.disabled === false, 'its save button');
      save('product.theme.json')!.click();
      await until(() => requests.length === 2, 'the second review');
      expect(requests[1]).toEqual({
        file: 'product.theme.json',
        config: {
          extends: './base.theme.json',
          brand: { neutral: '#888888', primary: '#0a7d33' },
          spacing: { strategy: 'multiples', unit: '8px' },
        },
      });

      // The rebuild after a save (the base now holds its draft) keeps every draft, and the base
      // is no longer marked edited.
      const saved = requests[0]!['config'] as typeof baseTheme;
      panel.page = {
        ...page,
        studio: { ...page.studio, files: [{ ...files[0]!, config: saved }, files[1]!] },
      };
      await settled();
      expect(panel.draft).toEqual(requests[1]!['config']);
      expect([label('base.theme.json'), label('product.theme.json')]).toEqual([
        'base.theme.json (base)',
        'product.theme.json (edited)',
      ]);

      // A file the dev server does not write says why (a rebuild with a changed base restarts).
      panel.page = {
        ...page,
        studio: {
          ...page.studio,
          files: [
            {
              file: 'base.theme.json',
              config: { ...baseTheme, name: 'base' },
              unsaveable: 'a .json theme file: base is code',
            },
            files[1]!,
          ],
        },
      };
      await until(() => panel.draft === product, 'the new page');
      await until(() => !!picker(), 'the file picker again');
      open('base.theme.json');
      await settled();
      expect(save('base.theme.json')).toBeUndefined();
      expect(root.querySelector('#export')?.textContent).toContain(
        'Saving needs a .json theme file: base is code.',
      );
    } finally {
      spy.mockRestore();
    }
  });

  it('generates a file on its bases in order, the root first, and names only products', async () => {
    const page = studioPage();
    const files = [
      { file: 'root.json', config: { brand: { primary: '#111111' } } },
      { file: 'mid.json', config: { brand: { primary: '#222222' } }, base: 'root.json' },
      { file: 'leaf.json', config: { name: 'leaf' }, base: 'mid.json' },
    ];
    const panel = document.createElement('oddkin-theme-studio-panel');
    panel.frameUrl = frameUrl;
    panel.page = { ...page, studio: { ...page.studio, files } };
    mounted.push(panel);
    document.body.append(panel);
    const root = panel.shadowRoot!;
    const themed = (value: string) =>
      panel.previews.length === 2 &&
      panel.previews.every((preview) =>
        [...(preview.iframe.contentDocument?.adoptedStyleSheets ?? [])].some((sheet) =>
          [...sheet.cssRules].some((rule) => rule.cssText.includes(value)),
        ),
      );
    await until(() => themed('#222222'), 'the nearest base wins');
    await until(() => !!root.querySelector('#ts-file'), 'the file picker');
    const picker = root.querySelector<HTMLSelectElement>('#ts-file')!;
    picker.value = 'root.json';
    picker.dispatchEvent(new Event('change', { bubbles: true }));
    await settled();
    // A base that builds on another is not a product.
    expect(root.querySelector('#ts-file-note')?.textContent?.trim()).toBe(
      'Products on it: leaf.json.',
    );
    expect(root.querySelector('#ts-impact')?.textContent?.trim()).toBe('');
    // A rebuild that renames a file restarts: each draft belongs to its file.
    panel.page = {
      ...page,
      studio: {
        ...page.studio,
        files: [
          files[0]!,
          { ...files[1]!, file: 'middle.json' },
          { ...files[2]!, base: 'middle.json' },
        ],
      },
    };
    await until(() => !!root.querySelector('#ts-file option[value="middle.json"]'), 'the rename');
    const renamed = root.querySelector<HTMLSelectElement>('#ts-file')!;
    renamed.value = 'middle.json';
    renamed.dispatchEvent(new Event('change', { bubbles: true }));
    await settled();
    expect(panel.draft).toEqual({ brand: { primary: '#222222' } });
  });

  it('checks only an edited base, and keeps only the newest check', async () => {
    const { ThemeProducts } = await import('../src/panels/theme-products.js');
    const scope = createScope({ name: 'theme products test' });
    const files = [
      { file: 'base.json', config: { brand: { primary: '#111111' } } },
      { file: 'a.json', config: {}, base: 'base.json' },
      { file: 'b.json', config: { brand: { primary: '#222222' } }, base: 'base.json' },
    ];
    const drafts = new Map<string, unknown>(files.map((f) => [f.file, f.config]));
    const products = new ThemeProducts(
      new URL('./fixtures/theme-worker.ts', import.meta.url).href,
      scope,
      {
        files,
        themes: undefined,
        file: 'base.json',
        product: '',
        css: undefined,
        draft: (file) => drafts.get(file),
        bases: (file) =>
          file === 'base.json' ? [] : [{ file: 'base.json', config: drafts.get('base.json') }],
        open: () => {},
        set: () => {},
        frame: () => {
          throw new Error('This test compares nothing.');
        },
        attach: async () => {},
        detach: () => {},
      },
    );
    const host = document.createElement('div');
    const status = () => {
      render(products.render(), host);
      return host.querySelector('#ts-impact')?.textContent?.trim();
    };
    try {
      await products.check();
      expect(status()).toBe('');
      expect(host.querySelector('#ts-file-note')?.textContent?.trim()).toBe(
        'Products on it: a.json, b.json.',
      );
      drafts.set('base.json', { brand: { primary: '#333333' } });
      await products.check();
      expect(status()).toBe('This edit changes a.json. Unchanged: b.json.');
      // An edit undone while the check of the edit runs: only the newest check counts.
      drafts.set('base.json', { brand: { primary: '#444444' } });
      const older = products.check();
      drafts.set('base.json', files[0]!.config);
      await Promise.all([older, products.check()]);
      expect(status()).toBe('');
    } finally {
      scope.dispose();
    }
  });

  it('edits each theme and the products of a file, adds a product, and compares chosen ones', async () => {
    const frames = previewProtocolStats().liveFrames;
    const page = studioPage();
    const canvas = { 'color.canvas': { light: '#ffffff', dark: '#000000' } };
    const base = { brand: { primary: '#123456' }, overrides: canvas };
    const clinic = { extends: './base.theme.json', brand: { primary: '#0a7d33' } };
    const portal = {
      extends: './base.theme.json',
      products: { kiosk: { brand: { primary: '#aa0000' } }, lobby: {} },
    };
    const files = [
      { file: 'base.theme.json', config: base },
      { file: 'clinic.theme.json', config: clinic, base: 'base.theme.json' },
      { file: 'portal.theme.json', config: portal, base: 'base.theme.json' },
    ];
    const themes = [
      { file: 'clinic.theme.json', name: 'clinic' },
      { file: 'portal.theme.json', name: 'portal' },
    ];
    const panel = document.createElement('oddkin-theme-studio-panel');
    panel.frameUrl = frameUrl;
    panel.page = { ...page, studio: { ...page.studio, files, themes } };
    mounted.push(panel);
    document.body.append(panel);
    const root = panel.shadowRoot!;
    const sheets = (previews: readonly { iframe: HTMLIFrameElement }[], value: string) =>
      previews.length > 0 &&
      previews.every((preview) =>
        [...(preview.iframe.contentDocument?.adoptedStyleSheets ?? [])].some((sheet) =>
          [...sheet.cssRules].some((rule) => rule.cssText.includes(value)),
        ),
      );
    const picker = () => root.querySelector<HTMLSelectElement>('#ts-file')!;
    const open = (value: string) => {
      picker().value = value;
      picker().dispatchEvent(new Event('change', { bubbles: true }));
    };
    const set = (target: HTMLInputElement | null, value: string) => {
      target!.value = value;
      target!.dispatchEvent(new Event('change', { bubbles: true }));
    };
    const input = (id: string) => root.querySelector<HTMLInputElement>(`#${id}`);
    const status = () => root.querySelector('#ts-impact')?.textContent?.trim();
    const text = (selector: string) =>
      root.querySelector(selector)?.textContent?.replace(/\s+/g, ' ').trim();

    // The first theme is edited first; the picker lists every file and each file's products.
    await until(() => sheets(panel.previews, '#0a7d33'), "clinic's primary");
    await until(() => !!picker(), 'the picker');
    expect([...picker().options].map((o) => o.textContent?.trim())).toEqual([
      'base.theme.json (base)',
      'clinic',
      'portal',
      'portal / kiosk',
      'portal / lobby',
    ]);
    expect(picker().value).toBe('clinic.theme.json');

    // A product of a file: its own entries over its theme, shown with the product's setting.
    const productOf = (iframe: HTMLIFrameElement) =>
      iframe.contentDocument?.querySelector<HTMLElement>('[data-oddkin-preview]')?.dataset[
        'oddProduct'
      ];
    open('portal.theme.json#kiosk');
    await until(
      () => panel.previews.every((p) => productOf(p.iframe) === 'kiosk'),
      'the product in both frames',
    );
    // The ramp and contrast views are the product's.
    await until(() => !!text('#ts-contrast-summary')?.includes('for product kiosk'), 'its views');
    expect(text('#ramps tbody tr:nth-child(2) td:last-child')).toBe('#aa0000');
    expect(panel.draft).toEqual(portal);
    expect(text('#generate')).toContain('Draft of portal.theme.json, product kiosk.');
    expect(input('ts-brand-primary')?.value).toBe('#aa0000');
    expect(input('ts-status-danger')).toBeNull();
    expect(root.querySelector('[data-group="spacing"]')).toBeNull();
    const row = root.querySelector('[data-group="overrides"] tbody tr');
    expect(row?.querySelector('th')?.textContent).toContain('from base.theme.json');
    set(input('ts-brand-primary'), '#bb0000');
    await until(() => sheets(panel.previews, '#bb0000'), "kiosk's new primary");
    // An inherited override is copied into the product, then edited; lobby is untouched.
    set(row?.querySelector('input') ?? null, '#fafafa');
    await settled();
    expect(panel.draft).toEqual({
      ...portal,
      products: {
        kiosk: {
          brand: { primary: '#bb0000' },
          overrides: { 'color.canvas': { light: '#fafafa', dark: '#000000' } },
        },
        lobby: {},
      },
    });
    await until(() => !!status(), 'what the edit changes');
    expect(status()).toBe('This edit changes no product. Unchanged: portal / lobby.');

    // A new product from a brand colour, in the file edited; a bad name or a taken one says so.
    const add = (name: string, colour: string) => {
      set(input('ts-new-product'), name);
      set(input('ts-new-brand'), colour);
      root.querySelector<HTMLFormElement>('form[aria-label="New product"]')!.requestSubmit();
    };
    const message = () => root.querySelector('#ts-product-status')?.textContent?.trim();
    add('kiosk', '#00aa55');
    await settled();
    expect(message()).toBe('portal.theme.json already has a product kiosk.');
    add('a b', '#00aa55');
    await settled();
    expect(message()).toBe('Name the product with letters, digits, "-", and "_".');
    add('museum', '#00aa55');
    await settled();
    expect(message()).toBe('Added museum to the draft of portal.theme.json.');
    expect(getPath(panel.draft, ['products', 'museum'])).toEqual({
      brand: { primary: '#00aa55' },
    });
    expect(picker().value).toBe('portal.theme.json#museum');
    await until(() => sheets(panel.previews, '#00aa55'), "museum's primary");
    // Another product of the same file: the views follow it.
    await until(() => !!text('#ts-contrast-summary')?.includes('for product museum'), 'its views');
    expect(text('#ramps tbody tr:nth-child(2) td:last-child')).toBe('#00aa55');

    // Compare: chosen products beside the one edited, in light and dark, on the same screen.
    const choices = () => [
      ...root.querySelectorAll<HTMLLabelElement>('fieldset[data-group="compare"] label'),
    ];
    const choice = (label: string) =>
      choices()
        .find((l) => l.textContent?.trim() === label)
        ?.querySelector('input');
    expect(choices().map((l) => l.textContent?.trim())).toEqual([
      'clinic',
      'portal',
      'portal / kiosk',
      'portal / lobby',
    ]);
    const check = (label: string, on: boolean) => {
      const box = choice(label)!;
      box.checked = on;
      box.dispatchEvent(new Event('change', { bubbles: true }));
    };
    const compared = (label: string) =>
      [
        ...(root.querySelector(`section[aria-label="${label}"]`)?.querySelectorAll('iframe') ?? []),
      ].map((iframe) => ({ iframe }));
    check('clinic', true);
    check('portal / kiosk', true);
    await until(() => sheets(compared('clinic'), '#0a7d33'), "clinic's frames");
    await until(() => sheets(compared('portal / kiosk'), '#bb0000'), "kiosk's frames");
    // A frame's product setting can arrive after its CSS (CI run 41995923296, Chromium).
    await until(
      () =>
        compared('portal / kiosk')
          .map(({ iframe }) => productOf(iframe))
          .join() === 'kiosk,kiosk',
      "kiosk's product in both frames",
    );
    expect(previewProtocolStats().liveFrames).toBe(frames + 6);
    // Compared products of the file edited take each new CSS; compared frames follow the screen.
    set(input('ts-brand-primary'), '#00bb66');
    await until(() => sheets(compared('portal / kiosk'), '#00bb66'), "the edit beside kiosk's");
    const screen = root.querySelector<HTMLSelectElement>('#ts-screen')!;
    screen.value = 'component:fixture-button';
    screen.dispatchEvent(new Event('change', { bubbles: true }));
    await until(
      () =>
        compared('clinic').every(
          ({ iframe }) => !!iframe.contentDocument?.querySelector('figure[data-role="quiet"]'),
        ),
      'the screen in the compared frames',
    );
    check('clinic', false);
    await settled();
    expect(root.querySelector('section[aria-label="clinic"]')).toBeNull();
    expect(previewProtocolStats().liveFrames).toBe(frames + 4);

    // The base: an edit names each theme and product it changes; compared files follow it.
    open('base.theme.json');
    set(input('ts-brand-primary'), '#222222');
    // The museum edit's result shows until the base edit's replaces it.
    const based =
      'This edit changes portal, portal / lobby. Unchanged: clinic, portal / kiosk, portal / museum.';
    await until(() => status() === based, 'what the base edit changes');
    await until(() => sheets(compared('portal / kiosk'), '#222222'), 'kiosk on the edited base');
  });

  it("lists a file's products as merged, and forms a product over its theme and bases", async () => {
    const { ThemeProducts } = await import('../src/panels/theme-products.js');
    const { themeFields } = await import('../src/panels/theme-model.js');
    const scope = createScope({ name: 'theme products form test' });
    const files = [
      {
        file: 'base.json',
        config: {
          brand: { primary: '#111111' },
          products: { kiosk: { brand: { neutral: '#555555' } }, retired: {} },
        },
      },
      {
        file: 'portal.json',
        config: { brand: { neutral: '#888888' }, products: { kiosk: {}, retired: null } },
        base: 'base.json',
      },
    ];
    const drafts = new Map<string, unknown>(files.map((f) => [f.file, f.config]));
    const products = new ThemeProducts(
      new URL('./fixtures/theme-worker.ts', import.meta.url).href,
      scope,
      {
        files,
        themes: [{ file: 'portal.json', name: 'portal' }],
        file: 'portal.json',
        product: 'kiosk',
        css: undefined,
        draft: (file) => drafts.get(file),
        bases: (file) =>
          file === 'base.json' ? [] : [{ file: 'base.json', config: drafts.get('base.json') }],
        open: () => {},
        set: () => {},
        frame: () => {
          throw new Error('This test compares nothing.');
        },
        attach: async () => {},
        detach: () => {},
      },
    );
    const host = document.createElement('div');
    try {
      render(products.render(), host);
      // A product a base declares belongs to the files on it, unless a file removes it (null).
      expect([...host.querySelectorAll('option')].map((o) => o.textContent?.trim())).toEqual([
        'base.json (base)',
        'base.json / kiosk',
        'base.json / retired',
        'portal',
        'portal / kiosk',
      ]);
      // A product's own entries win over its theme's, and a base's entries for it over the
      // file's theme: kiosk's neutral comes from the base's kiosk, not portal's theme.
      const form = products.form()!;
      const neutral = themeFields(form.config, form.bases, true)[0]?.fields[1];
      expect(neutral?.inherited).toEqual({ file: 'base.json (kiosk)', value: '#555555' });
      expect(form.path).toEqual(['products', 'kiosk']);
      expect(form.value({ brand: { primary: '#222222' } })).toEqual({
        brand: { primary: '#222222' },
      });
    } finally {
      scope.dispose();
    }
  });

  it('keeps the draft and screen when a rebuild leaves the theme file alone or saves the draft', async () => {
    const panel = document.createElement('oddkin-theme-studio-panel');
    panel.frameUrl = frameUrl;
    panel.page = studioPage();
    mounted.push(panel);
    document.body.append(panel);
    const root = panel.shadowRoot!;
    const select = () => root.querySelector<HTMLSelectElement>('#ts-screen')!;
    await until(() => panel.previews.length === 2, 'the frames');
    const frames = panel.previews;
    select().value = 'component:fixture-button';
    select().dispatchEvent(new Event('change', { bubbles: true }));
    const field = root.querySelector<HTMLInputElement>('#ts-brand-primary')!;
    field.value = '#0a7d33';
    field.dispatchEvent(new Event('change', { bubbles: true }));
    const draft = panel.draft;
    // New screens data, the same theme file: the draft, screen, and frames stay.
    const items = studioPage().studio.screens!.components[0]!.items;
    const rebuilt = studioPage();
    panel.page = {
      ...rebuilt,
      studio: {
        ...rebuilt.studio,
        screens: {
          ...rebuilt.studio.screens!,
          components: [
            {
              tag: 'fixture-button',
              title: 'Fixture button',
              items: items.slice(0, 1),
              omitted: [],
            },
          ],
        },
      },
    };
    await until(
      () => panel.previews[1]?.iframe.contentDocument?.querySelectorAll('figure').length === 1,
      'the new screens data',
    );
    expect([panel.draft, select().value]).toEqual([draft, 'component:fixture-button']);
    expect(panel.previews).toBe(frames);
    // The file now holds the draft, as after a save: still nothing restarts.
    panel.page = { ...rebuilt, studio: { ...rebuilt.studio, config: draft as never } };
    await settled();
    expect([panel.draft, select().value]).toEqual([draft, 'component:fixture-button']);
    expect(panel.previews).toBe(frames);
    // Someone else changed the file: the new baseline replaces the draft.
    panel.page = {
      ...rebuilt,
      studio: { ...rebuilt.studio, config: { brand: { primary: '#999999' } } },
    };
    await settled();
    expect(panel.draft).toEqual({ brand: { primary: '#999999' } });
    expect(panel.previews).not.toBe(frames);
  });

  // Continuity (responsiveness.md; component-contracts.md §2.11): the panel arranges by its own
  // container, Generate beside the screens when wide and above them when narrow, and a change of
  // width keeps the reader's work: a value typed and not yet applied (its caret and the focus), the
  // file and product edited, the screen, an open diff, and the frames, which do not reload.
  it('keeps the draft, focus, product, screen, open diff, and frames while its parent changes width', async () => {
    await linkTheme();
    // A path as long as the dev server's: it wraps rather than widening the panel.
    const portalFile = '../../../packages/tokens/themes/portal.theme.json';
    const fetchOriginal = globalThis.fetch;
    const lines = ['@@ -1,3 +1,3 @@', `-${'"#aa0000" '.repeat(12)}`, `+${'"#bb0000" '.repeat(12)}`];
    const spy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) =>
      String(input) === '/save-portal'
        ? new Response(JSON.stringify({ file: portalFile, version: 'v1', lines }), {
            status: 200,
            headers: { 'content-type': 'application/json' },
          })
        : fetchOriginal(input, init),
    );
    const host = document.createElement('div');
    host.style.boxSizing = 'border-box';
    host.style.padding = '10px';
    try {
      const page = studioPage();
      const base = {
        brand: { primary: '#123456' },
        overrides: { 'color.canvas': { light: '#ffffff', dark: '#000000' } },
      };
      const portal = {
        extends: './base.theme.json',
        products: { kiosk: { brand: { primary: '#aa0000' } } },
      };
      const files = [
        { file: 'base.theme.json', config: base },
        {
          file: portalFile,
          config: portal,
          base: 'base.theme.json',
          save: '/save-portal',
        },
      ];
      const panel = document.createElement('oddkin-theme-studio-panel');
      panel.frameUrl = frameUrl;
      panel.page = {
        ...page,
        studio: { ...page.studio, files, themes: [{ file: portalFile, name: 'portal' }] },
      };
      host.append(panel);
      mounted.push(host);
      document.body.append(host);
      const root = panel.shadowRoot!;
      const $ = <E extends Element>(selector: string) => root.querySelector<E>(selector)!;
      const change = (select: HTMLSelectElement, value: string) => {
        select.value = value;
        select.dispatchEvent(new Event('change', { bubbles: true }));
      };
      const button = (text: string) =>
        [...root.querySelectorAll('button')].find((b) => b.textContent?.includes(text));
      const productOf = (iframe: HTMLIFrameElement) =>
        iframe.contentDocument?.querySelector<HTMLElement>('[data-oddkin-preview]')?.dataset[
          'oddProduct'
        ];
      await until(() => panel.previews.length === 2 && !!$('#ts-file'), 'the frames and picker');

      // The reader picks a product and a screen, asks for the diff, and types a value.
      change($('#ts-file'), `${portalFile}#kiosk`);
      await until(() => panel.previews.every((p) => productOf(p.iframe) === 'kiosk'), 'kiosk');
      change($('#ts-screen'), 'component:fixture-button');
      await until(
        () =>
          panel.previews.every(
            (p) => !!p.iframe.contentDocument?.querySelector('[data-role="quiet"]'),
          ),
        'the component screen',
      );
      await until(() => button(`Save to ${portalFile}`)?.disabled === false, 'saving');
      button(`Save to ${portalFile}`)!.click();
      await until(() => !!$(`[aria-label="Changes to ${portalFile}"]`), 'the diff');
      const diff = $(`[aria-label="Changes to ${portalFile}"]`);
      const field = $<HTMLInputElement>('#ts-brand-primary');
      await userEvent.fill(field, '#bb0000');
      field.setSelectionRange(3, 3);
      const frames = panel.previews.map((p) => [p.iframe, p.iframe.contentDocument]);
      for (const [, doc] of frames) (doc as Document & { probe?: true }).probe = true;
      const density = () =>
        [field, $('#ts-screen'), $('fieldset.wb-group'), button(`Write ${portalFile}`)!].map(
          (el) => {
            const style = getComputedStyle(el);
            return [style.paddingInlineStart, style.paddingBlockStart, style.fontSize];
          },
        );
      const first = density();

      for (const width of [1400, 800, 420, 1400, 360]) {
        host.style.inlineSize = `${width}px`;
        await settled();
        await painted();
        expect($('#ts-brand-primary')).toBe(field);
        expect(field.value).toBe('#bb0000');
        expect(root.activeElement).toBe(field);
        expect([field.selectionStart, field.selectionEnd]).toEqual([3, 3]);
        expect([
          $<HTMLSelectElement>('#ts-file').value,
          $<HTMLSelectElement>('#ts-screen').value,
        ]).toEqual([`${portalFile}#kiosk`, 'component:fixture-button']);
        expect($(`[aria-label="Changes to ${portalFile}"]`)).toBe(diff);
        // The same frames and documents: nothing reloaded them.
        panel.previews.forEach((p, i) => {
          expect(p.iframe).toBe(frames[i]![0]);
          expect(p.iframe.contentDocument).toBe(frames[i]![1]);
        });
        expect(
          panel.previews.every(
            (p) => (p.iframe.contentDocument as Document & { probe?: true }).probe,
          ),
        ).toBe(true);
        expect(density()).toEqual(first);
        // Nothing overflows the parent; the table and the diff scroll on their own.
        expect(host.scrollWidth).toBeLessThanOrEqual(host.clientWidth + 1);
        const content = $('.wb-content');
        expect(content.scrollWidth).toBeLessThanOrEqual(content.clientWidth + 1);
        // Generate beside the screens in a wide container (52rem), above them in a narrow one.
        const generate = $('#generate').getBoundingClientRect();
        const screens = $('#live-preview').getBoundingClientRect();
        if (width >= 900) expect(screens.left).toBeGreaterThanOrEqual(generate.right);
        else expect(screens.top).toBeGreaterThanOrEqual(generate.bottom);
      }
      // The typed value applies when the reader leaves the field, as before.
      await userEvent.keyboard('{Tab}');
      await until(() => JSON.stringify(panel.draft).includes('#bb0000'), 'the applied value');
    } finally {
      spy.mockRestore();
    }
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
    expect(root.querySelector('.wb-card-tag code')?.textContent).toBe('wb-probe');
    expect(root.querySelector('.wb-card-tag .wb-card-package')?.textContent).toBe('@probe/ui');
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
    // The package ends the tag's row, on the tag's line (Figma 20:1877).
    const box = (selector: string) => root.querySelector(selector)!.getBoundingClientRect();
    const [row, tag, from] = [
      box('.wb-card-tag'),
      box('.wb-card-tag code'),
      box('.wb-card-package'),
    ];
    expect(Math.abs(from.right - row.right)).toBeLessThan(1);
    expect(from.left).toBeGreaterThan(tag.right);
    expect(from.top < tag.bottom && tag.top < from.bottom).toBe(true);
  });

  // Continuity (responsiveness.md): the cards change columns with the panel's width; the query,
  // its caret and the focus, and the cards themselves stay.
  it('keeps the query, its focus, and the cards while the panel changes width', async () => {
    await linkTheme();
    const panel = document.createElement('oddkin-catalog-panel');
    panel.index = probeData().index;
    panel.href = (route) => `/docs${route}`;
    mounted.push(panel);
    document.body.append(panel);
    const root = panel.shadowRoot!;
    await until(() => !!root.querySelector('odd-card a'), 'the cards');
    const search = root.querySelector<HTMLInputElement>('.wb-catalog-filters input')!;
    await userEvent.fill(search, 'probe');
    search.setSelectionRange(2, 2);
    await until(() => panel.query === 'probe', 'the query');
    await settled();
    const cards = [...root.querySelectorAll('odd-card')];
    expect(cards.length).toBeGreaterThan(0);
    for (const width of [1000, 600, 360, 1000, 360]) {
      panel.style.inlineSize = `${width}px`;
      await settled();
      await painted();
      expect(root.querySelector('.wb-catalog-filters input')).toBe(search);
      expect(search.value).toBe('probe');
      expect(root.activeElement).toBe(search);
      expect([search.selectionStart, search.selectionEnd]).toEqual([2, 2]);
      const shown = [...root.querySelectorAll('odd-card')];
      expect(shown.length === cards.length && shown.every((card, i) => card === cards[i])).toBe(
        true,
      );
      expect(panel.scrollWidth).toBeLessThanOrEqual(panel.clientWidth + 1);
    }
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
