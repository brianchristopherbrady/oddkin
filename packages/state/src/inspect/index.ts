/**
 * `@oddkin/state/inspect` — bounded inspection of stores for development tools and tests. DOM-free.
 * A separate import: stores carry only counters and an observer hook, never a log.
 * Contract: docs/architecture/core-contracts.md §7.
 */
import { DEV } from '../internal/dev.js';
import { OddkinError } from '@oddkin/core/diagnostics';
import { INTERNALS, liveCounts, type Store, type StoreInternals } from '../store/store.js';

/** One recorded update. */
export interface StoreUpdate<T> {
  readonly previous: T;
  readonly next: T;
  /** Names of the actions running when the update was made, outermost first; empty outside an action. */
  readonly actions: readonly string[];
}

export interface InspectOptions {
  /** Most recent updates kept (default 50). `0` counts updates without keeping them. */
  limit?: number;
}

export interface StoreInspector<T> {
  readonly store: Store<T>;
  /** The most recent updates since inspection started, oldest first; at most `limit`. */
  readonly updates: readonly StoreUpdate<T>[];
  /** Updates seen since inspection started, including those no longer kept. */
  readonly recorded: number;
  /** Live `subscribe()` listeners of the store. */
  readonly subscribers: number;
  /** True once inspection stopped, by `dispose()` or because the store was disposed. */
  readonly stopped: boolean;
  /** Stop recording. What was recorded stays readable. Idempotent. */
  dispose(): void;
}

/** Live stores (created and not disposed) and live `subscribe()` listeners, across all stores. */
export function storeStats(): { readonly stores: number; readonly subscriptions: number } {
  return liveCounts();
}

/** Record a store's updates and their actions, keeping the most recent `limit`. */
export function inspect<T>(store: Store<T>, options?: InspectOptions): StoreInspector<T> {
  const internals = (store as Partial<Record<typeof INTERNALS, StoreInternals<T>>>)[INTERNALS];
  if (!internals) {
    throw new OddkinError(
      'state.inspect.unsupported',
      DEV
        ? 'inspect() needs a store created by createStore() from this copy of @oddkin/state.'
        : '',
    );
  }
  const limit = options?.limit ?? 50;
  if (!Number.isInteger(limit) || limit < 0) {
    throw new OddkinError(
      'state.inspect.limit',
      DEV ? `inspect() limit must be a whole number of updates (0 or more), not ${limit}.` : '',
    );
  }
  const updates: StoreUpdate<T>[] = [];
  let recorded = 0;
  let stopped = false;
  const stop = internals.observe({
    update(record) {
      recorded++;
      if (limit === 0) return;
      if (updates.length === limit) updates.shift();
      updates.push({ previous: record.previous, next: record.next, actions: record.actions });
    },
    dispose() {
      stopped = true;
    },
  });
  return {
    store,
    get updates() {
      return [...updates];
    },
    get recorded() {
      return recorded;
    },
    get subscribers() {
      return internals.subscribers;
    },
    get stopped() {
      return stopped || store.disposed;
    },
    dispose() {
      if (stopped) return;
      stopped = true;
      stop();
    },
  };
}
