/**
 * `@oddkin/workbench/app` — the Workbench shell (workbench.md §2.1): `<oddkin-workbench>` and the
 * DOM-free pieces it is built from (registry routes, search). Registration is the separate,
 * side-effecting `@oddkin/workbench/app/define`.
 */
export { OddkinWorkbench } from './shell.js';
export type { WorkbenchSource } from './shell.js';
export { shellRoutes } from './routes.js';
export type { PageLoader, ShellView } from './routes.js';
export { search, searchItems } from './search.js';
export type { SearchItem } from './search.js';
