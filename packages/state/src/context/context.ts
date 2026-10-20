/**
 * Context (core-contracts.md §7.2): typed values from the nearest provider in the composed tree,
 * over the community context protocol (`context-request` events with `context`, `contextTarget`,
 * `callback`, and `subscribe`; providers stop immediate propagation), so Oddkin providers and
 * consumers interoperate with other implementations such as Lit's `@lit/context`. A provider also
 * announces itself with a `context-provider` event so waiting consumers and enclosing providers can
 * hand consumers over. Between Oddkin peers the provider hands over its readable itself, so a
 * consumer reads through one reactive graph; other peers receive values through the callback.
 *
 * Imports without DOM globals (it only extends `Event`); providers and consumers need a DOM.
 */
import { DEV } from '../internal/dev.js';
import { OddkinError, reportOddkinError } from '@oddkin/core/diagnostics';
import {
  READABLE,
  batch,
  computed,
  isReadable,
  signal,
  type Readable,
  type Signal,
} from '@oddkin/core/reactive';
import type { Controller, Scope } from '@oddkin/core/scope';

/**
 * A typed context key. Providers and consumers match keys by identity, so each `createContext()`
 * call creates a distinct context. Structurally compatible with the community protocol's
 * `Context<Key, Value>`.
 */
export interface Context<T> {
  /** Name used in diagnostics. */
  readonly name: string;
  /** Carries the value type for TypeScript; absent at runtime (community context protocol). */
  readonly __context__: T;
}

/** The value type of a context. */
export type ContextType<C> = C extends Context<infer T> ? T : never;

/** Receives a provided value; `unsubscribe` is passed when the request subscribed. */
export type ContextCallback<T> = (value: T, unsubscribe?: () => void) => void;

/** Create a context key with a name for diagnostics. */
export function createContext<T>(name: string): Context<T> {
  return Object.freeze({ name }) as unknown as Context<T>;
}

/** A consumer asks for a context (community context protocol). Bubbles and is composed. */
export class ContextRequestEvent<T> extends Event {
  readonly context: Context<T>;
  /** The requesting element; `target` is retargeted across shadow roots. */
  readonly contextTarget: Element;
  readonly callback: ContextCallback<T>;
  /** True when the callback may be called again as the value changes. */
  readonly subscribe: boolean;

  constructor(
    context: Context<T>,
    contextTarget: Element,
    callback: ContextCallback<T>,
    subscribe = false,
  ) {
    super('context-request', { bubbles: true, composed: true });
    this.context = context;
    this.contextTarget = contextTarget;
    this.callback = callback;
    this.subscribe = subscribe;
  }
}

/** A provider announces itself, so enclosing providers and waiting consumers can re-request. */
export class ContextProviderEvent<T> extends Event {
  readonly context: Context<T>;
  readonly contextTarget: Node;

  constructor(context: Context<T>, contextTarget: Node) {
    super('context-provider', { bubbles: true, composed: true });
    this.context = context;
    this.contextTarget = contextTarget;
  }
}

/** Oddkin consumers tag their callback so an Oddkin provider can hand over its readable. */
const CONSUMER = Symbol('oddkin.context.consumer');
const ATTACH = Symbol('oddkin.context.attach');
const DETACH = Symbol('oddkin.context.detach');

interface Attachable<T> {
  [ATTACH](view: Readable<T>, unsubscribe: () => void): void;
  [DETACH](unsubscribe: () => void): void;
}

type TaggedCallback<T> = ContextCallback<T> & { [CONSUMER]?: Attachable<T> };

const targetOf = (event: ContextRequestEvent<unknown> | ContextProviderEvent<unknown>) =>
  event.contextTarget ?? event.composedPath()[0];

export interface ConsumeOptions<T> {
  /** The value while no provider supplies one. Default `undefined`. */
  fallback?: T;
  /** Report `state.context.missing` when no provider answers as the consumer connects. */
  required?: boolean;
}

