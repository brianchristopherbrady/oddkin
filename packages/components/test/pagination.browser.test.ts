import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { cdp, server, userEvent } from 'vitest/browser';
import { flush } from '@oddkin/core/reactive';
import { scopeStats } from '@oddkin/core/scope';
import type { OddkinPagination } from '../src/pagination/pagination.js';
import './register.js';
import { loadTheme, settle, themeValue } from './probe.js';

// odd-pagination (component-contracts.md §3.4), with the shipped theme.
let unload: () => void;
beforeAll(async () => {
  unload = await loadTheme();
});
afterAll(() => unload());

let container: HTMLElement;
afterEach(() => {
  container?.remove();
  flush();
});
async function mount(attributes: string): Promise<OddkinPagination> {
  container = document.createElement('div');
  container.innerHTML = `<button id="before">before</button><odd-pagination ${attributes}></odd-pagination><button id="after">after</button>`;
  document.body.append(container);
  const el = container.querySelector('odd-pagination')!;
  await settle(el);
  return el;
}
const controls = (el: Element) => [
  ...el.shadowRoot!.querySelectorAll<HTMLElement>('[part~="list"] > li > *'),
];
/** The list as text: `<` and `>` for previous and next (`x` when disabled), `…` for gaps, `[n]` for the current page. */
const shape = (el: Element) =>
  controls(el)
    .map((c) => {
      const part = c.getAttribute('part');
      const off =
        (c as HTMLButtonElement).disabled || c.getAttribute('aria-disabled') === 'true' ? 'x' : '';
      if (part === 'previous') return `<${off}`;
      if (part === 'next') return `>${off}`;
      if (part === 'ellipsis') return '…';
      const n = c.textContent!.trim();
      return c.getAttribute('aria-current') === 'page' ? `[${n}]` : n;
    })
    .join(' ');
const part = (el: Element, name: string, text?: string) =>
  [...el.shadowRoot!.querySelectorAll<HTMLElement>(`[part~="${name}"]`)].find(
    (c) => text === undefined || c.textContent!.trim() === text,
  )!;
const actions = (el: Element) => {
  const seen: unknown[] = [];
  el.addEventListener('odd-action', (e) => {
    const event = e as CustomEvent;
    expect(event.bubbles && event.composed).toBe(true);
    seen.push(event.detail);
  });
  return seen;
};

