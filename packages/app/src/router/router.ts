/**
 * The router (core-contracts.md §9): the URL is the source of truth, read with `URL` and the
 * History API. Links are native anchors, intercepted at the document only for primary,
 * unmodified clicks on same-document-origin links inside the base path without `target`,
 * `download`, or `rel="external"`. Each matched level owns a scope for as long as it stays
 * matched; a navigation loads its new levels, then commits: the history entry is written only
 * when every load has settled, so a superseded navigation leaves no entry, and its loads are
 * aborted and can never commit. A service of an application: `use(router)` starts it and the
 * application's stop removes its listeners and ends every level. Imports without DOM globals.
 */
import { DEV } from '../internal/dev.js';
import { OddkinError, reportOddkinError } from '@oddkin/core/diagnostics';
import { computed, signal, untracked, type Readable } from '@oddkin/core/reactive';
import { createScope, type Controller, type Scope } from '@oddkin/core/scope';
import {
  matchRoutes,
  validateRoutes,
  type AnyRoute,
  type MatchedRoute,
  type Route,
  type RouteLocation,
  type RouteMatch,
} from './match.js';

/** `history`: paths below `base`. `hash`: paths in the fragment, for static hosts without rewrites. */
export type RouterMode = 'history' | 'hash';

export interface RouterState {
  /** `idle` while the router is not running; otherwise the committed location's outcome. */
  readonly status: 'idle' | 'ready' | 'error' | 'not-found';
  /** The committed location (`undefined` while idle, or for a URL outside the base path). */
  readonly location: RouteLocation | undefined;
  /** The committed levels, outermost first. */
  readonly matches: readonly RouteMatch[];
  /** The first level's error, or the failure that prevented matching (`status: 'error'`). */
  readonly error: unknown;
  /** The location being loaded while a navigation is pending; the committed one stays shown. */
  readonly navigating: RouteLocation | undefined;
}

export interface RouterOptions {
  readonly routes: readonly AnyRoute[];
  /** The deployment base path in `history` mode, such as `/docs/`. Default `/`. */
  readonly base?: string;
  /** Default `history`. */
  readonly mode?: RouterMode;
  /**
   * The document title from the deepest level's title (`undefined` when no level has one, as
   * for not-found). Return `undefined` to leave the title alone. Default: the level's title.
   */
  readonly formatTitle?: (title: string | undefined, state: RouterState) => string | undefined;
  /** The window whose history and document the router uses. Default `globalThis`. */
  readonly window?: Window;
  /** Name used in abort reasons and diagnostics. */
  readonly name?: string;
}

export interface NavigateOptions {
  /** Replace the current history entry instead of adding one. */
  readonly replace?: boolean;
}

export interface Router extends Controller {
  readonly state: Readable<RouterState>;
  /** The committed match for `route`, typed by the route (tracked). */
  match<P, S, T>(route: Route<P, S, T>): RouteMatch<P, S, T> | undefined;
  /**
   * The `href` for an application path (`'/components?q=x'`), resolved like a URL against the
   * committed location: `/docs/components?q=x` in history mode, `#/components?q=x` in hash mode.
   */
  href(to: string): string;
  /**
   * Navigate to an application path. Resolves `true` when the navigation commits and `false`
   * when another navigation or the router's stop supersedes it. Throws
   * `app.router.disconnected` unless the router is running.
   */
  navigate(to: string, options?: NavigateOptions): Promise<boolean>;
  /** Load every level of the current location again, without a history entry. */
  refresh(): Promise<boolean>;
}

type Kind = 'initial' | 'push' | 'replace' | 'pop' | 'refresh';

interface Level {
  readonly route: AnyRoute;
  readonly key: string;
  readonly params: unknown;
  readonly scope: Scope;
  search: unknown;
  status: 'pending' | 'ready' | 'error';
  data: unknown;
  error: unknown;
  match: RouteMatch | undefined;
}

interface Navigation {
  readonly location: RouteLocation | undefined;
  readonly kind: Kind;
  readonly levels: Level[];
  pending: number;
  readonly resolve: (committed: boolean) => void;
}

const IDLE: RouterState = Object.freeze({
  status: 'idle' as const,
  location: undefined,
  matches: Object.freeze([]) as readonly RouteMatch[],
  error: undefined,
  navigating: undefined,
});
const MAX_REDIRECTS = 10;
/** A placeholder origin for parsing application paths with `URL`. */
const ORIGIN = 'http://oddkin.invalid';

const isPromiseLike = (value: unknown): value is PromiseLike<unknown> =>
  (typeof value === 'object' || typeof value === 'function') &&
  value !== null &&
  typeof (value as { then?: unknown }).then === 'function';

