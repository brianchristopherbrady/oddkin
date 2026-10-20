/**
 * Route definitions and path matching for `@oddkin/app/router` (core-contracts.md §9). Pure and
 * DOM-free: `matchRoutes()` can also enumerate and check routes outside a browser (for example a
 * static build). Patterns are written per level, relative to the parent: static segments,
 * `:name` parameters (one whole segment), and a final `*` for the rest of the path. Siblings are
 * tried in definition order and the first full match wins.
 */
import { DEV } from '../internal/dev.js';
import { OddkinError } from '@oddkin/core/diagnostics';
import type { Scope } from '@oddkin/core/scope';

/** Decoded path parameters, accumulated from the outermost level down. `*` holds the rest. */
export type RawParams = Readonly<Record<string, string>>;

/** A location inside the application: the path below the base path, and its query and fragment. */
export interface RouteLocation {
  /** Percent-encoded, starting with `/`: `/components/odd-button`. */
  readonly path: string;
  /** `''` or `?…`. */
  readonly search: string;
  /** `''` or `#…`. */
  readonly hash: string;
}

/** What a level's `load` receives. Everything registered on `scope` ends with the level. */
export interface RouteContext<P, S> {
  readonly params: P;
  readonly search: S;
  readonly location: RouteLocation;
  /** Aborted when the navigation is superseded or the level is left. */
  readonly signal: AbortSignal;
  /** The level's own scope: it lives while the level stays matched. */
  readonly scope: Scope;
}

/** A committed level: its route, parsed params and search, and its loaded data or error. */
export type RouteMatch<P = unknown, S = unknown, T = unknown> = {
  readonly route: Route<P, S, T>;
  readonly params: P;
  readonly search: S;
} & (
  | { readonly status: 'ready'; readonly data: T }
  | { readonly status: 'error'; readonly error: unknown }
);

export interface Route<P = RawParams, S = undefined, T = undefined> {
  /** Pattern relative to the parent: `'components'`, `':tag'`, `'*'`, or `''` (index). */
  readonly path: string;
  readonly name?: string;
  /**
   * Typed parameters from the raw ones (all levels so far). Return `undefined` to decline the
   * match, so matching goes on with the next route (for example a non-numeric id).
   */
  readonly params?: (raw: RawParams) => P | undefined;
  /** Typed search parameters. A level that declares `search` reloads when the query changes. */
  readonly search?: (search: URLSearchParams) => S;
  /** Load the level's module or data (`() => import('./page.js')`). Runs untracked. */
  readonly load?: (context: RouteContext<P, S>) => T | PromiseLike<T>;
  /** The document title while this is the deepest level with a title. */
  readonly title?: string | ((match: RouteMatch<P, S, T>) => string | undefined);
  /** Replace a navigation that ends here with another application path (legacy routes). */
  readonly redirect?:
    string | ((context: { readonly params: P; readonly location: RouteLocation }) => string);
  readonly children?: readonly AnyRoute[];
}

export type AnyRoute = Route<any, any, any>;

/** One matched level, before loading: the route with its raw and parsed parameters. */
export interface MatchedRoute {
  readonly route: AnyRoute;
  /** Raw parameters of this level and all levels above it. */
  readonly raw: RawParams;
  readonly params: unknown;
}

type Segment =
  | { readonly kind: 'static'; readonly value: string }
  | { readonly kind: 'param'; readonly name: string }
  | { readonly kind: 'rest' };

const compiled = new WeakMap<AnyRoute, readonly Segment[]>();

const invalid = (message: string): OddkinError => new OddkinError('app.router.route', message);

function compile(route: AnyRoute): readonly Segment[] {
  let segments = compiled.get(route);
  if (segments) return segments;
  if (typeof route.path !== 'string') {
    throw invalid(DEV ? `A route path must be a string, not ${String(route.path)}.` : '');
  }
  const parts = route.path.split('/').filter(Boolean);
  segments = parts.map((part, index): Segment => {
    if (part === '*') {
      if (index !== parts.length - 1) {
        throw invalid(
          DEV
            ? `Route "${route.path}": "*" matches the rest of the path, so it must come last.`
            : '',
        );
      }
      return { kind: 'rest' };
    }
    if (part.startsWith(':')) {
      const name = part.slice(1);
      if (!name) {
        throw invalid(DEV ? `Route "${route.path}": a parameter needs a name, as in ":id".` : '');
      }
      return { kind: 'param', name };
    }
    return { kind: 'static', value: part };
  });
  if (route.children !== undefined && !Array.isArray(route.children)) {
    throw invalid(DEV ? `Route "${route.path}": children must be an array of routes.` : '');
  }
  if (route.redirect !== undefined && route.children?.length) {
    throw invalid(
      DEV
        ? `Route "${route.path}" redirects, so it cannot have children: a redirect applies where a navigation ends.`
        : '',
    );
  }
  compiled.set(route, segments);
  return segments;
}

/** Check every route below `routes` once, throwing `app.router.route` for an invalid pattern. */
export function validateRoutes(routes: readonly AnyRoute[]): void {
  for (const route of routes) {
    compile(route);
    if (route.children) validateRoutes(route.children);
  }
}

/** Define a route; the same object, typed. Patterns are checked here and by `createRouter()`. */
export function route<P = RawParams, S = undefined, T = undefined>(
  definition: Route<P, S, T>,
): Route<P, S, T> {
  compile(definition);
  return definition;
}

const decode = (segment: string): string | undefined => {
  try {
    return decodeURIComponent(segment);
  } catch {
    return undefined;
  }
};

function matchLevel(
  routes: readonly AnyRoute[],
  segments: readonly string[],
  start: number,
  raw: RawParams,
  out: MatchedRoute[],
): boolean {
  for (const route of routes) {
    const params: Record<string, string> = { ...raw };
    let index = start;
    let matched = true;
    for (const segment of compile(route)) {
      if (segment.kind === 'rest') {
        params['*'] = segments.slice(index).join('/');
        index = segments.length;
        break;
      }
      const value = segments[index];
      if (value === undefined || (segment.kind === 'static' && value !== segment.value)) {
        matched = false;
        break;
      }
      if (segment.kind === 'param') params[segment.name] = value;
      index++;
    }
    if (!matched) continue;
    const parsed = route.params ? route.params(params) : params;
    if (parsed === undefined) continue;
    out.push({ route, raw: params, params: parsed });
    if (route.children?.length && matchLevel(route.children, segments, index, params, out)) {
      return true;
    }
    if (index === segments.length) return true;
    out.pop();
  }
  return false;
}

/**
 * Match an application path (percent-encoded, below the base path) against `routes`. Returns
 * the matched levels from the outermost down, or `undefined` when nothing matches. Segments are
 * decoded before matching; a path that cannot be decoded matches nothing. Trailing slashes are
 * ignored. A `params` function that throws makes `matchRoutes` throw.
 */
export function matchRoutes(
  routes: readonly AnyRoute[],
  path: string,
): readonly MatchedRoute[] | undefined {
  const segments: string[] = [];
  for (const part of path.split('/')) {
    if (!part) continue;
    const decoded = decode(part);
    if (decoded === undefined) return undefined;
    segments.push(decoded);
  }
  const out: MatchedRoute[] = [];
  return matchLevel(routes, segments, 0, {}, out) ? out : undefined;
}