describe('odd-pagination', () => {
  it('is a named navigation with the position, previous, pages, and next', async () => {
    const el = await mount('current="3" page-count="12"');
    const nav = part(el, 'base');
    expect(nav.localName).toBe('nav');
    expect(nav.getAttribute('aria-label')).toBe('Pagination');
    expect(part(el, 'status').textContent).toBe('Page 3 of 12');
    expect(shape(el)).toBe('< 1 2 [3] 4 … 12 >');
    expect(part(el, 'page', '3').getAttribute('aria-label')).toBe('Page 3');
    expect(part(el, 'previous').getAttribute('aria-label')).toBe('Previous page');
    expect(part(el, 'next').getAttribute('aria-label')).toBe('Next page');
    expect(part(el, 'ellipsis').getAttribute('aria-hidden')).toBe('true');
    el.setAttribute('label', 'Search results');
    el.strings = { status: '{current} / {count}', page: 'Seite {page}' };
    await settle(el);
    expect(nav.getAttribute('aria-label')).toBe('Search results');
    expect(part(el, 'status').textContent).toBe('3 / 12');
    expect(part(el, 'page', '3').getAttribute('aria-label')).toBe('Seite 3');
  });

  it('shows the first, last, current, and neighbouring pages, filling one-page gaps', async () => {
    const el = await mount('current="1" page-count="12"');
    expect(shape(el)).toBe('<x [1] 2 3 … 12 >');
    const cases: [string, number, string][] = [
      ['4', 12, '< 1 2 3 [4] 5 … 12 >'],
      ['6', 12, '< 1 … 5 [6] 7 … 12 >'],
      ['11', 12, '< 1 … 10 [11] 12 >'],
      ['12', 12, '< 1 … 10 11 [12] >x'],
      ['2', 4, '< 1 [2] 3 4 >'],
      ['99', 5, '< 1 2 3 4 [5] >x'],
      ['x', 3, '<x [1] 2 3 >'],
      ['1', 0, '<x [1] >x'],
      ['1', -3, '<x [1] >x'],
    ];
    for (const [current, count, expected] of cases) {
      el.current = current;
      el.pageCount = count;
      await settle(el);
      expect(shape(el), `${current} of ${count}`).toBe(expected);
    }
  });

  it('without href, reports the page to open and leaves current to the application', async () => {
    const el = await mount('current="3" page-count="12"');
    const seen = actions(el);
    part(el, 'page', '4').click();
    part(el, 'next').click();
    part(el, 'previous').click();
    expect(seen).toEqual([
      { id: '4', action: 'page' },
      { id: '4', action: 'page' },
      { id: '2', action: 'page' },
    ]);
    expect(el.current).toBe('3');
    el.current = '1';
    await settle(el);
    part(el, 'previous').click();
    expect(seen).toHaveLength(3);
    expect((part(el, 'previous') as HTMLButtonElement).disabled).toBe(true);
  });

  it('keeps the focused page button when the application moves to it', async () => {
    const el = await mount('current="3" page-count="12"');
    const four = part(el, 'page', '4');
    four.focus();
    el.current = '4';
    await settle(el);
    expect(el.shadowRoot!.activeElement).toBe(four);
    expect(four.getAttribute('aria-current')).toBe('page');
    expect(shape(el)).toBe('< 1 2 3 [4] 5 … 12 >');
  });

  it('with href, renders links from the template and no actions', async () => {
    const el = await mount('current="1" page-count="12" href="#results-{page}"');
    const seen = actions(el);
    expect(controls(el).every((c) => c.localName === 'a' || c.localName === 'span')).toBe(true);
    expect(part(el, 'page', '2').getAttribute('href')).toBe('#results-2');
    expect(part(el, 'page', '1').getAttribute('aria-current')).toBe('page');
    const previous = part(el, 'previous');
    expect(previous.hasAttribute('href')).toBe(false);
    expect(previous.getAttribute('role')).toBe('link');
    expect(previous.getAttribute('aria-disabled')).toBe('true');
    expect(part(el, 'next').getAttribute('href')).toBe('#results-2');
    el.current = '12';
    await settle(el);
    expect(part(el, 'previous').getAttribute('href')).toBe('#results-11');
    expect(part(el, 'next').hasAttribute('href')).toBe(false);
    expect(seen).toEqual([]);
  });

  it('puts enabled controls in the Tab order in reading order', async () => {
    await mount('current="1" page-count="3"');
    container.querySelector<HTMLElement>('#before')!.focus();
    const path: string[] = [];
    for (let i = 0; i < 5; i++) {
      await userEvent.tab();
      let active = document.activeElement;
      while (active?.shadowRoot?.activeElement) active = active.shadowRoot.activeElement;
      path.push(active?.getAttribute('aria-label') ?? active?.id ?? '');
    }
    expect(path).toEqual(['Page 1', 'Page 2', 'Page 3', 'Next page', 'after']);
  });

  it('draws the current page in the selection colours and the steps with strong borders', async () => {
    const el = await mount('current="3" page-count="12"');
    const current = getComputedStyle(part(el, 'page', '3'));
    expect(current.backgroundColor).toBe(
      themeValue('background-color', '--odd-color-selection-background'),
    );
    expect(current.color).toBe(themeValue('color', '--odd-color-selection-foreground'));
    expect(getComputedStyle(part(el, 'page', '2')).borderBlockStartColor).toBe(
      themeValue('color', '--odd-color-border-default'),
    );
    expect(getComputedStyle(part(el, 'next')).borderBlockStartColor).toBe(
      themeValue('color', '--odd-color-border-strong'),
    );
    expect(getComputedStyle(part(el, 'status')).color).toBe(
      themeValue('color', '--odd-color-text-secondary'),
    );
    expect(part(el, 'page', '2').getBoundingClientRect().width).toBe(
      parseFloat(themeValue('inline-size', '--odd-control-height-md')),
    );
    part(el, 'next').focus();
    await userEvent.keyboard('{Shift}');
    expect(getComputedStyle(part(el, 'next')).outlineStyle).toBe('solid');
  });

  it('points previous and next the other way right to left', async () => {
    const el = await mount('current="3" page-count="12" dir="rtl"');
    const glyph = part(el, 'next').querySelector('svg')!;
    expect(getComputedStyle(glyph).scale).toBe('-1 1');
  });

  it.runIf(server.browser === 'chromium')(
    'keeps the current page and disabled steps distinct in forced colours',
    async () => {
      const session = cdp();
      await session.send('Emulation.setEmulatedMedia', {
        features: [{ name: 'forced-colors', value: 'active' }],
      });
      try {
        const el = await mount('current="1" page-count="3"');
        const system = (property: string, color: string) => {
          const probe = document.createElement('span');
          probe.style.setProperty(property, color);
          container.append(probe);
          return getComputedStyle(probe).getPropertyValue(property);
        };
        expect(getComputedStyle(part(el, 'page', '1')).backgroundColor).toBe(
          system('background-color', 'Highlight'),
        );
        expect(getComputedStyle(part(el, 'previous')).color).toBe(system('color', 'GrayText'));
      } finally {
        await session.send('Emulation.setEmulatedMedia', { features: [] });
      }
    },
  );

  it('releases everything it owns when removed', async () => {
    const before = scopeStats();
    await mount('current="3" page-count="12"');
    container.remove();
    flush();
    expect(scopeStats()).toEqual(before);
  });
});
