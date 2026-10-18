import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { flush } from '@oddkin/core/reactive';
import { scopeStats } from '@oddkin/core/scope';
import type { NavigationItem } from '../src/models/navigation.js';
import type { OddkinSideNav } from '../src/side-nav/side-nav.js';

let container: HTMLElement;
beforeEach(() => {
  container = document.createElement('div');
  // Token CSS is not loaded in these tests; the roles the navigation reads are set here.
  container.style.cssText =
    '--odd-navigation-item-gap: 4px; --odd-navigation-item-min-height: 36px; --odd-navigation-item-padding-block: 6px; --odd-navigation-item-padding-inline: 12px; --odd-navigation-indent: 16px; --odd-target-min: 24px; width: 300px';
  document.body.append(container);
});
afterEach(() => {
  container.remove();
  flush();
  vi.restoreAllMocks();
});

const settle = async (el: { updateComplete: Promise<void> }) => {
  await el.updateComplete;
  flush();
  await new Promise((resolve) => setTimeout(resolve, 0));
  await el.updateComplete;
};

const ITEMS: readonly NavigationItem[] = [
  { id: 'overview', kind: 'link', label: 'Overview', href: '/overview' },
  { id: 'components', kind: 'link', label: 'Components', href: '/components', badge: '12' },
  {
    id: 'guides',
    kind: 'group',
    label: 'Guides',
    items: [
      { id: 'theming', kind: 'link', label: 'Theming', href: '/guides/theming' },
      { id: 'layout', kind: 'link', label: 'Layout', href: '/guides/layout' },
    ],
  },
  { id: 'external', kind: 'link', label: 'Source', href: 'https://example.com', target: '_blank' },
  { id: 'create', kind: 'action', label: 'Create project', action: 'project.create' },
];

async function mount(setup: (el: OddkinSideNav) => void = () => {}, markup = '') {
  await import('../src/side-nav/side-nav.define.js');
  const el = document.createElement('odd-side-nav');
  el.innerHTML = markup;
  setup(el);
  container.append(el);
  await settle(el);
  const $ = <T extends Element = HTMLElement>(selector: string) =>
    el.shadowRoot!.querySelector<T>(selector);
  const $$ = <T extends Element = HTMLElement>(selector: string) => [
    ...el.shadowRoot!.querySelectorAll<T>(selector),
  ];
  return { el, $, $$ };
}

describe('imports', () => {
  it('the foundation and the component entry register nothing', async () => {
    const foundation = await import('../src/side-nav/foundation.js');
    expect(Object.keys(foundation).sort()).toEqual([
      'OddkinSideNav',
      'hostStyles',
      'sideNavRecipeStyles',
      'sideNavStructuralStyles',
      'sideNavTemplate',
    ]);
    await import('../src/side-nav/index.js');
    expect(customElements.get('odd-side-nav')).toBeUndefined();
  });
});

