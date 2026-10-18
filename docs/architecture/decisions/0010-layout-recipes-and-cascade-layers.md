# 0010. Layout recipe model and cascade layering

- **Status:** Proposed
- **Date:** 2026-10-17
- **Area:** Layout
- **Detailed contract:** [layout-recipes.md](../layout-recipes.md)

## Context
Repeated layout CSS should be reusable without a second styling language or a build step.

## Decision
- `defineLayoutRecipe` with `stack`, `row`, `grid`, `autoGrid`, `split`, evaluated at module scope into an ordinary reusable stylesheet; generic in `@oddkin/core/layout`, Oddkin defaults in `@oddkin/components/layout`.
- Layers `recipe.base → recipe.variant → recipe.condition`; among normal author rules in the same encapsulation context, unlayered rules win; shadow-root recipes are customized through roles, component variables, parts, and host styles; `!important` follows reversed layer and cross-context precedence.
- `extend()` creates new recipes without mutating shared sheets.

## Alternatives considered
- Utility-class framework — renames CSS properties; poor encapsulation.
- Template styling directives — deferred until handwritten-vs-recipe evidence justifies them.

## Consequences
Recipe CSS must be inspected for conflicts with consumer layer orders in light DOM.

## Evidence
CSS Cascade 5, CSS Shadow (§12.3). Pending: M4 side-nav handwritten vs recipe comparison.

## Revisit when
The side-nav slice shows recipes do not reduce authored CSS or create precedence surprises.