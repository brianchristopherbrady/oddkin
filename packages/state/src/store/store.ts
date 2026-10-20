/**
 * Optional shared stores on Oddkin's reactive graph (core-contracts.md §7). DOM-free.
 *
 * A store holds one immutable snapshot in a core signal. `state` and `select()` are ordinary
 * readables (a read-only computed view and memoized computed values), so effects, bindings, and
 * other computed values observe them through the same graph and `Scope` ownership as any signal:
 * a selector registers with the store only while something observes it.
 */
import { DEV } from '../internal/dev.js';
import { OddkinError } from '@oddkin/core/diagnostics';
import {
  batch,
  computed,
  signal,
  untracked,
  type ExternalSource,
  type ReactiveOptions,
  type Readable,
  type Signal,
} from '@oddkin/core/reactive';

export interface StoreOptions {
  /** Name used in diagnostics and inspection. */
  name?: string;
  /**
   * Freeze the plain objects and arrays of every snapshot, in development and production alike,
   * so a mutation throws instead of going unnoticed. Default `true`. Class instances, maps, sets,
   * dates, and other objects with their own prototype are never frozen.
   */
  freeze?: boolean;
}

/** Options for `select()`: `equals` decides whether a newly selected value is a change. */
export type SelectOptions<S> = ReactiveOptions<S>;

export interface Store<T> extends ExternalSource<T> {
  readonly name: string | undefined;
  /** The current snapshot as a read-only readable; `.value` in a tracked context registers a dependency. */
  readonly state: Readable<T>;
  /** True after `dispose()`. */
  readonly disposed: boolean;
  /** The current snapshot, the same value until the state changes. Bound, so it can be passed around. */
  readonly getSnapshot: () => T;
  /**
   * Call `listener` with the new snapshot after each change: synchronously outside a batch, once at
   * the outermost boundary inside one. Returns an unsubscribe function. Bound and stable.
   */
  readonly subscribe: (listener: (state: T) => void) => () => void;
  /**
   * Replace the snapshot with `updater(current)`. Returning the current snapshot is no change.
   * The updater runs untracked and must not update this store itself.
   */
  update(updater: (state: T) => T): void;
  /** A memoized readable of part of the state that notifies only when the selected value changes. */
  select<S>(selector: (state: T) => S, options?: SelectOptions<S>): Readable<S>;
  /** Return to the initial snapshot. */
  reset(): void;
  /** Release every subscription. Reads keep the last snapshot; updates throw. Idempotent. */
  dispose(): void;
}

/** @internal One committed update, as `@oddkin/state/inspect` records it. */
export interface UpdateRecord<T> {
  readonly previous: T;
  readonly next: T;
  /** Names of the running actions, outermost first. */
  readonly actions: readonly string[];
}

/** @internal Receives a store's updates and its disposal (`@oddkin/state/inspect`). */
export interface StoreObserver<T> {
  update(record: UpdateRecord<T>): void;
  dispose(): void;
}

/** @internal Counters and update observation, reached through `store[INTERNALS]`. */
export interface StoreInternals<T> {
  readonly subscribers: number;
  readonly updates: number;
  observe(observer: StoreObserver<T>): () => void;
}

/** @internal Key of a store's {@link StoreInternals}. */
export const INTERNALS: unique symbol = Symbol('oddkin.store.internals');

const live = { stores: 0, subscriptions: 0 };

/** @internal Live stores (created, not disposed) and live `subscribe()` listeners. */
export function liveCounts(): { readonly stores: number; readonly subscriptions: number } {
  return { ...live };
}

/** Action names currently running, outermost first. */
const running: string[] = [];

const noop = (): void => {};

/** A root prototype (of any realm): plain objects, `Object.create(null)` dictionaries. */
function isPlainObject(value: object): boolean {
  const proto = Object.getPrototypeOf(value) as object | null;
  return proto === null || Object.getPrototypeOf(proto) === null;
}

/**
 * Freeze the plain objects and arrays reachable from `root`. Stops at frozen values (unchanged
 * parts of a snapshot were frozen with an earlier one) and at other objects. Iterative, so deep
 * structures cannot overflow the stack; reads data properties only, so no getter runs.
 */
function freezeSnapshot(root: unknown): void {
  const pending: unknown[] = [root];
  while (pending.length > 0) {
    const value = pending.pop();
    if (typeof value !== 'object' || value === null || Object.isFrozen(value)) continue;
    if (Array.isArray(value)) {
      Object.freeze(value);
      for (let i = 0; i < value.length; i++) pending.push(value[i]);
    } else if (isPlainObject(value)) {
      Object.freeze(value);
      for (const key of Object.keys(value)) {
        const descriptor = Object.getOwnPropertyDescriptor(value, key);
        if (descriptor && 'value' in descriptor) pending.push(descriptor.value);
      }
    }
  }
}

class StoreImpl<T> implements Store<T> {
  readonly name: string | undefined;
  readonly state: Readable<T>;
  readonly #value: Signal<T>;
  readonly #initial: T;
  readonly #freeze: boolean;
  readonly #subscriptions = new Set<() => void>();
  #observers: Set<StoreObserver<T>> | undefined;
  #updates = 0;
  #updating = false;
  #disposed = false;

