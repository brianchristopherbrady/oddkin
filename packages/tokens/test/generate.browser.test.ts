import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { generate, resolveToken, type ResolveContext, type ResolvedTheme } from '../src/index.js';
import { cases } from './fixtures/cases.js';

describe('browser generation', () => {
  it('runs unchanged in a module Worker with byte-identical output', async () => {
    const worker = new Worker(new URL('./fixtures/generate.worker.ts', import.meta.url), {
      type: 'module',
    });
    const outputs = await new Promise<Record<string, string>>((resolve, reject) => {
      worker.onmessage = (event: MessageEvent<Record<string, string>>) => resolve(event.data);
      worker.onerror = (event) => reject(new Error(event.message));
    });
    worker.terminate();
    for (const name of Object.keys(cases)) {
      const expected = await (
        await fetch(new URL(`./fixtures/${name}.css.txt`, import.meta.url))
      ).text();
      expect(outputs[name], name).toBe(expected);
    }
  });
  for (const [name, config] of Object.entries(cases)) {
    it(`${name}: byte-identical to the Node-generated fixture`, async () => {
      const expected = await (
        await fetch(new URL(`./fixtures/${name}.css.txt`, import.meta.url))
      ).text();
      expect(generate(config).css).toBe(expected);
    });
  }
});

describe('generated CSS in a real cascade', () => {
  const result = generate(cases['products-density']);
  const theme = result.theme as ResolvedTheme;
  const sheet = new CSSStyleSheet();
  let root: HTMLElement;

  beforeAll(() => {
    sheet.replaceSync(result.css ?? '');
    document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet];
    root = document.createElement('div');
    root.innerHTML = `
      <div data-mote-mode="light" id="light"><i></i>
        <div data-mote-mode="dark" id="dark"><i></i>
          <div data-mote-product="clinic" id="dark-clinic"><i></i>
            <div data-mote-mode="light" id="dark-clinic-light"><i></i></div>
          </div>
          <div data-mote-density="compact" id="dark-compact"><i></i></div>
          <div data-mote-mode="system" id="system"><i></i></div>
          <div id="host"></div>
          <div data-mote-profile="layout.compact" id="dark-profile"><i></i>
            <div data-mote-density="compact" id="dark-profile-compact"><i></i></div>
          </div>
        </div>
        <div data-mote-product="studio" id="studio"><i></i>
          <div data-mote-mode="dark" id="studio-dark"><i></i>
            <div data-mote-density="spacious" id="studio-dark-spacious"><i></i></div>
          </div>
        </div>
      </div>`;
    document.body.append(root);
    const shadow = (root.querySelector('#host') as HTMLElement).attachShadow({ mode: 'open' });
    shadow.innerHTML = '<i id="in-shadow"></i>';
  });

  afterAll(() => {
    root.remove();
    document.adoptedStyleSheets = document.adoptedStyleSheets.filter((s) => s !== sheet);
  });

  const probe = (id: string) => {
    const scope =
      root.querySelector(`#${id}`) ??
      (root.querySelector('#host') as HTMLElement).shadowRoot?.querySelector(`#${id}`);
    const el = (
      scope?.id === 'in-shadow' ? scope : scope?.querySelector(':scope > i')
    ) as HTMLElement;
    el.style.cssText =
      'color: var(--mote-color-action-default); background-color: var(--mote-color-surface-default); padding-left: var(--mote-space-md); min-height: var(--mote-navigation-item-min-height); margin-left: var(--mote-card-padding); display: block';
    return getComputedStyle(el);
  };

  const rgb = (hex: string | undefined) => {
    const h = (hex ?? '').slice(1);
    return `rgb(${[0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)).join(', ')})`;
  };
  // Engines may snap lengths to layout units (WebKit uses 1/64 px), so compare within 0.05px.
  const expectLength = (actual: string, rem: string | undefined) =>
    expect(Number.parseFloat(actual)).toBeCloseTo(Number.parseFloat(px(rem)), 1);
  const px = (rem: string | undefined) =>
    `${Number.parseFloat(rem ?? '') * Number.parseFloat(getComputedStyle(document.documentElement).fontSize)}px`;

  const expectations: Array<[id: string, context: ResolveContext]> = [
    ['light', { mode: 'light' }],
    ['dark', { mode: 'dark' }],
    ['dark-clinic', { mode: 'dark', product: 'clinic' }],
    ['dark-clinic-light', { mode: 'light', product: 'clinic' }],
    ['dark-compact', { mode: 'dark', density: 'compact' }],
    ['studio', { mode: 'light', product: 'studio' }],
    ['studio-dark', { mode: 'dark', product: 'studio' }],
    ['studio-dark-spacious', { mode: 'dark', product: 'studio', density: 'spacious' }],
    ['in-shadow', { mode: 'dark' }],
    ['dark-profile', { mode: 'dark', profiles: ['layout.compact'] }],
    // A nested density re-declares base expressions; the profile must survive inside it.
    ['dark-profile-compact', { mode: 'dark', density: 'compact', profiles: ['layout.compact'] }],
  ];

  for (const [id, context] of expectations) {
    it(`resolves ${id} like the generator (${JSON.stringify(context)})`, () => {
      const style = probe(id);
      expect(style.color).toBe(rgb(resolveToken(theme, 'color.action.default', context)));
      expect(style.backgroundColor).toBe(
        rgb(resolveToken(theme, 'color.surface.default', context)),
      );
      expectLength(style.paddingLeft, resolveToken(theme, 'space.md', context));
      expectLength(style.minHeight, resolveToken(theme, 'navigation.item.min-height', context));
      expectLength(style.marginLeft, resolveToken(theme, 'card.padding', context));
    });
  }

  it('follows the system preference in data-mote-mode="system"', () => {
    const dark = matchMedia('(prefers-color-scheme: dark)').matches;
    const style = probe('system');
    expect(style.color).toBe(
      rgb(resolveToken(theme, 'color.action.default', { mode: dark ? 'dark' : 'light' })),
    );
    expect(style.colorScheme).toBe(dark ? 'dark' : 'light');
  });

  it('accepts the empty mode toggle value', () => {
    const style = getComputedStyle(root.querySelector('#light') as HTMLElement);
    expect(style.getPropertyValue('--mote-mode-dark').trim()).toBe('');
    expect(style.colorScheme).toBe('light');
  });
});
