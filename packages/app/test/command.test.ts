import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { OddkinError, setErrorHandler, type ErrorContext } from '@oddkin/core/diagnostics';
import { effect, flush, signal } from '@oddkin/core/reactive';
import { createScope, scopeStats } from '@oddkin/core/scope';
import { command, type CommandOptions, type RunContext } from '../src/command/index.js';

// Commands (core-contracts.md §8): explicit mutations with owned pending/error/result state,
// cancellation that is not a rollback, an explicit retry policy, and a concurrency policy.

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

/** A run whose attempts can be settled from the test, one deferred per attempt. */
function controlledRun<I, R>() {
  const calls: { input: I; context: RunContext; deferred: Deferred<R> }[] = [];
  const run = (input: I, context: RunContext) => {
    const call = { input, context, deferred: deferred<R>() };
    calls.push(call);
    return call.deferred.promise;
  };
  return { calls, run };
}

const settle = async () => {
  for (let i = 0; i < 5; i++) await Promise.resolve();
  flush();
};

const codeOf = (fn: () => unknown): string | undefined => {
  try {
    fn();
  } catch (error) {
    return error instanceof OddkinError ? error.code : `not an OddkinError: ${String(error)}`;
  }
  return undefined;
};

class Unavailable extends Error {
  override name = 'Unavailable';
}

let reported: { error: unknown; context: ErrorContext }[];
beforeEach(() => {
  reported = [];
  setErrorHandler((error, context) => reported.push({ error, context }));
});
afterEach(() => {
  flush();
  vi.useRealTimers();
  setErrorHandler(undefined);
});

