import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setErrorHandler, type ErrorContext } from '@oddkin/core/diagnostics';
import {
  batch,
  computed,
  effect,
  flush,
  fromExternal,
  signal,
  type ExternalSource,
} from '@oddkin/core/reactive';
import { Scope, scopeStats } from '@oddkin/core/scope';
import { action, createStore, shallowEqual } from '../src/store/index.js';
import { inspect, storeStats } from '../src/inspect/index.js';

// Stores (core-contracts.md §7): one immutable snapshot in a core signal; `state` and `select()`
// are ordinary readables; `subscribe`/`getSnapshot` are the shared external-store contract.

interface Item {
  readonly id: string;
  readonly price: number;
}
interface Cart {
  readonly items: readonly Item[];
  readonly coupon: string;
}
const cart = (): Cart => ({ items: [{ id: 'a', price: 3 }], coupon: '' });

let reported: { error: unknown; context: ErrorContext }[];
beforeEach(() => {
  reported = [];
  setErrorHandler((error, context) => reported.push({ error, context }));
});
afterEach(() => {
  flush();
  setErrorHandler(undefined);
});

describe('createStore', () => {
  it('holds one snapshot, read through state, getSnapshot, and peek; identical until it changes', () => {
    const initial = cart();
    const store = createStore(initial);
    const { getSnapshot } = store; // bound: usable detached, as external-store hooks call it
    expect(store.state.value).toBe(initial);
    expect(store.state.peek()).toBe(initial);
    expect(getSnapshot()).toBe(initial);
    expect(getSnapshot()).toBe(getSnapshot());
    store.update((s) => ({ ...s, coupon: 'SAVE' }));
    expect(getSnapshot()).not.toBe(initial);
    expect(getSnapshot()).toEqual({ ...initial, coupon: 'SAVE' });
    expect(store.state.value).toBe(getSnapshot());
  });

  it('notifies subscribers with the new snapshot; returning the same snapshot is no change', () => {
    const store = createStore(cart());
    const { subscribe } = store;
    const seen: Cart[] = [];
    const off = subscribe((state) => seen.push(state));
    store.update((s) => s);
    expect(seen).toEqual([]);
    store.update((s) => ({ ...s, coupon: 'X' }));
    expect(seen).toEqual([store.getSnapshot()]);
    off();
    off();
    store.update((s) => ({ ...s, coupon: 'Y' }));
    expect(seen).toHaveLength(1);
  });

  it('is an ExternalSource: fromExternal and useSyncExternalStore-style consumers read it', () => {
    const store = createStore({ n: 1 });
    const source: ExternalSource<{ n: number }> = store;
    const calls = vi.fn();
    const off = source.subscribe(calls);
    const value = fromExternal(source);
    const runs: number[] = [];
    const stop = effect(() => void runs.push(value.value.n));
    store.update(() => ({ n: 2 }));
    flush();
    expect(calls).toHaveBeenCalledTimes(1);
    expect(runs).toEqual([1, 2]);
    expect(source.getSnapshot()).toBe(store.getSnapshot());
    off();
    stop();
    expect(store.disposed).toBe(false);
  });

  it('exposes state as a read-only readable', () => {
    const store = createStore({ n: 1 });
    expect(() => {
      (store.state as { value: unknown }).value = { n: 2 };
    }).toThrow(TypeError);
    expect(store.getSnapshot()).toEqual({ n: 1 });
  });
});

