/**
 * Commands (core-contracts.md §8): explicit mutations. A command runs only when asked; its pending,
 * error, and result state belongs to the command, and its runs to the scope it is connected to.
 * Cancelling a run, or the end of its owner, aborts the client's work and stops waiting for it; it
 * undoes nothing the server may already have done, so the state says `cancelled`, never `idle`.
 * Failures are retried only under an explicit `retry` policy whose `when` decides which failures
 * are safe to repeat. One run at a time by default; a running mutation is never aborted to start
 * another. DOM-free.
 */
import { DEV } from '../internal/dev.js';
import { OddkinError, reportOddkinError } from '@oddkin/core/diagnostics';
import { computed, signal, untracked, type Readable } from '@oddkin/core/reactive';
import { createScope, type Controller, type Scope } from '@oddkin/core/scope';

/** One discriminated state, owned by the command; it survives disconnection until `reset()`. */
export type CommandState<I, R> =
  | { readonly status: 'idle' }
  | {
      readonly status: 'pending';
      readonly input: I;
      /** The attempt in flight, or about to start after a retry delay; the first is 1. */
      readonly attempt: number;
      /** The failure being retried, or `undefined` on the first attempt. */
      readonly error: unknown;
    }
  | { readonly status: 'success'; readonly input: I; readonly value: R }
  | {
      readonly status: 'error';
      readonly input: I;
      readonly error: unknown;
      /** How many attempts were made. */
      readonly attempts: number;
    }
  | {
      /** The run started and the client stopped waiting: its effect on the server is unknown. */
      readonly status: 'cancelled';
      readonly input: I;
      readonly reason: unknown;
    };

/** How one `run()` ended. Never a rejection. */
export type CommandOutcome<R> =
  | { readonly status: 'success'; readonly value: R }
  | { readonly status: 'error'; readonly error: unknown }
  /** Started, then cancelled: nothing was rolled back, and the server may have applied it. */
  | { readonly status: 'cancelled'; readonly reason: unknown }
  /** Never started: refused while another run was pending, replaced, or cancelled while waiting. */
  | { readonly status: 'dropped' };

/** What each attempt receives. Everything registered on `scope` ends with the attempt. */
export interface RunContext {
  /**
   * Aborted when the attempt ends, whatever its outcome: with the cancellation's or the owner's
   * reason, a `TimeoutError`, or the attempt's own failure.
   */
  readonly signal: AbortSignal;
  /** The attempt's own scope. */
  readonly scope: Scope;
  /** 1 for the first attempt, then 2, 3, … for retries. */
  readonly attempt: number;
}

/**
 * Retrying a mutation can apply it twice, so a policy names the failures that are safe to repeat
 * (for example a 503 from a server that deduplicates on an idempotency key).
 */
export interface RetryPolicy {
  /** How many times a failed run may be retried: at most `retries + 1` attempts in total. */
  retries: number;
  /** Whether this failure may be retried. Called after each failed attempt that has retries left. */
  when: (error: unknown, attempt: number) => boolean;
  /** Milliseconds before the next attempt, or a function of the failed attempt. Default 0. */
  delay?: number | ((attempt: number, error: unknown) => number);
}

/**
 * What `run()` does while another run is pending. `exclusive` (default): nothing starts and the
 * call resolves `dropped`. `queue`: each run waits its turn, in call order. `latest`: like `queue`,
 * but only the latest waiting input is kept; the ones it replaces resolve `dropped`.
 */
export type CommandConcurrency = 'exclusive' | 'queue' | 'latest';

export interface CommandOptions<I, R> {
  /** Perform the mutation. Runs untracked; may return a value or a promise. */
  run: (input: I, context: RunContext) => R | PromiseLike<R>;
  /** Retry failures that `when` says are safe to repeat. Default: no retries. */
  retry?: RetryPolicy;
  /** Fail an attempt that takes longer than this many milliseconds, with a `TimeoutError`. */
  timeout?: number;
  /** What `run()` does while another run is pending. Default `exclusive`. */
  concurrency?: CommandConcurrency;
  /** Name used in abort reasons and diagnostics. */
  name?: string;
}

export interface Command<I, R> extends Controller {
  /** The latest run's state, as a read-only readable. */
  readonly state: Readable<CommandState<I, R>>;
  /**
   * Start a run with `input`, synchronously when nothing else is pending (so it keeps the caller's
   * user activation). Resolves with the run's outcome; never rejects. Throws
   * `app.command.disconnected` unless the command is connected (`scope.use(command)`).
   */
  run(input: I): Promise<CommandOutcome<R>>;
  /**
   * Stop waiting for the pending run (its signal is aborted with `reason`, by default an
   * `AbortError`) and drop the waiting ones. The state becomes `cancelled`; nothing is rolled back.
   */
  cancel(reason?: unknown): void;
  /** Return a settled state to `idle`. Does nothing while a run is pending: cancel it first. */
  reset(): void;
  /** Cancel, disconnect, and refuse later connections. Idempotent. */
  dispose(): void;
}

