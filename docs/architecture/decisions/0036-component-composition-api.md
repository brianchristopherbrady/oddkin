# 0036. Component composition API: `compose()` and `define(definition)`

- **Status:** Accepted
- **Date:** 2026-10-17
- **Area:** Core
- **Detailed contract:** [core-contracts.md](../core-contracts.md) §1.1; recomposition: [multi-product.md](../multi-product.md) §5
- **Related:** 0003 (property definitions), 0031 (size budgets), 0033 (multi-product foundations)

## Context
Oddkin's own components use one folder per component (class, template, styles, definition, registration, `index.ts`). Product teams need to reuse a component's behavior and template with different styles (ADR 0033). Class-only authoring puts the template in `render()` and styles in `static styles`, so neither can be swapped without subclassing and overriding, and subclasses inherit configuration they may not want.

## Decision
- `compose({ name, element, template?, styles?, dependencies? })` returns a frozen `ElementDefinition`. `template` is a function of the host. It runs in the same tracked render context as `render()`, so the binding rule, scheduling, lifecycle, `Scope` ownership, and DOM identity are unchanged.
- **Lineage:** every definition carries `source` (itself). Spreading a definition into `compose()` copies `source`, which the new definition records as `extends`. This was chosen over an explicit `extend()` helper because ordinary object spread is enough, it keeps typing simple, and the analyzer can see the relationship statically.
- `define(definition)` registers dependencies first, then the element. Before registering, it binds the definition to its **exact constructor** in a module-private `WeakMap`, so upgrades during `customElements.define` see it. Classes and definitions are never mutated, and a subclass never inherits a parent's definition.
- **Policy:** a definition's `styles` is the complete, ordered style list and replaces the class's `static styles`; without `styles`, the class's styles apply. A definition's `template` replaces `render()`. Development builds report `definition.render.ignored` when both exist.
- **Registration codes:** `registry.definitionConflict` (a different definition for a name already registered with that class); `registry.constructorReused` (a class already bound to another definition, or registered under another name); `registry.collision` (a different class for a taken name); `registry.definition.invalid`. Composition errors: `definition.element.invalid`, `definition.template.invalid`, `definition.dependency.invalid`. A failed registration leaves no binding behind.
- `define(tag, ctor)` and colocated class authoring stay fully supported.
- **Naming:** `compose()` (`@oddkin/core/element`) is the component-definition composer. The optional data-composition schema renderer is `renderComposition()` from `@oddkin/components/composition`.

## Alternatives considered
- **Explicit `extend(definition, overrides)`** — clearer intent but one more API; spread already expresses it.
- **Writing template and styles onto the class** — mutates shared classes and leaks configuration to subclasses.
- **Merging definition styles with class styles** — makes ordering implicit; one complete list is easier to reason about.

## Consequences
- External templates can only reach the host's public members. Members that exist only for a template use a leading `_` or `@internal` and are excluded from metadata.
- `define()` carries the definition path for every consumer: the counter fixture grew from 9,280 to 9,521 B gzip (budget 9,728 B, 97.9%).

## Evidence
`packages/core/test/definition.browser.test.ts` (17 tests × Chromium, Firefox, WebKit): frozen definitions and lineage; external templates with direct-binding skips, tracked re-runs, and preserved DOM identity; ordered, document-shared definition styles replacing class styles; recomposition coexisting with its foundation; no inherited definitions; idempotence, conflict, reuse, and collision codes with no leftover binding; dependency-first registration upgrading existing elements; `definition.render.ignored`; scope counts back to baseline after reconnects. Full core suite (416 tests) and size budgets pass.

Analyzer: `packages/analyzer/test/analyzer.test.ts` — a folder-structured fixture with a recomposed definition gives CEM declarations identical to the colocated fixture; metadata `definition` records `ref`, `extends`, template, styles, and dependencies; `@internal` members excluded; unresolvable definitions report `analyzer.dynamic.*`.

## Revisit when
Analyzer support shows the spread-based lineage cannot be extracted reliably, or the size budget is exceeded.
