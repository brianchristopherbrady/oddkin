/**
 * `@mote/core/template` — tagged templates with explicit binding parts.
 * Contract: docs/architecture/core-contracts.md §1, §6.
 */
export { html, svg, nothing, isTemplateResult } from './result.js';
export type { TemplateResult, TemplateKind } from './result.js';
export { render, BLOCKED_URL } from './parts.js';
export type { ChildPart, RenderOptions } from './parts.js';
export { when, match, repeat } from './directives.js';
