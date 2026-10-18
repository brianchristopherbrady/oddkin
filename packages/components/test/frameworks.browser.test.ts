import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createElement, useState } from 'react';
import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import { createApp, h, nextTick, shallowRef } from 'vue';
import { flush } from '@oddkin/core/reactive';
import type { NavigationItem } from '../src/models/navigation.js';
import type { NavigationActionDetail, NavigationToggleDetail } from '../src/side-nav/side-nav.js';
import '../src/side-nav/side-nav.define.js';

// odd-side-nav from framework state, with no Oddkin state library: data and controlled
// expansion go in as properties, intent comes out as events (data-composition.md §10).

let container: HTMLElement;
beforeEach(() => {
  container = document.createElement('div');
  document.body.append(container);
});
afterEach(() => {
  container.remove();
  flush();
});

const ITEMS: readonly NavigationItem[] = [
  { id: 'overview', kind: 'link', label: 'Overview', href: '#overview' },
  {
    id: 'guides',
    kind: 'group',
    label: 'Guides',
    items: [{ id: 'theming', kind: 'link', label: 'Theming', href: '#theming' }],
  },
  { id: 'create', kind: 'action', label: 'Create project', action: 'project.create' },
];
const REORDERED: readonly NavigationItem[] = [ITEMS[2]!, ITEMS[0]!, ITEMS[1]!];

const frames = (n = 2) =>
  new Promise<void>((resolve) => {
    const step = (left: number) => (left ? requestAnimationFrame(() => step(left - 1)) : resolve());
    step(n);
  });
async function sideNav() {
  await frames();
  flush();
  const el = container.querySelector('odd-side-nav')!;
  await el.updateComplete;
  flush();
  return el;
}
const toggle = (el: Element) =>
  el.shadowRoot!.querySelector<HTMLButtonElement>('[part="group-toggle"]')!;

describe('odd-side-nav in frameworks without Oddkin state', () => {
  it('React 19: properties in, controlled expansion through odd-toggle, keyed updates', async () => {
    const toggles: NavigationToggleDetail[] = [];
    const actions: NavigationActionDetail[] = [];
    let setItems!: (items: readonly NavigationItem[]) => void;
    function App() {
      const [items, set] = useState(ITEMS);
      const [expanded, setExpanded] = useState<readonly string[]>([]);
      setItems = set;
      return createElement('odd-side-nav', {
        label: 'Primary',
        items,
        current: 'overview',
        expanded,
        'onodd-toggle': (e: CustomEvent<NavigationToggleDetail>) => {
          toggles.push(e.detail);
          setExpanded(e.detail.expanded ? [e.detail.id] : []);
        },
        'onodd-action': (e: CustomEvent<NavigationActionDetail>) => actions.push(e.detail),
      });
    }
    const root = createRoot(container);
    flushSync(() => root.render(createElement(App)));
    let el = await sideNav();
    expect(el.items).toBe(ITEMS);
    expect(el.getAttribute('items')).toBeNull();
    expect(el.expanded).toEqual([]);
    expect(toggle(el).getAttribute('aria-expanded')).toBe('false');

    toggle(el).click();
    el = await sideNav();
    expect(toggles).toEqual([{ id: 'guides', expanded: true }]);
    expect(el.expanded).toEqual(['guides']);
    expect(toggle(el).getAttribute('aria-expanded')).toBe('true');

    el.shadowRoot!.querySelector<HTMLButtonElement>('[part="action"]')!.click();
    expect(actions).toEqual([{ id: 'create', action: 'project.create' }]);

    const link = el.shadowRoot!.querySelector('a[href="#overview"]');
    flushSync(() => setItems(REORDERED));
    el = await sideNav();
    expect(el.shadowRoot!.querySelector('a[href="#overview"]')).toBe(link);
    expect(el.shadowRoot!.querySelector('.content > li')!.textContent).toContain('Create project');
    // Framework re-renders never echo intent events.
    expect(toggles).toHaveLength(1);
    root.unmount();
  });

  it('Vue 3: properties in, controlled expansion through odd-toggle, keyed updates', async () => {
    const toggles: NavigationToggleDetail[] = [];
    const actions: NavigationActionDetail[] = [];
    // shallowRef passes the arrays themselves; a deep ref would pass reactive proxies.
    const items = shallowRef<readonly NavigationItem[]>(ITEMS);
    const expanded = shallowRef<readonly string[]>([]);
    const app = createApp({
      setup: () => () =>
        h('odd-side-nav', {
          label: 'Primary',
          items: items.value,
          current: 'theming',
          expanded: expanded.value,
          onOddToggle: (e: CustomEvent<NavigationToggleDetail>) => {
            toggles.push(e.detail);
            expanded.value = e.detail.expanded ? [e.detail.id] : [];
          },
          onOddAction: (e: CustomEvent<NavigationActionDetail>) => actions.push(e.detail),
        }),
    });
    app.config.compilerOptions.isCustomElement = (tag) => tag.startsWith('odd-');
    app.mount(container);
    let el = await sideNav();
    expect(el.items).toBe(ITEMS);
    expect(el.getAttribute('items')).toBeNull();
    // Controlled: the group holding `current` stays as the page says (closed).
    expect(toggle(el).getAttribute('aria-expanded')).toBe('false');
    expect(el.shadowRoot!.querySelector('a[aria-current="page"]')!.textContent).toBe('Theming');

    toggle(el).click();
    await nextTick();
    el = await sideNav();
    expect(toggles).toEqual([{ id: 'guides', expanded: true }]);
    expect(toggle(el).getAttribute('aria-expanded')).toBe('true');

    el.shadowRoot!.querySelector<HTMLButtonElement>('[part="action"]')!.click();
    expect(actions).toEqual([{ id: 'create', action: 'project.create' }]);

    const link = el.shadowRoot!.querySelector('a[href="#overview"]');
    items.value = REORDERED;
    await nextTick();
    el = await sideNav();
    expect(el.shadowRoot!.querySelector('a[href="#overview"]')).toBe(link);
    expect(toggles).toHaveLength(1);
    app.unmount();
  });
});
