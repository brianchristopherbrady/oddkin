# 0008. Style delivery and CSP

- **Status:** Accepted
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
R25. BCD 8.1.6: `adoptedStyleSheets` and `CSSStyleSheet()` Chrome/Edge 73/79, Firefox 101, Safari 16.4. M3 (2026-10-17): `e2e/core-counter.spec.ts` runs under `default-src 'none'; style-src 'self'; require-trusted-types-for 'script'` with zero policy violations in Chromium, Firefox, and WebKit; components style through one adopted constructed sheet. 100 instances share one sheet per document; adoption into an iframe document swaps to that document's sheet (`element.browser.test.ts`). Light-DOM scoping is not yet implemented.

## Revisit when
CSP testing shows constructed sheets are blocked under a policy we must support.