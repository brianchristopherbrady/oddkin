/**
 * `@oddkin/app/app` — application ownership: `createApp()` with one root scope per run.
 * Imports without DOM globals. Contract: docs/architecture/core-contracts.md §9.
 */
export { createApp } from './app.js';
export type { App, AppContext, AppOptions, AppService } from './app.js';