describe('select', () => {
  it('notifies only when the selected value changes', () => {
    const store = createStore(cart());
    let evaluations = 0;
    const count = store.select((s) => {
      evaluations++;
      return s.items.length;
    });
    const seen: number[] = [];
    const off = count.subscribe((n) => seen.push(n));
    store.update((s) => ({ ...s, coupon: 'A' }));
    store.update((s) => ({ ...s, coupon: 'B' }));
    expect(seen).toEqual([]);
    store.update((s) => ({ ...s, items: [...s.items, { id: 'b', price: 5 }] }));
    expect(seen).toEqual([2]);
    expect(count.value).toBe(2);
    expect(evaluations).toBe(4); // first read + three changes, never twice for one snapshot
    off();
  });

  it('uses custom equality; shallowEqual suits selections built from several fields', () => {
    const store = createStore({ a: 1, b: 2, c: 3 });
    const pair = store.select((s) => ({ a: s.a, b: s.b }), { equals: shallowEqual });
    const naive = store.select((s) => ({ a: s.a, b: s.b }));
    const seenPair: unknown[] = [];
    const seenNaive: unknown[] = [];
    const offPair = pair.subscribe((v) => seenPair.push(v));
    const offNaive = naive.subscribe((v) => seenNaive.push(v));
    store.update((s) => ({ ...s, c: 4 }));
    expect(seenPair).toEqual([]);
    expect(seenNaive).toEqual([{ a: 1, b: 2 }]);
    store.update((s) => ({ ...s, a: 9 }));
    expect(seenPair).toEqual([{ a: 9, b: 2 }]);
    offPair();
    offNaive();
  });

  it('is lazy and memoized, and follows the store only while observed', () => {
    const store = createStore({ n: 1 });
    let evaluations = 0;
    const doubled = store.select((s) => {
      evaluations++;
      return s.n * 2;
    });
    expect(evaluations).toBe(0);
    expect(doubled.value).toBe(2);
    expect(doubled.value).toBe(2);
    expect(evaluations).toBe(1);
    store.update(() => ({ n: 2 }));
    store.update(() => ({ n: 3 }));
    expect(evaluations).toBe(1); // unobserved: nothing recomputes until read
    const runs: number[] = [];
    const stop = effect(() => void runs.push(doubled.value));
    store.update(() => ({ n: 4 }));
    flush();
    expect(runs).toEqual([6, 8]);
    const before = evaluations;
    stop();
    store.update(() => ({ n: 5 }));
    store.update(() => ({ n: 6 }));
    flush();
    expect(evaluations).toBe(before); // no observer: the store no longer drives it
    expect(doubled.value).toBe(12);
  });

  it('combines store state with other signals in one glitch-free graph', () => {
    const store = createStore(cart());
    const max = signal(4);
    const affordable = store.select((s) => s.items.filter((item) => item.price <= max.value));
    const ids = store.select((s) => s.items.map((item) => item.id).join());
    let runs = 0;
    const summary = computed(() => {
      runs++;
      return `${ids.value}:${affordable.value.length}`;
    });
    const seen: string[] = [];
    const off = summary.subscribe((v) => seen.push(v));
    expect(summary.value).toBe('a:1');
    const before = runs;
    store.update((s) => ({ ...s, items: [...s.items, { id: 'b', price: 5 }] }));
    expect(runs - before).toBe(1); // both selectors changed, the dependent ran once
    expect(seen).toEqual(['a,b:1']);
    max.value = 10;
    expect(seen).toEqual(['a,b:1', 'a,b:2']);
    off();
  });

  it('reports a throwing selector to its subscribers without breaking the store', () => {
    const store = createStore({ n: 1 });
    const fragile = store.select((s) => {
      if (s.n > 1) throw new Error('too big');
      return s.n;
    });
    const other: number[] = [];
    const offFragile = fragile.subscribe(() => {});
    const offOther = store.subscribe((s) => other.push(s.n));
    store.update(() => ({ n: 2 }));
    expect(store.getSnapshot()).toEqual({ n: 2 });
    expect(other).toEqual([2]);
    expect(reported.map((r) => r.context.code)).toEqual(['reactive.subscribe.sourceError']);
    expect(() => fragile.value).toThrow('too big');
    store.update(() => ({ n: 1 }));
    expect(fragile.value).toBe(1);
    offFragile();
    offOther();
  });
});

describe('batching and actions', () => {
  it('batch() and action() notify once, at the outermost boundary, with the latest snapshot', () => {
    const store = createStore({ n: 0 });
    const seen: number[] = [];
    const off = store.subscribe((s) => seen.push(s.n));
    batch(() => {
      store.update((s) => ({ n: s.n + 1 }));
      store.update((s) => ({ n: s.n + 1 }));
    });
    expect(seen).toEqual([2]);
    const inner = action('inner', () => store.update((s) => ({ n: s.n + 10 })));
    const outer = action('outer', (by: number) => {
      store.update((s) => ({ n: s.n + by }));
      inner();
      expect(seen).toEqual([2]); // nothing yet: still inside the outer action
      return 'done';
    });
    expect(outer(5)).toBe('done');
    expect(seen).toEqual([2, 17]);
    off();
  });

  it('keeps updates made before an action throws: batching is not rollback', () => {
    const store = createStore({ n: 0 });
    const seen: number[] = [];
    const off = store.subscribe((s) => seen.push(s.n));
    const failing = action('failing', () => {
      store.update(() => ({ n: 1 }));
      store.update(() => ({ n: 2 }));
      throw new Error('halfway');
    });
    expect(failing).toThrow('halfway');
    expect(store.getSnapshot()).toEqual({ n: 2 });
    expect(seen).toEqual([2]);
    off();
  });
});

