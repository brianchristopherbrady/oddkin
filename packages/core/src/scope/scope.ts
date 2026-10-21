/**
 * `Scope` — one ownership primitive for listeners, timers, effects, controllers, and
 * child lifetimes (ADR 0004). DOM-free: it uses only `EventTarget`, timers, and
 * `AbortController`, which exist in browsers and Node.
 * Contract: docs/architecture/core-contracts.md §4.
 */
import { DEV } from '../internal/dev.js';
import { OddkinError, reportOddkinError } from '../diagnostics/index.js';
import { effect as reactiveEffect, type EffectOptions } from '../reactive/graph.js';

export type Cleanup = () => void;
export type Release = () => void;

/** A reusable behavior that registers its own cleanup on the scope it is given. */
export interface Controller {
  connect(scope: Scope): void;
}

export type ScopedEffect = (scope: Scope) => void | Cleanup;

export interface ScopeOptions {
  /** Name used in diagnostics. */
  name?: string | undefined;
}

interface Entry {
  run: Cleanup;
  label: string;
}

const stats = { scopes: 0, listeners: 0, timers: 0, effects: 0 };

/**
 * Live counts of resources owned through scopes (scopes, listeners, timers, effects), in both
 * builds. Compare before and after mount/remove cycles to check that ownership returns to baseline.
 */
export function scopeStats(): Readonly<typeof stats> {
  return { ...stats };
}

export class Scope {
  readonly name: string | undefined;
  #entries = new Set<Entry>();
  #controller: AbortController | undefined;
  #disposed = false;
  #reason: unknown;

  constructor(options?: ScopeOptions) {
    this.name = options?.name;
    stats.scopes++;
  }

  /** True once `dispose()` has started. Setup on a disposed scope does nothing. */
  get disposed(): boolean {
    return this.#disposed;
  }

  /** An `AbortSignal` aborted with the disposal reason. Allocated on first access. */
  get signal(): AbortSignal {
    this.#controller ??= new AbortController();
    if (this.#disposed && !this.#controller.signal.aborted) this.#controller.abort(this.#reason);
    return this.#controller.signal;
  }

  /**
   * Register a cleanup. Returns a release function that runs it at most once and
   * drops it from the scope. On a disposed scope the cleanup runs immediately.
   */
  add(cleanup: Cleanup, label = 'cleanup'): Release {
    const entry: Entry = { run: cleanup, label };
    if (this.#disposed) {
      this.#runEntry(entry);
      return () => {};
    }
    this.#entries.add(entry);
    return () => {
      if (this.#entries.delete(entry)) this.#runEntry(entry);
    };
  }

  /** Add an event listener removed on dispose or early release. Preserves capture/passive/once. */
  listen<E extends Event = Event>(
    target: EventTarget,
    type: string,
    handler: (event: E) => void,
    options?: AddEventListenerOptions | boolean,
  ): Release {
    if (this.#disposed) return () => {};
    const capture = typeof options === 'boolean' ? options : (options?.capture ?? false);
    const listener = handler as EventListener;
    target.addEventListener(type, listener, options);
    stats.listeners++;
    return this.add(() => {
      target.removeEventListener(type, listener, capture);
      stats.listeners--;
    }, `listener "${type}"`);
  }

  /** Run `fn` once after `ms`; cancelled on dispose or early release. */
  timeout(fn: () => void, ms: number): Release {
    if (this.#disposed) return () => {};
    let release: Release = () => {};
    const id = setTimeout(() => {
      release();
      this.#invoke(fn, 'scope.timer.error');
    }, ms);
    stats.timers++;
    release = this.add(() => {
      clearTimeout(id);
      stats.timers--;
    }, 'timeout');
    return release;
  }

  /** Run `fn` every `ms`; cancelled on dispose or early release. */
  interval(fn: () => void, ms: number): Release {
    if (this.#disposed) return () => {};
    const id = setInterval(() => this.#invoke(fn, 'scope.timer.error'), ms);
    stats.timers++;
    return this.add(() => {
      clearInterval(id);
      stats.timers--;
    }, 'interval');
  }

  /** Create a child scope disposed with this one (and its reason), or earlier on its own. */
  child(options?: ScopeOptions): Scope {
    const child = new Scope({ name: options?.name ?? this.name });
    if (this.#disposed) {
      child.dispose(this.#reason);
      return child;
    }
    const release = this.add(() => child.dispose(this.#reason), 'child scope');
    child.add(() => release(), 'detach from parent');
    return child;
  }

  /**
   * A tracked effect owned by this scope. Each run receives a fresh child scope that
   * is disposed before the next run and when this scope is disposed.
   */
  effect(run: ScopedEffect, options?: EffectOptions): Release {
    if (this.#disposed) return () => {};
    stats.effects++;
    const dispose = reactiveEffect(() => {
      const runScope = this.child({ name: options?.name ?? this.name });
      let cleanup: void | Cleanup;
      try {
        cleanup = run(runScope);
      } catch (error) {
        runScope.dispose();
        throw error;
      }
      return () => {
        try {
          if (typeof cleanup === 'function') cleanup();
        } finally {
          // A rerun ends the run without a reason; the owner's disposal passes its own.
          runScope.dispose(this.#disposed ? this.#reason : undefined);
        }
      };
    }, options);
    return this.add(() => {
      dispose();
      stats.effects--;
    }, 'effect');
  }

  /** Activate a controller against this scope. Returns the controller. */
  use<C extends Controller>(controller: C): C {
    if (!this.#disposed) controller.connect(this);
    return controller;
  }

  /**
   * End the lifetime: abort `signal` with `reason`, then run every cleanup (including child
   * scopes, disposed with the same reason) in reverse registration order. All cleanups run even
   * if some throw; failures are reported with code `scope.cleanup.error`. Idempotent: a later
   * call keeps the first reason.
   */
  dispose(reason?: unknown): void {
    if (this.#disposed) return;
    this.#disposed = true;
    this.#reason = reason;
    stats.scopes--;
    try {
      this.#controller?.abort(reason);
    } catch (error) {
      reportOddkinError(error, { code: 'scope.abort.error', origin: this.name });
    }
    const entries = [...this.#entries].reverse();
    this.#entries.clear();
    for (const entry of entries) this.#runEntry(entry);
  }

  #runEntry(entry: Entry): void {
    try {
      entry.run();
    } catch (error) {
      reportOddkinError(
        new OddkinError(
          'scope.cleanup.error',
          DEV
            ? `A ${entry.label} cleanup${this.name ? ` in scope "${this.name}"` : ''} threw.`
            : '',
          { cause: error },
        ),
        { code: 'scope.cleanup.error', origin: this.name },
      );
    }
  }

  #invoke(fn: () => void, code: string): void {
    try {
      fn();
    } catch (error) {
      reportOddkinError(error, { code, origin: this.name });
    }
  }
}

/** Create a root scope. Dispose it explicitly when its owner's lifetime ends. */
export function createScope(options?: ScopeOptions): Scope {
  return new Scope(options);
}
