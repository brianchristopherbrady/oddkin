/**
 * `@oddkin/core/controllers/observe` — `ResizeObserver` and `IntersectionObserver` owned by a
 * `Scope`. Unbranded; observers exist only while connected.
 * Contract: docs/architecture/core-contracts.md §4.1.
 */
import type { Controller, Scope } from '../scope/index.js';

export interface ObserveOptions {
  /** Elements observed on connect; more can be added with `observe()`. */
  readonly targets?: () => Iterable<Element | null | undefined>;
  /**
   * `'immediate'` (default) runs in the observer callback, before paint, which layout
   * corrections such as scroll anchoring need. `'frame'` defers to the next animation frame and
   * merges deliveries into one call with the latest entry per target, for expensive work that
   * may lag a frame.
   */
  readonly timing?: 'immediate' | 'frame';
}

interface Observer {
  observe(target: Element): void;
  unobserve(target: Element): void;
  disconnect(): void;
}

abstract class ObserverController<E extends { readonly target: Element }> implements Controller {
  readonly #callback: (entries: readonly E[]) => void;
  readonly #options: ObserveOptions;
  #observer: Observer | undefined;
  #pending = new Map<Element, E>();
  #frame: number | undefined;

  constructor(callback: (entries: readonly E[]) => void, options: ObserveOptions = {}) {
    this.#callback = callback;
    this.#options = options;
  }

  protected abstract create(deliver: (entries: readonly E[]) => void): Observer;

  connect(scope: Scope): void {
    const observer = this.create((entries) => this.#deliver(entries));
    this.#observer = observer;
    scope.add(() => {
      observer.disconnect();
      if (this.#frame !== undefined) cancelAnimationFrame(this.#frame);
      this.#frame = undefined;
      this.#pending.clear();
      this.#observer = undefined;
    }, 'observer');
    for (const target of this.#options.targets?.() ?? []) if (target) observer.observe(target);
  }

  /** Start observing `target` (ignored while disconnected). */
  observe(target: Element): void {
    this.#observer?.observe(target);
  }

  unobserve(target: Element): void {
    this.#observer?.unobserve(target);
    this.#pending.delete(target);
  }

  #deliver(entries: readonly E[]): void {
    if (this.#options.timing !== 'frame') return this.#callback(entries);
    for (const entry of entries) this.#pending.set(entry.target, entry);
    this.#frame ??= requestAnimationFrame(() => {
      this.#frame = undefined;
      const latest = [...this.#pending.values()];
      this.#pending.clear();
      if (latest.length) this.#callback(latest);
    });
  }
}

export class ResizeController extends ObserverController<ResizeObserverEntry> {
  readonly #box: ResizeObserverBoxOptions | undefined;

  constructor(
    callback: (entries: readonly ResizeObserverEntry[]) => void,
    options: ObserveOptions & { readonly box?: ResizeObserverBoxOptions } = {},
  ) {
    super(callback, options);
    this.#box = options.box;
  }

  protected create(deliver: (entries: readonly ResizeObserverEntry[]) => void) {
    const observer = new ResizeObserver(deliver);
    const box = this.#box;
    return {
      observe: (target: Element) => observer.observe(target, box ? { box } : undefined),
      unobserve: (target: Element) => observer.unobserve(target),
      disconnect: () => observer.disconnect(),
    };
  }
}

export class IntersectionController extends ObserverController<IntersectionObserverEntry> {
  readonly #init: () => IntersectionObserverInit | undefined;

  constructor(
    callback: (entries: readonly IntersectionObserverEntry[]) => void,
    options: ObserveOptions & {
      /** Read on connect, so `root` can be an element that exists only after rendering. */
      readonly init?: () => IntersectionObserverInit | undefined;
    } = {},
  ) {
    super(callback, options);
    this.#init = options.init ?? (() => undefined);
  }

  protected create(deliver: (entries: readonly IntersectionObserverEntry[]) => void) {
    return new IntersectionObserver(deliver, this.#init());
  }
}