describe('odd-side-nav from items', () => {
  it('renders a named landmark of native links, actions, and groups', async () => {
    const { $, $$ } = await mount((el) => {
      el.label = 'Primary';
      el.items = ITEMS;
      el.current = 'components';
    });
    const nav = $('nav')!;
    expect(nav.getAttribute('aria-label')).toBe('Primary');
    const links = $$<HTMLAnchorElement>('a[part="link"]');
    expect(links.map((a) => a.getAttribute('href'))).toEqual([
      '/overview',
      '/components',
      '/guides/theming',
      '/guides/layout',
      'https://example.com',
    ]);
    expect(links[1]!.getAttribute('aria-current')).toBe('page');
    expect(links[0]!.hasAttribute('aria-current')).toBe(false);
    expect(links[1]!.querySelector('[part="badge"]')!.textContent).toBe('12');
    expect(links[4]!.rel).toBe('noopener noreferrer');
    expect($$('button[part="action"]').map((b) => b.textContent?.trim())).toEqual([
      'Create project',
    ]);
    expect($$('li > ul').length).toBe(1);
  });

  it('never renders a script URL and leaves disabled links out of the Tab order', async () => {
    const { $$ } = await mount((el) => {
      el.items = [
        { id: 'a', kind: 'link', label: 'Bad', href: 'java\tscript:alert(1)' },
        { id: 'b', kind: 'link', label: 'Off', href: '/off', disabled: true },
      ];
    });
    const [bad, off] = $$<HTMLAnchorElement>('a');
    expect(bad!.hasAttribute('href')).toBe(false);
    expect(off!.hasAttribute('href')).toBe(false);
    expect(off!.getAttribute('aria-disabled')).toBe('true');
    expect(off!.getAttribute('role')).toBe('link');
  });

  it('opens groups that contain the current link and toggles others (uncontrolled)', async () => {
    const { el, $ } = await mount((el) => {
      el.items = ITEMS;
      el.current = 'layout';
    });
    const toggle = $<HTMLButtonElement>('[part="group-toggle"]')!;
    const group = $<HTMLUListElement>('[part="group"]')!;
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(toggle.getAttribute('aria-controls')).toBe(group.id);
    expect(group.hidden).toBe(false);
    const events: Array<{ id: string; expanded: boolean }> = [];
    el.addEventListener('odd-toggle', (e) => events.push((e as CustomEvent).detail));
    toggle.click();
    await settle(el);
    expect(events).toEqual([{ id: 'guides', expanded: false }]);
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(group.hidden).toBe(true);
    // A cancelled toggle keeps the state.
    el.addEventListener('odd-toggle', (e) => e.preventDefault(), { once: true });
    toggle.click();
    await settle(el);
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
  });

  it('only reports toggles when expansion is controlled', async () => {
    const { el, $ } = await mount((el) => {
      el.items = ITEMS;
      el.expanded = [];
    });
    const toggle = $<HTMLButtonElement>('[part="group-toggle"]')!;
    const events: unknown[] = [];
    el.addEventListener('odd-toggle', (e) => events.push((e as CustomEvent).detail));
    toggle.click();
    await settle(el);
    expect(events).toEqual([{ id: 'guides', expanded: true }]);
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    el.expanded = ['guides'];
    await settle(el);
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
  });

  it('emits odd-action for enabled actions only', async () => {
    const { el, $$ } = await mount((el) => {
      el.items = [
        { id: 'create', kind: 'action', label: 'Create', action: 'project.create' },
        { id: 'delete', kind: 'action', label: 'Delete', action: 'project.delete', disabled: true },
      ];
    });
    const seen: unknown[] = [];
    container.addEventListener('odd-action', (e) => seen.push((e as CustomEvent).detail));
    const [create, remove] = $$<HTMLButtonElement>('button');
    create!.click();
    remove!.click();
    expect(seen).toEqual([{ id: 'create', action: 'project.create' }]);
    expect(remove!.disabled).toBe(true);
    void el;
  });

  it('moves the current marker across unchanged entries and opens the group that contains it', async () => {
    const { el, $, $$ } = await mount((el) => {
      el.items = ITEMS;
      el.current = 'overview';
    });
    const links = $$<HTMLAnchorElement>('a[part="link"]');
    expect(links[0]!.getAttribute('aria-current')).toBe('page');
    expect($<HTMLUListElement>('[part="group"]')!.hidden).toBe(true);
    el.current = 'theming';
    await settle(el);
    expect($$<HTMLAnchorElement>('a[part="link"]')).toEqual(links);
    expect(links[0]!.hasAttribute('aria-current')).toBe(false);
    expect(links[2]!.getAttribute('aria-current')).toBe('page');
    expect($<HTMLUListElement>('[part="group"]')!.hidden).toBe(false);
  });

  it('keeps DOM identity and focus when entries are reordered, inserted, and removed', async () => {
    const { el, $$ } = await mount((el) => (el.items = ITEMS));
    const before = $$<HTMLAnchorElement>('a[href="/components"]')[0]!;
    before.focus();
    el.items = [
      { id: 'new', kind: 'link', label: 'New', href: '/new' },
      ...[...ITEMS].reverse().filter((i) => i.id !== 'overview'),
    ];
    await settle(el);
    const after = $$<HTMLAnchorElement>('a[href="/components"]')[0]!;
    expect(after).toBe(before);
    expect(el.shadowRoot!.activeElement).toBe(before);
    expect($$('a').map((a) => a.textContent?.trim())[0]).toBe('New');
    expect($$('a[href="/overview"]')).toEqual([]);
  });
});

describe('odd-side-nav from slots', () => {
  it('renders declarative links, hides empty header and footer, and lets items win with one warning', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { el, $ } = await mount(
      () => {},
      '<span slot="header">Acme</span><a href="/a">A</a><a href="/b">B</a>',
    );
    expect($('slot:not([name])')).not.toBeNull();
    expect($('[part="header"]')!.hidden).toBe(false);
    expect($('[part="footer"]')!.hidden).toBe(true);
    expect(getComputedStyle(el.querySelector('a')!).display).toBe('block');
    el.items = [];
    await settle(el);
    expect($('slot:not([name])')).toBeNull();
    expect(el.shadowRoot!.querySelectorAll('li').length).toBe(0);
    el.items = [];
    await settle(el);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0]![0])).toContain('collection.source.conflict');
  });
});