describe('updates', () => {
  it('an updater that throws leaves the snapshot unchanged', () => {
    const store = createStore({ n: 1 });
    const seen = vi.fn();
    const off = store.subscribe(seen);
    expect(() =>
      store.update(() => {
        throw new Error('bad input');
      }),
    ).toThrow('bad input');
    expect(store.getSnapshot()).toEqual({ n: 1 });
    expect(seen).not.toHaveBeenCalled();
    store.update(() => ({ n: 2 })); // still usable
    expect(seen).toHaveBeenCalledTimes(1);
    off();
  });

  it('rejects updating a store from inside its own updater; other stores may be updated', () => {
    const store = createStore({ n: 1 });
    const log = createStore<string[]>([]);
    expect(() =>
      store.update((s) => {
        store.update(() => ({ n: 100 }));
        return { n: s.n + 1 };
      }),
    ).toThrow(expect.objectContaining({ code: 'state.update.reentrant' }));
    expect(() =>
      store.update((s) => {
        store.reset();
        return s;
      }),
    ).toThrow(expect.objectContaining({ code: 'state.update.reentrant' }));
    expect(store.getSnapshot()).toEqual({ n: 1 });
    store.update((s) => {
      log.update((entries) => [...entries, 'incremented']);
      return { n: s.n + 1 };
    });
    expect(store.getSnapshot()).toEqual({ n: 2 });
    expect(log.getSnapshot()).toEqual(['incremented']);
  });

  it('runs updaters untracked, so an effect that updates does not depend on what the updater read', () => {
    const store = createStore({ total: 0 });
    const price = signal(3);
    const trigger = signal(0);
    let runs = 0;
    const stop = effect(() => {
      runs++;
      void trigger.value;
      store.update(() => ({ total: price.value }));
    });
    expect(store.getSnapshot()).toEqual({ total: 3 });
    price.value = 4;
    flush();
    expect(runs).toBe(1);
    trigger.value = 1;
    flush();
    expect(runs).toBe(2);
    expect(store.getSnapshot()).toEqual({ total: 4 });
    stop();
  });

  it('lets subscribers update the store; every subscriber ends with the latest snapshot', () => {
    const store = createStore({ n: 0 });
    const first: number[] = [];
    const second: number[] = [];
    const offFirst = store.subscribe((s) => {
      first.push(s.n);
      if (s.n === 1) store.update(() => ({ n: 2 }));
    });
    const offSecond = store.subscribe((s) => second.push(s.n));
    store.update(() => ({ n: 1 }));
    expect(first).toEqual([1, 2]);
    expect(second).toEqual([2]); // never an older snapshot after a newer one
    expect(store.getSnapshot()).toEqual({ n: 2 });
    offFirst();
    offSecond();
  });

  it('stops a subscriber that keeps updating at the runaway guard', () => {
    const store = createStore({ n: 0 });
    const off = store.subscribe((s) => store.update(() => ({ n: s.n + 1 })));
    store.update(() => ({ n: 1 }));
    expect(reported.map((r) => r.context.code)).toEqual(['reactive.flush.runaway']);
    off();
    const n = store.getSnapshot().n;
    store.update(() => ({ n: -1 }));
    expect(store.getSnapshot().n).toBe(-1);
    expect(n).toBeGreaterThan(1);
  });

  it('cannot be updated from inside a computed value', () => {
    const store = createStore({ n: 1 });
    const impure = computed(() => {
      store.update(() => ({ n: 2 }));
      return 0;
    });
    expect(() => impure.value).toThrow(
      expect.objectContaining({ code: 'reactive.write.inComputed' }),
    );
    expect(store.getSnapshot()).toEqual({ n: 1 });
  });
});

