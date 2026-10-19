import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setErrorHandler, type ErrorContext } from '../src/diagnostics/index.js';
import { observerCount } from '../src/reactive/graph.js';
import {
  batch,
  computed,
  effect,
  flush,
  fromExternal,
  signal,
  toExternal,
  type ExternalSource,
} from '../src/reactive/index.js';
import { Scope, scopeStats } from '../src/scope/index.js';

// External stores (core-contracts.md §5): `fromExternal` reads a store through the shared
// `ExternalSource` contract, subscribed only while observed; `toExternal` exposes a readable.

/** A minimal store in the shape Redux, Zustand, and React's `useSyncExternalStore` share. */
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

let reported: ErrorContext[];
beforeEach(() => {
  reported = [];
  setErrorHandler((_error, context) => reported.push(context));
});
afterEach(() => {
  flush();
  setErrorHandler(undefined);
});

describe('fromExternal', () => {
  it('reads a fresh snapshot while unobserved, without subscribing', () => {
    const store = createStore({ count: 1 });
    const count = fromExternal(store);
    const doubled = computed(() => count.value.count * 2);
    expect(count.value).toEqual({ count: 1 });
    expect(doubled.value).toBe(2);
    store.set({ count: 5 });
    expect(count.peek()).toEqual({ count: 5 });
    expect(doubled.value).toBe(10);
    expect(store.listeners).toBe(0);
  });

  it('subscribes on the first observer, shares one subscription, and unsubscribes on the last', () => {
    const store = createStore(1);
    const value = fromExternal(store);
    const runs: number[] = [];
    const stop = effect(() => void runs.push(value.value));
    expect(store.listeners).toBe(1);
    const seen: number[] = [];
    const off = value.subscribe((v) => seen.push(v));
    const doubled = computed(() => value.value * 2);
    const stopDoubled = effect(() => void doubled.value);
    expect(store.listeners).toBe(1);
    expect(observerCount(value)).toBe(3);

    store.set(2);
    expect(seen).toEqual([2]);
    flush();
    expect(runs).toEqual([1, 2]);
    expect(doubled.peek()).toBe(4);

    stop();
    off();
    expect(store.listeners).toBe(1);
    stopDoubled();
    expect(store.listeners).toBe(0);
    expect(observerCount(value)).toBe(0);
    // Unobserved again: reads still follow the store.
    store.set(3);
    expect(value.value).toBe(3);
  });

  it('notifies only for a different snapshot, by Object.is or a custom equality', () => {
    const store = createStore({ id: 'a', n: 1 });
    const same = fromExternal(store);
    const byId = fromExternal(store, { equals: (a, b) => a.id === b.id });
    const a: unknown[] = [];
    const b: unknown[] = [];
    const offA = same.subscribe((v) => a.push(v));
    const offB = byId.subscribe((v) => b.push(v));
    store.set(store.getSnapshot()); // the same object: no change
    store.set({ id: 'a', n: 2 }); // a new object with the same id
    store.set({ id: 'b', n: 2 });
    expect(a).toHaveLength(2);
    expect(b).toEqual([{ id: 'b', n: 2 }]);
    offA();
    offB();
  });

  it('coalesces store changes inside a batch into one notification', () => {
    const store = createStore(0);
    const value = fromExternal(store);
    const seen: number[] = [];
    const off = value.subscribe((v) => seen.push(v));
    batch(() => {
      store.set(1);
      store.set(2);
    });
    expect(seen).toEqual([2]);
    off();
  });

  it('does not miss a change made between the last read and the first subscription', () => {
    const store = createStore('before');
    const value = fromExternal(store);
    expect(value.peek()).toBe('before');
    const inner = store.subscribe;
    const racing = {
      getSnapshot: store.getSnapshot,
      subscribe(listener: () => void) {
        store.set('during');
        return inner.call(store, listener);
      },
    } satisfies ExternalSource<string>;
    const raced = fromExternal(racing);
    const runs: string[] = [];
    const stop = effect(() => void runs.push(raced.value));
    flush();
    expect(runs.at(-1)).toBe('during');
    stop();
  });

  it('follows the owning scope: disposing the scope that runs the effect unsubscribes', () => {
    const store = createStore(1);
    const value = fromExternal(store);
    const before = scopeStats();
    const scope = new Scope({ name: 'consumer' });
    const runs: number[] = [];
    scope.effect(() => void runs.push(value.value));
    expect(store.listeners).toBe(1);
    store.set(2);
    flush();
    expect(runs).toEqual([1, 2]);
    scope.dispose();
    expect(store.listeners).toBe(0);
    expect(scopeStats()).toEqual(before);
    store.set(3);
    flush();
    expect(runs).toEqual([1, 2]);
    expect(reported).toEqual([]);
  });
});

describe('toExternal', () => {
  it('exposes a readable through the same contract, and round-trips through fromExternal', () => {
    const count = signal(1);
    const source = toExternal(count);
    const calls = vi.fn();
    const off = source.subscribe(calls);
    expect(source.getSnapshot()).toBe(1);
    count.value = 2;
    expect(calls).toHaveBeenCalledTimes(1);
    expect(calls.mock.calls[0]).toEqual([]);
    expect(source.getSnapshot()).toBe(2);
    off();
    count.value = 3;
    expect(calls).toHaveBeenCalledTimes(1);

    const back = fromExternal(toExternal(count));
    const runs: number[] = [];
    const stop = effect(() => void runs.push(back.value));
    count.value = 4;
    flush();
    expect(runs).toEqual([3, 4]);
    stop();
    expect(observerCount(count)).toBe(0);
  });
});
