/**
 * Resources (core-contracts.md §8): async reads driven by a reactive source. Construction is inert;
 * `scope.use(resource)` observes the source; each key starts a generation with its own request
 * scope and abort signal; a newer generation, `cancel()`, a timeout, or disconnection revokes the
 * older one's right to commit before its continuation runs (abort and a generation guard), so a
 * stale result never wins even when the load ignores its signal. Expected aborts never surface as
 * errors or unhandled rejections; timeouts are failures with a `TimeoutError`. Reads only:
 * mutations are commands (`./command`). DOM-free.
 */
import { DEV } from '../internal/dev.js';
import { OddkinError } from '@oddkin/core/diagnostics';
import { computed, signal, untracked, type Readable } from '@oddkin/core/reactive';
import { createScope, type Controller, type Scope } from '@oddkin/core/scope';

/** A loaded value and the key it was loaded for. */
export interface Loaded<K, T> {
  readonly key: K;
  readonly value: T;
}

/**
 * One discriminated state. `pending` and `error` carry the latest success, of any key, as
 * `previous`, so a view can keep showing it.
 */
export type ResourceState<K, T> =
  | { readonly status: 'idle' }
  | { readonly status: 'pending'; readonly key: K; readonly previous: Loaded<K, T> | undefined }
  | { readonly status: 'success'; readonly key: K; readonly value: T }
  | {
      readonly status: 'error';
      readonly key: K;
      readonly error: unknown;
      readonly previous: Loaded<K, T> | undefined;
    };

/** What a load receives. Everything registered on `scope` ends with the generation. */
export interface LoadContext {
  /** Aborted when the generation is superseded, cancelled, timed out, or disconnected. */
  readonly signal: AbortSignal;
  /** The generation's own scope (a fresh request scope per load). */
  readonly scope: Scope;
  /** Increases with every load of this resource. */
  readonly generation: number;
}

export interface ResourceOptions<K, T> {
  /** The key to load, read in a tracked context; `undefined` means idle. */
  source: () => K | undefined;
  /** Load the value for a key. Runs untracked; may return a value or a promise. */
  load: (key: K, context: LoadContext) => T | PromiseLike<T>;
  /** Whether two keys are the same, so a new key object does not reload. Default `Object.is`. */
  equals?: (a: K, b: K) => boolean;
  /** Fail a load that takes longer than this many milliseconds, with a `TimeoutError`. */
  timeout?: number;
  /**
   * Freshness policy: on reconnection, reuse a success for the same key younger than this many
   * milliseconds instead of loading again. Default `0`: reconnecting reloads.
   */
  freshFor?: number;
  /** Name used in abort reasons and diagnostics. */
  name?: string;
}

export interface Resource<K, T> extends Controller {
  /** The current state, as a read-only readable. */
  readonly state: Readable<ResourceState<K, T>>;
  /** Load the current key again, superseding a pending load. No-op while disconnected or idle. */
  refresh(): void;
  /** The same as `refresh()`, for use after an error. */
  retry(): void;
  /** Abort the pending load without an error; the state returns to what it was before it. */
  cancel(reason?: unknown): void;
  /** End the resource: abort its load and stop following its source. Idempotent. */
  dispose(): void;
}

interface Connection<K> {
  readonly scope: Scope;
  hasKey: boolean;
  key: K | undefined;
}

interface Generation<K> {
  readonly scope: Scope;
  readonly key: K;
}

const isPromiseLike = (value: unknown): value is PromiseLike<unknown> =>
  (typeof value === 'object' || typeof value === 'function') &&
  value !== null &&
  typeof (value as { then?: unknown }).then === 'function';

class ResourceImpl<K, T> implements Resource<K, T> {
  readonly state: Readable<ResourceState<K, T>>;
  readonly #options: ResourceOptions<K, T>;
  readonly #equals: (a: K, b: K) => boolean;
  readonly #state = signal<ResourceState<K, T>>({ status: 'idle' });
  /** The state to return to when a pending load is abandoned. */
  #settled: ResourceState<K, T> = { status: 'idle' };
  #latest: (Loaded<K, T> & { readonly at: number }) | undefined;
  #connection: Connection<K> | undefined;
  #active: Generation<K> | undefined;
  #generation = 0;
  #disposed = false;

