import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setErrorHandler, type ErrorContext } from '@oddkin/core/diagnostics';
import { flush } from '@oddkin/core/reactive';
import { inspect } from '../src/inspect/index.js';
import { persist, type PersistStateOptions, type StorageLike } from '../src/persist/index.js';
import { createStore, shallowEqual } from '../src/store/index.js';

// Persistence (core-contracts.md §7.3): explicit selection, versions and migrations, validation,
// restore before subscribing, and storage failures that never reach the store.

class MemoryStorage implements StorageLike {
  readonly items = new Map<string, string>();
  writes = 0;
  failWrites: unknown;
  failReads: unknown;
  getItem(key: string) {
    if (this.failReads) throw this.failReads;
    return this.items.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    if (this.failWrites) throw this.failWrites;
    this.writes++;
    this.items.set(key, value);
  }
  removeItem(key: string) {
    this.items.delete(key);
  }
  saved(key: string): unknown {
    const text = this.items.get(key);
    return text === undefined ? undefined : JSON.parse(text);
  }
}

const tick = () => Promise.resolve();

let reported: { error: unknown; context: ErrorContext }[];
let storage: MemoryStorage;
beforeEach(() => {
  reported = [];
  storage = new MemoryStorage();
  setErrorHandler((error, context) => reported.push({ error, context }));
});
afterEach(() => {
  flush();
  setErrorHandler(undefined);
});
const codes = () => reported.map((r) => r.context.code);

