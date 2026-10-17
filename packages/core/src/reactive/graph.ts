/**
 * Mote's single reactive graph (ADR 0002). DOM-free.
 *
 * Design: push–pull with versions.
 * - A signal write bumps the signal's version and pushes a "maybe stale" mark to
 *   observers. Nothing recomputes during the push.
 * - A computed value re-validates lazily on read by comparing the versions of the
 *   sources it saw last time, so reads are glitch-free through diamonds.
 * - Computed values only register with their sources while something observes
 *   them; unobserved computed values never leak into source observer sets.
 * - Subscribers (`subscribe`) are notified synchronously, once, at the outermost
 *   batch boundary. Effects are deduplicated into one microtask flush; commit-phase
 *   effects run before post-phase effects in each pass.
 */
import { DEV } from '../internal/dev.js';
import { MoteError, reportMoteError } from '../diagnostics/index.js';

/** Brand identifying any Mote readable (signals, computed values, readable adapters). */
export const READABLE: unique symbol = Symbol.for('mote.readable') as never;

export interface Readable<T> {
  readonly [READABLE]: true;
  /** Current value. Inside a tracked evaluation, reading registers a dependency. */
  readonly value: T;
  /** Current value without registering a dependency. */
  peek(): T;
  /**
   * Call `onChange` whenever the value changes. Notifications are synchronous outside
   * a batch and happen once at the outermost batch boundary inside one. The function
   * is bound and stable, so it can be passed around (e.g. to external-store hooks).
   */
  readonly subscribe: (onChange: (value: T) => void) => () => void;
}

export interface Signal<T> extends Readable<T> {
  value: T;
  /** Set the value from the current one. */
  update(fn: (current: T) => T): void;
}

export interface ReactiveOptions<T> {
  /** Equality used to skip no-op changes. Defaults to `Object.is`. */
  equals?: (previous: T, next: T) => boolean;
  /** Name used in diagnostics. */
  name?: string;
}

export type EffectPhase = 'commit' | 'post';

export interface EffectOptions {
  /** `commit` effects (DOM updates) run before `post` effects in each flush. Default `post`. */
  phase?: EffectPhase;
  name?: string;
}

export type EffectCleanup = () => void;
export type EffectFn = () => void | EffectCleanup;

// ---------------------------------------------------------------------------
// Internal graph state

const MAX_FLUSH_PASSES = 100;
const MAX_LISTENER_PASSES = 1000;

type Source = SignalNode<unknown> | ComputedNode<unknown>;
interface Consumer {
  notify(): void;
}

let activeConsumer: Consumer | undefined;
let trackedSources: Map<Source, number> | undefined;
let computingDepth = 0;
let globalVersion = 0;
let batchDepth = 0;

function track(source: Source): void {
  trackedSources?.set(source, source.version);
}

function runTracked<R>(consumer: Consumer, sources: Map<Source, number>, fn: () => R): R {
  const previousConsumer = activeConsumer;
  const previousSources = trackedSources;
  activeConsumer = consumer;
  trackedSources = sources;
  try {
    return fn();
  } finally {
    activeConsumer = previousConsumer;
    trackedSources = previousSources;
  }
}

function sourcesChanged(sources: Map<Source, number>): boolean {
  for (const [source, seen] of sources) {
    if (source instanceof ComputedNode) source.refresh();
    if (source.version !== seen) return true;
  }
  return false;
}

/** Move a consumer's subscriptions from `previous` to `next` sources. */
function resubscribe(consumer: Consumer, previous: Map<Source, number>, next: Map<Source, number>) {
  for (const source of previous.keys()) if (!next.has(source)) source.removeObserver(consumer);
  for (const source of next.keys()) if (!previous.has(source)) source.addObserver(consumer);
}

function label(kind: string, name: string | undefined): string {
  return name ? `${kind} "${name}"` : kind;
}

// ---------------------------------------------------------------------------
// Nodes

abstract class ReadableNode<T> implements Readable<T> {
  readonly [READABLE] = true as const;
  version = 0;
  readonly observers = new Set<Consumer>();
  readonly name: string | undefined;
  protected readonly equals: (a: T, b: T) => boolean;

  constructor(options: ReactiveOptions<T> | undefined) {
    this.equals = options?.equals ?? Object.is;
    this.name = options?.name;
  }

  abstract get value(): T;
  abstract peek(): T;

