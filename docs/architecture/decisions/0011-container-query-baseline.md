# 0011. Container/media query compatibility baseline

- **Status:** Accepted
- **Date:** 2026-10-17
- **Area:** Layout
- **Detailed contract:** [theming-and-styling.md §11.2](../theming-and-styling.md), [layout-recipes.md §5](../layout-recipes.md)

## Context
`var()` cannot appear in query conditions; newer query syntax has uneven support.

## Decision
Named conditions serialize to literal `min-width`/`max-width` queries (rem default) with named or unnamed containers and `prefers-*` media features. Range syntax and style queries are progressive enhancement only after browser evidence. Changing a threshold regenerates the relevant generated CSS; it never relies on runtime custom properties.

## Alternatives considered
- Custom properties in queries — not supported.
- JavaScript resize observation — violates the CSS-native responsiveness goal.

## Consequences
Theme Studio threshold edits regenerate preview-owned stylesheets.

## Evidence
CSS Conditional 5 (§12.3). BCD 8.1.6: container queries Chrome/Edge 105, Firefox 110, Safari 16.

## Revisit when
Range or style query syntax has verified support across the baseline.