describe('persist', () => {
  it('writes nothing until the state changes, then one envelope per microtask', async () => {
    const store = createStore({ theme: 'light', count: 0 });
    const persistence = persist(store, { key: 'prefs', version: 1, storage });
    expect(persistence.status.value).toBe('empty');
    await tick();
    expect(storage.writes).toBe(0);
    store.update((s) => ({ ...s, count: 1 }));
    store.update((s) => ({ ...s, count: 2 }));
    expect(storage.writes).toBe(0);
    await tick();
    expect(storage.writes).toBe(1);
    expect(storage.saved('prefs')).toEqual({ version: 1, data: { theme: 'light', count: 2 } });
    expect(codes()).toEqual([]);
  });

  it('restores before returning, as one named update, without writing it back', async () => {
    storage.items.set('prefs', JSON.stringify({ version: 1, data: { theme: 'dark', count: 5 } }));
    const store = createStore({ theme: 'light', count: 0 });
    const inspector = inspect(store);
    const seen: unknown[] = [];
    store.subscribe((state) => seen.push(state));
    const persistence = persist(store, { key: 'prefs', version: 1, storage });
    expect(store.getSnapshot()).toEqual({ theme: 'dark', count: 5 });
    expect(Object.isFrozen(store.getSnapshot())).toBe(true);
    expect(persistence.status.value).toBe('restored');
    expect(seen).toHaveLength(1);
    expect(inspector.updates.map((u) => u.actions)).toEqual([['persist/restore']]);
    await tick();
    expect(storage.writes).toBe(0);
  });

  it('persists only the selection and merges it back into the current state', async () => {
    const options = {
      key: 'p',
      version: 1,
      storage,
      select: (s: { prefs: { theme: string }; cart: readonly string[] }) => s.prefs,
      restore: (
        s: { prefs: { theme: string }; cart: readonly string[] },
        prefs: { theme: string },
      ) => ({ ...s, prefs }),
    };
    const store = createStore({ prefs: { theme: 'light' }, cart: [] as readonly string[] });
    persist(store, options);
    store.update((s) => ({ ...s, cart: ['tea'] }));
    await tick();
    expect(storage.writes).toBe(0); // not selected
    store.update((s) => ({ ...s, prefs: { theme: 'dark' } }));
    await tick();
    expect(storage.saved('p')).toEqual({ version: 1, data: { theme: 'dark' } });

    const next = createStore({ prefs: { theme: 'light' }, cart: ['milk'] as readonly string[] });
    persist(next, options);
    expect(next.getSnapshot()).toEqual({ prefs: { theme: 'dark' }, cart: ['milk'] });
  });

  it('writes a selection only when equals says it changed', async () => {
    const store = createStore({ a: 1, b: 2, c: 3 });
    persist(store, {
      key: 'ab',
      version: 1,
      storage,
      select: (s) => ({ a: s.a, b: s.b }),
      restore: (s, saved) => ({ ...s, ...saved }),
      equals: shallowEqual,
    });
    store.update((s) => ({ ...s, c: 4 }));
    await tick();
    expect(storage.writes).toBe(0);
    store.update((s) => ({ ...s, a: 9 }));
    await tick();
    expect(storage.saved('ab')).toEqual({ version: 1, data: { a: 9, b: 2 } });
  });

  it('migrates stored data step by step to the current version, then validates it', async () => {
    storage.items.set('person', JSON.stringify({ version: 1, data: { name: 'Ada' } }));
    const store = createStore({ first: '', last: '', title: '' });
    const persistence = persist(store, {
      key: 'person',
      version: 3,
      storage,
      migrate: {
        2: (data) => ({ first: (data as { name: string }).name, last: '' }),
        3: (data) => ({ ...(data as object), title: 'Dr' }),
      },
      validate: (data) => typeof (data as { first?: unknown }).first === 'string',
    });
    expect(store.getSnapshot()).toEqual({ first: 'Ada', last: '', title: 'Dr' });
    expect(persistence.status.value).toBe('restored');
    store.update((s) => ({ ...s, last: 'Lovelace' }));
    await tick();
    expect(storage.saved('person')).toEqual({
      version: 3,
      data: { first: 'Ada', last: 'Lovelace', title: 'Dr' },
    });
  });

  const fails = (): never => {
    throw new Error('bad');
  };
  const stored = JSON.stringify({ version: 1, data: 1 });
  const rejections: {
    name: string;
    text: string;
    options: Partial<
      Pick<PersistStateOptions<{ n: number }>, 'version' | 'migrate' | 'validate' | 'restore'>
    >;
    code: string;
  }[] = [
    { name: 'unparseable text', text: '{oops', options: {}, code: 'state.persist.parse' },
    { name: 'no envelope', text: '{"data":1}', options: {}, code: 'state.persist.parse' },
    { name: 'version 0', text: '{"version":0,"data":1}', options: {}, code: 'state.persist.parse' },
    {
      name: 'fractional version',
      text: '{"version":1.5,"data":1}',
      options: {},
      code: 'state.persist.parse',
    },
    {
      name: 'missing migration',
      text: stored,
      options: { version: 2 },
      code: 'state.persist.migrate',
    },
    {
      name: 'throwing migration',
      text: stored,
      options: { version: 2, migrate: { 2: fails } },
      code: 'state.persist.migrate',
    },
    {
      name: 'validate false',
      text: stored,
      options: { validate: () => false },
      code: 'state.persist.invalid',
    },
    {
      name: 'validate throws',
      text: stored,
      options: { validate: fails },
      code: 'state.persist.invalid',
    },
    {
      name: 'restore throws',
      text: stored,
      options: { restore: fails },
      code: 'state.persist.invalid',
    },
  ];
  for (const { name, text, options, code } of rejections) {
    it(`rejects ${name}: the state is kept and the next change overwrites the entry`, async () => {
      storage.items.set('k', text);
      const store = createStore({ n: 0 });
      const persistence = persist(store, { key: 'k', version: 1, storage, ...options });
      expect(store.getSnapshot()).toEqual({ n: 0 });
      expect(persistence.status.value).toBe('rejected');
      expect(codes()).toEqual([code]);
      store.update(() => ({ n: 1 }));
      await tick();
      expect(storage.saved('k')).toEqual({ version: options.version ?? 1, data: { n: 1 } });
    });
  }

  it('leaves newer stored data alone until clear()', async () => {
    const newer = JSON.stringify({ version: 4, data: { n: 99 } });
    storage.items.set('k', newer);
    const store = createStore({ n: 0 });
    const persistence = persist(store, { key: 'k', version: 2, storage });
    expect(persistence.status.value).toBe('blocked');
    expect(codes()).toEqual(['state.persist.version']);
    expect(store.getSnapshot()).toEqual({ n: 0 });
    store.update(() => ({ n: 1 }));
    await tick();
    persistence.flush();
    expect(storage.items.get('k')).toBe(newer);
    persistence.clear();
    expect(storage.items.has('k')).toBe(false);
    expect(persistence.status.value).toBe('empty');
    store.update(() => ({ n: 2 }));
    await tick();
    expect(storage.saved('k')).toEqual({ version: 2, data: { n: 2 } });
  });

  it('isolates write failures: the store and its subscribers carry on; one report per failing streak', async () => {
    storage.failWrites = new Error('QuotaExceededError');
    const store = createStore({ n: 0 });
    const other = vi.fn();
    store.subscribe(other);
    const persistence = persist(store, { key: 'k', version: 1, storage });
    store.update(() => ({ n: 1 }));
    await tick();
    store.update(() => ({ n: 2 }));
    await tick();
    expect(store.getSnapshot()).toEqual({ n: 2 });
    expect(other).toHaveBeenCalledTimes(2);
    expect(codes()).toEqual(['state.persist.write']);
    expect((reported[0]!.error as Error).cause).toBe(storage.failWrites);
    storage.failWrites = undefined;
    persistence.flush(); // the unwritten state is still pending, without a new change
    expect(storage.saved('k')).toEqual({ version: 1, data: { n: 2 } });
    store.update(() => ({ n: 3 }));
    await tick();
    expect(storage.saved('k')).toEqual({ version: 1, data: { n: 3 } });
    storage.failWrites = new Error('again');
    store.update(() => ({ n: 4 }));
    await tick();
    expect(codes()).toEqual(['state.persist.write', 'state.persist.write']);
  });

  it('reports state that cannot be serialized and writes nothing', async () => {
    const store = createStore<{ n: number | bigint }>({ n: 0 });
    persist(store, { key: 'k', version: 1, storage });
    store.update(() => ({ n: 10n }));
    await tick();
    expect(storage.writes).toBe(0);
    expect(codes()).toEqual(['state.persist.serialize']);
    expect(store.getSnapshot()).toEqual({ n: 10n });
  });

  it('keeps the store in memory when storage is unreachable, missing, or unreadable', async () => {
    const denied = createStore({ n: 0 });
    const throwing = persist(denied, {
      key: 'k',
      version: 1,
      storage: () => {
        throw new Error('SecurityError');
      },
    });
    const missing = persist(createStore({ n: 0 }), { key: 'k', version: 1, storage: () => null });
    const noDefault = persist(createStore({ n: 0 }), { key: 'k', version: 1 }); // Node: no localStorage
    storage.failReads = new Error('read failed');
    const unreadable = persist(createStore({ n: 0 }), { key: 'k', version: 1, storage });
    expect([throwing, missing, noDefault, unreadable].map((p) => p.status.value)).toEqual([
      'unavailable',
      'unavailable',
      'unavailable',
      'unavailable',
    ]);
    expect(codes()).toEqual([
      'state.persist.unavailable',
      'state.persist.unavailable',
      'state.persist.unavailable',
      'state.persist.read',
    ]);
    denied.update(() => ({ n: 1 }));
    await tick();
    expect(denied.getSnapshot()).toEqual({ n: 1 });
    expect(storage.writes).toBe(0);
  });

  it('uses custom serialize and deserialize for values JSON cannot keep', () => {
    const options = {
      key: 'dates',
      version: 1,
      storage,
      serialize: (envelope: { version: number; data: { at: Date } }) =>
        JSON.stringify({ ...envelope, data: { at: envelope.data.at.toISOString() } }),
      deserialize: (text: string) =>
        JSON.parse(text, (key, value) => (key === 'at' ? new Date(value as string) : value)),
    };
    const store = createStore({ at: new Date(0) });
    const persistence = persist(store, options);
    store.update(() => ({ at: new Date('2026-10-19T12:00:00Z') }));
    persistence.flush();
    const next = createStore({ at: new Date(0) });
    persist(next, options);
    expect(next.getSnapshot().at).toBeInstanceOf(Date);
    expect(next.getSnapshot().at.toISOString()).toBe('2026-10-19T12:00:00.000Z');
  });

  it('flush() writes now; dispose() writes a pending change and stops', async () => {
    const store = createStore({ n: 0 });
    const persistence = persist(store, { key: 'k', version: 1, storage });
    store.update(() => ({ n: 1 }));
    persistence.flush();
    expect(storage.writes).toBe(1);
    await tick();
    expect(storage.writes).toBe(1); // the queued write found nothing new
    store.update(() => ({ n: 2 }));
    persistence.dispose();
    persistence.dispose();
    expect(persistence.disposed).toBe(true);
    expect(storage.saved('k')).toEqual({ version: 1, data: { n: 2 } });
    store.update(() => ({ n: 3 }));
    await tick();
    persistence.flush();
    expect(storage.saved('k')).toEqual({ version: 1, data: { n: 2 } });
  });

  it('sends failures to onError when given', () => {
    const errors: { code: string }[] = [];
    storage.items.set('k', '{oops');
    persist(createStore(1), { key: 'k', version: 1, storage, onError: (e) => errors.push(e) });
    expect(errors.map((e) => e.code)).toEqual(['state.persist.parse']);
    expect(codes()).toEqual([]);
  });

  it('rejects unusable options and disposed stores', () => {
    for (const [key, version] of [
      ['', 1],
      ['k', 0],
      ['k', 1.5],
    ] as const) {
      expect(() => persist(createStore(1), { key, version, storage })).toThrow(
        expect.objectContaining({ code: 'state.persist.options' }),
      );
    }
    const store = createStore(1);
    store.dispose();
    expect(() => persist(store, { key: 'k', version: 1, storage })).toThrow(
      expect.objectContaining({ code: 'state.store.disposed' }),
    );
  });
});