describe('layout', () => {
  it('stacks entries when narrow and uses three columns from 40rem of its own width, with no resize observer', async () => {
    const created = vi.spyOn(window, 'ResizeObserver');
    const { el, $ } = await mount((el) => (el.items = ITEMS));
    const writes: MutationRecord[] = [];
    const observer = new MutationObserver((records) => writes.push(...records));
    observer.observe(el.shadowRoot!, { subtree: true, childList: true, attributes: true });
    observer.observe(el, { attributes: true });
    const content = $('.content')!;
    expect(getComputedStyle(content).display).toBe('flex');
    container.style.width = '800px';
    expect(getComputedStyle(content).display).toBe('grid');
    expect(getComputedStyle(content).gridTemplateColumns.split(' ').length).toBe(3);
    container.style.width = '300px';
    expect(getComputedStyle(content).display).toBe('flex');
    await settle(el);
    // The width change is pure CSS: no render, no DOM write in or on the element.
    expect(writes.splice(0).length).toBe(0);
    observer.disconnect();
    expect(created).not.toHaveBeenCalled();
  });

  it('overrides by extend(), host roles, and unlayered ::part() rules leave the shared sheets unchanged', async () => {
    const { sideNavRecipe } = await import('../src/side-nav/side-nav.recipe.js');
    const { row } = await import('../src/layout/index.js');
    const a = (await mount((el) => (el.items = ITEMS))).el;
    const b = (await mount((el) => (el.items = ITEMS))).el;
    const sheets = a.shadowRoot!.adoptedStyleSheets;
    expect(b.shadowRoot!.adoptedStyleSheets).toEqual(sheets);
    const text = () => sheets.map((s) => [...s.cssRules].map((r) => r.cssText).join('\n'));
    const before = text();
    const recipeText = sideNavRecipe.cssText;

    const wide = sideNavRecipe.extend({ regions: { footer: row({ justify: 'end' }) } });
    expect(wide.cssText).not.toBe(recipeText);
    expect(sideNavRecipe.cssText).toBe(recipeText);
    a.id = 'nav-a';
    a.style.setProperty('--odd-navigation-item-padding-inline', '2px');
    const page = document.createElement('style');
    page.textContent = '#nav-a::part(link) { padding-inline-start: 40px; }';
    document.head.append(page);
    try {
      const link = (el: Element) => el.shadowRoot!.querySelector('a')!;
      expect(getComputedStyle(link(a)).paddingInlineStart).toBe('40px');
      expect(getComputedStyle(link(a)).paddingInlineEnd).toBe('2px');
      expect(getComputedStyle(link(b)).paddingInlineStart).toBe('12px');
      expect(getComputedStyle(link(b)).paddingInlineEnd).toBe('12px');
      expect(text()).toEqual(before);
    } finally {
      page.remove();
    }
  });

  it('renders a nested component in a slot, which inherits roles through both shadow boundaries', async () => {
    await import('../src/button/button.define.js');
    const { el } = await mount(
      (el) => (el.items = ITEMS),
      '<odd-button slot="footer" size="sm">Sign out</odd-button>',
    );
    const button = el.querySelector('odd-button')!;
    await button.updateComplete;
    expect(el.shadowRoot!.querySelector<HTMLElement>('[part="footer"]')!.hidden).toBe(false);
    const inner = button.shadowRoot!.querySelector('button')!;
    const label = inner.querySelector<HTMLSlotElement>('slot:not([name])')!;
    expect(label.assignedNodes().map((n) => n.textContent)).toEqual(['Sign out']);
    // A role set on the page scope reaches the button's own shadow root through the slot.
    container.style.setProperty('--odd-button-radius', '7px');
    expect(getComputedStyle(inner).borderTopLeftRadius).toBe('7px');
    inner.focus();
    expect(button.shadowRoot!.activeElement).toBe(inner);
  });

  it('reads navigation roles through the shadow boundary and never shrinks below the target', async () => {
    const { $ } = await mount((el) => (el.items = ITEMS));
    const link = $('a')!;
    expect(getComputedStyle(link).paddingInlineEnd).toBe('12px');
    expect(getComputedStyle(link).minHeight).toBe('36px');
    container.style.setProperty('--odd-navigation-item-padding-inline', '4px');
    container.style.setProperty('--odd-navigation-item-min-height', '10px');
    expect(getComputedStyle(link).paddingInlineEnd).toBe('4px');
    expect(getComputedStyle(link).minHeight).toBe('24px');
    expect(getComputedStyle($('[part="group"]')!).paddingInlineStart).toBe('16px');
  });
});

describe('lifecycle', () => {
  it('keeps its nodes across reconnects and returns to its ownership baseline', async () => {
    const { el, $ } = await mount((el) => (el.items = ITEMS));
    const link = $('a');
    const baseline = scopeStats();
    for (let i = 0; i < 20; i++) {
      el.remove();
      container.append(el);
    }
    await settle(el);
    expect($('a')).toBe(link);
    el.remove();
    container.append(el);
    await settle(el);
    expect(scopeStats().listeners).toBe(baseline.listeners);
    expect(scopeStats().scopes).toBe(baseline.scopes);
  });

  it('returns to its ownership baseline after 1,000 mount, replace, and unmount cycles', async () => {
    const { el } = await mount((el) => (el.items = ITEMS));
    el.remove();
    flush();
    const baseline = scopeStats();
    for (let i = 0; i < 1000; i++) {
      container.append(el);
      el.items = i % 2 ? ITEMS : ITEMS.slice(1);
      await el.updateComplete;
      flush();
      el.remove();
      flush();
    }
    expect(scopeStats().listeners).toBe(baseline.listeners);
    expect(scopeStats().scopes).toBe(baseline.scopes);
  });
});
