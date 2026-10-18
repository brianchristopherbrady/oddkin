/**
 * `@oddkin/core/template` — tagged templates with explicit binding parts.
 * Contract: docs/architecture/core-contracts.md §1, §6.
 */
export { html, svg, nothing, isTemplateResult } from './result.js';
export type { TemplateResult, TemplateKind } from './result.js';
export { render, BLOCKED_URL } from './parts.js';
export type { ChildPart, RenderOptions } from './parts.js';
export { when, match, repeat } from './directives.js';
export { ATTRIBUTE_DIRECTIVE, isAttributeDirective } from './directive.js';
export type {
  AttributeDirective,
  DirectiveBinding,
  DirectiveHandler,
  DirectivePartType,
  DirectiveResult,
} from './directive.js';
