import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { cdp, server, userEvent } from 'vitest/browser';
import { flush } from '@oddkin/core/reactive';
import { scopeStats } from '@oddkin/core/scope';
import type { OddkinBreadcrumbs } from '../src/breadcrumbs/breadcrumbs.js';
import './register.js';
import { loadTheme, settle, themeValue } from './probe.js';

// odd-breadcrumbs (component-contracts.md §3.4, §2.2 links), with the shipped theme.
let unload: () => void;
beforeAll(async () => {
  unload = await loadTheme();
});
afterAll(() => unload());

const TRAIL = ['Home', 'Workspace', 'Projects', 'Components', 'Forms'];
const records = (labels = TRAIL) =>
  labels.map((label) => ({ label, href: `#${label.toLowerCase()}` }));
const list = (labels = TRAIL) =>
  `<ol>${labels.map((label) => `<li><a href="#${label.toLowerCase()}">${label}</a></li>`).join('')}</ol>`;

let container: HTMLElement;
afterEach(() => {
  container?.remove();
  flush();
  vi.restoreAllMocks();
});
async function mount(attributes: string, children = list()): Promise<OddkinBreadcrumbs> {
  container = document.createElement('div');
  container.innerHTML = `<button id="before">before</button><odd-breadcrumbs ${attributes}>${children}</odd-breadcrumbs><button id="after">after</button>`;
  document.body.append(container);
  const el = container.querySelector('odd-breadcrumbs')!;
  await settle(el);
  return el;
}
/** The trail as text: `[x]` for the current page, `…n` for "more" hiding n items. */
const shape = (el: Element) =>
  [...el.shadowRoot!.querySelectorAll<HTMLElement>('[part~="item"] > :not([part~="separator"])')]
    .map((c) => {
      const part = c.getAttribute('part');
      if (part === 'more') return `…${/\d+/.exec(c.getAttribute('aria-label')!)![0]}`;
      if (part === 'current') return `[${c.textContent!.trim()}]`;
      return c.textContent!.trim();
    })
    .join(' ');
const part = (el: Element, name: string, text?: string) =>
  [...el.shadowRoot!.querySelectorAll<HTMLElement>(`[part~="${name}"]`)].find(
    (c) => text === undefined || c.textContent!.trim() === text,
  )!;
const deepActive = () => {
  let active = document.activeElement;
  while (active?.shadowRoot?.activeElement) active = active.shadowRoot.activeElement;
  return active;
};

