import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setErrorHandler, type ErrorContext } from '@oddkin/core/diagnostics';
import { effect, flush, signal } from '@oddkin/core/reactive';
import { createScope, scopeStats } from '@oddkin/core/scope';
import { resource, type LoadContext } from '../src/resource/index.js';

// Resources (core-contracts.md §8): inert construction, generations with abort and a generation
// guard, discriminated state, refresh/retry/cancel, timeouts, freshness on reconnection.

interface Deferred<T> {
  promise: Promise<T>;
  resolve(value: T): void;
  reject(error: unknown): void;
}
function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

/** A load whose calls can be settled from the test, one deferred per call. */
function controlledLoad<K, T>() {
  const calls: { key: K; context: LoadContext; deferred: Deferred<T> }[] = [];
  const load = (key: K, context: LoadContext) => {
    const call = { key, context, deferred: deferred<T>() };
    calls.push(call);
    return call.deferred.promise;
  };
  return { calls, load };
}

const settle = async () => {
  for (let i = 0; i < 5; i++) await Promise.resolve();
  flush();
};

let reported: ErrorContext[];
beforeEach(() => {
  reported = [];
  setErrorHandler((_error, context) => reported.push(context));
});
afterEach(() => {
  flush();
  vi.useRealTimers();
  setErrorHandler(undefined);
});