const toMatch = (level: Level): RouteMatch =>
  (level.match ??=
    level.status === 'error'
      ? {
          route: level.route,
          params: level.params,
          search: level.search,
          status: 'error',
          error: level.error,
        }
      : {
          route: level.route,
          params: level.params,
          search: level.search,
          status: 'ready',
          data: level.data,
        });

class RouterImpl implements Router {
  readonly state: Readable<RouterState>;
  readonly #options: RouterOptions;
  readonly #base: string;
  readonly #mode: RouterMode;
  readonly #state = signal<RouterState>(IDLE);
  #owner: Scope | undefined;
  #window: Window | undefined;
  #levels: Level[] = [];
  #committed: RouteLocation | undefined;
  #pending: Navigation | undefined;

  constructor(options: RouterOptions, base: string, mode: RouterMode) {
    this.#options = options;
    this.#base = base;
    this.#mode = mode;
    this.state = computed(() => this.#state.value);
  }

  connect(scope: Scope): void {
    if (scope.disposed) return;
    const win = this.#options.window ?? (globalThis as { window?: Window }).window;
    if (!win?.history || !win.document) {
      throw new OddkinError(
        'app.router.environment',
        DEV
          ? `${this.#label()} needs a window with a History API and a document; pass createRouter({ window }) outside a browser page.`
          : '',
      );
    }
    this.#release(new DOMException(`${this.#label()} connected elsewhere`, 'AbortError'));
    this.#owner = scope;
    this.#window = win;
    // Read now: a signal first created after dispose() would not carry the disposal reason.
    const ownerSignal = scope.signal;
    // Fragment changes, including one set directly, also fire `popstate` (all three engines).
    scope.listen(win, 'popstate', () => void this.#go(this.#read(), 'pop'));
    scope.listen(win.document, 'click', (event: MouseEvent) => this.#onClick(event));
    scope.add(() => {
      if (this.#owner === scope) this.#release(ownerSignal.reason);
    }, 'router');
    void this.#go(this.#read(), 'initial');
  }

  match<P, S, T>(route: Route<P, S, T>): RouteMatch<P, S, T> | undefined {
    return this.state.value.matches.find((match) => match.route === route) as
      RouteMatch<P, S, T> | undefined;
  }

  href(to: string): string {
    return this.#href(this.#parse(to));
  }

  navigate(to: string, options?: NavigateOptions): Promise<boolean> {
    this.#assertRunning();
    const location = this.#parse(to);
    const same = this.#committed && this.#href(location) === this.#href(this.#committed);
    return this.#go(location, options?.replace || same ? 'replace' : 'push');
  }

  refresh(): Promise<boolean> {
    this.#assertRunning();
    return this.#go(this.#committed ?? this.#read(), 'refresh', 0, true);
  }

  #label(): string {
    return this.#options.name ? `router "${this.#options.name}"` : 'router';
  }

  #assertRunning(): void {
    if (this.#owner) return;
    throw new OddkinError(
      'app.router.disconnected',
      DEV
        ? `${this.#label()} is not running: start it as a service of an application (use(router) in setup) before navigating.`
        : '',
    );
  }

  /** An application location from an application path, relative to the committed location. */
  #parse(to: string): RouteLocation {
    const from = this.#committed;
    const url = new URL(to, ORIGIN + (from ? from.path + from.search : '/'));
    if (url.origin !== ORIGIN) {
      throw new OddkinError(
        'app.router.path',
        DEV
          ? `"${to}" is not a path in this application. href() and navigate() take application paths such as "/components"; leave the application with a link or location.assign().`
          : '',
      );
    }
    return { path: url.pathname, search: url.search, hash: url.hash };
  }

  #href(location: RouteLocation): string {
    const tail = location.path + location.search + location.hash;
    return this.#mode === 'hash' ? `#${tail}` : this.#base + tail.slice(1);
  }

  /** The application location of the document's URL, or `undefined` outside the base path. */
  #read(): RouteLocation | undefined {
    const { pathname, search, hash } = this.#window!.location;
    if (this.#mode === 'hash') {
      const fragment = hash.slice(1);
      if (!fragment || fragment.startsWith('/')) return this.#fromHashPath(fragment || '/');
      // An in-page fragment (`#section`): the committed route, scrolled to that fragment.
      const current = this.#committed ?? { path: '/', search: '', hash: '' };
      return { path: current.path, search: current.search, hash };
    }
    return this.#fromPathname(pathname, search, hash);
  }