describe('frozen snapshots', () => {
  it('freezes plain objects and arrays at every depth, so a mutation throws', () => {
    const dictionary = Object.assign(Object.create(null) as Record<string, number[]>, {
      list: [1, 2],
    });
    const store = createStore({ nested: { deep: { values: [{ x: 1 }] } }, dictionary });
    const state = store.getSnapshot();
    for (const value of [
      state,
      state.nested,
      state.nested.deep,
      state.nested.deep.values,
      state.nested.deep.values[0],
      state.dictionary,
      state.dictionary['list'],
    ])
      expect(Object.isFrozen(value)).toBe(true);
    expect(() => {
      (state.nested.deep.values as { x: number }[]).push({ x: 2 });
    }).toThrow(TypeError);
    expect(() => {
      (state.nested.deep.values[0] as { x: number }).x = 5;
    }).toThrow(TypeError);
    store.update((s) => ({ ...s, nested: { deep: { values: [] } } }));
    expect(Object.isFrozen(store.getSnapshot().nested.deep.values)).toBe(true);
  });

  it('leaves class instances, maps, sets, and dates alone', () => {
    class Counter {
      count = 0;
      readonly inner = { plain: true };
    }
    const value = {
      counter: new Counter(),
      map: new Map([['a', { x: 1 }]]),
      set: new Set([1]),
      date: new Date(0),
    };
    const store = createStore(value);
    expect(Object.isFrozen(store.getSnapshot())).toBe(true);
    for (const object of [value.counter, value.counter.inner, value.map, value.set, value.date])
      expect(Object.isFrozen(object)).toBe(false);
    value.counter.count++;
    value.map.set('b', { x: 2 });
    expect(value.map.size).toBe(2); // replace maps and sets instead: identity decides change
  });

  it('freezes only the new parts of a snapshot', () => {
    const items = Array.from({ length: 1000 }, (_, i) => ({ id: i, done: false }));
    const store = createStore({ items });
    const freeze = vi.spyOn(Object, 'freeze');
    try {
      store.update((s) => ({
        items: s.items.map((item) => (item.id === 500 ? { ...item, done: true } : item)),
      }));
      expect(freeze).toHaveBeenCalledTimes(3); // snapshot, array, changed item
    } finally {
      freeze.mockRestore();
    }
  });

  it('handles cycles and very deep nesting, and runs no getters', () => {
    type Node = { next?: Node; value: number };
    let deep: Node = { value: 0 };
    for (let i = 1; i < 100_000; i++) deep = { next: deep, value: i };
    const cyclic: { self?: unknown; list: unknown[] } = { list: [] };
    cyclic.self = cyclic;
    cyclic.list.push(cyclic);
    const getter = vi.fn(() => 1);
    const withGetter = Object.defineProperty({}, 'computed', { enumerable: true, get: getter });
    const store = createStore({ deep, cyclic, withGetter });
    expect(Object.isFrozen(store.getSnapshot().deep.next?.next)).toBe(true);
    expect(Object.isFrozen(cyclic.list)).toBe(true);
    expect(getter).not.toHaveBeenCalled();
  });

  it('freeze: false leaves snapshots mutable and changes nothing else', () => {
    const store = createStore({ items: [1] }, { freeze: false });
    const seen = vi.fn();
    const off = store.subscribe(seen);
    expect(Object.isFrozen(store.getSnapshot())).toBe(false);
    store.update((s) => ({ items: [...s.items, 2] }));
    expect(Object.isFrozen(store.getSnapshot().items)).toBe(false);
    expect(seen).toHaveBeenCalledTimes(1);
    off();
  });
});