describe('command', () => {
  it('runs only while connected, synchronously, and owns its pending and result state', async () => {
    const baseline = scopeStats().scopes;
    const { calls, run } = controlledRun<string, number>();
    const save = command({ name: 'save', run });
    expect(save.state.value).toEqual({ status: 'idle' });
    expect(codeOf(() => save.run('draft'))).toBe('app.command.disconnected');
    expect(calls).toHaveLength(0);

    const owner = createScope();
    owner.use(save);
    const outcome = save.run('draft');
    expect(calls).toHaveLength(1); // started before run() returned
    expect(calls[0]!.input).toBe('draft');
    expect(calls[0]!.context.attempt).toBe(1);
    expect(save.state.value).toEqual({
      status: 'pending',
      input: 'draft',
      attempt: 1,
      error: undefined,
    });
    calls[0]!.deferred.resolve(7);
    expect(await outcome).toEqual({ status: 'success', value: 7 });
    expect(save.state.value).toEqual({ status: 'success', input: 'draft', value: 7 });
    expect(calls[0]!.context.scope.disposed).toBe(true); // the attempt's scope ended with it
    owner.dispose();
    expect(scopeStats().scopes).toBe(baseline);
    expect(save.state.value.status).toBe('success'); // the result outlives the owner
    expect(reported).toEqual([]);
  });

  it('settles synchronous values and throws without rejecting', async () => {
    const owner = createScope();
    const failure = new Error('refused');
    const sync = command({ run: (n: number) => n * 2 });
    const throwing = command({
      run: (_: number): number => {
        throw failure;
      },
    });
    owner.use(sync);
    owner.use(throwing);
    const doubled = sync.run(21);
    expect(sync.state.value).toEqual({ status: 'success', input: 21, value: 42 });
    expect(await doubled).toEqual({ status: 'success', value: 42 });
    const thrown = throwing.run(1);
    expect(throwing.state.value).toEqual({
      status: 'error',
      input: 1,
      error: failure,
      attempts: 1,
    });
    expect(await thrown).toEqual({ status: 'error', error: failure });
    owner.dispose();
    expect(reported).toEqual([]);
  });

  it('keeps a failure visible, aborts its attempt with it, and does not retry by default', async () => {
    const { calls, run } = controlledRun<string, string>();
    const save = command({ run });
    const owner = createScope();
    owner.use(save);
    const outcome = save.run('x');
    const failure = new Error('500');
    calls[0]!.deferred.reject(failure);
    expect(await outcome).toEqual({ status: 'error', error: failure });
    expect(save.state.value).toEqual({ status: 'error', input: 'x', error: failure, attempts: 1 });
    expect(calls[0]!.context.signal.reason).toBe(failure);
    await settle();
    expect(calls).toHaveLength(1);
    owner.dispose();
    expect(reported).toEqual([]);
  });

  it('cancel() stops waiting without a rollback: cancelled, never idle, late results ignored', async () => {
    const { calls, run } = controlledRun<string, string>();
    const save = command({ name: 'save', run });
    const owner = createScope();
    owner.use(save);
    const first = save.run('a');
    save.cancel();
    const cancelled = save.state.value;
    expect(cancelled.status).toBe('cancelled');
    expect(cancelled.status === 'cancelled' && cancelled.input).toBe('a');
    const reason = cancelled.status === 'cancelled' ? cancelled.reason : undefined;
    expect(reason).toBeInstanceOf(DOMException);
    expect((reason as DOMException).name).toBe('AbortError');
    expect((reason as DOMException).message).toContain('command "save" cancelled');
    expect(calls[0]!.context.signal.reason).toBe(reason);
    expect(await first).toEqual({ status: 'cancelled', reason });
    calls[0]!.deferred.resolve('applied after all'); // the server finished anyway: still ignored
    await settle();
    expect(save.state.value).toBe(cancelled);

    const custom = new Error('user pressed stop');
    const second = save.run('b');
    save.cancel(custom);
    calls[1]!.deferred.reject(new Error('late failure')); // a late rejection is no error either
    expect(await second).toEqual({ status: 'cancelled', reason: custom });
    expect(calls[1]!.context.signal.reason).toBe(custom);
    await settle();
    expect(save.state.value).toEqual({ status: 'cancelled', input: 'b', reason: custom });
    save.cancel(); // nothing pending: no-op
    expect(save.state.value).toEqual({ status: 'cancelled', input: 'b', reason: custom });
    owner.dispose();
    expect(reported).toEqual([]);
  });

  it("the owner's end cancels the pending run with its reason; reconnection allows runs again", async () => {
    const { calls, run } = controlledRun<string, string>();
    const save = command({ run });
    const first = createScope();
    first.use(save);
    const outcome = save.run('a');
    const reason = new Error('<demo-form> disconnected');
    first.dispose(reason);
    expect(await outcome).toEqual({ status: 'cancelled', reason });
    expect(calls[0]!.context.signal.reason).toBe(reason);
    expect(save.state.value).toEqual({ status: 'cancelled', input: 'a', reason });
    expect(codeOf(() => save.run('b'))).toBe('app.command.disconnected');

    const second = createScope();
    second.use(save);
    expect(save.state.value.status).toBe('cancelled'); // reconnection keeps the last state
    const again = save.run('b');
    calls[1]!.deferred.resolve('ok');
    expect(await again).toEqual({ status: 'success', value: 'ok' });
    second.dispose();
  });

  it('connecting elsewhere cancels the pending run; the old owner no longer matters', async () => {
    const { calls, run } = controlledRun<string, string>();
    const save = command({ run });
    const a = createScope();
    const b = createScope();
    a.use(save);
    const outcome = save.run('x');
    b.use(save);
    const result = await outcome;
    expect(result.status).toBe('cancelled');
    expect(result.status === 'cancelled' && (result.reason as DOMException).message).toContain(
      'connected elsewhere',
    );
    a.dispose();
    const next = save.run('y'); // still connected to b
    calls[1]!.deferred.resolve('done');
    expect(await next).toEqual({ status: 'success', value: 'done' });
    b.dispose();
    expect(codeOf(() => save.run('z'))).toBe('app.command.disconnected');
  });

  it('exclusive (default): a run while another is pending starts nothing and resolves dropped', async () => {
    const { calls, run } = controlledRun<string, string>();
    const save = command({ run });
    const owner = createScope();
    owner.use(save);
    const first = save.run('a');
    expect(await save.run('b')).toEqual({ status: 'dropped' });
    expect(calls).toHaveLength(1);
    expect(save.state.value).toMatchObject({ status: 'pending', input: 'a' });
    calls[0]!.deferred.resolve('A');
    expect(await first).toEqual({ status: 'success', value: 'A' });
    owner.dispose();
  });

  it('queue: runs wait their turn in call order', async () => {
    const { calls, run } = controlledRun<string, string>();
    const save = command({ run, concurrency: 'queue' });
    const owner = createScope();
    owner.use(save);
    const a = save.run('a');
    const b = save.run('b');
    const c = save.run('c');
    expect(calls.map((call) => call.input)).toEqual(['a']);
    calls[0]!.deferred.resolve('A');
    expect(await a).toEqual({ status: 'success', value: 'A' });
    expect(calls.map((call) => call.input)).toEqual(['a', 'b']);
    expect(save.state.value).toMatchObject({ status: 'pending', input: 'b', attempt: 1 });
    calls[1]!.deferred.reject(new Error('b failed'));
    expect((await b).status).toBe('error');
    expect(calls.map((call) => call.input)).toEqual(['a', 'b', 'c']); // a failure does not stop the queue
    calls[2]!.deferred.resolve('C');
    expect(await c).toEqual({ status: 'success', value: 'C' });
    expect(save.state.value).toEqual({ status: 'success', input: 'c', value: 'C' });
    owner.dispose();
  });

  it('latest: only the latest waiting input runs next; the ones it replaces are dropped', async () => {
    const { calls, run } = controlledRun<string, string>();
    const save = command({ run, concurrency: 'latest' });
    const owner = createScope();
    owner.use(save);
    const a = save.run('a');
    const b = save.run('b');
    const c = save.run('c');
    expect(await b).toEqual({ status: 'dropped' });
    expect(calls.map((call) => call.input)).toEqual(['a']); // the running one is never aborted
    calls[0]!.deferred.resolve('A');
    expect(await a).toEqual({ status: 'success', value: 'A' });
    expect(calls.map((call) => call.input)).toEqual(['a', 'c']);
    calls[1]!.deferred.resolve('C');
    expect(await c).toEqual({ status: 'success', value: 'C' });
    owner.dispose();
  });

  it('cancel() and disconnection drop waiting runs, which never start', async () => {
    const { calls, run } = controlledRun<string, string>();
    const save = command({ run, concurrency: 'queue' });
    const owner = createScope();
    owner.use(save);
    const a = save.run('a');
    const b = save.run('b');
    save.cancel();
    expect((await a).status).toBe('cancelled');
    expect(await b).toEqual({ status: 'dropped' });
    const c = save.run('c');
    const d = save.run('d');
    owner.dispose();
    expect((await c).status).toBe('cancelled');
    expect(await d).toEqual({ status: 'dropped' });
    await settle();
    expect(calls.map((call) => call.input)).toEqual(['a', 'c']);
  });

  it('retries only failures its policy names, up to its limit', async () => {
    const { calls, run } = controlledRun<string, string>();
    const when = vi.fn((error: unknown) => error instanceof Unavailable);
    const save = command({ run, retry: { retries: 2, when } });
    const owner = createScope();
    owner.use(save);

    // Retried until it succeeds.
    const ok = save.run('a');
    const first = new Unavailable('503');
    calls[0]!.deferred.reject(first);
    await settle();
    expect(when).toHaveBeenLastCalledWith(first, 1);
    expect(calls).toHaveLength(2);
    expect(calls[1]!.context.attempt).toBe(2);
    expect(calls[0]!.context.signal.reason).toBe(first);
    expect(save.state.value).toEqual({ status: 'pending', input: 'a', attempt: 2, error: first });
    calls[1]!.deferred.reject(new Unavailable('503 again'));
    await settle();
    expect(calls).toHaveLength(3);
    calls[2]!.deferred.resolve('A');
    expect(await ok).toEqual({ status: 'success', value: 'A' });

    // A failure the policy does not name is not retried.
    const refused = save.run('b');
    const conflict = new Error('409');
    calls[3]!.deferred.reject(conflict);
    expect(await refused).toEqual({ status: 'error', error: conflict });
    expect(save.state.value).toEqual({ status: 'error', input: 'b', error: conflict, attempts: 1 });

    // The limit: retries + 1 attempts at most, and `when` is not asked after the last one.
    when.mockClear();
    const exhausted = save.run('c');
    for (let i = 4; i < 7; i++) {
      calls[i]!.deferred.reject(new Unavailable(`503 #${i}`));
      await settle();
    }
    expect(calls).toHaveLength(7);
    expect(when).toHaveBeenCalledTimes(2);
    const result = await exhausted;
    expect(result.status).toBe('error');
    expect(save.state.value).toMatchObject({ status: 'error', input: 'c', attempts: 3 });
    owner.dispose();
    expect(reported).toEqual([]);
  });

  it('waits the policy delay between attempts; cancelling during the wait starts nothing', async () => {
    vi.useFakeTimers();
    const baseline = scopeStats();
    const { calls, run } = controlledRun<string, string>();
    const delay = vi.fn((attempt: number) => 100 * 2 ** (attempt - 1));
    const save = command({ run, retry: { retries: 3, when: () => true, delay } });
    const owner = createScope();
    owner.use(save);
    const outcome = save.run('a');
    const failure = new Unavailable('503');
    calls[0]!.deferred.reject(failure);
    await settle();
    expect(delay).toHaveBeenLastCalledWith(1, failure);
    expect(calls).toHaveLength(1);
    expect(save.state.value).toEqual({ status: 'pending', input: 'a', attempt: 2, error: failure });
    vi.advanceTimersByTime(99);
    expect(calls).toHaveLength(1);
    vi.advanceTimersByTime(1);
    expect(calls).toHaveLength(2);
    calls[1]!.deferred.reject(failure);
    await settle();
    expect(delay).toHaveBeenLastCalledWith(2, failure);
    save.cancel();
    expect((await outcome).status).toBe('cancelled');
    vi.advanceTimersByTime(1000);
    expect(calls).toHaveLength(2);
    owner.dispose();
    expect(scopeStats()).toEqual(baseline); // no timer or scope left behind

    // A fixed delay.
    const fixed = command({ run, retry: { retries: 1, when: () => true, delay: 50 } });
    const again = createScope();
    again.use(fixed);
    const fixedOutcome = fixed.run('b');
    calls[2]!.deferred.reject(failure);
    await settle();
    vi.advanceTimersByTime(49);
    expect(calls).toHaveLength(3);
    vi.advanceTimersByTime(1);
    expect(calls).toHaveLength(4);
    calls[3]!.deferred.resolve('B');
    expect(await fixedOutcome).toEqual({ status: 'success', value: 'B' });
    again.dispose();
  });

  it('a throwing or invalid retry policy is reported and the run fails with its own error', async () => {
    const { calls, run } = controlledRun<string, string>();
    const policyBug = new Error('policy bug');
    const owner = createScope();
    const throwingWhen = command({
      name: 'save',
      run,
      retry: {
        retries: 2,
        when: () => {
          throw policyBug;
        },
      },
    });
    owner.use(throwingWhen);
    const first = throwingWhen.run('a');
    const failure = new Unavailable('503');
    calls[0]!.deferred.reject(failure);
    expect(await first).toEqual({ status: 'error', error: failure });
    expect(reported).toEqual([
      { error: policyBug, context: { code: 'app.command.retry', origin: 'command "save"' } },
    ]);

    reported = [];
    const badDelay = command({ run, retry: { retries: 2, when: () => true, delay: () => -1 } });
    owner.use(badDelay);
    const second = badDelay.run('b');
    calls[1]!.deferred.reject(failure);
    expect(await second).toEqual({ status: 'error', error: failure });
    expect(reported).toHaveLength(1);
    expect(reported[0]!.context.code).toBe('app.command.retry');
    expect((reported[0]!.error as OddkinError).code).toBe('app.command.retry');
    expect(calls).toHaveLength(2);
    owner.dispose();
  });

  it('times out an attempt with a TimeoutError, which a policy may retry', async () => {
    vi.useFakeTimers();
    const { calls, run } = controlledRun<string, string>();
    const save = command({ name: 'save', run, timeout: 1000 });
    const owner = createScope();
    owner.use(save);
    const outcome = save.run('a');
    vi.advanceTimersByTime(1000);
    const result = await outcome;
    expect(result.status).toBe('error');
    const error = result.status === 'error' ? (result.error as DOMException) : undefined;
    expect(error?.name).toBe('TimeoutError');
    expect(error?.message).toContain('command "save" timed out after 1000 ms');
    expect(calls[0]!.context.signal.reason).toBe(error);
    calls[0]!.deferred.resolve('too late');
    await settle();
    expect(save.state.value).toMatchObject({ status: 'error', error });

    const retried = command({
      run,
      timeout: 1000,
      retry: { retries: 1, when: (e) => (e as DOMException).name === 'TimeoutError' },
    });
    owner.use(retried);
    const second = retried.run('b');
    vi.advanceTimersByTime(1000);
    await settle();
    expect(calls).toHaveLength(3);
    calls[2]!.deferred.resolve('B');
    expect(await second).toEqual({ status: 'success', value: 'B' });
    owner.dispose();
  });

  it('reset() clears a settled state, and does nothing while a run is pending', async () => {
    const { calls, run } = controlledRun<string, string>();
    const save = command({ run });
    const owner = createScope();
    owner.use(save);
    const outcome = save.run('a');
    save.reset();
    expect(save.state.value.status).toBe('pending');
    calls[0]!.deferred.resolve('A');
    await outcome;
    save.reset();
    expect(save.state.value).toEqual({ status: 'idle' });
    owner.dispose();
  });

  it('dispose() cancels, disconnects for good, and is idempotent', async () => {
    const { calls, run } = controlledRun<string, string>();
    const save = command({ name: 'save', run });
    const owner = createScope();
    owner.use(save);
    const outcome = save.run('a');
    save.dispose();
    const result = await outcome;
    expect(result.status === 'cancelled' && (result.reason as DOMException).message).toContain(
      'command "save" disposed',
    );
    expect(calls[0]!.context.signal.aborted).toBe(true);
    save.dispose();
    owner.use(save);
    expect(codeOf(() => save.run('b'))).toBe('app.command.disconnected');
    owner.dispose();
  });

  it('runs untracked; the state is a tracked readable; reentrant calls are safe', async () => {
    const owner = createScope();
    const outside = signal(1);
    const save = command({ run: (n: number) => n + outside.value });
    owner.use(save);
    const statuses: string[] = [];
    const runs = vi.fn();
    const stop = effect(() => {
      statuses.push(save.state.value.status);
    });
    const runner = effect(() => {
      runs();
      void save.run(1); // reads `outside` inside run(): must not subscribe this effect
    });
    flush();
    outside.value = 2;
    flush();
    expect(runs).toHaveBeenCalledTimes(1);
    expect(statuses).toEqual(['idle', 'success']);
    stop();
    runner();

    // run() calling cancel() on its own command, and run() inside run(), are well defined.
    let selfCancelled: Promise<unknown> | undefined;
    const self = command({
      run: (n: number): number => {
        selfCancelled = self.run(n + 1); // exclusive: dropped
        self.cancel();
        return n;
      },
    });
    owner.use(self);
    const outcome = await self.run(1);
    expect(outcome.status).toBe('cancelled');
    expect(await selfCancelled).toEqual({ status: 'dropped' });
    expect(self.state.value.status).toBe('cancelled');
    owner.dispose();
    expect(reported).toEqual([]);
  });

  it('rejects invalid options with app.command.options', () => {
    const run = () => 1;
    const invalid: Partial<CommandOptions<void, number>>[] = [
      {},
      { run, timeout: -1 },
      { run, timeout: Number.NaN },
      { run, concurrency: 'parallel' as never },
      { run, retry: { retries: -1, when: () => true } },
      { run, retry: { retries: 1.5, when: () => true } },
      { run, retry: { retries: 1 } as never },
      { run, retry: { retries: 1, when: () => true, delay: -5 } },
    ];
    for (const options of invalid) {
      expect(codeOf(() => command(options as CommandOptions<void, number>))).toBe(
        'app.command.options',
      );
    }
    expect(codeOf(() => command({ run, timeout: 0, concurrency: 'queue' }))).toBeUndefined();
  });
});
