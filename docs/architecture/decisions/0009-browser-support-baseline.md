# 0009. Browser support baseline

- **Status:** Accepted (2026-10-17, pinned for the v1 cycle and re-resolved each release; Safari 17.4 runtime evidence pending)
- **Date:** 2026-10-17
- **Area:** Platform
- **Detailed contract:** [IMPLEMENTATION_PLAN.md §2.5](../../../IMPLEMENTATION_PLAN.md), [css-architecture.md §2](../css-architecture.md); registry [features.json](../../compatibility/features.json); generated [matrix](../../compatibility/matrix.md)

## Context
Oddkin relies on modern platform features. The baseline must be explicit, evidence-based, and tested in CI.

## Decision
Minimum versions: **Chrome 125, Edge 125, Firefox 126, Safari 17.4**, and the mobile equivalents **Chrome Android 125, Firefox Android 126, Safari iOS 17.4** (all released between March and May 2024). These cover every required feature below. Newer features are feature-detected with documented fallbacks (ADR 0038). The floor, the data versions it was resolved with, and the date are pinned in `docs/compatibility/features.json` and checked by `npm run lint:css`; the token generator's `BROWSER_FLOOR` must match.

Relation to Baseline: on 2026-10-17, Baseline Widely Available corresponds to Chrome/Edge 123, Firefox 124, Safari 17.4 (computed from web-features 3.43.0). The floor is slightly higher because components require custom states (`:state()`, `ElementInternals.states`: Baseline newly available 2024-05-17, widely available 2026-11-17).

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
| `requestSubmit`, `<dialog>`, `popover` | 76, 37, 114 | 79, 79, 114 | 75, 98, 125 | 16, 15.4, 17 | Required (popover: floor exception on Safari iOS 17.0–18.2, no light dismiss on outside taps) |
| `Element.moveBefore` | 133 | 133 | 144 | no | Feature-detected |
| `ElementInternals.ariaLabelledByElements` | 135 | 135 | 136 | 16.4 | Feature-detected |
| Scoped custom element registries | 146 | 146 | preview | 26 | Feature-detected; not relied on |
| Trusted Types | 83 | 83 | 148 | 26 | Enforced where supported |

The JavaScript floor matches: shipped TypeScript targets ES2022 with the ES2023 library, so built-ins newer than the floor (set methods, iterator helpers) do not type-check.

## Alternatives considered
- "Last two major versions" — moving target; harder to reason about features.
- Lower baseline with polyfills — conflicts with zero third-party runtime dependencies.
- Baseline Widely Available exactly (Chrome 123, Firefox 124) — would exclude custom states until 2026-11-17.

## Consequences
CI runs Playwright's Chromium, Firefox, and WebKit; the floor probe runs the oldest Chrome and Firefox; the published matrix states tested versions. Generated CSS may use `oklch()` directly (it currently emits sRGB hex). Browsers below the floor are unsupported and get no compatibility build.

## Evidence
`@mdn/browser-compat-data` 8.1.6 and `web-features` 3.43.0 (queried 2026-10-17; pinned as exact dev dependencies). Floor runs (2026-10-17, `npm run compat:floor`, [floor-results.json](../../../research/compatibility/floor-results.json)): Chrome for Testing 125.0.6422.141 and Firefox 126.0 on Windows load the production core build, register `odd-button`, `odd-card`, and `odd-input` through an import map, share adopted sheets, resolve layered tokens in nested scopes, set `:state(user-invalid)`, submit form-associated values, and evaluate container queries (16/16 checks each); 20 feature detections per browser match BCD for that version. Pending: Safari 17.4 and Safari iOS 17.4 (not automatable on the current host), mobile Chrome and Firefox (data only), and the floor run in CI.

## Revisit when
Each release (raise the floor if a feature becomes essential); or if adopters need older Safari versions.
