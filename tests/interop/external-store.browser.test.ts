// External stores in both directions (core-contracts.md §5): React reads an Oddkin signal through
// `toExternal` and `useSyncExternalStore`; an Oddkin element renders an application store through
// `fromExternal`, subscribed only while connected.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createElement, useSyncExternalStore } from 'react';
import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import { OddkinElement, define } from '@oddkin/core/element';
import { flush, fromExternal, signal, toExternal } from '@oddkin/core/reactive';
import { scopeStats } from '@oddkin/core/scope';
import { html } from '@oddkin/core/template';

function createStore<T>(initial: T) {
  let state = initial;
  const listeners = new Set<() => void>();
  return {
    getSnapshot: () => state,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => void listeners.delete(listener);
    },
    set(next: T) {
      state = next;
      for (const listener of [...listeners]) listener();
    },
    get listeners() {
      return listeners.size;
    },
  };
}

interface Todos {
  readonly items: readonly string[];
}
const store = createStore<Todos>({ items: ['Write tests'] });
const todos = fromExternal(store);

class TodoCount extends OddkinElement {
  renders = 0;
  protected override render() {
    this.renders++;
    return html`<p>${todos.value.items.length} to do</p>`;
  }
}
define('external-todo-count', TodoCount);

let container: HTMLElement;
beforeEach(() => {
  container = document.createElement('div');
  document.body.append(container);
});
afterEach(() => {
  container.remove();
  flush();
});

const text = (el: Element) => el.shadowRoot!.textContent!.trim();

describe('external stores', () => {
  it('an Oddkin element renders an application store and lets go of it when disconnected', async () => {
    const before = scopeStats();
    const el = document.createElement('external-todo-count') as TodoCount;
    container.append(el);
    await el.updateComplete;
    expect(text(el)).toBe('1 to do');
    expect(store.listeners).toBe(1);

    store.set({ items: [...store.getSnapshot().items, 'Ship'] });
    await el.updateComplete;
    expect(text(el)).toBe('2 to do');
    const renders = el.renders;
    store.set(store.getSnapshot()); // same snapshot: no render
    await el.updateComplete;
    expect(el.renders).toBe(renders);

    el.remove();
    flush();
    expect(store.listeners).toBe(0);
    expect(scopeStats()).toEqual(before);

    // Reconnected, it reads the store's current state and subscribes again.
    store.set({ items: [] });
    container.append(el);
    await el.updateComplete;
    expect(text(el)).toBe('0 to do');
    expect(store.listeners).toBe(1);
    el.remove();
    flush();
    expect(store.listeners).toBe(0);
  });

  it('React reads an Oddkin signal through useSyncExternalStore, tear-free', () => {
    const count = signal(1);
    const external = toExternal(count);
    let active = 0;
    const source = {
      getSnapshot: external.getSnapshot,
      subscribe(listener: () => void) {
        active++;
        const off = external.subscribe(listener);
        return () => {
          active--;
          off();
        };
      },
    };
    let renders = 0;
    function Counter() {
      renders++;
      const value = useSyncExternalStore(source.subscribe, source.getSnapshot);
      return createElement('output', null, String(value));
    }
    const root = createRoot(container);
    flushSync(() => root.render(createElement(Counter)));
    const output = container.querySelector('output')!;
    expect(output.textContent).toBe('1');
    expect(active).toBe(1);
    flushSync(() => {
      count.value = 2;
    });
    expect(output.textContent).toBe('2');
    const before = renders;
    flushSync(() => {
      count.value = 2;
    });
    expect(renders).toBe(before);
    root.unmount();
    expect(active).toBe(0);
  });
});
