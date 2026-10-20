/**
 * `@oddkin/state/persist` — an optional, versioned persistence adapter for one store
 * (core-contracts.md §7.3). DOM-free: storage is reached only when `persist()` runs, and any Web
 * Storage-like object works. Nothing is persisted unless it is selected explicitly or the whole
 * store is opted in; no component property is ever persisted automatically.
 */
import { DEV } from '../internal/dev.js';
import { OddkinError, reportOddkinError } from '@oddkin/core/diagnostics';
import { computed, signal, type Readable } from '@oddkin/core/reactive';
import { action, type Store } from '../store/store.js';

/** The part of the Web Storage API persistence uses; `localStorage` and `sessionStorage` fit. */
export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/** What is stored under the key: the persisted data and the version of its shape. */
export interface PersistedEnvelope<P> {
  readonly version: number;
  readonly data: P;
}

/**
 * `empty`: nothing was stored. `restored`: stored data was migrated if needed, validated, and
 * applied. `rejected`: stored data could not be read, migrated, or validated; the store kept its
 * state and the next change overwrites the entry. `blocked`: the stored version is newer than this
 * code; nothing is written until `clear()`. `unavailable`: there is no usable storage; the store
 * works in memory only.
 */
export type PersistStatus = 'empty' | 'restored' | 'rejected' | 'blocked' | 'unavailable';

interface CommonOptions<P> {
  /** Storage key. One persistence per key. */
  key: string;
  /** Version of the persisted shape: a whole number of 1 or more. */
  version: number;
  /** Storage, or a function returning it (default: `localStorage` when it can be reached). */
  storage?: StorageLike | (() => StorageLike | null | undefined);
  /** Migrations keyed by the version they produce: `{ 2: (v1Data) => v2Data }`. */
  migrate?: Readonly<Record<number, (data: unknown) => unknown>>;
  /** Accept restored data in the current version; return false (or throw) to reject it. */
  validate?: (data: unknown) => boolean;
  /** Decides whether a new selection must be written. Default `Object.is`. */
  equals?: (previous: P, next: P) => boolean;
  /** Default `JSON.stringify`. */
  serialize?: (envelope: PersistedEnvelope<P>) => string;
  /** Default `JSON.parse`. */
  deserialize?: (text: string) => unknown;
  /** Receives storage and data failures instead of the Oddkin error handler. */
  onError?: (error: OddkinError) => void;
}

/** Persist the whole state; restoring replaces it unless `restore` merges. */
export interface PersistStateOptions<T> extends CommonOptions<T> {
  select?: undefined;
  restore?: (state: T, saved: T) => T;
}

/** Persist a selection of the state; `restore` puts it back into the current state. */
export interface PersistSelectionOptions<T, P> extends CommonOptions<P> {
  select: (state: T) => P;
  restore: (state: T, saved: P) => T;
}

export interface Persistence {
  readonly key: string;
  /** Outcome of the restore, then `empty` after `clear()`. */
  readonly status: Readable<PersistStatus>;
  readonly disposed: boolean;
  /** Write the current selection now if it differs from what was last written or restored. */
  flush(): void;
  /** Remove the stored entry and allow writing again; the next change writes. */
  clear(): void;
  /** Write a pending change, then stop. Stored data stays. Idempotent. */
  dispose(): void;
}

const NOTHING = Symbol('nothing written');

function isEnvelope(value: unknown): value is PersistedEnvelope<unknown> {
  if (typeof value !== 'object' || value === null || !('data' in value)) return false;
  const version = (value as { version?: unknown }).version;
  return typeof version === 'number' && Number.isInteger(version) && version >= 1;
}

/**
 * Persist a store under `options.key`. Restores synchronously before returning (migrating,
 * validating, and applying stored data as one update named `persist/restore`), then writes the
 * selection after changes, coalesced to one write per microtask. Storage failures are reported and
 * never reach the store, its subscribers, or the caller of `update()`.
 */