  constructor(initial: T, options: StoreOptions | undefined) {
    this.name = options?.name;
    this.#freeze = options?.freeze ?? true;
    if (this.#freeze) freezeSnapshot(initial);
    this.#initial = initial;
    const named = this.name === undefined ? undefined : { name: this.name };
    this.#value = signal(initial, named);
    this.state = computed(() => this.#value.value, named);
    live.stores++;
  }

  get disposed(): boolean {
    return this.#disposed;
  }

  readonly getSnapshot = (): T => this.#value.peek();

  readonly subscribe = (listener: (state: T) => void): (() => void) => {
    if (this.#disposed) return noop;
    const off = this.#value.subscribe(listener);
    let active = true;
    const release = (): void => {
      if (!active) return;
      active = false;
      this.#subscriptions.delete(release);
      live.subscriptions--;
      off();
    };
    this.#subscriptions.add(release);
    live.subscriptions++;
    return release;
  };

  update(updater: (state: T) => T): void {
    this.#check('update');
    const previous = this.#value.peek();
    let next: T;
    this.#updating = true;
    try {
      next = untracked(() => updater(previous));
    } finally {
      this.#updating = false;
    }
    this.#commit(previous, next);
  }

  select<S>(selector: (state: T) => S, options?: SelectOptions<S>): Readable<S> {
    return computed(() => selector(this.#value.value), options);
  }

  reset(): void {
    this.#check('reset');
    this.#commit(this.#value.peek(), this.#initial);
  }

  dispose(): void {
    if (this.#disposed) return;
    this.#disposed = true;
    live.stores--;
    for (const release of [...this.#subscriptions]) release();
    const observers = this.#observers;
    this.#observers = undefined;
    if (observers) for (const observer of observers) observer.dispose();
  }

  get [INTERNALS](): StoreInternals<T> {
    const store = this;
    return {
      get subscribers() {
        return store.#subscriptions.size;
      },
      get updates() {
        return store.#updates;
      },
      observe(observer: StoreObserver<T>): () => void {
        if (store.#disposed) {
          observer.dispose();
          return noop;
        }
        (store.#observers ??= new Set()).add(observer);
        return () => void store.#observers?.delete(observer);
      },
    };
  }

  #check(operation: string): void {
    if (this.#disposed) {
      throw new OddkinError(
        'state.store.disposed',
        DEV
          ? `Cannot ${operation} ${this.name ? `store "${this.name}"` : 'a store'} after dispose(). Stop the work that updates it (own it with the same Scope) or keep the store alive.`
          : '',
      );
    }
    if (this.#updating) {
      throw new OddkinError(
        'state.update.reentrant',
        DEV
          ? `Cannot ${operation} ${this.name ? `store "${this.name}"` : 'a store'} from inside its own updater: the outer updater would overwrite the result. Return the combined change from one updater instead.`
          : '',
      );
    }
  }

  #commit(previous: T, next: T): void {
    if (Object.is(previous, next)) return;
    if (this.#freeze) freezeSnapshot(next);
    // Observers record the update before subscribers run, so an update a subscriber makes is
    // recorded after the one that caused it.
    batch(() => {
      this.#value.value = next;
      this.#updates++;
      const observers = this.#observers;
      if (!observers) return;
      const record: UpdateRecord<T> = { previous, next, actions: [...running] };
      for (const observer of [...observers]) observer.update(record);
    });
  }
}

/**
 * Create a store holding `initial` as its first snapshot. Update it with `update()`, which takes the
 * current snapshot and returns the next one; read it through `state`, `select()`, `getSnapshot()`,
 * or `subscribe()`. No provider, registry, or reducer is needed.
 */
export function createStore<T>(initial: T, options?: StoreOptions): Store<T> {
  return new StoreImpl(initial, options);
}

/**
 * Name a unit of work for inspection. `fn` runs inside `batch()`, so subscribers are notified once
 * when it returns, and every store update it makes records the name; nested actions record the
 * whole chain. Batching is not a transaction: if `fn` throws, updates it already made stay. Only
 * synchronous work belongs to the action; updates after an `await` do not.
 */
export function action<A extends unknown[], R>(
  name: string,
  fn: (...args: A) => R,
): (...args: A) => R {
  return (...args: A): R => {
    running.push(name);
    try {
      return batch(() => fn(...args));
    } finally {
      running.pop();
    }
  };
}

/**
 * Equality for `select()` results built from several fields: the same value, or arrays or plain
 * objects with the same entries compared with `Object.is`. Maps, sets, and class instances are
 * equal only when identical.
 */
export function shallowEqual<V>(a: V, b: V): boolean {
  if (Object.is(a, b)) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) if (!Object.is(a[i], b[i])) return false;
    return true;
  }
  if (!isPlainObject(a) || !isPlainObject(b)) return false;
  const keys = Object.keys(a);
  if (keys.length !== Object.keys(b).length) return false;
  for (const key of keys) {
    if (!Object.hasOwn(b, key)) return false;
    if (!Object.is((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key]))
      return false;
  }
  return true;
}
