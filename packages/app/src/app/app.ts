/**
 * Application ownership (core-contracts.md §9): one root `Scope` per run, explicit services,
 * idempotent `start()` and `stop()`, restart with fresh scopes and services, and any number of
 * applications per page. `suspend()`/`resume()` pause and resume the run's services without
 * disposing anything (page suspension, §9.1). No global singleton; importing this module
 * registers nothing. Imports without DOM globals; a root is used only when the application
 * provides context at it.
 */
import { DEV } from '../internal/dev.js';
import { OddkinError, reportOddkinError } from '@oddkin/core/diagnostics';
import { signal, type Readable } from '@oddkin/core/reactive';
import { createScope, type Controller, type Scope } from '@oddkin/core/scope';
import { provide, type Context, type ContextProvider } from '@oddkin/state/context';

/**
 * A service activated for one run with `use()`. `suspend`/`resume` are called by `app.suspend()` and
 * `app.resume()`, for example by `pageLifecycle()` when the page enters and leaves the back/forward
 * cache. Suspension is not disposal: the service keeps its listeners and state.
 */
export interface AppService extends Controller {
  /** Pause external work (connections, polling) while the page is suspended. */
  suspend?(): void;
  /** Resume after `suspend()`, without registering listeners again. */
  resume?(): void;
}

/** What `setup` receives on each start. Everything registered on `scope` ends with `stop()`. */
export interface AppContext {
  readonly app: App<unknown>;
  /** The run's root scope. */
  readonly scope: Scope;
  /** Aborted when the run stops. */
  readonly signal: AbortSignal;
  /** The node the application owns, if any. */
  readonly root: Node | undefined;
  /** Provide a context value (or a readable to follow) at the root for this run. */
  provide<T>(context: Context<T>, value: T | Readable<T>): ContextProvider<T>;
  /** Activate a service for this run. */
  use<C extends AppService>(service: C): C;
}

export interface AppOptions<S> {
  /** Name used for the root scope and in diagnostics. */
  name?: string;
  /** An element, shadow root, or document the application owns; one running application per root. */
  root?: Node;
  /** Runs on every start with a fresh scope; returns the run's services. */
  setup(context: AppContext): S;
}

export interface App<S> {
  readonly name: string | undefined;
  readonly root: Node | undefined;
  /** True between a successful `start()` and `stop()`. Tracked. */
  readonly running: boolean;
  /** True between `suspend()` and `resume()` (or `stop()`). Tracked. */
  readonly suspended: boolean;
  /** The current run's services; `undefined` while stopped. */
  readonly services: S | undefined;
  /** Start a run (idempotent while running). If `setup` throws, the run is disposed and the error rethrown. */
  start(): S;
  /** Dispose the run's scope (idempotent). `reason` becomes the abort reason. */
  stop(reason?: unknown): void;
  /**
   * Suspend the run's services (`suspend()` in reverse order of `use()`) without disposing
   * anything. No-op unless running and not suspended. A throwing service is reported
   * (`app.service.suspend`) and the others are still suspended.
   */
  suspend(): void;
  /**
   * Resume the run's services (`resume()` in order of `use()`). No-op unless suspended. A throwing
   * service is reported (`app.service.resume`) and the others are still resumed.
   */
  resume(): void;
}

type Phase = 'stopped' | 'starting' | 'running' | 'stopping';

/** Roots owned by running applications. */
const owners = new WeakMap<Node, App<unknown>>();

class AppImpl<S> implements App<S> {
  readonly name: string | undefined;
  readonly root: Node | undefined;
  readonly #setup: (context: AppContext) => S;
  readonly #running = signal(false);
  readonly #suspended = signal(false);
  #phase: Phase = 'stopped';
  #scope: Scope | undefined;
  #services: S | undefined;
  /** The run's `use()`d services, in order. */
  #used: Set<AppService> | undefined;
  /** The suspend or resume pass in progress. */
  #pass: 'suspend' | 'resume' | undefined;

  constructor(options: AppOptions<S>) {
    this.name = options.name;
    this.root = options.root;
    this.#setup = options.setup;
  }

  get running(): boolean {
    return this.#running.value;
  }

  get suspended(): boolean {
    return this.#suspended.value;
  }

  get services(): S | undefined {
    return this.#services;
  }

