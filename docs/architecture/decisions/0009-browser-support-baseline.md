# 0009. Browser support baseline

- **Status:** Proposed
- **Date:** 2026-10-17
- **Area:** Platform
- **Detailed contract:** [IMPLEMENTATION_PLAN.md §2.5](../../../IMPLEMENTATION_PLAN.md)

## Context
Oddkin relies on modern platform features. The baseline must be explicit, evidence-based, and tested in CI.

## Decision
Proposed minimum versions: **Chrome 125, Edge 125, Firefox 126, Safari 17.4** (all released by mid-2024). These cover every required feature below. Newer features are feature-detected with documented fallbacks.

| Feature (BCD 8.1.6) | Chrome | Edge | Firefox | Safari | Use |
| --- | --- | --- | --- | --- | --- |
| `adoptedStyleSheets`, `CSSStyleSheet()` | 73 | 79 | 101 | 16.4 | Required |
| `ElementInternals` / `setFormValue` | 77 | 79 | 93 / 98 | 16.4 | Required (forms) |
| `ElementInternals.states` / `:state()` | 90 / 125 | 90 / 125 | 126 | 17.4 | Required (custom states) |
| Container queries | 105 | 105 | 110 | 16 | Required |
| Cascade layers | 99 | 99 | 97 | 15.4 | Required |
| `:where()` | 88 | 88 | 78 | 14 | Required |
| `oklch()` | 111 | 111 | 113 | 15.4 | Required (generated CSS) |
| Import maps | 89 | 89 | 108 | 16.4 | Required (no-build path) |
| `AbortSignal.any` / `.timeout` | 116 / 124 | 116 / 124 | 124 / 100 | 17.4 / 16 | Required |
| `requestSubmit`, `<dialog>`, `popover` | 76, 37, 114 | 79, 79, 114 | 75, 98, 125 | 16, 15.4, 17 | Required |
| `Element.moveBefore` | 133 | 133 | 144 | no | Feature-detected |
| Scoped custom element registries | 146 | 146 | preview | 26 | Feature-detected; not relied on |
| Trusted Types | 83 | 83 | 148 | 26 | Enforced where supported |

## Alternatives considered
- "Last two major versions" — moving target; harder to reason about features.
- Lower baseline with polyfills — conflicts with zero third-party runtime dependencies.

## Consequences
CI runs Playwright's Chromium, Firefox, and WebKit; the published matrix states tested versions. Generated CSS may use `oklch()` directly.

## Evidence
`@mdn/browser-compat-data` 8.1.6 (queried 2026-10-17). Pending: CI runs on the minimum and current versions where obtainable.

## Revisit when
Each release (raise floor if a feature becomes essential); or if adopters need older Safari versions.