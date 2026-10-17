# 0008. Style delivery and CSP

- **Status:** Proposed
- **Date:** 2026-10-17
- **Area:** Core
- **Detailed contract:** [theming-and-styling.md §7](../theming-and-styling.md)

## Context
Static component styles should be parsed once per document and shared across instances, work under strict CSP, and never be rebuilt on updates.

## Decision
- `css` results become one constructed `CSSStyleSheet` per style definition per document, adopted by every instance (`adoptedStyleSheets`).
- A `<style>` path with CSP nonce remains available as an explicit option; under the baseline (ADR 0009) it is not needed for capability, only for policy or legacy embedding.
- Light-DOM styles use explicit scoping and a de-duplicated sheet per root.
- Published components ship ready JS style modules; no CSS loader required.

## Alternatives considered
- `<style>` per instance — duplicate parsing and memory.
- Native CSS module scripts as the primary path — not needed for shipping; optional future path.

## Consequences
Document adoption must swap to the new document's sheet. CSP behavior of constructed sheets must be verified.

## Evidence
R25. BCD 8.1.6: `adoptedStyleSheets` and `CSSStyleSheet()` Chrome/Edge 73/79, Firefox 101, Safari 16.4. Pending: M3 test of constructed sheets under strict `style-src` policies in all three engines.

## Revisit when
CSP testing shows constructed sheets are blocked under a policy we must support.