  #fromHashPath(path: string): RouteLocation {
    const url = new URL(path, `${ORIGIN}/`);
    return { path: url.pathname, search: url.search, hash: url.hash };
  }

  #fromPathname(pathname: string, search: string, hash: string): RouteLocation | undefined {
    const base = this.#base;
    if (pathname === base.slice(0, -1)) return { path: '/', search, hash };
    if (!pathname.startsWith(base)) return undefined;
    return { path: `/${pathname.slice(base.length)}`, search, hash };
  }

  #onClick(event: MouseEvent): void {
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) {
      return;
    }
    const anchor = event
      .composedPath()
      .find(
        (node): node is HTMLAnchorElement =>
          (node as Element).localName === 'a' &&
          typeof (node as HTMLAnchorElement).href === 'string',
      );
    if (!anchor?.hasAttribute('href') || anchor.hasAttribute('download')) return;
    const target = anchor.getAttribute('target');
    if (target && target.toLowerCase() !== '_self') return;
    if (/(?:^|\s)external(?:\s|$)/i.test(anchor.getAttribute('rel') ?? '')) return;
    const url = new URL(anchor.href);
    const page = this.#window!.location;
    if (url.origin !== page.origin) return;
    const sameDocument = url.pathname === page.pathname && url.search === page.search;
    let location: RouteLocation | undefined;
    if (this.#mode === 'hash') {
      if (!sameDocument) return;
      const fragment = url.hash.slice(1);
      if (!fragment || fragment.startsWith('/')) location = this.#fromHashPath(fragment || '/');
      else {
        const current = this.#committed ?? { path: '/', search: '', hash: '' };
        location = { path: current.path, search: current.search, hash: url.hash };
      }
    } else {
      // A link to a fragment of this document: the browser scrolls to it natively.
      if (sameDocument && url.hash) return;
      location = this.#fromPathname(url.pathname, url.search, url.hash);
      if (!location) return; // outside the base path: another application or document
    }
    event.preventDefault();
    const same = this.#committed && this.#href(location) === this.#href(this.#committed);
    void this.#go(location, same ? 'replace' : 'push');
  }

  #go(
    location: RouteLocation | undefined,
    kind: Kind,
    redirects = 0,
    fresh = false,
  ): Promise<boolean> {
    const previous = this.#pending;
    if (previous) {
      this.#abandon(
        previous,
        new DOMException(`${this.#label()} navigation superseded`, 'AbortError'),
      );
    }
    return new Promise<boolean>((resolve) => {
      const navigation: Navigation = { location, kind, levels: [], pending: 0, resolve };
      this.#pending = navigation;
      if (!location) {
        this.#commit(navigation, 'not-found');
        return;
      }
      let chain: readonly MatchedRoute[] | undefined;
      try {
        chain = untracked(() => matchRoutes(this.#options.routes, location.path));
      } catch (error) {
        this.#commit(navigation, 'error', error);
        return;
      }
      if (!chain) {
        this.#commit(navigation, 'not-found');
        return;
      }
      const leaf = chain[chain.length - 1]!;
      const redirect = leaf.route.redirect;
      if (redirect !== undefined) {
        let target: RouteLocation;
        try {
          if (redirects >= MAX_REDIRECTS) {
            throw new OddkinError(
              'app.router.redirect',
              DEV
                ? `${this.#label()} stopped after ${MAX_REDIRECTS} redirects in a row at "${location.path}"; the redirects probably form a loop.`
                : '',
            );
          }
          target = this.#parse(
            typeof redirect === 'function'
              ? untracked(() => redirect({ params: leaf.params, location }))
              : redirect,
          );
        } catch (error) {
          this.#commit(navigation, 'error', error);
          return;
        }
        this.#pending = undefined;
        resolve(this.#go(target, kind === 'push' ? 'push' : 'replace', redirects + 1, fresh));
        return;
      }
      let reusing = !fresh;
      for (let depth = 0; depth < chain.length; depth++) {
        const matched = chain[depth]!;
        const key = JSON.stringify(matched.raw) + (matched.route.search ? location.search : '');
        const current = this.#levels[depth];
        if (reusing && current?.route === matched.route && current.key === key) {
          navigation.levels.push(current);
          continue;
        }
        reusing = false;
        this.#start(navigation, matched, key, location);
        if (this.#pending !== navigation) return; // a load navigated elsewhere synchronously
      }
      if (navigation.pending === 0) this.#commit(navigation, 'ready');
      else this.#state.value = { ...this.#state.peek(), navigating: location };
    });
  }

  /** Create a level for a new match and start its load. */
  #start(
    navigation: Navigation,
    matched: MatchedRoute,
    key: string,
    location: RouteLocation,
  ): void {
    const route = matched.route;
    const level: Level = {
      route,
      key,
      params: matched.params,
      scope: createScope({ name: `${this.#label()} ${route.path || '(index)'}` }),
      search: undefined,
      status: 'pending',
      data: undefined,
      error: undefined,
      match: undefined,
    };
    navigation.levels.push(level);
    let result: unknown;
    try {
      if (route.search) {
        level.search = untracked(() => route.search!(new URLSearchParams(location.search)));
      }
      result = route.load
        ? untracked(() =>
            route.load!({
              params: level.params,
              search: level.search,
              location,
              signal: level.scope.signal,
              scope: level.scope,
            }),
          )
        : undefined;
    } catch (error) {
      level.status = 'error';
      level.error = error;
      return;
    }
    if (isPromiseLike(result)) {
      navigation.pending++;
      // Both handlers at once: a rejection after supersession is handled, never unhandled.
      Promise.resolve(result).then(
        (data) => this.#settle(navigation, level, 'ready', data),
        (error: unknown) => this.#settle(navigation, level, 'error', error),
      );
    } else {
      level.status = 'ready';
      level.data = result;
    }
  }

  #settle(navigation: Navigation, level: Level, status: 'ready' | 'error', value: unknown): void {
    if (this.#pending !== navigation) return; // superseded or stopped: never commits
    level.status = status;
    if (status === 'ready') level.data = value;
    else level.error = value;
    if (--navigation.pending === 0) this.#commit(navigation, 'ready');
  }

  #commit(navigation: Navigation, outcome: 'ready' | 'error' | 'not-found', error?: unknown): void {
    this.#pending = undefined;
    const { location, kind, levels } = navigation;
    const win = this.#window!;
    if (location) {
      const href = this.#href(location);
      if (kind === 'push') win.history.pushState(null, '', href);
      else if (kind === 'replace') win.history.replaceState(null, '', href);
      else if (kind === 'pop' && this.#mode === 'hash' && win.location.hash !== href) {
        win.history.replaceState(win.history.state, '', href); // `#section` → `#/path#section`
      }
    }
    for (const level of this.#levels) {
      if (!levels.includes(level)) {
        level.scope.dispose(
          new DOMException(`${this.#label()} left "${level.route.path}"`, 'AbortError'),
        );
      }
    }
    this.#levels = levels;
    this.#committed = location;
    const failed = levels.find((level) => level.status === 'error');
    const state: RouterState = {
      status: outcome === 'ready' && failed ? 'error' : outcome,
      location,
      matches: levels.map(toMatch),
      error: outcome === 'error' ? error : failed?.error,
      navigating: undefined,
    };
    this.#state.value = state;
    this.#title(state);
    navigation.resolve(true);
  }

  #title(state: RouterState): void {
    untracked(() => {
      let title: string | undefined;
      try {
        for (let i = state.matches.length - 1; i >= 0 && title === undefined; i--) {
          const match = state.matches[i]!;
          const own = match.route.title;
          title = typeof own === 'function' ? own(match) : own;
        }
        const format = this.#options.formatTitle;
        if (format) title = format(title, state);
      } catch (error) {
        reportOddkinError(error, { code: 'app.router.title', origin: this.#label() });
        return;
      }
      if (title !== undefined) this.#window!.document.title = title;
    });
  }

  /** A superseded or stopped navigation: abort its new levels; it never commits. */
  #abandon(navigation: Navigation, reason: unknown): void {
    this.#pending = undefined;
    for (const level of navigation.levels) {
      if (!this.#levels.includes(level)) level.scope.dispose(reason);
    }
    navigation.resolve(false);
  }

  #release(reason: unknown): void {
    if (!this.#owner) return;
    this.#owner = undefined;
    const pending = this.#pending;
    if (pending) this.#abandon(pending, reason);
    for (const level of this.#levels) level.scope.dispose(reason);
    this.#levels = [];
    this.#committed = undefined;
    this.#window = undefined;
    this.#state.value = IDLE;
  }
}

/**
 * A router over `routes`. Inert until it is used as a service (`use(router)` in an
 * application's setup, or `scope.use(router)`); it then reads the URL, intercepts links, and
 * follows history until that scope ends.
 */
export function createRouter(options: RouterOptions): Router {
  const mode = options.mode ?? 'history';
  if (mode !== 'history' && mode !== 'hash') {
    throw new OddkinError(
      'app.router.options',
      DEV ? `createRouter() mode must be "history" or "hash", not ${String(mode)}.` : '',
    );
  }
  let base = options.base ?? '/';
  if (typeof base !== 'string' || !base.startsWith('/') || /[?#]/.test(base)) {
    throw new OddkinError(
      'app.router.options',
      DEV
        ? `createRouter() base must be a path starting with "/", such as "/docs/", not ${String(base)}.`
        : '',
    );
  }
  if (!base.endsWith('/')) base += '/';
  if (!Array.isArray(options.routes)) {
    throw new OddkinError('app.router.options', DEV ? 'createRouter() needs a routes array.' : '');
  }
  validateRoutes(options.routes);
  return new RouterImpl(options, base, mode);
}
