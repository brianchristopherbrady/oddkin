# 0038. CSS compatibility policy and progressive enhancement

- **Status:** Accepted
- **Date:** 2026-10-17
- **Area:** Platform
- **Detailed contract:** [css-architecture.md](../css-architecture.md) §2–§4, §7, §14–§16; registry [features.json](../../compatibility/features.json); generated [matrix](../../compatibility/matrix.md)
- **Related:** 0006 (colour generation), 0007 (alias scope redeclaration), 0008 (style delivery), 0009 (browser floor), 0011 (query baseline), 0039 (layer order)

## Context

Oddkin wants modern CSS without separate styling systems or a fragile baseline. Browser support has to be checked per capability and per subfeature, and a few CSS behaviors defeat naive fallbacks: a defined custom property holding unsupported syntax invalidates the declaration that reads it at computed-value time (so `var()` fallbacks are not a compatibility mechanism); an unsupported selector in a shared selector list drops the whole rule; registered custom properties mask `var()` fallbacks. There was no machine-checked record of which features Oddkin relies on, no lint for shipped CSS, and no run in the oldest supported browsers.

## Decision

1. **Categories.** Every adopted or evaluated platform feature is a *foundation* (fully supported at the ADR 0009 floor, or with a documented floor exception), an *enhancement* (gated, with a working baseline, documented differences, and tests of both paths), *experimental* (isolated, never shipped), or *deferred/declined* (reason and owner recorded), in `docs/compatibility/features.json` with each BCD subfeature listed individually.
2. **Gates.** Enhancements apply only behind `@supports` (or `@supports selector()`), as a literal parse-time fallback after a floor value of the same property, or behind script feature detection. A `var()` fallback is never a gate, and a literal fallback never applies to values that use `var()`. Above-floor selectors never share a non-forgiving selector list.
3. **Tokens.** Token values stay within the floor. The generator reports `value.syntax.aboveFloor` for value syntax the floor cannot parse; enhanced token values, when introduced, are emitted by the canonical generator inside gates per scope.
4. **No registrations of tokens or component variables** (`@property`, `CSS.registerProperty()`); component-private registrations later follow the policy in css-architecture.md §7.
5. **One output, no transpiler.** The floor needs no syntax lowering; statically computable values are produced by the generator; runtime-dependent behavior gets shared Oddkin code only where required. No polyfills.
6. **Checks.** `npm run lint:css` validates the registry against the pinned data, verifies the generator's above-floor list, lints every shipped and example stylesheet, and keeps the generated matrix current. `npm run compat:floor` runs a probe in the floor browsers that can be automated.

## Alternatives considered

- **Baseline status only** (no registry): coarse; hides subfeature gaps such as `position-anchor` (full support only from Chrome 151) or popover light dismiss on iOS.
- **A CSS transpiler with browser targets** (e.g. Lightning CSS): nothing in the shipped CSS needs lowering at the floor, and unwrapping layers or emulating `@scope` would change semantics; it would add a build step to the no-build consumption path.
- **Broad CSS polyfills**: violate the zero-runtime-dependency rule and approximate semantics (anchoring, relational selectors) at a performance cost.
- **Mocked `CSS.supports()` in tests**: does not change what the parser accepts; rejected as evidence.

## Consequences

- Adopting a feature means a registry entry with its subfeatures, gate, baseline, and tests; the lint rejects unregistered or ungated uses, including a few real cases it found (`cursor` and `resize` have no effect on iOS; registered as foundations with floor exceptions).
- Enhancements cost a gate, a baseline, and two tested paths each; the matrix makes that cost visible.
- The registry and matrix must be re-resolved when the floor or data versions change (css-architecture.md §2.3).

## Evidence

`@mdn/browser-compat-data` 8.1.6 and `web-features` 3.43.0 (2026-10-17). `npm run lint:css`: 69 registered features, 16 stylesheets, 150 compatibility keys, no problems; `tests/compat/check-css.test.ts` proves each rule catches its hazard. `packages/tokens/test/cascade.browser.test.ts` (Chromium 156, Firefox 157, WebKit 27.2) shows the computed-value-time invalidation and the gated alternative. Floor probe (`tests/floor/probe.html`, [floor-results.json](../../../research/compatibility/floor-results.json)): Chrome for Testing 125.0.6422.141 and Firefox 126.0 pass 16/16 checks; the hazard reproduced with `contrast-color(red)` (Chrome 125) and `oklch(from red l c h)` (Firefox 126), the gated value kept the baseline, a registered initial value masked a `var()` fallback in Chrome 125, and all 20 feature detections matched BCD. Pending: Safari 17.4 runtime evidence.

Re-resolved for the Baseline 2024 floor (2026-10-26, ADR 0046 D1): `npm run compat` reports 71 registered features, 178 stylesheets, 314 compatibility keys, no problems. `text-wrap: balance` and `scrollbar-gutter` became foundations; `light-dark()` and relative colour syntax left the generator's above-floor list; `@starting-style` stays an enhancement because Firefox 132 implements `transition-behavior` only partly (no `display` transitions). Floor probe: Chrome for Testing 130.0.6723.116 and Firefox 132.0 pass 16/16 checks each and all 23 feature detections per browser match BCD; the hazard reproduced with `contrast-color(red)` in both, and a registered initial value masked a `var()` fallback in both. Pending: Safari 18.2 runtime evidence (no macOS host).

## Revisit when

The floor moves (ADR 0009); a needed feature cannot be expressed with a gate and baseline; or a transpiler becomes necessary for a newly required syntax.