  readonly subscribe = (onChange: (value: T) => void): (() => void) => {
    const listener = new ListenerNode<T>(this as unknown as Source, onChange);
    return () => listener.dispose();
  };

  addObserver(consumer: Consumer): void {
    this.observers.add(consumer);
  }

  removeObserver(consumer: Consumer): void {
    this.observers.delete(consumer);
  }
}

class SignalNode<T> extends ReadableNode<T> implements Signal<T> {
  #value: T;

  constructor(initial: T, options: ReactiveOptions<T> | undefined) {
    super(options);
    this.#value = initial;
  }

  get value(): T {
    track(this as unknown as Source);
    return this.#value;
  }

  set value(next: T) {
    if (computingDepth > 0) {
      throw new MoteError(
        'reactive.write.inComputed',
        DEV
          ? `Cannot write ${label('signal', this.name)} while a computed value is evaluating. Computed values must be pure; use an effect instead.`
          : '',
      );
    }
    if (this.equals(this.#value, next)) return;
    this.#value = next;
    this.version++;
    globalVersion++;
    batchDepth++;
    try {
      for (const observer of [...this.observers]) observer.notify();
    } finally {
      batchDepth--;
      if (batchDepth === 0) flushListeners();
    }
  }

  peek(): T {
    return this.#value;
  }

  update(fn: (current: T) => T): void {
    this.value = fn(this.#value);
  }
}

class ComputedNode<T> extends ReadableNode<T> implements Consumer {
  #fn: () => T;
  #value: T | undefined;
  #error: unknown;
  #hasError = false;
  #initialized = false;
  #computing = false;
  #stale = true;
  #globalSeen = -1;
  #sources = new Map<Source, number>();

  constructor(fn: () => T, options: ReactiveOptions<T> | undefined) {
    super(options);
    this.#fn = fn;
  }

  get value(): T {
    this.refresh();
    track(this as unknown as Source);
    if (this.#hasError) throw this.#error;
    return this.#value as T;
  }

  peek(): T {
    this.refresh();
    if (this.#hasError) throw this.#error;
    return this.#value as T;
  }

  /** True when the last evaluation threw. */
  get failed(): boolean {
    return this.#hasError;
  }

  refresh(): void {
    if (this.#computing) {
      throw new MoteError(
        'reactive.cycle',
        DEV ? `${label('Computed value', this.name)} depends on itself.` : '',
      );
    }
    if (!this.#stale && this.#globalSeen === globalVersion) return;
    // Observed computed values receive pushes, so "not stale" means clean.
    if (!this.#stale && this.observers.size > 0) {
      this.#globalSeen = globalVersion;
      return;
    }
    this.#globalSeen = globalVersion;
    if (this.#initialized && !sourcesChanged(this.#sources)) {
      this.#stale = false;
      return;
    }
    this.#recompute();
  }

  #recompute(): void {
    const next = new Map<Source, number>();
    let result: T | undefined;
    let threw = false;
    let error: unknown;
    this.#computing = true;
    computingDepth++;
    try {
      result = runTracked(this, next, this.#fn);
    } catch (caught) {
      threw = true;
      error = caught;
    } finally {
      computingDepth--;
      this.#computing = false;
    }
    if (this.observers.size > 0) resubscribe(this, this.#sources, next);
    this.#sources = next;
    this.#stale = false;
    const first = !this.#initialized;
    this.#initialized = true;
    if (threw) {
      if (!this.#hasError || this.#error !== error) this.version++;
      this.#hasError = true;
      this.#error = error;
    } else if (first || this.#hasError || !this.equals(this.#value as T, result as T)) {
      this.#value = result;
      this.#hasError = false;
      this.#error = undefined;
      this.version++;
    }
  }

  notify(): void {
    if (this.#stale) return;
    this.#stale = true;
    for (const observer of [...this.observers]) observer.notify();
  }

  override addObserver(consumer: Consumer): void {
    if (this.observers.size === 0) {
      for (const source of this.#sources.keys()) source.addObserver(this);
      // We were not receiving pushes while unobserved: re-check source versions on
      // the next read. (Do not set #stale here; it would block the next push.)
      this.#globalSeen = -1;
    }
    super.addObserver(consumer);
  }

  override removeObserver(consumer: Consumer): void {
    super.removeObserver(consumer);
    if (this.observers.size === 0) {
      for (const source of this.#sources.keys()) source.removeObserver(this);
    }
  }
}

class ListenerNode<T> implements Consumer {
  #source: Source;
  #onChange: (value: T) => void;
  #seen: number;
  #disposed = false;

  constructor(source: Source, onChange: (value: T) => void) {
    this.#source = source;
    this.#onChange = onChange;
    if (source instanceof ComputedNode) source.refresh();
    this.#seen = source.version;
    source.addObserver(this);
  }

  notify(): void {
    if (!this.#disposed) pendingListeners.add(this);
  }

  check(): void {
    if (this.#disposed) return;
    const source = this.#source;
    if (source instanceof ComputedNode) source.refresh();
    if (source.version === this.#seen) return;
    this.#seen = source.version;
    if (source instanceof ComputedNode && source.failed) {
      try {
        source.peek();
      } catch (error) {
        reportMoteError(error, { code: 'reactive.subscribe.sourceError', origin: source.name });
      }
      return;
    }
    this.#onChange(source.peek() as T);
  }

  dispose(): void {
    if (this.#disposed) return;
    this.#disposed = true;
    pendingListeners.delete(this);
    this.#source.removeObserver(this);
  }
}

class EffectNode implements Consumer {
  readonly phase: EffectPhase;
  readonly name: string | undefined;
  scheduled = false;
  #fn: EffectFn;
  #cleanup: EffectCleanup | undefined;
  #sources = new Map<Source, number>();
  #initialized = false;
  #disposed = false;

  constructor(fn: EffectFn, options: EffectOptions | undefined) {
    this.#fn = fn;
    this.phase = options?.phase ?? 'post';
    this.name = options?.name;
  }

  notify(): void {
    if (!this.#disposed) schedule(this);
  }

  run(): void {
    if (this.#disposed) return;
    if (this.#initialized) {
      let changed = true;
      try {
        changed = sourcesChanged(this.#sources);
      } catch {
        // A source failed to refresh (e.g. a cycle): run so the error surfaces from the effect.
      }
      if (!changed) return;
    }
    this.#runCleanup();
    const next = new Map<Source, number>();
    try {
      const cleanup = runTracked(this, next, this.#fn);
      if (typeof cleanup === 'function') this.#cleanup = cleanup;
    } catch (error) {
      reportMoteError(error, { code: 'reactive.effect.error', origin: this.name });
    } finally {
      resubscribe(this, this.#sources, next);
      this.#sources = next;
      this.#initialized = true;
    }
    if (this.#disposed) {
      this.#unsubscribe();
      return;
    }
    // A source written during this run (possibly by the run itself) changed after we
    // read it, before we were subscribed: run again in a later pass.
    let stale = false;
    try {
      stale = sourcesChanged(this.#sources);
    } catch {
      stale = true;
    }
    if (stale) schedule(this);
  }

  dispose(): void {
    if (this.#disposed) return;
    this.#disposed = true;
    unschedule(this);
    this.#unsubscribe();
    this.#runCleanup();
  }

  #unsubscribe(): void {
    for (const source of this.#sources.keys()) source.removeObserver(this);
    this.#sources = new Map();
  }

  #runCleanup(): void {
    const cleanup = this.#cleanup;
    this.#cleanup = undefined;
    if (!cleanup) return;
    try {
      untracked(cleanup);
    } catch (error) {
      reportMoteError(error, { code: 'reactive.effect.cleanupError', origin: this.name });
    }
  }
}

// ---------------------------------------------------------------------------
// Listener notifications (synchronous, at the outermost batch boundary)

const pendingListeners = new Set<{ check(): void }>();
let flushingListeners = false;

function flushListeners(): void {
  if (flushingListeners) return;
  flushingListeners = true;
  let passes = 0;
  try {
    while (pendingListeners.size > 0) {
      if (++passes > MAX_LISTENER_PASSES) {
        pendingListeners.clear();
        reportMoteError(
          new MoteError(
            'reactive.flush.runaway',
            DEV
              ? `Subscribers kept changing values after ${MAX_LISTENER_PASSES} passes; notifications stopped.`
              : '',
          ),
          { code: 'reactive.flush.runaway' },
        );
        break;
      }
      const listeners = [...pendingListeners];
      pendingListeners.clear();
      for (const listener of listeners) {
        try {
          listener.check();
        } catch (error) {
          reportMoteError(error, { code: 'reactive.subscribe.error' });
        }
      }
    }
  } finally {
    flushingListeners = false;
  }
}

// ---------------------------------------------------------------------------
// Effect scheduling (deduplicated microtask flush)

const queues: Record<EffectPhase, Set<EffectNode>> = { commit: new Set(), post: new Set() };
let flushScheduled = false;
let flushing = false;
let waiters: Array<() => void> = [];

function hasPendingEffects(): boolean {
  return queues.commit.size > 0 || queues.post.size > 0;
}

function schedule(effect: EffectNode): void {
  if (effect.scheduled) return;
  effect.scheduled = true;
  queues[effect.phase].add(effect);
  if (!flushScheduled && !flushing) {
    flushScheduled = true;
    queueMicrotask(flush);
  }
}

function unschedule(effect: EffectNode): void {
  effect.scheduled = false;
  queues[effect.phase].delete(effect);
}

function runQueue(queue: Set<EffectNode>): void {
  const effects = [...queue];
  queue.clear();
  for (const effect of effects) {
    effect.scheduled = false;
    effect.run();
  }
}

/**
 * Run all scheduled effects now: commit-phase effects, then post-phase effects,
 * repeating while effects schedule more work. Stops after a bounded number of
 * passes and reports `reactive.flush.runaway`.
 */
export function flush(): void {
  if (flushing) return;
  flushScheduled = false;
  flushing = true;
  let passes = 0;
  try {
    while (hasPendingEffects()) {
      if (++passes > MAX_FLUSH_PASSES) {
        for (const queue of [queues.commit, queues.post]) {
          for (const effect of queue) effect.scheduled = false;
          queue.clear();
        }
        reportMoteError(
          new MoteError(
            'reactive.flush.runaway',
            DEV
              ? `Effects kept scheduling work after ${MAX_FLUSH_PASSES} passes; the flush stopped. An effect probably writes a value it also reads.`
              : '',
          ),
          { code: 'reactive.flush.runaway' },
        );
        break;
      }
      runQueue(queues.commit);
      runQueue(queues.post);
    }
  } finally {
    flushing = false;
    const resolved = waiters;
    waiters = [];
    for (const resolve of resolved) resolve();
  }
}

/** Resolves after currently scheduled effects have run (immediately if none are pending). */
export function settled(): Promise<void> {
  if (!hasPendingEffects() && !flushScheduled) return Promise.resolve();
  return new Promise((resolve) => waiters.push(resolve));
}

// ---------------------------------------------------------------------------
// Public API

/** Create a writable signal. */
export function signal<T>(initial: T, options?: ReactiveOptions<T>): Signal<T> {
  return new SignalNode(initial, options);
}

/** Create a lazy, memoized derived value. `fn` must be pure and synchronous. */
export function computed<T>(fn: () => T, options?: ReactiveOptions<T>): Readable<T> {
  return new ComputedNode(fn, options);
}

/**
 * Run `fn` now and again (in a deduplicated microtask flush) whenever a value it read
 * changes. `fn` may return a cleanup that runs before the next run and on dispose.
 * Returns an explicit disposer. Only synchronous reads are tracked.
 */
export function effect(fn: EffectFn, options?: EffectOptions): () => void {
  if (computingDepth > 0) {
    throw new MoteError(
      'reactive.effect.inComputed',
      DEV ? 'Cannot create an effect while a computed value is evaluating.' : '',
    );
  }
  const node = new EffectNode(fn, options);
  node.run();
  return () => node.dispose();
}

/** Group writes so subscribers are notified once, at the outermost boundary. Returns `fn`'s result. */
export function batch<R>(fn: () => R): R {
  batchDepth++;
  try {
    return fn();
  } finally {
    batchDepth--;
    if (batchDepth === 0) flushListeners();
  }
}

/** Run `fn` without registering dependencies. Returns `fn`'s result. */
export function untracked<R>(fn: () => R): R {
  const previousConsumer = activeConsumer;
  const previousSources = trackedSources;
  activeConsumer = undefined;
  trackedSources = undefined;
  try {
    return fn();
  } finally {
    activeConsumer = previousConsumer;
    trackedSources = previousSources;
  }
}

/** True for any Mote readable (signal or computed value). */
export function isReadable(value: unknown): value is Readable<unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as Record<symbol, unknown>)[READABLE] === true
  );
}

/** @internal Number of consumers observing a readable. For tests and dev inspection. */
export function observerCount(readable: Readable<unknown>): number {
  return readable instanceof ReadableNode ? readable.observers.size : 0;
}
