import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { flushSync, mount, unmount } from 'svelte';
import { flush } from '@oddkin/core/reactive';
import { scopeStats } from '@oddkin/core/scope';
import type { NavigationActionDetail, NavigationToggleDetail } from '../src/side-nav/side-nav.js';
import '../src/side-nav/side-nav.define.js';
import { ITEMS, REORDERED, action, sideNav, toggle } from './framework-fixtures.js';
import SideNav from './fixtures/SideNav.svelte';

// odd-side-nav from Svelte 5 runes, with no Oddkin state library: data and controlled expansion
// go in as properties, intent comes out as events (data-composition.md §10). The component is
// compiled by the Svelte Vite plugin for tests only.

let container: HTMLElement;
let app: ReturnType<typeof mount> | undefined;
beforeEach(() => {
  container = document.createElement('div');
  document.body.append(container);
});
afterEach(() => {
  if (app) void unmount(app);
  app = undefined;
  container.remove();
  flush();
});

interface Exports {
  setItems(items: typeof ITEMS): void;
  setShown(shown: boolean): void;
}

function start(controlled = true) {
  const toggles: NavigationToggleDetail[] = [];
  const actions: NavigationActionDetail[] = [];
  app = mount(SideNav, {
    target: container,
    props: {
      initial: ITEMS,
      // Uncontrolled, a group holding `current` would start open.
      current: controlled ? 'theming' : '',
      controlled,
      onToggle: (detail: NavigationToggleDetail) => toggles.push(detail),
      onAction: (detail: NavigationActionDetail) => actions.push(detail),
    },
  });
  flushSync();
  return { exports: app as unknown as Exports, toggles, actions };
}

describe('odd-side-nav in Svelte without Oddkin state', () => {
  it('properties in, controlled expansion through odd-toggle, keyed updates', async () => {
    const { exports, toggles, actions } = start();
    let el = await sideNav(container);
    expect(el.items).toBe(ITEMS);
    expect(el.getAttribute('items')).toBeNull();
    expect(el.expanded).toEqual([]);
    expect(toggle(el).getAttribute('aria-expanded')).toBe('false');
    expect(el.shadowRoot!.querySelector('a[aria-current="page"]')!.textContent).toBe('Theming');

    toggle(el).click();
    flushSync();
    el = await sideNav(container);
    expect(toggles).toEqual([{ id: 'guides', expanded: true }]);
    expect(el.expanded).toEqual(['guides']);
    expect(toggle(el).getAttribute('aria-expanded')).toBe('true');

    action(el).click();
    expect(actions).toEqual([{ id: 'create', action: 'project.create' }]);

    const link = el.shadowRoot!.querySelector('a[href="#overview"]');
    exports.setItems(REORDERED);
    flushSync();
    el = await sideNav(container);
    expect(el.items).toBe(REORDERED);
    expect(el.shadowRoot!.querySelector('a[href="#overview"]')).toBe(link);
    expect(el.shadowRoot!.querySelector('.content > li')!.textContent).toContain('Create project');
    expect(toggles).toHaveLength(1);
  });

  it('re-creates the element under {#if} with fresh state, one listener each, and no leaks', async () => {
    const baseline = scopeStats();
    const { exports, toggles } = start(false);
    const el = await sideNav(container);
    toggle(el).click();
    await sideNav(container);
    expect(toggle(el).getAttribute('aria-expanded')).toBe('true');
    exports.setShown(false);
    flushSync();
    expect(container.querySelector('odd-side-nav')).toBeNull();
    exports.setShown(true);
    flushSync();
    const again = await sideNav(container);
    expect(again).not.toBe(el);
    // Uncontrolled expansion belonged to the old instance.
    expect(toggle(again).getAttribute('aria-expanded')).toBe('false');
    toggle(again).click();
    expect(toggles).toEqual([
      { id: 'guides', expanded: true },
      { id: 'guides', expanded: true },
    ]);
    void unmount(app!);
    app = undefined;
    flush();
    expect(scopeStats().scopes).toBe(baseline.scopes);
    expect(scopeStats().listeners).toBe(baseline.listeners);
  });
});
