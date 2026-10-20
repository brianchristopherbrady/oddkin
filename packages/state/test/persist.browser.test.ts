// Persistence against real Web Storage in each engine (core-contracts.md §7.3): a round trip
// through localStorage, and a real quota failure that never reaches the store or its subscribers.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { setErrorHandler, type ErrorContext } from '@oddkin/core/diagnostics';
import { persist } from '../src/persist/index.js';
import { createStore } from '../src/store/index.js';

const KEY = 'oddkin-state-test';
let reported: { error: unknown; context: ErrorContext }[];
beforeEach(() => {
  reported = [];
  setErrorHandler((error, context) => reported.push({ error, context }));
  localStorage.removeItem(KEY);
  sessionStorage.removeItem(KEY);
});
afterEach(() => {
  setErrorHandler(undefined);
  localStorage.removeItem(KEY);
  sessionStorage.removeItem(KEY);
});

describe('persist with Web Storage', () => {
  it('round-trips through localStorage by default, as after a reload', async () => {
    const first = createStore({ theme: 'light', visits: 0 });
    const persistence = persist(first, { key: KEY, version: 1 });
    expect(persistence.status.value).toBe('empty');
    first.update((s) => ({ ...s, theme: 'dark', visits: 1 }));
    await Promise.resolve();
    expect(JSON.parse(localStorage.getItem(KEY)!)).toEqual({
      version: 1,
      data: { theme: 'dark', visits: 1 },
    });
    persistence.dispose();

    const second = createStore({ theme: 'light', visits: 0 });
    expect(persist(second, { key: KEY, version: 1 }).status.value).toBe('restored');
    expect(second.getSnapshot()).toEqual({ theme: 'dark', visits: 1 });
    expect(reported).toEqual([]);
  });

  it('isolates a real QuotaExceededError from the store and its subscribers', async () => {
    const store = createStore({ blob: '' });
    const seen: number[] = [];
    store.subscribe((state) => seen.push(state.blob.length));
    persist(store, { key: KEY, version: 1, storage: sessionStorage });
    const huge = 'x'.repeat(12 * 1024 * 1024); // beyond every engine's per-origin storage quota
    expect(() => store.update(() => ({ blob: huge }))).not.toThrow();
    await Promise.resolve();
    expect(store.getSnapshot().blob.length).toBe(huge.length);
    expect(seen).toEqual([huge.length]);
    expect(reported.map((r) => r.context.code)).toEqual(['state.persist.write']);
    const cause = (reported[0]!.error as Error).cause as DOMException;
    expect(cause).toBeInstanceOf(DOMException);
    expect(cause.name).toMatch(/quota/i);
    expect(sessionStorage.getItem(KEY)).toBeNull();

    store.update(() => ({ blob: 'small' })); // a later change is written again
    await Promise.resolve();
    expect(JSON.parse(sessionStorage.getItem(KEY)!)).toEqual({
      version: 1,
      data: { blob: 'small' },
    });
  });
});