export function persist<T>(store: Store<T>, options: PersistStateOptions<T>): Persistence;
export function persist<T, P>(store: Store<T>, options: PersistSelectionOptions<T, P>): Persistence;
export function persist<T, P>(
  store: Store<T>,
  options: PersistStateOptions<T> | PersistSelectionOptions<T, P>,
): Persistence {
  const { key, version } = options;
  if (typeof key !== 'string' || key === '' || !Number.isInteger(version) || version < 1) {
    throw new OddkinError(
      'state.persist.options',
      DEV
        ? `persist() needs a non-empty key and a whole-number version of 1 or more, not key ${JSON.stringify(key)} and version ${String(version)}.`
        : '',
    );
  }
  if (store.disposed) {
    throw new OddkinError(
      'state.store.disposed',
      DEV ? `persist() cannot follow a disposed store (key "${key}").` : '',
    );
  }
  const select = (options.select ?? ((state: T) => state)) as (state: T) => P;
  const restore = (options.restore ?? ((_state: T, saved: T) => saved)) as (
    state: T,
    saved: P,
  ) => T;
  const equals = (options.equals ?? Object.is) as (previous: P, next: P) => boolean;
  const serialize = (options.serialize ?? JSON.stringify) as (
    envelope: PersistedEnvelope<P>,
  ) => string;
  const deserialize = options.deserialize ?? JSON.parse;
  const status = signal<PersistStatus>('empty');

  const fail = (code: string, message: string, cause?: unknown): void => {
    const error = new OddkinError(code, message, cause === undefined ? undefined : { cause });
    if (!options.onError) return reportOddkinError(error, { code, origin: key });
    try {
      options.onError(error);
    } catch (handlerError) {
      reportOddkinError(handlerError, { code, origin: key });
    }
  };
  const reject = (code: string, message: string, cause?: unknown): void => {
    status.value = 'rejected';
    fail(code, message, cause);
  };

  let storage: StorageLike | undefined;
  try {
    const source =
      options.storage ?? (() => (globalThis as { localStorage?: StorageLike }).localStorage);
    storage = (typeof source === 'function' ? source() : source) ?? undefined;
    if (!storage) {
      fail(
        'state.persist.unavailable',
        DEV
          ? `No storage for "${key}": localStorage does not exist here. Pass a storage option; the store keeps working in memory.`
          : '',
      );
    }
  } catch (error) {
    storage = undefined;
    fail(
      'state.persist.unavailable',
      DEV
        ? `Storage for "${key}" cannot be reached (for example, storage is disabled or the page is sandboxed); the store keeps working in memory.`
        : '',
      error,
    );
  }

  let text: string | null = null;
  if (storage) {
    try {
      text = storage.getItem(key);
    } catch (error) {
      storage = undefined;
      fail(
        'state.persist.read',
        DEV ? `Reading "${key}" from storage failed; the store keeps working in memory.` : '',
        error,
      );
    }
  }
  if (!storage) status.value = 'unavailable';

  let blocked = false;
  if (storage && text !== null) {
    let envelope: unknown;
    let parsed = true;
    try {
      envelope = deserialize(text);
    } catch (error) {
      parsed = false;
      reject(
        'state.persist.parse',
        DEV ? `Stored data for "${key}" could not be parsed; it is ignored.` : '',
        error,
      );
    }
    if (parsed && !isEnvelope(envelope)) {
      reject(
        'state.persist.parse',
        DEV
          ? `Stored data for "${key}" is not a { version, data } envelope with a whole-number version; it is ignored.`
          : '',
      );
    } else if (parsed && isEnvelope(envelope) && envelope.version > version) {
      blocked = true;
      status.value = 'blocked';
      fail(
        'state.persist.version',
        DEV
          ? `Stored data for "${key}" has version ${envelope.version}, newer than ${version}. It is not applied and not overwritten; call clear() to discard it.`
          : '',
      );
    } else if (parsed && isEnvelope(envelope)) {
      let data = envelope.data;
      let migrated = true;
      for (let next = envelope.version + 1; next <= version && migrated; next++) {
        const step = options.migrate?.[next];
        if (!step) {
          migrated = false;
          reject(
            'state.persist.migrate',
            DEV
              ? `Stored data for "${key}" has version ${envelope.version}, and there is no migration to version ${next}; it is ignored.`
              : '',
          );
          break;
        }
        try {
          data = step(data);
        } catch (error) {
          migrated = false;
          reject(
            'state.persist.migrate',
            DEV ? `Migrating "${key}" to version ${next} failed; the stored data is ignored.` : '',
            error,
          );
        }
      }
      if (migrated) {
        let valid = true;
        let cause: unknown;
        try {
          valid = options.validate ? options.validate(data) : true;
        } catch (error) {
          valid = false;
          cause = error;
        }
        if (valid) {
          try {
            action('persist/restore', () => store.update((state) => restore(state, data as P)))();
            status.value = 'restored';
          } catch (error) {
            valid = false;
            cause = error;
          }
        }
        if (!valid) {
          reject(
            'state.persist.invalid',
            DEV
              ? `Stored data for "${key}" was rejected by validate() or restore(); the store keeps its state.`
              : '',
            cause,
          );
        }
      }
    }
  }

  let written: P | typeof NOTHING = select(store.getSnapshot());
  let pending = false;
  let failing = false;
  let disposed = false;

  const write = (): void => {
    pending = false;
    if (!storage || blocked) return;
    const selection = select(store.getSnapshot());
    if (written !== NOTHING && equals(written, selection)) return;
    let serialized: string;
    try {
      serialized = serialize({ version, data: selection });
    } catch (error) {
      if (!failing)
        fail(
          'state.persist.serialize',
          DEV
            ? `The state for "${key}" could not be serialized (for example a cycle or a BigInt with JSON); it was not written.`
            : '',
          error,
        );
      failing = true;
      return;
    }
    try {
      storage.setItem(key, serialized);
    } catch (error) {
      if (!failing)
        fail(
          'state.persist.write',
          DEV
            ? `Writing "${key}" to storage failed (for example the quota is exceeded); later changes try again.`
            : '',
          error,
        );
      failing = true;
      return;
    }
    failing = false;
    written = selection;
  };

  const unsubscribe = store.subscribe(() => {
    if (pending || disposed) return;
    pending = true;
    queueMicrotask(() => {
      if (pending && !disposed) write();
    });
  });

  return {
    key,
    status: computed(() => status.value),
    get disposed() {
      return disposed;
    },
    flush() {
      if (!disposed) write();
    },
    clear() {
      if (disposed || !storage) return;
      try {
        storage.removeItem(key);
      } catch (error) {
        fail('state.persist.write', DEV ? `Removing "${key}" from storage failed.` : '', error);
        return;
      }
      blocked = false;
      written = NOTHING;
      status.value = 'empty';
    },
    dispose() {
      if (disposed) return;
      if (pending) write();
      disposed = true;
      unsubscribe();
    },
  };
}