  constructor(options: ResourceOptions<K, T>) {
    this.#options = options;
    this.#equals = options.equals ?? Object.is;
    this.state = computed(() => this.#state.value);
  }

  connect(scope: Scope): void {
    if (this.#disposed || scope.disposed) return;
    this.#disconnect(new DOMException(`${this.#label()} connected elsewhere`, 'AbortError'));
    const connection: Connection<K> = { scope, hasKey: false, key: undefined };
    this.#connection = connection;
    // Read the signal now: a scope's controller is created lazily, and one created only after
    // dispose() would not carry the disposal reason that the pending load must receive.
    const ownerSignal = scope.signal;
    // Registered before the effect, so it runs after the effect stops following the source.
    scope.add(() => {
      if (this.#connection === connection) this.#disconnect(ownerSignal.reason);
    }, 'resource');
    scope.effect(
      () => {
        const key = this.#options.source();
        untracked(() => this.#onKey(connection, key));
      },
      { name: this.#label() },
    );
  }

  refresh(): void {
    const connection = this.#connection;
    if (this.#disposed || !connection || connection.key === undefined) return;
    this.#start(connection, connection.key);
  }

  retry(): void {
    this.refresh();
  }

  cancel(reason?: unknown): void {
    if (!this.#active) return;
    this.#abandon(reason ?? new DOMException(`${this.#label()} cancelled`, 'AbortError'));
  }

  dispose(): void {
    if (this.#disposed) return;
    this.#disconnect(new DOMException(`${this.#label()} disposed`, 'AbortError'));
    this.#disposed = true;
  }

  #label(): string {
    return this.#options.name ? `resource "${this.#options.name}"` : 'resource';
  }

  #onKey(connection: Connection<K>, key: K | undefined): void {
    if (this.#disposed || this.#connection !== connection) return;
    const previous = connection.key;
    const first = !connection.hasKey;
    connection.hasKey = true;
    connection.key = key;
    if (!first) {
      const same =
        previous === undefined || key === undefined
          ? previous === key
          : this.#equals(previous, key);
      if (same) return;
    }
    if (key === undefined) {
      this.#abandon(new DOMException(`${this.#label()} has no key`, 'AbortError'));
      this.#set({ status: 'idle' });
      return;
    }
    if (first) {
      const state = this.#state.peek();
      const latest = this.#latest;
      const freshFor = this.#options.freshFor ?? 0;
      if (
        state.status === 'success' &&
        latest &&
        this.#equals(latest.key, key) &&
        Date.now() - latest.at < freshFor
      )
        return;
    }
    this.#start(connection, key);
  }

  #start(connection: Connection<K>, key: K): void {
    this.#abort(new DOMException(`${this.#label()} superseded`, 'AbortError'));
    const generation = ++this.#generation;
    // A root scope owned by this resource rather than a child of the connection: disposing a parent
    // disposes children without its reason, and the load must see the real one (disconnection,
    // supersession, cancellation, or timeout).
    const request = createScope({ name: this.#label() });
    const active: Generation<K> = { scope: request, key };
    this.#active = active;
    this.#set({ status: 'pending', key, previous: this.#previous() });
    const timeout = this.#options.timeout;
    if (timeout !== undefined) {
      request.timeout(
        () =>
          this.#fail(
            active,
            new DOMException(`${this.#label()} timed out after ${timeout} ms`, 'TimeoutError'),
          ),
        timeout,
      );
    }
    let result: T | PromiseLike<T>;
    try {
      result = untracked(() =>
        this.#options.load(key, { signal: request.signal, scope: request, generation }),
      );
    } catch (error) {
      this.#fail(active, error);
      return;
    }
    if (isPromiseLike(result)) {
      // Both handlers are attached at once: a rejection after supersession is handled, not unhandled.
      Promise.resolve(result).then(
        (value) => this.#succeed(active, value),
        (error: unknown) => this.#fail(active, error),
      );
    } else {
      this.#succeed(active, result);
    }
  }

  #succeed(active: Generation<K>, value: T): void {
    if (this.#active !== active) return; // stale: superseded, cancelled, timed out, or disconnected
    this.#active = undefined;
    this.#latest = { key: active.key, value, at: Date.now() };
    this.#set({ status: 'success', key: active.key, value });
    active.scope.dispose();
  }

  #fail(active: Generation<K>, error: unknown): void {
    if (this.#active !== active) return;
    this.#active = undefined;
    this.#set({ status: 'error', key: active.key, error, previous: this.#previous() });
    active.scope.dispose(error);
  }

  /** Revoke the active generation's right to commit and abort its signal. */
  #abort(reason: unknown): void {
    const active = this.#active;
    if (!active) return;
    this.#active = undefined;
    active.scope.dispose(reason);
  }

  /** Abort the active generation and return to the state before it. */
  #abandon(reason: unknown): void {
    if (!this.#active) return;
    this.#abort(reason);
    this.#set(this.#settled);
  }

  #disconnect(reason: unknown): void {
    if (!this.#connection) return;
    this.#connection = undefined;
    this.#abandon(reason);
  }

  #previous(): Loaded<K, T> | undefined {
    const latest = this.#latest;
    return latest && { key: latest.key, value: latest.value };
  }

  #set(state: ResourceState<K, T>): void {
    if (state.status !== 'pending') this.#settled = state;
    this.#state.value = state;
  }
}

/**
 * A resource: the value for `source()`'s key, loaded by `load` while the resource is connected
 * (`scope.use(resource)`). Nothing loads before that. The latest success survives disconnection;
 * reconnecting reloads the current key unless `freshFor` says the success is fresh enough.
 */
export function resource<K, T>(options: ResourceOptions<K, T>): Resource<K, T> {
  if (
    options.timeout !== undefined &&
    !(Number.isFinite(options.timeout) && options.timeout >= 0)
  ) {
    throw new OddkinError(
      'app.resource.options',
      DEV
        ? `resource() timeout must be a number of milliseconds of 0 or more, not ${String(options.timeout)}.`
        : '',
    );
  }
  return new ResourceImpl(options);
}