describe('reset and dispose', () => {
  it('reset returns to the initial snapshot and notifies once; already initial is no change', () => {
    const initial = { n: 0 };
    const store = createStore(initial, { name: 'counter' });
    const seen: unknown[] = [];
    const off = store.subscribe((s) => seen.push(s));
    store.reset();
    expect(seen).toEqual([]);
    store.update(() => ({ n: 1 }));
    store.update(() => ({ n: 2 }));
    store.reset();
    expect(store.getSnapshot()).toBe(initial);
    expect(Object.isFrozen(initial)).toBe(true);
    expect(seen.at(-1)).toBe(initial);
    expect(seen).toHaveLength(3);
    off();
  });

  it('dispose releases subscribers, keeps the last snapshot readable, and rejects updates', () => {
    const baseline = storeStats();
    const store = createStore({ n: 1 }, { name: 'session' });
    const doubled = store.select((s) => s.n * 2);
    const seen = vi.fn();
    store.subscribe(seen);
    store.subscribe(seen);
    expect(storeStats()).toEqual({
      stores: baseline.stores + 1,
      subscriptions: baseline.subscriptions + 2,
    });
    store.dispose();
    store.dispose();
    expect(store.disposed).toBe(true);
    expect(storeStats()).toEqual(baseline);
    expect(store.getSnapshot()).toEqual({ n: 1 });
    expect(store.state.value).toEqual({ n: 1 });
    expect(doubled.value).toBe(2);
    expect(() => store.update(() => ({ n: 2 }))).toThrow(
      expect.objectContaining({
        code: 'state.store.disposed',
        message: expect.stringContaining('store "session"'),
      }),
    );
    expect(() => store.reset()).toThrow(expect.objectContaining({ code: 'state.store.disposed' }));
    const late = vi.fn();
    const off = store.subscribe(late);
    off();
    expect(storeStats()).toEqual(baseline);
    expect(seen).not.toHaveBeenCalled();
    expect(late).not.toHaveBeenCalled();
  });
});

describe('Scope ownership', () => {
  it('effects and subscriptions owned by a scope end with it', () => {
    const baseline = scopeStats();
    const store = createStore({ n: 1, other: 0 });
    const n = store.select((s) => s.n);
    const scope = new Scope({ name: 'feature' });
    const runs: number[] = [];
    scope.effect(() => void runs.push(n.value));
    const seen = vi.fn();
    scope.add(store.subscribe(seen));
    store.update((s) => ({ ...s, other: 1 }));
    flush();
    expect(runs).toEqual([1]);
    store.update((s) => ({ ...s, n: 2 }));
    flush();
    expect(runs).toEqual([1, 2]);
    expect(inspect(store).subscribers).toBe(1);
    scope.dispose();
    expect(inspect(store).subscribers).toBe(0);
    expect(scopeStats()).toEqual(baseline);
    store.update((s) => ({ ...s, n: 3 }));
    flush();
    expect(runs).toEqual([1, 2]);
    expect(seen).toHaveBeenCalledTimes(2);
    store.dispose();
  });
});

describe('inspect', () => {
  it('records updates with the running actions, oldest first, keeping the most recent', () => {
    const store = createStore({ n: 0 });
    const inspector = inspect(store, { limit: 2 });
    store.update((s) => s); // no change, nothing recorded
    store.update(() => ({ n: 1 }));
    const add = action('cart/add', () => store.update((s) => ({ n: s.n + 1 })));
    const checkout = action('cart/checkout', () => {
      add();
      store.update((s) => ({ n: s.n * 10 }));
    });
    checkout();
    expect(inspector.recorded).toBe(3);
    expect(inspector.updates).toEqual([
      { previous: { n: 1 }, next: { n: 2 }, actions: ['cart/checkout', 'cart/add'] },
      { previous: { n: 2 }, next: { n: 20 }, actions: ['cart/checkout'] },
    ]);
    inspector.dispose();
    inspector.dispose();
    store.update(() => ({ n: 0 }));
    expect(inspector.recorded).toBe(3);
    expect(inspector.stopped).toBe(true);
  });

  it('records an update a subscriber makes after the update that caused it', () => {
    const store = createStore({ n: 0 });
    const inspector = inspect(store);
    const off = store.subscribe((s) => {
      if (s.n === 1) store.update(() => ({ n: 2 }));
    });
    store.update(() => ({ n: 1 }));
    expect(inspector.updates.map((u) => u.next)).toEqual([{ n: 1 }, { n: 2 }]);
    off();
  });

  it('stops when the store is disposed; counts without keeping at limit 0; rejects bad input', () => {
    const store = createStore({ n: 0 });
    const counting = inspect(store, { limit: 0 });
    store.update(() => ({ n: 1 }));
    expect(counting.recorded).toBe(1);
    expect(counting.updates).toEqual([]);
    store.dispose();
    expect(counting.stopped).toBe(true);
    expect(inspect(store).stopped).toBe(true);
    expect(() => inspect(createStore(1), { limit: 1.5 })).toThrow(
      expect.objectContaining({ code: 'state.inspect.limit' }),
    );
    const foreign = { ...createStore(1) };
    expect(() => inspect(foreign as never)).toThrow(
      expect.objectContaining({ code: 'state.inspect.unsupported' }),
    );
  });
});