/** A readable of the nearest provider's value, activated with `scope.use()`. */
export interface ContextConsumer<V> extends Readable<V>, Controller {
  readonly context: Context<unknown>;
  readonly host: Element;
  /** True while a provider supplies the value. Tracked like `value`. */
  readonly provided: boolean;
  /** Ask again for the nearest provider, e.g. from `moved()` after a state-preserving move. */
  resolve(): void;
}

/** Provides a value to consumers below its host, activated with `scope.use()`. */
export interface ContextProvider<T> extends Controller {
  readonly context: Context<T>;
  readonly host: Node;
  /** The provided value. Assign a value, or a readable to follow it. */
  get value(): T;
  set value(next: T | Readable<T>);
  /** Consumers currently subscribed to this provider. */
  readonly consumers: number;
}

interface Connection {
  readonly scope: Scope;
  waiting: (() => void) | undefined;
}

class ConsumerImpl<T> implements ContextConsumer<T | undefined>, Attachable<T> {
  readonly [READABLE] = true as const;
  readonly context: Context<T>;
  readonly host: Element;
  readonly #fallback: T | undefined;
  readonly #required: boolean;
  readonly #source = signal<Readable<T> | undefined>(undefined);
  readonly #view: Readable<T | undefined>;
  readonly #callback: TaggedCallback<T>;
  #local: Signal<T> | undefined;
  #unsubscribe: (() => void) | undefined;
  #connection: Connection | undefined;
  #answered = false;

