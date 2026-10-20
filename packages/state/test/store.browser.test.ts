// Stores in elements and frameworks (core-contracts.md §7): selectors bind directly in templates,
// render-tracked reads re-render only for the selected value, observation ends with the connection,
// and React reads a store through useSyncExternalStore.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createElement, useSyncExternalStore } from 'react';
import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import { OddkinElement, define } from '@oddkin/core/element';
import { flush } from '@oddkin/core/reactive';
import { scopeStats } from '@oddkin/core/scope';
import { html } from '@oddkin/core/template';
import { inspect } from '../src/inspect/index.js';
import { createStore } from '../src/store/index.js';

interface Cart {
  readonly items: readonly string[];
  readonly coupon: string;
  readonly note: string;
}
const cart = createStore<Cart>({ items: ['tea'], coupon: '', note: '' }, { name: 'cart' });
const count = cart.select((s) => s.items.length);
const coupon = cart.select((s) => s.coupon);

class CartSummary extends OddkinElement {
  renders = 0;
  protected override render() {
    this.renders++;
    // `count` is bound directly (updates only its text); `coupon.value` is read during render.
    return html`<p><output>${count}</output> items, coupon <b>${coupon.value || 'none'}</b></p>`;
  }
}
define('state-cart-summary', CartSummary);

let container: HTMLElement;
beforeEach(() => {
  container = document.createElement('div');
  document.body.append(container);
});
afterEach(() => {
  container.remove();
  flush();
});

const text = (el: Element, selector: string) =>
  el.shadowRoot!.querySelector(selector)!.textContent!.trim();

describe('stores in elements', () => {
  it('updates a direct binding without re-rendering, re-renders for a render-tracked selector', async () => {
    const baseline = scopeStats();
    const el = document.createElement('state-cart-summary') as CartSummary;
    container.append(el);
    await el.updateComplete;
    expect(text(el, 'output')).toBe('1');
    expect(text(el, 'b')).toBe('none');
    expect(el.renders).toBe(1);
    const output = el.shadowRoot!.querySelector('output')!;

    cart.update((s) => ({ ...s, items: [...s.items, 'milk'] }));
    await el.updateComplete;
    expect(text(el, 'output')).toBe('2');
    expect(el.renders).toBe(1);
    expect(el.shadowRoot!.querySelector('output')).toBe(output); // same node, text updated

    cart.update((s) => ({ ...s, note: 'leave at door' }));
    await el.updateComplete;
    expect(el.renders).toBe(1);

    cart.update((s) => ({ ...s, coupon: 'SAVE' }));
    await el.updateComplete;
    expect(text(el, 'b')).toBe('SAVE');
    expect(el.renders).toBe(2);

    el.remove();
    flush();
    expect(scopeStats()).toEqual(baseline);
    cart.update((s) => ({ ...s, coupon: 'LATER', items: [] }));
    flush();
    expect(el.renders).toBe(2); // no work while disconnected

    container.append(el);
    await el.updateComplete;
    expect(text(el, 'output')).toBe('0');
    expect(text(el, 'b')).toBe('LATER');
    el.remove();
    flush();
    expect(scopeStats()).toEqual(baseline);
    cart.reset();
  });

  it('React reads the store through useSyncExternalStore and releases it on unmount', () => {
    const store = createStore({ items: ['tea'] as readonly string[] });
    let renders = 0;
    function Count() {
      renders++;
      const state = useSyncExternalStore(store.subscribe, store.getSnapshot);
      return createElement('output', null, String(state.items.length));
    }
    const root = createRoot(container);
    flushSync(() => root.render(createElement(Count)));
    const output = container.querySelector('output')!;
    expect(output.textContent).toBe('1');
    expect(inspect(store).subscribers).toBe(1);
    flushSync(() => store.update((s) => ({ items: [...s.items, 'milk'] })));
    expect(output.textContent).toBe('2');
    const before = renders;
    flushSync(() => store.update((s) => s));
    expect(renders).toBe(before);
    root.unmount();
    expect(inspect(store).subscribers).toBe(0);
    store.dispose();
  });
});
