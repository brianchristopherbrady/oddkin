/**
 * `@oddkin/app/router` — URL-driven navigation on the History API and native anchors: nested and
 * lazy routes, typed parameters, not-found and route errors, per-level ownership, navigation
 * cancellation, a base path, and a hash mode. Imports without DOM globals; `matchRoutes` is
 * DOM-free. Contract: docs/architecture/core-contracts.md §9.
 */
export { matchRoutes, route } from './match.js';
export type {
  AnyRoute,
  MatchedRoute,
  RawParams,
  Route,
  RouteContext,
  RouteLocation,
  RouteMatch,
} from './match.js';
export { createRouter } from './router.js';
export type { NavigateOptions, Router, RouterMode, RouterOptions, RouterState } from './router.js';