describe('odd-breadcrumbs', () => {
  it('reads links from its children into a named list, the last one current', async () => {
    const el = await mount('');
    const nav = part(el, 'base');
    expect(nav.localName).toBe('nav');
    expect(nav.getAttribute('aria-label')).toBe('Breadcrumb');
    expect(part(el, 'list').localName).toBe('ol');
    expect(shape(el)).toBe('Home Workspace Projects Components [Forms]');
    expect(part(el, 'link', 'Workspace').getAttribute('href')).toBe('#workspace');
    const current = part(el, 'current');
    expect(current.localName).toBe('span');
    expect(current.getAttribute('aria-current')).toBe('page');
    const separators = el.shadowRoot!.querySelectorAll('[part~="separator"]');
    expect(separators).toHaveLength(4);
    expect([...separators].every((s) => s.getAttribute('aria-hidden') === 'true')).toBe(true);
    // The children are data: nothing slots them.
    expect(el.shadowRoot!.querySelector('slot')).toBeNull();
    expect(el.querySelector('ol')!.assignedSlot).toBeNull();
    el.setAttribute('label', 'You are here');
    await settle(el);
    expect(nav.getAttribute('aria-label')).toBe('You are here');
  });

  it('follows children as they are added, edited, and removed', async () => {
    const el = await mount('', list(['Home', 'Docs']));
    expect(shape(el)).toBe('Home [Docs]');
    const ol = el.querySelector('ol')!;
    ol.insertAdjacentHTML('beforeend', '<li><a href="#forms">Forms</a></li>');
    await settle(el);
    expect(shape(el)).toBe('Home Docs [Forms]');
    ol.querySelector('a[href="#docs"]')!.textContent = 'Guides';
    ol.querySelector('a[href="#docs"]')!.setAttribute('href', '#guides');
    await settle(el);
    expect(shape(el)).toBe('Home Guides [Forms]');
    expect(part(el, 'link', 'Guides').getAttribute('href')).toBe('#guides');
    ol.lastElementChild!.remove();
    await settle(el);
    expect(shape(el)).toBe('Home [Guides]');
  });

  it('takes items from the property over children, and reports having both once', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const el = await mount('', list(['Home', 'Docs']));
    el.items = records(['Start', 'Settings']);
    await settle(el);
    expect(shape(el)).toBe('Start [Settings]');
    el.items = [];
    await settle(el);
    expect(shape(el)).toBe('');
    expect(
      warn.mock.calls.filter(([m]) => String(m).includes('collection.source.conflict')),
    ).toHaveLength(1);
    el.items = undefined;
    await settle(el);
    expect(shape(el)).toBe('Home [Docs]');
  });

  it('collapses the middle behind "more" with max-items, and shows it on request', async () => {
    const el = await mount('max-items="3"');
    expect(shape(el)).toBe('Home …2 Components [Forms]');
    const more = part(el, 'more');
    expect(more.localName).toBe('button');
    expect(more.getAttribute('aria-label')).toBe('Show 2 more');
    expect(more.previousElementSibling!.getAttribute('part')).toBe('separator');
    const cases: [number, string][] = [
      [0, 'Home Workspace Projects Components [Forms]'],
      [5, 'Home Workspace Projects Components [Forms]'],
      [4, 'Home …1 Projects Components [Forms]'],
      [2, 'Home …3 [Forms]'],
      [1, 'Home …3 [Forms]'],
    ];
    for (const [max, expected] of cases) {
      el.maxItems = max;
      await settle(el);
      expect(shape(el), `max-items ${max}`).toBe(expected);
    }
    // Nothing to hide: two items with max-items 1 stay as they are.
    el.items = records(['Home', 'Docs']);
    await settle(el);
    expect(shape(el)).toBe('Home [Docs]');
    el.items = undefined;
    el.maxItems = 3;
    el.strings = { more: '{count} hidden' };
    await settle(el);
    expect(part(el, 'more').getAttribute('aria-label')).toBe('2 hidden');
    part(el, 'more').click();
    await settle(el);
    expect(shape(el)).toBe('Home Workspace Projects Components [Forms]');
    expect(deepActive()).toBe(part(el, 'link', 'Workspace'));
  });

  it('has the Tab stops of native links and a button, and "more" works from the keyboard', async () => {
    const stops = async () => {
      container.querySelector<HTMLElement>('#before')!.focus();
      const path: string[] = [];
      while (path.at(-1) !== 'after' && path.length < 8) {
        await userEvent.tab();
        const active = deepActive();
        path.push(active?.getAttribute('aria-label') ?? active?.textContent!.trim() ?? '');
      }
      return path;
    };
    // The native equivalent, in the same engine (WebKit leaves links out of the Tab order).
    await mount('', '');
    container.querySelector('odd-breadcrumbs')!.outerHTML =
      '<nav><ol><li><a href="#home">Home</a></li><li><button aria-label="Show 2 more">…</button></li><li><a href="#components">Components</a></li><li><span aria-current="page">Forms</span></li></ol></nav>';
    const native = await stops();
    container.remove();
    expect(native.at(-1)).toBe('after');
    const el = await mount('max-items="3"');
    expect(await stops()).toEqual(native);
    part(el, 'more').focus();
    await userEvent.keyboard('{Enter}');
    await settle(el);
    expect(shape(el)).toBe('Home Workspace Projects Components [Forms]');
    expect(deepActive()).toBe(part(el, 'link', 'Workspace'));
  });

  it('draws links in the link colour and the current page in primary text on the surface', async () => {
    const el = await mount('max-items="3"');
    const base = getComputedStyle(part(el, 'base'));
    expect(base.backgroundColor).toBe(
      themeValue('background-color', '--odd-color-surface-default'),
    );
    expect(base.borderTopLeftRadius).toBe(
      themeValue('border-top-left-radius', '--odd-control-radius'),
    );
    expect(getComputedStyle(part(el, 'link', 'Home')).color).toBe(
      themeValue('color', '--odd-color-link'),
    );
    expect(getComputedStyle(part(el, 'current')).color).toBe(
      themeValue('color', '--odd-color-text-primary'),
    );
    expect(part(el, 'more').getBoundingClientRect().height).toBe(
      parseFloat(themeValue('block-size', '--odd-control-height-sm')),
    );
    part(el, 'link', 'Home').focus();
    await userEvent.keyboard('{Shift}');
    expect(getComputedStyle(part(el, 'link', 'Home')).outlineStyle).toBe('solid');
  });

  it('points the separators the other way right to left', async () => {
    const el = await mount('dir="rtl"');
    const glyph = part(el, 'separator').querySelector('svg')!;
    expect(getComputedStyle(glyph).scale).toBe('-1 1');
  });

  it.runIf(server.browser === 'chromium')(
    'keeps links, the current page, and "more" distinct in forced colours',
    async () => {
      const session = cdp();
      await session.send('Emulation.setEmulatedMedia', {
        features: [{ name: 'forced-colors', value: 'active' }],
      });
      try {
        const el = await mount('max-items="3"');
        const system = (color: string) => {
          const probe = document.createElement('span');
          probe.style.color = color;
          container.append(probe);
          return getComputedStyle(probe).color;
        };
        expect(getComputedStyle(part(el, 'link', 'Home')).color).toBe(system('LinkText'));
        expect(getComputedStyle(part(el, 'current')).color).toBe(system('CanvasText'));
        expect(getComputedStyle(part(el, 'more')).color).toBe(system('ButtonText'));
      } finally {
        await session.send('Emulation.setEmulatedMedia', { features: [] });
      }
    },
  );

  it('releases everything it owns when removed', async () => {
    const before = scopeStats();
    await mount('max-items="3"');
    container.remove();
    flush();
    expect(scopeStats()).toEqual(before);
  });
});