interface Run<I, R> {
  readonly input: I;
  readonly resolve: (outcome: CommandOutcome<R>) => void;
  attempt: number;
  /** The scope of the attempt in flight, or of the wait before the next attempt. */
  scope: Scope | undefined;
}

const IDLE = Object.freeze({ status: 'idle' as const });
const DROPPED = Object.freeze({ status: 'dropped' as const });

const isPromiseLike = (value: unknown): value is PromiseLike<unknown> =>
  (typeof value === 'object' || typeof value === 'function') &&
  value !== null &&
  typeof (value as { then?: unknown }).then === 'function';

class CommandImpl<I, R> implements Command<I, R> {
  readonly state: Readable<CommandState<I, R>>;
  readonly #options: CommandOptions<I, R>;
  readonly #state = signal<CommandState<I, R>>(IDLE);
  #owner: Scope | undefined;
  #active: Run<I, R> | undefined;
  #waiting: Run<I, R>[] = [];
  #disposed = false;

  constructor(options: CommandOptions<I, R>) {
    this.#options = options;
    this.state = computed(() => this.#state.value);
  }

  connect(scope: Scope): void {
    if (this.#disposed || scope.disposed) return;
    this.#release(new DOMException(`${this.#label()} connected elsewhere`, 'AbortError'));
    this.#owner = scope;
    scope.add(() => {
      if (this.#owner === scope) this.#release(scope.signal.reason);
    }, 'command');
  }

  run(input: I): Promise<CommandOutcome<R>> {
    if (!this.#owner) {
      throw new OddkinError(
        'app.command.disconnected',
        DEV
          ? `${this.#label()} cannot run while ${this.#disposed ? 'disposed' : 'disconnected'}: its runs belong to the scope it is connected to. Connect it with scope.use(command) first.`
          : '',
      );
    }
    return new Promise<CommandOutcome<R>>((resolve) => {
      const run: Run<I, R> = { input, resolve, attempt: 0, scope: undefined };
      if (!this.#active) {
        this.#active = run;
        this.#attempt(run, undefined);
        return;
      }
      const concurrency = this.#options.concurrency ?? 'exclusive';
      if (concurrency === 'exclusive') {
        resolve(DROPPED);
        return;
      }
      if (concurrency === 'latest') this.#drop(this.#waiting.splice(0));
      this.#waiting.push(run);
    });
  }

  cancel(reason?: unknown): void {
    if (!this.#active) return;
    this.#stop(reason ?? new DOMException(`${this.#label()} cancelled`, 'AbortError'));
  }

  reset(): void {
    if (this.#active) return;
    this.#state.value = IDLE;
  }

  dispose(): void {
    if (this.#disposed) return;
    this.#release(new DOMException(`${this.#label()} disposed`, 'AbortError'));
    this.#disposed = true;
  }

  #label(): string {
    return this.#options.name ? `command "${this.#options.name}"` : 'command';
  }

  #attempt(run: Run<I, R>, previousError: unknown): void {
    const attempt = ++run.attempt;
    const scope = createScope({ name: this.#label() });
    run.scope = scope;
    this.#state.value = { status: 'pending', input: run.input, attempt, error: previousError };
    const timeout = this.#options.timeout;
    if (timeout !== undefined) {
      scope.timeout(
        () =>
          this.#failed(
            run,
            scope,
            new DOMException(`${this.#label()} timed out after ${timeout} ms`, 'TimeoutError'),
          ),
        timeout,
      );
    }
    let result: R | PromiseLike<R>;
    try {
      result = untracked(() =>
        this.#options.run(run.input, { signal: scope.signal, scope, attempt }),
      );
    } catch (error) {
      this.#failed(run, scope, error);
      return;
    }
    if (isPromiseLike(result)) {
      // Both handlers at once: a rejection after cancellation is handled, never unhandled.
      Promise.resolve(result).then(
        (value) => this.#succeeded(run, scope, value),
        (error: unknown) => this.#failed(run, scope, error),
      );
    } else {
      this.#succeeded(run, scope, result);
    }
  }

  /** Whether `scope` is still the active run's current attempt or wait. */
  #current(run: Run<I, R>, scope: Scope): boolean {
    return this.#active === run && run.scope === scope;
  }

  #succeeded(run: Run<I, R>, scope: Scope, value: R): void {
    if (!this.#current(run, scope)) return; // cancelled, timed out, or its owner ended
    run.scope = undefined;
    scope.dispose();
    this.#settle(run, { status: 'success', input: run.input, value }, { status: 'success', value });
  }

  #failed(run: Run<I, R>, scope: Scope, error: unknown): void {
    if (!this.#current(run, scope)) return;
    run.scope = undefined;
    scope.dispose(error);
    const delay = this.#retryDelay(run, error);
    if (delay === undefined) {
      this.#settle(
        run,
        { status: 'error', input: run.input, error, attempts: run.attempt },
        { status: 'error', error },
      );
    } else if (delay === 0) {
      this.#attempt(run, error);
    } else {
      const wait = createScope({ name: this.#label() });
      run.scope = wait;
      this.#state.value = { status: 'pending', input: run.input, attempt: run.attempt + 1, error };
      wait.timeout(() => {
        if (!this.#current(run, wait)) return;
        run.scope = undefined;
        wait.dispose();
        this.#attempt(run, error);
      }, delay);
    }
  }

  /** The delay before retrying `error`, or `undefined` when the policy does not retry it. */
  #retryDelay(run: Run<I, R>, error: unknown): number | undefined {
    const retry = this.#options.retry;
    if (!retry || run.attempt > retry.retries) return undefined;
    let delay: unknown;
    try {
      if (!retry.when(error, run.attempt)) return undefined;
      delay = typeof retry.delay === 'function' ? retry.delay(run.attempt, error) : retry.delay;
    } catch (policyError) {
      reportOddkinError(policyError, { code: 'app.command.retry', origin: this.#label() });
      return undefined;
    }
    if (delay === undefined) return 0;
    if (typeof delay === 'number' && delay >= 0 && delay < Infinity) return delay;
    reportOddkinError(
      new OddkinError(
        'app.command.retry',
        DEV
          ? `${this.#label()} retry delay must be a number of milliseconds of 0 or more, not ${String(delay)}; the run fails with its error instead of retrying.`
          : '',
      ),
      { code: 'app.command.retry', origin: this.#label() },
    );
    return undefined;
  }

  #settle(run: Run<I, R>, state: CommandState<I, R>, outcome: CommandOutcome<R>): void {
    this.#active = undefined;
    this.#state.value = state;
    run.resolve(outcome);
    const next = this.#waiting.shift();
    if (next) {
      this.#active = next;
      this.#attempt(next, undefined);
    }
  }

  /** Abort the active run (state `cancelled`) and drop the waiting ones. */
  #stop(reason: unknown): void {
    const waiting = this.#waiting.splice(0);
    const run = this.#active;
    if (run) {
      this.#active = undefined;
      const scope = run.scope;
      run.scope = undefined;
      scope?.dispose(reason);
      this.#state.value = { status: 'cancelled', input: run.input, reason };
      run.resolve({ status: 'cancelled', reason });
    }
    this.#drop(waiting);
  }

  #drop(runs: readonly Run<I, R>[]): void {
    for (const run of runs) run.resolve(DROPPED);
  }

  #release(reason: unknown): void {
    if (!this.#owner) return;
    this.#owner = undefined;
    this.#stop(reason);
  }
}

const optionsError = (message: string): OddkinError =>
  new OddkinError('app.command.options', message);

/**
 * A command: an explicit mutation run by `command.run(input)` while the command is connected
 * (`scope.use(command)`). Nothing runs before that, and nothing is retried unless `retry` says so.
 */
export function command<I = void, R = unknown>(options: CommandOptions<I, R>): Command<I, R> {
  const { retry, timeout, concurrency } = options;
  if (typeof options.run !== 'function') {
    throw optionsError(DEV ? 'command() needs a run(input, context) function.' : '');
  }
  if (timeout !== undefined && !(Number.isFinite(timeout) && timeout >= 0)) {
    throw optionsError(
      DEV
        ? `command() timeout must be a number of milliseconds of 0 or more, not ${String(timeout)}.`
        : '',
    );
  }
  if (
    concurrency !== undefined &&
    concurrency !== 'exclusive' &&
    concurrency !== 'queue' &&
    concurrency !== 'latest'
  ) {
    throw optionsError(
      DEV
        ? `command() concurrency must be "exclusive", "queue", or "latest", not ${String(concurrency)}.`
        : '',
    );
  }
  if (retry !== undefined) {
    if (!(Number.isInteger(retry.retries) && retry.retries >= 0)) {
      throw optionsError(
        DEV
          ? `command() retry.retries must be a whole number of 0 or more, not ${String(retry.retries)}.`
          : '',
      );
    }
    if (typeof retry.when !== 'function') {
      throw optionsError(
        DEV
          ? 'command() retry needs a when(error, attempt) function: retrying a mutation can apply it twice, so the policy must say which failures are safe to repeat.'
          : '',
      );
    }
    const delay = retry.delay;
    if (
      delay !== undefined &&
      typeof delay !== 'function' &&
      !(Number.isFinite(delay) && delay >= 0)
    ) {
      throw optionsError(
        DEV
          ? `command() retry.delay must be a number of milliseconds of 0 or more or a function, not ${String(delay)}.`
          : '',
      );
    }
  }
  return new CommandImpl(options);
}
