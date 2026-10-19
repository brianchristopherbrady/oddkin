import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import '@angular/compiler';
import {
  CUSTOM_ELEMENTS_SCHEMA,
  Component,
  provideZonelessChangeDetection,
  type ApplicationRef,
} from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import { createElement, useState } from 'react';
import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import { flushSync as flushSvelte, mount, unmount } from 'svelte';
import { createApp, h, nextTick, shallowRef } from 'vue';
import { setErrorHandler } from '@oddkin/core/diagnostics';
import { compose, define, type ElementDefinition } from '@oddkin/core/element';
import { flush } from '@oddkin/core/reactive';
import type { NavigationItem } from '../src/models/navigation.js';
import { sideNavDefinition } from '../src/side-nav/index.js';
import type { NavigationActionDetail, OddkinSideNav } from '../src/side-nav/side-nav.js';
import LateSideNav from './fixtures/LateSideNav.svelte';
import { ITEMS, action } from './framework-fixtures.js';

// The framework renders first; the definition loads later (a lazily loaded component). Each case
// uses its own tag, registered only after the framework has rendered.

let container: HTMLElement;
let reported: string[];
const cleanup: (() => void)[] = [];
beforeEach(() => {
  container = document.createElement('div');
  document.body.append(container);
  reported = [];
  setErrorHandler((_error, context) => reported.push(context.code));
});
afterEach(() => {
  for (const dispose of cleanup.splice(0).reverse()) dispose();
  container.remove();
  flush();
  setErrorHandler(undefined);
});

async function defineLate(tag: string): Promise<OddkinSideNav> {
  const el = container.querySelector(tag) as OddkinSideNav;
  expect(customElements.get(tag)).toBeUndefined();
  const definition = sideNavDefinition as unknown as ElementDefinition;
  define(compose({ ...definition, name: tag, element: class extends definition.element {} }));
  await el.updateComplete;
  flush();
  return el;
}

/** The element upgraded with the framework's data and wired its events. */
function expectWorking(el: OddkinSideNav, actions: NavigationActionDetail[]) {
  expect(el.items).toBe(ITEMS);
  expect(el.getAttribute('items')).toBeNull();
  expect(el.shadowRoot!.querySelectorAll('a')).toHaveLength(2);
  action(el).click();
  expect(actions).toEqual([{ id: 'create', action: 'project.create' }]);
}

describe('defined after the framework renders: property bindings', () => {
  it('Angular [items] sets the property before upgrade', async () => {
    const actions: NavigationActionDetail[] = [];
    const Host = Component({
      selector: 'app-late',
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
      template: `<late-angular-nav label="Primary" [items]="items" (odd-action)="actions.push($event.detail)"></late-angular-nav>`,
    })(
      class {
        readonly items = ITEMS;
        readonly actions = actions;
      },
    );
    container.innerHTML = '<app-late></app-late>';
    const app: ApplicationRef = await bootstrapApplication(Host, {
      providers: [provideZonelessChangeDetection()],
    });
    cleanup.push(() => app.destroy());
    await app.whenStable();
    expectWorking(await defineLate('late-angular-nav'), actions);
    expect(reported).toEqual([]);
  });

  it('Svelte sets object values as properties on an undefined element', async () => {
    const actions: NavigationActionDetail[] = [];
    const app = mount(LateSideNav, {
      target: container,
      props: { items: ITEMS, onAction: (detail: NavigationActionDetail) => actions.push(detail) },
    });
    cleanup.push(() => void unmount(app));
    flushSvelte();
    expectWorking(await defineLate('late-svelte-nav'), actions);
    expect(reported).toEqual([]);
  });

  it('Vue with the .prop modifier (.items) sets the property before upgrade', async () => {
    const actions: NavigationActionDetail[] = [];
    const app = createApp({
      setup: () => () =>
        h('late-vue-prop-nav', {
          label: 'Primary',
          '.items': ITEMS,
          onOddAction: (e: CustomEvent<NavigationActionDetail>) => actions.push(e.detail),
        }),
    });
    app.mount(container);
    cleanup.push(() => app.unmount());
    expectWorking(await defineLate('late-vue-prop-nav'), actions);
    expect(reported).toEqual([]);
  });
});

describe('defined after the framework renders: attribute fallback', () => {
  // React 19 and Vue decide property or attribute when they render, by `name in element`; an
  // undefined element has no `items` accessor, so they write `items="[object Object],…"`.
  it('React 19: reported at upgrade, recovered by the next render', async () => {
    let setItems!: (items: readonly NavigationItem[]) => void;
    function App() {
      const [items, set] = useState(ITEMS);
      setItems = set;
      return createElement('late-react-nav', { label: 'Primary', items });
    }
    const root = createRoot(container);
    cleanup.push(() => root.unmount());
    flushSync(() => root.render(createElement(App)));
    const el = await defineLate('late-react-nav');
    expect(el.getAttribute('items')).toBe('[object Object],[object Object],[object Object]');
    // Unset: the attribute is ignored, and slotted entries (none here) would render instead.
    expect([el.items, reported]).toEqual([undefined, ['element.attribute.propertyOnly']]);
    const next = [...ITEMS];
    flushSync(() => setItems(next));
    await el.updateComplete;
    flush();
    expect(el.items).toBe(next);
    expect(el.shadowRoot!.querySelectorAll('a')).toHaveLength(2);
  });

  it('Vue without .prop: reported at upgrade, recovered by the next render', async () => {
    const items = shallowRef<readonly NavigationItem[]>(ITEMS);
    const app = createApp({
      setup: () => () => h('late-vue-nav', { label: 'Primary', items: items.value }),
    });
    app.mount(container);
    cleanup.push(() => app.unmount());
    const el = await defineLate('late-vue-nav');
    expect([el.items, reported]).toEqual([undefined, ['element.attribute.propertyOnly']]);
    items.value = [...ITEMS];
    await nextTick();
    await el.updateComplete;
    flush();
    expect(el.items).toBe(items.value);
    expect(el.shadowRoot!.querySelectorAll('a')).toHaveLength(2);
  });
});
