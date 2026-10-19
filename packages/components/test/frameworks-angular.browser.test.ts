import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import '@angular/compiler';
import {
  CUSTOM_ELEMENTS_SCHEMA,
  Component,
  provideZonelessChangeDetection,
  signal,
  type ApplicationRef,
} from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import { flush } from '@oddkin/core/reactive';
import { scopeStats } from '@oddkin/core/scope';
import type { NavigationItem } from '../src/models/navigation.js';
import type { NavigationActionDetail, NavigationToggleDetail } from '../src/side-nav/side-nav.js';
import '../src/side-nav/side-nav.define.js';
import { ITEMS, REORDERED, action, sideNav, toggle } from './framework-fixtures.js';

// odd-side-nav from Angular signals, with no Oddkin state library: data and controlled expansion
// go in as property bindings, intent comes out as events (data-composition.md §10). Angular runs
// in JIT mode with zoneless change detection; nothing Angular reaches a shipped bundle.

let container: HTMLElement;
let app: ApplicationRef | undefined;
beforeEach(() => {
  container = document.createElement('div');
  container.innerHTML = '<app-side-nav></app-side-nav>';
  document.body.append(container);
});
afterEach(() => {
  app?.destroy();
  app = undefined;
  container.remove();
  flush();
});

class Host {
  readonly items = signal<readonly NavigationItem[]>(ITEMS);
  readonly expanded = signal<readonly string[]>([]);
  readonly shown = signal(true);
  readonly toggles: NavigationToggleDetail[] = [];
  readonly actions: NavigationActionDetail[] = [];
  onToggle(event: CustomEvent<NavigationToggleDetail>) {
    this.toggles.push(event.detail);
    this.expanded.set(event.detail.expanded ? [event.detail.id] : []);
  }
  onAction(event: CustomEvent<NavigationActionDetail>) {
    this.actions.push(event.detail);
  }
}

const SideNavHost = Component({
  selector: 'app-side-nav',
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  template: `@if (shown()) {
    <odd-side-nav
      label="Primary"
      current="theming"
      [items]="items()"
      [expanded]="expanded()"
      (odd-toggle)="onToggle($event)"
      (odd-action)="onAction($event)"
    ></odd-side-nav>
  }`,
})(class extends Host {});

async function start() {
  app = await bootstrapApplication(SideNavHost, {
    providers: [provideZonelessChangeDetection()],
  });
  const host = app.components[0]!.instance as Host;
  const settle = async () => {
    await app!.whenStable();
    return sideNav(container);
  };
  return { host, settle };
}

describe('odd-side-nav in Angular without Oddkin state', () => {
  it('properties in, controlled expansion through odd-toggle, keyed updates', async () => {
    const { host, settle } = await start();
    let el = await settle();
    expect(el.items).toBe(ITEMS);
    expect(el.getAttribute('items')).toBeNull();
    expect(el.expanded).toEqual([]);
    // Controlled: the group holding `current` stays as the page says (closed).
    expect(toggle(el).getAttribute('aria-expanded')).toBe('false');
    expect(el.shadowRoot!.querySelector('a[aria-current="page"]')!.textContent).toBe('Theming');

    toggle(el).click();
    el = await settle();
    expect(host.toggles).toEqual([{ id: 'guides', expanded: true }]);
    expect(el.expanded).toEqual(['guides']);
    expect(toggle(el).getAttribute('aria-expanded')).toBe('true');

    action(el).click();
    expect(host.actions).toEqual([{ id: 'create', action: 'project.create' }]);

    const link = el.shadowRoot!.querySelector('a[href="#overview"]');
    host.items.set(REORDERED);
    el = await settle();
    expect(el.items).toBe(REORDERED);
    expect(el.shadowRoot!.querySelector('a[href="#overview"]')).toBe(link);
    expect(el.shadowRoot!.querySelector('.content > li')!.textContent).toContain('Create project');
    // Framework re-renders never echo intent events.
    expect(host.toggles).toHaveLength(1);
  });

  it('re-creates the element under @if with fresh state, one listener each, and no leaks', async () => {
    const baseline = scopeStats();
    const { host, settle } = await start();
    const el = await settle();
    action(el).click();
    expect(host.actions).toHaveLength(1);
    host.shown.set(false);
    await app!.whenStable();
    expect(container.querySelector('odd-side-nav')).toBeNull();
    host.shown.set(true);
    const again = await settle();
    expect(again).not.toBe(el);
    action(again).click();
    expect(host.actions).toHaveLength(2);
    app!.destroy();
    app = undefined;
    flush();
    expect(scopeStats().scopes).toBe(baseline.scopes);
    expect(scopeStats().listeners).toBe(baseline.listeners);
  });
});