  constructor(host: Element, context: Context<T>, options: ConsumeOptions<T> | undefined) {
    this.host = host;
    this.context = context;
    this.#fallback = options?.fallback;
    this.#required = options?.required ?? false;
    this.#view = computed(() => {
      const source = this.#source.value;
      return source ? source.value : this.#fallback;
    });
    const callback: TaggedCallback<T> = (value, unsubscribe) => this.#receive(value, unsubscribe);
    callback[CONSUMER] = this;
    this.#callback = callback;
  }

  get value(): T | undefined {
    return this.#view.value;
  }

  peek(): T | undefined {
    return this.#view.peek();
  }

  readonly subscribe = (onChange: (value: T | undefined) => void): (() => void) =>
    this.#view.subscribe(onChange);

  get provided(): boolean {
    return this.#source.value !== undefined;
  }

  connect(scope: Scope): void {
    if (scope.disposed) return;
    this.#disconnect(); // one connection at a time
    const connection: Connection = { scope, waiting: undefined };
    this.#connection = connection;
    scope.add(() => {
      if (this.#connection === connection) this.#disconnect();
    }, 'context consumer');
    this.#request();
    if (this.#required && this.#source.peek() === undefined) {
      reportOddkinError(
        new OddkinError(
          'state.context.missing',
          DEV
            ? `<${this.host.localName}> requires context "${this.context.name}", but no provider answered when it connected. Provide it on an ancestor that connects first (provide() with scope.use(), or the application's provide), or give the consumer a fallback.`
            : '',
        ),
        { code: 'state.context.missing', origin: this.host.localName },
      );
    }
  }

  resolve(): void {
    this.#request();
  }

  [ATTACH](view: Readable<T>, unsubscribe: () => void): void {
    this.#answered = true;
    this.#switch(unsubscribe);
    this.#source.value = view;
    this.#stopWaiting();
  }

  [DETACH](unsubscribe: () => void): void {
    if (unsubscribe !== this.#unsubscribe) return;
    this.#unsubscribe = undefined;
    this.#source.value = undefined;
    if (this.host.isConnected) this.#request();
  }

  #receive(value: T, unsubscribe: (() => void) | undefined): void {
    this.#answered = true;
    batch(() => {
      this.#switch(unsubscribe);
      if (this.#local) this.#local.value = value;
      else this.#local = signal(value);
      this.#source.value = this.#local;
    });
    this.#stopWaiting();
  }

  /** Adopt a provider's unsubscribe function, leaving the previous provider. */
  #switch(unsubscribe: (() => void) | undefined): void {
    if (unsubscribe === this.#unsubscribe) return;
    const previous = this.#unsubscribe;
    this.#unsubscribe = unsubscribe;
    previous?.();
  }

  #request(): void {
    if (!this.#connection) return;
    this.#answered = false;
    this.host.dispatchEvent(new ContextRequestEvent(this.context, this.host, this.#callback, true));
    if (this.#answered || !this.#connection) return;
    // Nobody answered: leave any previous provider and wait for one to announce itself.
    const previous = this.#unsubscribe;
    this.#unsubscribe = undefined;
    this.#source.value = undefined;
    previous?.();
    this.#startWaiting();
  }

  #startWaiting(): void {
    const connection = this.#connection;
    if (!connection || connection.waiting) return;
    connection.waiting = connection.scope.listen<ContextProviderEvent<unknown>>(
      this.host.ownerDocument,
      'context-provider',
      (event) => {
        if (event.context === this.context) this.#request();
      },
    );
  }

  #stopWaiting(): void {
    const connection = this.#connection;
    const release = connection?.waiting;
    if (!connection || !release) return;
    connection.waiting = undefined;
    release();
  }

  #disconnect(): void {
    const connection = this.#connection;
    if (!connection) return;
    this.#connection = undefined;
    connection.waiting?.();
    const previous = this.#unsubscribe;
    this.#unsubscribe = undefined;
    this.#source.value = undefined;
    previous?.();
  }
}

interface Subscription<T> {
  readonly host: Element;
  readonly consumer: Attachable<T> | undefined;
  readonly unsubscribe: () => void;
}

class ProviderImpl<T> implements ContextProvider<T> {
  readonly context: Context<T>;
  readonly host: Node;
  readonly #current: Signal<Readable<T>>;
  readonly #view: Readable<T>;
  readonly #subscribers = new Map<ContextCallback<T>, Subscription<T>>();
  #own: Signal<T> | undefined;
  #foreign: (() => void) | undefined;
  #connection: object | undefined;

  constructor(host: Node, context: Context<T>, value: T | Readable<T>) {
    this.host = host;
    this.context = context;
    this.#current = signal(this.#readable(value));
    this.#view = computed(() => this.#current.value.value);
  }

  get value(): T {
    return this.#view.value;
  }

  set value(next: T | Readable<T>) {
    this.#current.value = this.#readable(next);
  }

  get consumers(): number {
    return this.#subscribers.size;
  }

  connect(scope: Scope): void {
    if (scope.disposed) return;
    this.#disconnect(); // one connection at a time
    const connection = {};
    this.#connection = connection;
    // Registered first, so it runs after the listeners below are removed.
    scope.add(() => {
      if (this.#connection === connection) this.#disconnect();
    }, 'context provider');
    scope.listen<ContextRequestEvent<T>>(this.host, 'context-request', (event) => {
      if (this.#connection === connection) this.#onRequest(event);
    });
    scope.listen<ContextProviderEvent<T>>(this.host, 'context-provider', (event) => {
      if (this.#connection === connection) this.#onProvider(event);
    });
    this.host.dispatchEvent(new ContextProviderEvent(this.context, this.host));
  }

  #readable(value: T | Readable<T>): Readable<T> {
    if (isReadable(value)) return value as Readable<T>;
    if (this.#own) this.#own.value = value;
    else this.#own = signal(value);
    return this.#own;
  }

  #onRequest(event: ContextRequestEvent<T>): void {
    if (event.context !== this.context) return;
    const target = targetOf(event);
    if (target === this.host) return; // the host's own request goes to an enclosing provider
    event.stopImmediatePropagation();
    const callback = event.callback as TaggedCallback<T>;
    if (!event.subscribe) {
      callback(this.#view.peek()); // one value; never retained
      return;
    }
    let subscription = this.#subscribers.get(callback);
    if (!subscription) {
      const created: Subscription<T> = {
        host: target as Element,
        consumer: callback[CONSUMER],
        unsubscribe: () => this.#remove(callback, created),
      };
      subscription = created;
      this.#subscribers.set(callback, created);
    }
    if (subscription.consumer) {
      subscription.consumer[ATTACH](this.#view, subscription.unsubscribe);
    } else {
      this.#watch();
      callback(this.#view.peek(), subscription.unsubscribe);
    }
  }

  /** A provider appeared below this one: consumers now closer to it move there. */
  #onProvider(event: ContextProviderEvent<T>): void {
    if (event.context !== this.context || targetOf(event) === this.host) return;
    event.stopPropagation();
    for (const [callback, subscription] of [...this.#subscribers]) {
      if (this.#subscribers.get(callback) !== subscription) continue;
      subscription.host.dispatchEvent(
        new ContextRequestEvent(this.context, subscription.host, callback, true),
      );
    }
  }

  /** Other implementations' consumers receive values through their callbacks, each isolated. */
  #watch(): void {
    if (this.#foreign) return;
    this.#foreign = this.#view.subscribe((value) => {
      for (const [callback, subscription] of [...this.#subscribers]) {
        if (subscription.consumer || this.#subscribers.get(callback) !== subscription) continue;
        try {
          callback(value, subscription.unsubscribe);
        } catch (error) {
          reportOddkinError(error, { code: 'state.context.callback', origin: this.context.name });
        }
      }
    });
  }

  #remove(callback: ContextCallback<T>, subscription: Subscription<T>): void {
    if (this.#subscribers.get(callback) !== subscription) return;
    this.#subscribers.delete(callback);
    if (!this.#foreign) return;
    for (const other of this.#subscribers.values()) if (!other.consumer) return;
    this.#foreign();
    this.#foreign = undefined;
  }

  /** Stop providing: consumers look for the next provider up (or wait for one). */
  #disconnect(): void {
    if (!this.#connection) return;
    this.#connection = undefined;
    this.#foreign?.();
    this.#foreign = undefined;
    const subscriptions = [...this.#subscribers];
    this.#subscribers.clear();
    for (const [callback, subscription] of subscriptions) {
      if (subscription.consumer) subscription.consumer[DETACH](subscription.unsubscribe);
      else if (subscription.host.isConnected)
        subscription.host.dispatchEvent(
          new ContextRequestEvent(this.context, subscription.host, callback, true),
        );
    }
  }
}

/**
 * Provide `value` (or follow a readable) to consumers of `context` below `host`, which may be an
 * element, a shadow root, or a document. Activate it with `scope.use(provider)`; disposing that
 * scope stops providing, and its consumers look for the next provider up.
 */
export function provide<T>(
  host: Node,
  context: Context<T>,
  value: T | Readable<T>,
): ContextProvider<T> {
  return new ProviderImpl(host, context, value);
}

/**
 * Read `context` from the nearest provider above `host`. Activate it with `scope.use(consumer)`,
 * usually in `connected(scope)`; the subscription ends with that scope. Until a provider answers,
 * the value is `fallback` and `provided` is false; a provider that connects later is found when it
 * announces itself.
 */
export function consume<T>(
  host: Element,
  context: Context<T>,
  options: ConsumeOptions<T> & { fallback: T },
): ContextConsumer<T>;
export function consume<T>(
  host: Element,
  context: Context<T>,
  options?: ConsumeOptions<T>,
): ContextConsumer<T | undefined>;
export function consume<T>(
  host: Element,
  context: Context<T>,
  options?: ConsumeOptions<T>,
): ContextConsumer<T | undefined> {
  return new ConsumerImpl(host, context, options);
}