  start(): S {
    if (this.#phase === 'running') return this.#services as S;
    if (this.#phase !== 'stopped') throw this.#reentrant('start');
    const root = this.root;
    if (root) {
      const owner = owners.get(root);
      if (owner && owner !== this) {
        throw new OddkinError(
          'app.root.claimed',
          DEV
            ? `Cannot start ${this.#label()}: its root already belongs to the running application${owner.name ? ` "${owner.name}"` : ''}. Stop that one first, or give each application its own root.`
            : '',
        );
      }
      owners.set(root, this);
    }
    this.#phase = 'starting';
    const scope = createScope({ name: this.name ?? 'app' });
    const services = new Set<AppService>();
    const context: AppContext = {
      app: this as App<unknown>,
      scope,
      get signal() {
        return scope.signal;
      },
      root,
      provide: <T>(key: Context<T>, value: T | Readable<T>) => {
        if (!root) {
          throw new OddkinError(
            'app.root.missing',
            DEV
              ? `${this.#label()} has no root to provide context "${key.name}" at. Pass a root to createApp().`
              : '',
          );
        }
        return scope.use(provide(root, key, value));
      },
      use: <C extends AppService>(service: C): C => {
        if (scope.disposed) return service;
        services.add(service);
        scope.add(() => services.delete(service), 'app service');
        scope.use(service);
        // While suspended, every running service has been suspended, including one added now.
        if (this.#used === services && this.#suspended.peek() && !scope.disposed) {
          this.#call(service, 'suspend');
        }
        return service;
      },
    };
    let result: S;
    try {
      result = this.#setup(context);
    } catch (error) {
      this.#phase = 'stopped';
      if (root && owners.get(root) === this) owners.delete(root);
      scope.dispose(error);
      throw error;
    }
    this.#scope = scope;
    this.#services = result;
    this.#used = services;
    this.#phase = 'running';
    this.#running.value = true;
    return result;
  }

  stop(reason?: unknown): void {
    if (this.#phase === 'stopped' || this.#phase === 'stopping') return;
    if (this.#phase === 'starting') throw this.#reentrant('stop');
    const scope = this.#scope as Scope;
    this.#phase = 'stopping';
    this.#scope = undefined;
    this.#services = undefined;
    this.#used = undefined;
    this.#running.value = false;
    this.#suspended.value = false;
    try {
      scope.dispose(reason ?? new DOMException(`${this.#label()} stopped`, 'AbortError'));
    } finally {
      this.#phase = 'stopped';
      if (this.root && owners.get(this.root) === this) owners.delete(this.root);
    }
  }

  suspend(): void {
    if (this.#pass) throw this.#reentrantPass('suspend');
    if (this.#phase !== 'running' || this.#suspended.peek()) return;
    this.#suspended.value = true;
    this.#each('suspend');
  }

  resume(): void {
    if (this.#pass) throw this.#reentrantPass('resume');
    if (this.#phase !== 'running' || !this.#suspended.peek()) return;
    this.#suspended.value = false;
    this.#each('resume');
  }

  /** Call `kind` on the run's services: suspension in reverse order of `use()`, resumption in order. */
  #each(kind: 'suspend' | 'resume'): void {
    const scope = this.#scope;
    const services = [...(this.#used ?? [])];
    if (kind === 'suspend') services.reverse();
    this.#pass = kind;
    try {
      for (const service of services) {
        if (this.#scope !== scope) break; // the run stopped during the pass
        this.#call(service, kind);
      }
    } finally {
      this.#pass = undefined;
    }
  }

  #call(service: AppService, kind: 'suspend' | 'resume'): void {
    const hook = service[kind];
    if (typeof hook !== 'function') return;
    try {
      hook.call(service);
    } catch (error) {
      reportOddkinError(error, { code: `app.service.${kind}`, origin: this.name });
    }
  }

  #label(): string {
    return this.name ? `application "${this.name}"` : 'the application';
  }

  #reentrant(operation: string): OddkinError {
    return new OddkinError(
      'app.lifecycle.reentrant',
      DEV
        ? `Cannot ${operation} ${this.#label()} while it is ${this.#phase}: start() and stop() do not run inside setup() or inside a cleanup of the run being stopped. Return from setup() first, or throw from it to abandon the start.`
        : '',
    );
  }

  #reentrantPass(operation: string): OddkinError {
    return new OddkinError(
      'app.lifecycle.reentrant',
      DEV
        ? `Cannot ${operation} ${this.#label()} from a service's ${this.#pass}(): suspend() and resume() do not run inside a suspend or resume pass. stop() may.`
        : '',
    );
  }
}

/**
 * Create an application. Nothing runs until `start()`, which creates a root scope and calls
 * `setup` with it; `stop()` disposes that scope, so everything the run registered ends with it.
 * A later `start()` runs `setup` again with fresh ownership.
 */
export function createApp<S = void>(options: AppOptions<S>): App<S> {
  return new AppImpl(options);
}