describe('resource', () => {
  it('is inert until connected, then follows its source; no key is idle', async () => {
    const query = signal<string | undefined>('tea');
    const load = vi.fn(async (key: string) => `results for ${key}`);
    const results = resource({ source: () => query.value, load });
    expect(load).not.toHaveBeenCalled();
    expect(results.state.value).toEqual({ status: 'idle' });
    const scope = createScope();
    scope.use(results);
    expect(load).toHaveBeenCalledTimes(1);
    expect(load.mock.calls[0]![0]).toBe('tea');
    expect(results.state.value).toEqual({ status: 'pending', key: 'tea', previous: undefined });
    await settle();
    expect(results.state.value).toEqual({
      status: 'success',
      key: 'tea',
      value: 'results for tea',
    });
    query.value = undefined;
    flush();
    expect(results.state.value).toEqual({ status: 'idle' });
    expect(load).toHaveBeenCalledTimes(1);
    scope.dispose();
  });

  it('aborts the previous generation for a new key; a late result never wins', async () => {
    const query = signal('a');
    const { calls, load } = controlledLoad<string, string>();
    const results = resource({ source: () => query.value, load });
    const scope = createScope();
    scope.use(results);
    query.value = 'b';
    flush();
    const [a, b] = calls;
    expect(a!.context.signal.aborted).toBe(true);
    expect((a!.context.signal.reason as DOMException).name).toBe('AbortError');
    expect(b!.context.signal.aborted).toBe(false);
    expect(b!.context.generation).toBeGreaterThan(a!.context.generation);
    expect(results.state.value).toMatchObject({ status: 'pending', key: 'b' });
    b!.deferred.resolve('B');
    await settle();
    a!.deferred.resolve('A'); // the superseded load finishes last, ignoring its signal
    await settle();
    expect(results.state.value).toEqual({ status: 'success', key: 'b', value: 'B' });
    scope.dispose();
  });

  it('ignores a superseded load that resolves first, even if it never looked at its signal', async () => {
    const query = signal('slow');
    const { calls, load } = controlledLoad<string, string>();
    const results = resource({ source: () => query.value, load });
    const scope = createScope();
    scope.use(results);
    query.value = 'fast';
    flush();
    calls[0]!.deferred.resolve('stale'); // resolves before the current load
    await settle();
    expect(results.state.value).toMatchObject({ status: 'pending', key: 'fast' });
    calls[1]!.deferred.resolve('fresh');
    await settle();
    expect(results.state.value).toEqual({ status: 'success', key: 'fast', value: 'fresh' });
    scope.dispose();
  });

  it('ignores a superseded load that fails after the current one succeeded', async () => {
    const query = signal('old');
    const { calls, load } = controlledLoad<string, string>();
    const results = resource({ source: () => query.value, load });
    const scope = createScope();
    scope.use(results);
    query.value = 'new';
    flush();
    calls[1]!.deferred.resolve('fresh');
    await settle();
    calls[0]!.deferred.reject(new Error('the old request failed late'));
    await settle();
    expect(results.state.value).toEqual({ status: 'success', key: 'new', value: 'fresh' });
    expect(reported).toEqual([]);
    scope.dispose();
  });

  it('discards a result whose owner was disposed while it was being parsed', async () => {
    const response = deferred<{ json(): Promise<string[]> }>();
    const parsed = deferred<string[]>();
    let parsing = false;
    const results = resource({
      source: () => 'q',
      load: async () => {
        const body = await response.promise;
        parsing = true;
        return body.json();
      },
    });
    const scope = createScope();
    scope.use(results);
    response.resolve({ json: () => parsed.promise });
    await settle();
    expect(parsing).toBe(true);
    scope.dispose();
    parsed.resolve(['too late']);
    await settle();
    expect(results.state.value).toEqual({ status: 'idle' });
    expect(reported).toEqual([]);
  });

  it('treats an abort as no error and a real failure as an error that keeps the previous value', async () => {
    const query = signal('a');
    const results = resource({
      source: () => query.value,
      load: (key: string, { signal: abort }) =>
        new Promise<string>((resolve, reject) => {
          if (key === 'broken') reject(new Error('500 from the server'));
          abort.addEventListener('abort', () => reject(abort.reason)); // cooperative, like fetch
          if (key === 'a') resolve('A');
        }),
    });
    const scope = createScope();
    scope.use(results);
    await settle();
    query.value = 'pending-forever';
    flush();
    query.value = 'broken'; // aborts 'pending-forever', which rejects with the abort reason
    flush();
    await settle();
    expect(results.state.value).toEqual({
      status: 'error',
      key: 'broken',
      error: new Error('500 from the server'),
      previous: { key: 'a', value: 'A' },
    });
    expect(reported).toEqual([]); // the aborted load's rejection is handled, not reported
    scope.dispose();
  });

  it('fails a slow load with a TimeoutError, distinct from a cancellation', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const { calls, load } = controlledLoad<string, string>();
    const results = resource({ source: () => 'q', load, timeout: 100 });
    const scope = createScope();
    scope.use(results);
    vi.advanceTimersByTime(99);
    expect(results.state.value.status).toBe('pending');
    vi.advanceTimersByTime(1);
    const state = results.state.value;
    expect(state.status).toBe('error');
    expect((state as { error: DOMException }).error.name).toBe('TimeoutError');
    expect((calls[0]!.context.signal.reason as DOMException).name).toBe('TimeoutError');
    calls[0]!.deferred.resolve('too late');
    await settle();
    expect(results.state.value.status).toBe('error');

    results.retry();
    results.cancel();
    expect((calls[1]!.context.signal.reason as DOMException).name).toBe('AbortError');
    expect(results.state.value.status).toBe('error'); // back to the state before the load
    scope.dispose();
  });

  it('cancel() returns to the state before the load; refresh() and retry() load again', async () => {
    const { calls, load } = controlledLoad<string, number>();
    const results = resource({ source: () => 'count', load });
    const scope = createScope();
    scope.use(results);
    calls[0]!.deferred.resolve(1);
    await settle();
    results.refresh();
    expect(results.state.value).toEqual({
      status: 'pending',
      key: 'count',
      previous: { key: 'count', value: 1 },
    });
    const reason = new Error('user pressed Escape');
    results.cancel(reason);
    expect(calls[1]!.context.signal.reason).toBe(reason);
    expect(results.state.value).toEqual({ status: 'success', key: 'count', value: 1 });
    results.cancel(); // nothing pending: no-op
    results.retry();
    calls[2]!.deferred.reject(new Error('flaky'));
    await settle();
    expect(results.state.value.status).toBe('error');
    results.retry();
    calls[3]!.deferred.resolve(2);
    await settle();
    expect(results.state.value).toEqual({ status: 'success', key: 'count', value: 2 });
    scope.dispose();
  });

  it('keeps the latest success while disconnected; reconnecting reloads unless it is fresh', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    const { calls, load } = controlledLoad<string, string>();
    const results = resource({ source: () => 'k', load, freshFor: 1000 });
    const first = createScope();
    first.use(results);
    calls[0]!.deferred.resolve('v1');
    await settle();
    first.dispose();
    expect(results.state.value).toEqual({ status: 'success', key: 'k', value: 'v1' });

    vi.advanceTimersByTime(500);
    const second = createScope();
    second.use(results);
    expect(calls).toHaveLength(1); // fresh: reused
    second.dispose();

    vi.advanceTimersByTime(600);
    const third = createScope();
    third.use(results);
    expect(calls).toHaveLength(2); // stale: reloaded, showing the previous value meanwhile
    expect(results.state.value).toEqual({
      status: 'pending',
      key: 'k',
      previous: { key: 'k', value: 'v1' },
    });
    third.dispose();

    const plain = resource({ source: () => 'k', load });
    const scope = createScope();
    scope.use(plain);
    calls.at(-1)!.deferred.resolve('x');
    await settle();
    scope.dispose();
    const again = createScope();
    again.use(plain);
    expect(calls.at(-1)!.context.signal.aborted).toBe(false); // default: reconnecting reloads
    expect(plain.state.value.status).toBe('pending');
    again.dispose();
  });

  it('aborts a pending load when its owner disconnects, with the owner reason', () => {
    const { calls, load } = controlledLoad<string, string>();
    const results = resource({ source: () => 'k', load });
    const scope = createScope();
    scope.use(results);
    const reason = new DOMException('<x-search> disconnected', 'AbortError');
    scope.dispose(reason);
    expect(calls[0]!.context.signal.reason).toBe(reason);
    expect(results.state.value).toEqual({ status: 'idle' });
  });

  it('gives each generation its own request scope, ended with it', async () => {
    const baseline = scopeStats();
    const query = signal('a');
    const ended: string[] = [];
    const { calls, load } = controlledLoad<string, string>();
    const results = resource({
      source: () => query.value,
      load: (key, context) => {
        context.scope.add(() => ended.push(key));
        context.scope.interval(() => {}, 1000);
        return load(key, context);
      },
    });
    const scope = createScope();
    scope.use(results);
    query.value = 'b';
    flush();
    expect(ended).toEqual(['a']); // superseded
    calls[1]!.deferred.resolve('B');
    await settle();
    expect(ended).toEqual(['a', 'b']); // settled
    query.value = 'c';
    flush();
    scope.dispose();
    expect(ended).toEqual(['a', 'b', 'c']); // disconnected
    expect(scopeStats()).toEqual(baseline);
  });

  it('keeps the current generation for an equal key', () => {
    const query = signal({ id: 1, label: 'one' });
    const { calls, load } = controlledLoad<{ id: number }, string>();
    const results = resource({ source: () => query.value, load, equals: (a, b) => a.id === b.id });
    const scope = createScope();
    scope.use(results);
    query.value = { id: 1, label: 'renamed' };
    flush();
    expect(calls).toHaveLength(1);
    query.value = { id: 2, label: 'two' };
    flush();
    expect(calls).toHaveLength(2);
    scope.dispose();
  });

  it('runs loads untracked; synchronous values and throws commit at once', () => {
    const query = signal('k');
    const unrelated = signal(0);
    let loads = 0;
    const results = resource({
      source: () => query.value,
      load: (key) => {
        loads++;
        void unrelated.value; // read during the load: not a dependency
        if (key === 'bad') throw new Error('sync failure');
        return key.toUpperCase();
      },
    });
    const scope = createScope();
    scope.use(results);
    expect(results.state.value).toEqual({ status: 'success', key: 'k', value: 'K' });
    unrelated.value = 1;
    flush();
    expect(loads).toBe(1);
    query.value = 'bad';
    flush();
    expect(results.state.value).toMatchObject({ status: 'error', key: 'bad' });

    // refresh() from inside an effect: what the load reads does not become the effect's dependency.
    query.value = 'k';
    flush();
    let effectRuns = 0;
    const stop = effect(() => {
      effectRuns++;
      results.refresh();
    });
    const before = loads;
    unrelated.value = 2;
    flush();
    expect(effectRuns).toBe(1);
    expect(loads).toBe(before);
    stop();
    scope.dispose();
  });

  it('ends for good with dispose()', () => {
    const { calls, load } = controlledLoad<string, string>();
    const results = resource({ source: () => 'k', load });
    const scope = createScope();
    scope.use(results);
    results.dispose();
    results.dispose();
    expect(calls[0]!.context.signal.aborted).toBe(true);
    results.refresh();
    const again = createScope();
    again.use(results);
    expect(calls).toHaveLength(1);
    scope.dispose();
    again.dispose();
  });

  it('rejects an unusable timeout', () => {
    expect(() => resource({ source: () => 1, load: () => 1, timeout: -1 })).toThrow(
      expect.objectContaining({ code: 'app.resource.options' }),
    );
  });
});
