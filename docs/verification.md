# Verification log

Recorded results of checks. Each entry states the date, environment, command, and outcome. Never record a result that was not observed. Package, element, file, and token names in every entry use the current naming contract ([ADR 0037](./architecture/decisions/0037-naming-contract.md)).

**Evidence vocabulary.** Plan and architecture status uses: *implemented and verified* (entry below), *implemented with remaining verification*, *planned*, *experimental*, and *explicitly deferred*. Selected verification results use `selected`, `passed`, `failed`, `reused` (with the reused baseline's conditions), `not-executed`, and `unresolved` ([change-impact-and-verification.md](./architecture/change-impact-and-verification.md) §2.4). Results name the implementation, configuration, browser and version, and suite version they apply to; automated results never stand in for manual accessibility evidence, and a navigation test that only calls "go back" is not back/forward cache evidence.

## 2026-10-17 — M1 workspace skeleton

**Environment:** Windows, Node 24.19.0, npm 11.17.0, TypeScript 7.0.2, Vitest 5.0.5, Playwright 1.64.1 (Chrome for Testing 156.0.8078.4, Firefox 157.0, WebKit 27.2), Prettier 3.9.10, es-module-lexer 3.0.4, Ajv 8 + ajv-formats 3.

| Check | Command | Result |
| --- | --- | --- |
| Build | `npm run build` | Pass — 5 packages + `apps/docs` built with `tsc -b` (ESM + declarations + maps) |
| Boundaries | `npm run lint:boundaries` | Pass — 6 packages, 6 source files, 10 imports; manifests, sources, built artifacts, and the DOM-free `@oddkin/tokens` entry checked |
| Deliberate violation | Added `import '@oddkin/state'` to `packages/components/src/index.ts`, ran the checker, reverted | Fails as intended: `✖ [boundary.import.forbidden] @oddkin/components may not import @oddkin/state.` with file and fix |
| Formatting | `npm run format:check` | Pass |
| Typecheck | `npm run typecheck` | Pass — packages, tests, e2e, and configs |
| Unit tests | `npm test` | Pass — 29 tests: 5 package skeleton tests, 11 boundary-checker tests (temporary fixture workspaces), 13 schema tests |
| Full pipeline | `npm run verify` | Pass — lint, typecheck, unit tests, browser tests, packed consumers in one run |
| Browser tests | `npm run test:e2e` | Pass — plain-HTML consumer loads every package through an import map in Chromium, Firefox, and WebKit with no page errors |
| Packed consumers | `npm run verify:packs` | Pass — 5 tarballs installed into a temporary project outside the workspace; runtime imports and declarations resolve; no third-party runtime dependencies installed |

**Finding during M1:** the first boundary run reported "OK" while scanning zero imports, because es-module-lexer 3 renamed the import field (`n` → `specifier`). Fixed; the checker now reports scan counts and fails if source files yield no imports, and a test asserts side-effect and type-only imports are counted.

**Not yet verified:** the CI workflow (`.github/workflows/ci.yml`) has not run (no remote configured). Minimum browser versions from ADR 0009 are not yet tested; only current Playwright builds were used.
## 2026-10-17 — M3 core reactivity and `Scope`

**Environment:** as M1.

| Check | Command | Result |
| --- | --- | --- |
| Reactive graph | `npx vitest run packages/core` | Pass — 37 tests: signal equality/no-op writes, lazy memoized computed, diamond glitch-freedom, dynamic dependencies, unchanged-derivation suppression, cached errors, cycles (`reactive.cycle`), writes in computed, nested batches, reentrant subscribers, runaway detection, effect phases, cleanup ordering, self-writing effects, self-disposal, error isolation, `untracked`, `settled` |
| `Scope` | `npx vitest run packages/core` | Pass — 16 tests: reverse-order cleanup, early release, error isolation (`scope.cleanup.error` with origin), disposed-scope no-ops, abort reason, listener removal and options, timeouts/intervals (fake timers, `scope.timer.error`), child disposal and detachment, per-run effect scopes, controllers |
| Leak baseline | `scope.test.ts` "returns to baseline after 1,000 mount/dispose cycles" | Pass — internal scope/listener/timer/effect counts return to the starting values |
| DOM-free entries | `npm run lint:boundaries` | Pass — `@oddkin/core/reactive` and `@oddkin/core/scope` import in Node without DOM globals; 6 packages, 11 source files, 21 imports |
| Full pipeline | `npm run verify` | Pass — 81 unit tests, 3 browser tests (Chromium, Firefox, WebKit), packed consumers |

**Findings:** (1) registering an observer on a computed marked it stale and suppressed later pushes; fixed by forcing a global-version recheck instead. (2) An effect that writes a source it read must re-run; effects now compare source versions after each run and reschedule, with runaway detection. (3) `tsc` rejected test mocks returning values from effects — the `EffectFn` return type (void or cleanup) is enforced as intended.

**Not yet measured:** collection update cost, size, startup, and memory (M3 measurements).
## 2026-10-17 — M3 templates, styles, elements, and the property API

**Environment:** as M1, plus `@vitest/browser-playwright` 5.0.5 (dev-only) running Vitest browser tests in the same Playwright builds.

| Check | Command | Result |
| --- | --- | --- |
| Template lexer | `npx vitest run --project node packages/core` | Pass — case-preserved attribute names, multi-value attributes, comments/raw text ignored; stable codes for tag-name, attribute-name, comment, raw-text, mixed, `on*`, `innerHTML`/`srcdoc`, and unclosed positions |
| Templates (browser) | `npx vitest run --project browser` | Pass in Chromium, Firefox, WebKit — text never parsed as markup; in-place text and nested-instance reuse; nodes, arrays; functions not called; direct readable bindings without re-render; attribute/boolean/property parts; one DOM mutation per change (MutationObserver); subscription release; stable event listener with host `this`; `when`/`match`; keyed `repeat` reuse, release, duplicate-key diagnostic; focus kept across updates; SVG namespace; `javascript:` URLs blocked |
| Elements (browser) | same | Pass in all three — counter clicks update without `render()`; tracked `.value` reads re-render once per flush; dual-path value written once; handler reads untracked; typed defaults; per-instance object/array defaults; attribute conversion and boolean presence; invalid values reported with fallback; reflection opt-in on commit; pre-upgrade replay; reserved/duplicate names and attributes rejected; shadowing class field reported; `with()` chaining; hook order and one `updated` per batch; disconnect disposes listeners, reconnect resumes retained nodes with latest state; async generation guard; `moveBefore` keeps the connection (where supported); hook/render errors isolated with previous DOM kept; events, custom states, `define()` idempotence/collision/dependencies/name validation |
| Leak baseline (browser) | element test "1,000 connect/disconnect cycles" | Pass — scope/listener/timer/effect counts return to baseline |
| Shared styles | element test "100 instances" | Pass — one constructed sheet per document; iframe adoption swaps to that document's sheet; `<style>` fallback carries the nonce and is replaced on re-adoption |
| Declaration emit | `npm run typecheck` (`tests/examples/core-counter.types.test.ts`) | Pass — consumer types from emitted `.d.ts`: `string`, `boolean`, enum union, `string[]`, event detail, tag-name map |
| Static analyzability | `tests/experiments/analyzability.test.ts` | Pass — TypeScript 7 `unstable/sync` API extracts full property metadata from source in ~0.5 s; fixture module that throws on import is never executed; dynamic spreads, computed keys, and non-literal options yield `analyzer.dynamic.*` |
| Strict CSP + Trusted Types | `npx playwright test e2e/core-counter.spec.ts` | Pass in all three; zero `securitypolicyviolation` events under `default-src 'none'; style-src 'self'; require-trusted-types-for 'script'`; Trusted Types confirmed **enforced** in Chromium 156, Firefox 157, WebKit 27.2 |
| DOM-free import | `npm run lint:boundaries` | Pass — every `@oddkin/core` entry (root, `reactive`, `scope`, `template`, `styles`, `element`, `diagnostics`) imports in Node without DOM globals; `@oddkin/state` now depends on `@oddkin/core/reactive` only |
| Full pipeline | `npm run verify` | Pass — 90 Node + 147 browser unit tests, 6 e2e, packed consumers |

**Findings:** (1) TypeScript 7.0.2 has no in-process compiler API; only `typescript/unstable/*` (IPC) — recorded in ADR 0018. (2) A trailing `<` before a binding (`<${tag}>`) was lexed as text; now rejected as a dynamic tag name. (3) Importing the core root in Node threw (`HTMLElement` undefined), which would also break server imports in framework apps; the base class now falls back to a stub and `define()` is a no-op without a registry. (4) Import-map consumers need an entry for every subpath loaded transitively (`@oddkin/core/reactive`).

**Data point, not a measurement:** unminified `@oddkin/core` output with comments is 87.7 KB raw / 21.7 KB gzip in total (template 8.6 KB, element 6.7 KB, reactive 4.2 KB gzip). Minified per-entry sizes, startup, update, and memory measurements remain M3 work.
## 2026-10-17 — M3 helpers, light-DOM styles, and `css` references

**Environment:** as the previous entry.

| Check | Command | Result |
| --- | --- | --- |
| `css` grammar | `npx vitest run --project node packages/core/test/styles.test.ts` | Pass — accepts `var(--name)` with plain, nested-`var()`, `calc()`, colour-function, and font-list fallbacks; rejects declaration/block escapes, strings, comments, `!important`, `url()`/`image-set()`, at-rules, unbalanced parentheses, multiple references, over-long input, and `NaN` |
| Helpers (browser) | `npx vitest run --project browser` | Pass in Chromium, Firefox, WebKit — `classMap` keeps static and external classes, binds readables, clears on disposal; `styleMap` sets properties, custom properties, and `!important` through the CSSOM and removes cleared ones; `createRef` is set while rendered, cleared on removal, never written as an attribute, and observable by effects; callback refs receive the element then `undefined`; `live` restores edited fields, defers during composition, keeps the caret; directive position and binding errors |
| Event options | same | Pass — `once` fires once; `capture` runs before target listeners; `passive` ignores `preventDefault` |
| Light-DOM styles | same | Pass — one sheet for many instances in the document; adopted into an enclosing shadow root; removed with the last instance; `:host` reported once per class |
| Strict CSP with `styleMap` | `npx playwright test e2e/core-counter.spec.ts` | Pass in all three — tone colour applied through the CSSOM under `style-src 'self'`; zero policy violations |
| Full pipeline | `npm run verify` | Pass — 93 Node + 192 browser unit tests, 6 e2e, packed consumers |

**Finding:** a directive interpolated into a multi-value attribute (`class="x ${classMap(…)}"`) was stringified to `[object Object]`; it now reports `template.directive.position`.
## 2026-10-17 — M2 token generator slice

**Environment:** as the previous entry.

| Check | Command | Result |
| --- | --- | --- |
| Spacing vectors | `npx vitest run --project node packages/tokens` | Pass — multiples `0.25rem` × 1, 2, 3, 4.5, 9 → `0.25rem, 0.5rem, 0.75rem, 1.125rem, 2.25rem`; ratio `0.75rem`, 1.5, 2/2 → `0.3333rem, 0.5rem, 0.75rem, 1.125rem, 1.6875rem`; extending a ratio scale keeps every existing name and value; explicit scales, custom names, explicit snapping |
| Diagnostics | same | Pass — codes and JSON-pointer paths for strategy conflicts/unknown strategies, units, non-finite numbers, ratio and count parameters, name mismatches and duplicates, missing brand, bad colours, unknown keys (with suggestions), modes, product and density names/scales, unknown overrides, missing references, cycles, tier violations, unserializable values, and targets below the minimum under density |
| Colour | same | Pass — in-gamut sRGB round-trips; out-of-gamut colours keep lightness and hue; WCAG ratios (21:1, 4.48:1); 14 brand vectors, and all 14 as products of one theme, generate with zero contrast diagnostics; failing overrides are warned about and kept |
| Closure and growth | same | Pass — product scopes contain changed references plus dependents only; density scopes scale spacing and control sizes only; fixture theme: 122 tokens, 22 mode-dependent, 39 per brand product, 23 per density |
| JSON Schema | `packages/tokens/test/schema.test.ts` | Pass — fixtures and the documented example validate under Ajv 2020 strict mode; structural errors are rejected by both the schema and the generator; schema keys equal `ThemeConfig` keys |
| Determinism | node + browser projects | Pass — two committed fixtures regenerate byte-identically in Node and in Chromium, Firefox, and WebKit |
| Cascade | `packages/tokens/test/generate.browser.test.ts` | Pass in all three — computed colours, spacing, and min-heights match `resolveToken()` for nested light/dark/system, product, and density scopes and inside a shadow root; the empty `--odd-mode-dark: ;` toggle is accepted |
| DOM-free entries | `npm run lint:boundaries` | Pass — `@oddkin/tokens`, `./theme`, `./generate` import in Node without DOM globals |
| Full pipeline | `npm run verify` | Pass — 127 Node + 231 browser unit tests, 6 e2e, packed consumers |

**Findings:** (1) Per-mode role expressions cannot be re-declared correctly by product or density scopes using selectors, because CSS cannot select the nearest mode ancestor; solved with inherited space toggles (theming-and-styling.md §5.1). (2) Choosing a status text colour against the default surface alone failed on its tinted surface (4.39:1); roles now satisfy every paired surface. (3) An append to `.prettierignore` merged with its last line, which un-ignored `package-lock.json` and let Prettier rewrite fixtures; fixed and regenerated.

**Not yet verified:** Worker execution, the script-free CSS-only fixture (first paint, system mode via emulated media), CLI, conditions, profiles, non-CSS outputs.
## 2026-10-17 — M2 refs, values, CLI, Worker, and CSS-only example

**Environment:** as the previous entry.

| Check | Command | Result |
| --- | --- | --- |
| Generated modules | `packages/tokens/test/outputs.test.ts` | Pass — committed `src/generated/default-names.ts` and `default-values.ts` equal the emitters' output; `token()` builds `var()` references; unknown names are type errors; literal `values` include `{ light, dark }` for mode-dependent tokens; a value/group name clash is rejected |
| Inspection JSON | same | Pass — definitions, compiled CSS, literals, provenance, and per-scope changed/re-declared lists |
| CLI | `packages/tokens/test/cli.test.ts` | Pass — `init` never overwrites; `check` prints codes and paths, `--strict` fails on warnings, `--json` emits diagnostics; `build` writes CSS byte-identical to `generate()` plus refs, values, and inspection files; ESM JS and type-stripped `.ts` configs produce identical CSS; load errors exit 1, usage errors exit 2 |
| Worker | `packages/tokens/test/generate.browser.test.ts` | Pass in Chromium, Firefox, WebKit — module Worker output is byte-identical to the Node fixtures |
| CSS-only page | `npx playwright test e2e/tokens-css-only.spec.ts` | Pass in all three under emulated light and dark preferences — no scripts on the page; first render follows the preference; computed surface, text, action, on-action, control height, and card padding equal `resolveToken()` in root, explicit dark, product-in-dark, light-in-product, and compact scopes; `rem` values follow a changed root font size |
| Packed consumer | `npm run verify:packs` | Pass — `@oddkin/tokens/css/default.css` and `schema.json` resolve through `exports` from the tarball; the installed `oddkin-tokens` binary runs `init` and `build --strict` in a project outside the workspace |
| Full pipeline | `npm run verify` | Pass — 138 Node + 234 browser unit tests, 12 e2e, packed consumers |

**Findings:** (1) Custom spacing scales without the step names the preset's roles use failed with bare `alias.missing`; the diagnostic now explains the requirement. (2) `.gitignore` and `.prettierignore` appends had merged with their last lines, so `.tmp/` and `.vitest/` were not ignored and six Vitest failure screenshots had been committed; they are removed from the index and both files end with newlines.
## 2026-10-17 — M2 conditions, profiles, and unit policy

**Environment:** as the previous entry.

| Check | Command | Result |
| --- | --- | --- |
| Conditions | `packages/tokens/test/conditions-profiles.test.ts` | Pass — named and unnamed container queries (logical and physical sizes), media ranges and preference features serialize to literal `{ kind, query, atRule }`; `@oddkin/tokens/conditions` imports without a DOM; `var()`, `%`, unitless, logical media sizes, invalid preference values, empty ranges, reserved container names, missing features, and unknown kinds report codes and paths; `px` thresholds warn |
| Profiles | same | Pass — attribute-scoped overrides with alias closure; nested-scope re-application selector emitted; profiles after products and densities; only layout/component roles; unknown roles, invalid values, missing references, and tier violations reported under `/profiles/…`; overlaps warn and name the winner; target minimums checked per profile and per profile × density for affected roles only |
| Unit policy | same | Pass — unitless line heights, font weights 1–1000, lengths with units; `px` warns for type and control sizes, not borders |
| Cascade | `packages/tokens/test/generate.browser.test.ts` | Pass in Chromium, Firefox, WebKit — a profile applies in dark mode and **survives inside a nested compact density**; lengths compared within 0.05px because WebKit snaps margins to 1/64px (`0.8438rem` → 13.5px vs 13.5008px elsewhere) |
| CSS-only page | `npx playwright test e2e/tokens-css-only.spec.ts` | Pass in all three under light and dark preferences — profile padding, and profile + nested compact density, equal `resolveToken()` |
| Full pipeline | `npm run verify` | Pass — 149 Node + 240 browser unit tests, 12 e2e, packed consumers |

**Findings:** (1) A profile changes role expressions, so a nested density/product/mode/theme scope would re-declare base expressions and drop it; each profile rule also targets nested scopes inside its subtree. (2) CSS cannot honour `data-odd-profile` list order; precedence follows configuration order and overlaps are reported. (3) Preset profiles originally referenced `space.2xs`, which custom scales need not define; they now derive smaller values with `calc()` from required steps. (4) Duplicate unit diagnostics and repeated target unit-mismatch warnings were removed.
## 2026-10-17 — M3 layout recipes

| Check | Command | Result |
| --- | --- | --- |
| Recipe CSS | `npx vitest run --project node packages/core/test/layout.test.ts` | Pass — committed side-nav (shadow) and page (light DOM) fixtures; layer order; changed-only variant/condition declarations; `extend` leaves the original untouched and merges per property; `describeRecipe`; branded helper defaults; diagnostics `recipe.helper.conflict`, `region.unknown`, `condition.unknown`, `container.missing`, `container.self`, `profile.unknown`, `region.reserved`, `value.invalid`, `region.missing` |
| Cascade | `npx vitest run --project browser packages/core/test/layout.browser.test.ts` | Pass in Chromium, Firefox, WebKit — browser output byte-identical to Node fixtures; narrow (1 column) and wide (3 columns) instances on one page from container queries alone, switching when resized; condition profile inherits into slotted content; variant attribute; unlayered component CSS beats recipe layers; `extend` subclass does not change the shared sheet; light-DOM `split` sits side by side when wide and wraps when narrow; region/part check; render-time definition reported |
## 2026-10-17 — M3 collections and models

| Check | Command | Result |
| --- | --- | --- |
| Collections | `npx vitest run --project node packages/core/test/collections.test.ts` | Pass — document order with depth/parent/index/path; entry identity reuse; missing/duplicate key diagnostics with paths; per-entry scopes disposed on removal and with the owner; selection (single/multiple, disabled and unknown ignored, destructured methods), controlled intent-only behavior, expansion and visible entries, disabled set, roving active entry skipping disabled/hidden entries and recovering |
| Invalidation | `packages/core/test/collections.browser.test.ts` | Pass in Chromium, Firefox, WebKit — same item object + changed external signal updates output; changed renderer re-renders; reorder keeps the focused input's node, value, and focus (WebKit via restoration, since its build lacks `moveBefore`); removed entry's scope cleanup runs once |
| Minimal moves | `packages/core/test/template.browser.test.ts` | Pass in all three — swapping the first and last of five keyed items moves only those two |
| Models | `npx vitest run --project node packages/core/test/model.test.ts` | Pass — recursive discriminated `Infer` types; codes and paths for empty labels, script URLs, unknown kinds, invalid action references, missing discriminators, invalid enums, unknown properties (warning), wrong types; tree-wide unique ids; migration from v1 and unsupported versions; JSON Schema with `$defs` agrees with `validate()` under Ajv 2020 strict |

**Findings:** (1) WebKit's Playwright build lacks `moveBefore`, so the earlier keyed reorder could blur a focused input; reordering now moves the fewest items and restores focus where needed. (2) Item templates re-run when their entry changes, which re-registered per-entry cleanups; `scopeFor(key, init)` runs setup once. (3) Generic `defineModel` signatures made TypeScript expand recursive inference without bound; the value type is computed only where a model is defined.
## 2026-10-17 — M3 analyzer

| Check | Command | Result |
| --- | --- | --- |
| Fixture library | `npx vitest run --project node packages/analyzer` | Pass — CEM validates against the pinned `custom-elements-manifest@2.1.0` schema and metadata against `oddkin-metadata.v1`; a module that throws on import is analyzed (never executed); properties, attributes, reflection, defaults, enum types, events with detail types and JSDoc, members (getters, methods), template and JSDoc slots/parts, CSS properties, custom states; inheritance across files with `inheritedFrom`; registrations, export specifiers, re-exports, recipe and model summaries, authored `@a11y`/`@keyboard`/`@category`/`@related` facts with locations; dynamic tag name reported with location; deterministic; incremental program reuse gives identical output |
| core-counter | same | Pass — committed CEM and metadata fixtures; zero diagnostics; `count`/`count-change` sync pair |
| Dynamic fixture | same | Pass — spread, computed key, and computed default reported with lines; unknown default omitted |
| Performance | `node scripts/experiments/analyzer-performance.mjs 50` (two runs) | 50 components: TypeScript 5.9 0.9–1.2 s full in-process, 1.6–1.7 s cold process, 0.8 s after a one-file edit; TypeScript 7 probe 0.5–0.6 s cold but properties only. Recorded in ADR 0018 (Accepted) |
| Packed | `npm run verify:packs` | Pass — `@oddkin/analyzer` installs from its tarball with `typescript` only beneath it, its declarations typecheck in a consumer, and `oddkin-analyze --help` runs |

**Findings:** (1) Shorthand `static events = { countChange }` resolved to the property symbol; the analyzer now uses the shorthand value symbol. (2) Module paths were relative to the workspace root when the tsconfig had no `package.json` beside it; the root now defaults to the tsconfig directory. (3) Ajv strict mode needs `strictRequired: false` for the M0 metadata schema's `fact` definition, as in `tests/schemas`.
**Explicit metadata (follow-up):** `packages/analyzer/test/analyzer.test.ts` passes — the dynamic fixture's `@oddkin-metadata` JSON supplies the spread, computed-key, and computed-default properties; they merge into CEM, appear in `oddkin.metadata.json` `authored` with their source file, the class's dynamic warnings become `info`, and both outputs still validate.

## 2026-10-17 — M3 measurements, development/production builds, size budgets

Environment: Windows 11 (10.0.26300), Intel i5-1135G7 (8 threads), 16 GiB, Node 24.19, Playwright 1.64.1 headless (Chromium 156, Firefox 157, WebKit 27.2), esbuild 0.28.2. Raw samples, medians, and p95 are in `research/benchmarks/results/2026-10-17-win32.json`; the method is recorded in that file and in `research/benchmarks/run.mjs`.

| Check | Command | Result |
| --- | --- | --- |
| Production build | `npx vitest run --project node packages/core/test/production.test.ts` | Pass — `dist/prod` has the same modules and export names as `dist`; every export maps `types`/`development`/`default`; Node resolves production by default and development with `--conditions=development`; production errors keep `[code]` (for example `reactive.write.inComputed`) with a pointer to the development build; no development message text or `DEV` reference remains |
| Size budgets | `npm run size` (part of `npm run verify`) | Pass — production gzip: minimal counter 9,280 B (budget 9,728), typical component 10,553 B, keyed list 11,064 B, reactive-only 1,892 B; no component bundle includes state, app, or tokens. The 8 KiB counter target was missed and revised in ADR 0031 |
| Keyed `repeat` | `npx vitest run packages/core/test/template.browser.test.ts` | Pass in Chromium, Firefox, WebKit — focused input that itself moves keeps focus and selection; 60 seeded rounds of shuffles, inserts, removals, and reversals keep order and reuse every surviving node |
| Mount/update | `node research/benchmarks/run.mjs` (15 samples, 3 warm-ups) | 1,000 counters, median ms: mount 11–15 (Chromium), 25–51 (Firefox), 11–15 (WebKit, one noisy run had p95 182); increment all and flush 1.4–2.3 / 4–7 / 2–3; one counter of 1,000 updated and flushed in ≈ 3–10 µs |
| Collection vs handwritten `repeat` | same | At 1,000 items, Chromium median ms (collection / handwritten): replace 1.6 / 1.4, single edit 0.8 / 0.7, insert 1.0 / 0.7–0.8, remove 0.8–1.3 / 0.5–0.9, reverse 2.2–3.5 / 2.0–2.8. Firefox 1–2 ms, reverse 5–7. WebKit 1–5 ms, reverse 9–28 across runs. The collection layer costs about 0–30% over a plain array signal. At 10 and 100 items every operation is under 1 ms in all engines |
| Memory (Chromium, CDP) | same | Retained per mounted counter ≈ 2.3 KB. Retained list at 1,000 items: collection ≈ 567 KB, handwritten ≈ 482 KB. Allocation per full replace at 1,000: ≈ 646 KB / ≈ 497 KB. Values at 10 items are within GC noise |
| Ownership and leaks | same | `scopeStats()` returns exactly to baseline (0 scopes, listeners, timers, effects) after 100 cycles of mounting and removing 100 counters in all three engines; Chromium heap after 106 cycles is within 5 KB of the heap after the first cycle |

**Findings:** (1) **WebKit list reorders were quadratic.** Without `moveBefore`, per-item `insertBefore` of `<li>` renumbers following list items on every move. Raw DOM took 239 ms to reverse 1,000 `<li>` in a `<ul>` and 1.6 s in an `<ol>`, versus 3 ms for `<div>`, and our `repeat` took 319 ms. The fallback now detaches moved ranges from the end of the list and inserts each run as one fragment: 9–28 ms across runs. Chromium and Firefox keep state-preserving `moveBefore`. (2) The keyed reconciler was bundled into every template; it now ships only with `repeat()`. (3) Development messages were about 1.7 KB gzip of the counter. (4) Port 4190 is on the Fetch blocked-port list, so the runner uses 4183. (5) Firefox and WebKit clamp `performance.now()` to about 1 ms without cross-origin isolation, so small operations run over independent copies and are averaged. (6) Firefox mounts direct-binding counters more slowly than render-tracked ones (40–51 vs 25–28 ms per 1,000); recorded for the binding walkthrough.

## 2026-10-17 — M3 binding-rule walkthrough and failure paths

| Check | Command | Result |
| --- | --- | --- |
| Binding rule (plain JS and TS) | `npx playwright test e2e/binding-rule.spec.ts` | Pass in Chromium, Firefox, WebKit — identical tables for elements authored in plain JavaScript (no build) and TypeScript: direct binding 0 renders / 1 write for three writes; render-tracked 1 / 1; dual path 1 / 1 (coalesced); handler and async snapshots 0 / 0 and read current values; no-op 0 / 0; public property 1 / 1 with `updated(label)`; same value 0 / 0; attribute 1 / 1; DOM unchanged before `updateComplete`, updated after |
| Failure paths | `npx vitest run packages/core/test/failure-paths.browser.test.ts` | Pass in all three (13 tests): invalid attribute falls back and recovers; throwing derivation in `render()` keeps the last DOM, reports `reactive.effect.error` with origin `<tag> render`, and recovers; a throwing direct binding leaves sibling bindings updating without a re-render; failing effect does not stop others in the flush; throwing setter reported and later values written; all cleanups run with one `scope.cleanup.error`; throwing `mounted()` leaves rendering working; shared module signal unsubscribes per removed element; self-removing handler leaves no subscriptions or owned resources; disconnect during a flush cancels the other element's queued effect; six connections get six scopes with no listener accumulation; direct updates make no layout reads (spied getters, `getBoundingClientRect`, `getComputedStyle`) and no re-render; production build in the browser reports the same code and owner with the short message |

**Findings:** (1) A test element named its handler `remove`, shadowing `Element.remove()`; the type check (`noImplicitOverride`) caught it. Worth a note in authoring docs: instance members on an `OddkinElement` share the `HTMLElement` namespace. (2) No core behavior changes were needed: the failure contract held as documented.

## 2026-10-17 — M3 `props()` assessment

| Check | Command | Result |
| --- | --- | --- |
| Prototype contract | `npx vitest run research/experiments/props` | Pass in Chromium, Firefox, WebKit (5 tests): declared keys set from a configuration object; unknown keys and native handler names (`onselect`) reported as `props.key.unknown` and skipped; readable values update without re-running the parent render; removed keys reset to declared defaults; pre-upgrade values replayed (keys unchecked before definition); precedence with an explicit `.label` binding is order-dependent (last change wins), so that contract row is **not met** |
| Cost | esbuild bundle of the helper with core external | 662 B gzip (1,102 B minified) |

**Outcome:** not added to `@oddkin/core` for M4–M7; the decision stays at M8 (`research/experiments/props/README.md`, data-composition.md §2).

## 2026-10-17 — M3 `@oddkin/workbench` DOM-free entries

| Check | Command | Result |
| --- | --- | --- |
| Page registry | `npx vitest run --project node packages/workbench/test/pages.test.ts` | Pass (12 tests) — from the analyzer's real core-counter CEM and enrichment: schema-valid registry, components from CEM, summaries from descriptions, fallback group, Foundations kept as an unavailable destination with no invented pages, Theme Studio partial and never a card. From an independent Acme fixture (enrichment validated against `oddkin-metadata.v1`): spacing partial with authored `visible: true` unable to show a section without data, a foundation with no data hidden, categories from config and enrichment ordered, prefix-stripped titles, enrichment and authored dates only (unknown dates omitted), page aliases, unknown page and section diagnostics, Products in Foundations and primary navigation. Standard-CEM-only libraries get partial components. Deterministic; ids stable across base-path and route changes; Products absent by default and hidden when empty; invalid config gives diagnostics and no registry. Projections: primary navigation, grouped sidebars, cards, search, On this page (two or more sections), history/hash hrefs, legacy redirects keeping share state, static redirect stubs |
| Config | `packages/workbench/test/config.test.ts` | Pass — defaults; agreement with `workbench-config.v1` on its valid and invalid examples; the Playground key explained; eight diagnostics with paths; `defineDocs` output valid against `docs-content.v1` |
| Examples | `packages/workbench/test/examples.test.ts`, `examples.types.ts` (type check) | Pass — frozen definitions; `examples.v1` output with fixtures reduced to `hasFixture`; unknown props, slots, and names reported against the analyzer's CEM; TypeScript rejects unknown keys, wrong value types, and methods for registered tags |
| DOM-free and packed | `npm run lint:boundaries`, `npm run verify:packs` | Pass — `./examples`, `./config`, `./pages` import in Node without DOM globals; the tarball installs and its subpath entries import and typecheck in a consumer |

**Findings:** (1) `oddkin-metadata.v1` stores `library.prefix` with its trailing hyphen and example references as component ids (`component:<tag>`); the registry accepts both forms. (2) A Products page placed in both Foundations and primary navigation must belong to the Foundations section to appear in its cards and sidebar. (3) `verify-packs` assumed every package had a root entry; it now checks subpath-only packages. (4) As the suite grew, a process-spawning CLI test exceeded 5 s on a busy machine; it now has the analyzer's 30 s budget.

## 2026-10-17 — M3 startup and update-to-paint

Command: `node research/benchmarks/run.mjs --samples 15` (results regenerated in `research/benchmarks/results/2026-10-17-win32.json`; this run was on a busy shared machine, and timings were 1.2–2× slower than earlier runs: Chromium mount of 1,000 counters 18 ms vs 11–15 ms).

| Measure (median, p95 ms) | Chromium 156 | Firefox 157 | WebKit 27.2 |
| --- | --- | --- | --- |
| First render after navigation start, cold context, minimal production counter | 36, 46 | 169, 367 | 46, 60 |
| Bundle response end → first render (parse, execute, define, render) | 7.4 | 18 | 33 |
| Click → next frame, Oddkin counter | 9.2, 11.5 | 3, 9 | 27, 42 |
| Click → next frame, plain-DOM control button | 9.8, 16.4 | 3, 10 | 26, 39 |
| Clicks over 16 ms by Event Timing (both buttons) | 12 of 90 | 0 of 90 | 46 of 90 |

**Findings:** (1) Oddkin's click-to-next-frame time matches the plain-DOM control in every engine, so the update itself adds no measurable frame latency. WebKit's ~27 ms comes from headless WebKit's frame scheduling and affects the control equally. (2) Firefox's first render includes a slower cold context start (median 169 ms after navigation start) while its script-to-render time is 18 ms. (3) Timing on this machine varies between sessions; these are baselines for regression review (plan §8: flag > 15% timing change), not cross-library comparisons.

## 2026-10-17 — M4 composition API (`compose()`, `define(definition)`)

**Environment:** as above (Windows, Node 24.19, Vitest 5.0.5, Playwright 1.64.1 Chromium/Firefox/WebKit).

| Check | Command | Result |
| --- | --- | --- |
| Definition contract | `npx vitest run packages/core/test/definition.browser.test.ts` | Pass — 17 tests × 3 engines (51): frozen definitions and `source`/`extends` lineage; external templates (direct binding skips the template, tracked `.value` reads re-run it once per batch, DOM identity kept); definition styles ordered, shared per document, replacing class styles; recomposed `studio-card` coexisting with its foundation; subclasses do not inherit definitions; idempotent `define(definition)`; `registry.definitionConflict`, `registry.constructorReused`, `registry.collision` with no leftover binding; dependencies registered first and existing elements upgraded; `definition.render.ignored`; scope counts back to baseline after 5 reconnects |
| Core suite | `npx vitest run packages/core` | Pass — 30 files, 416 tests |
| Typecheck | `npm run typecheck` | Pass |
| Size budgets | `npm run size` | Pass — counter 9,521 B (budget 9,728), component 10,792 B (11,264), list 11,301 B (11,776), reactive 1,892 B (2,048); the counter grew by 241 B because `define()` carries the definition path |

## 2026-10-17 — M4 analyzer support for `compose()` definitions

| Check | Command | Result |
| --- | --- | --- |
| Analyzer suite | `npx vitest run packages/analyzer` | Pass — 17 tests (6 new): `tests/fixtures/analyzer-composed` (folder structure, recomposed `acme-alert`) is valid against CEM 2.1.0 and `oddkin-metadata.v1`, diagnostic-free, and its `AcmePanel`/`AcmeAlert` declarations equal the colocated `analyzer-library` declarations apart from module paths; metadata `definition` records `ref`, `extends: component:acme-panel`, template, styles, and dependencies; registrations carry `./define/*` specifiers; `@internal` template handlers are excluded; computed names, unresolvable `define(...)`, and unknown spreads report `analyzer.dynamic.tagName`/`registration`/`definition` with lines |
| Typecheck, lint | `npm run typecheck`, `npm run lint` | Pass |

## 2026-10-17 — M4 core-counter migration to component folders

| Check | Command | Result |
| --- | --- | --- |
| Metadata equivalence | analyzer on the pre-migration fixture vs the migrated example | `DemoGreeting` declaration identical; `DemoCounter` identical except its description (now says "template" instead of `render()`); module paths changed; `registration` now `dist/<name>/<name>.define.js`; new `definition` metadata; no diagnostics. Committed fixtures regenerated |
| Strict-CSP e2e | `npx playwright test e2e/core-counter.spec.ts` | Pass — unchanged test, Chromium, Firefox, WebKit |
| Migration acceptance | `npx vitest run tests/examples/core-counter-migration.browser.test.ts` | Pass — 4 tests × 3 engines: barrel registers nothing, `define.js` registers; a click writes only inside `<output>` and keeps `button`/`output` identity; tracked `label` update keeps `output`; `count-change` detail, `:state(positive)`, Escape reset; attributes, reflection, property-only `history`, one adopted sheet; `scopeStats()` unchanged after 10 reconnects |
| Dependents | `npx vitest run packages/analyzer packages/workbench tests/examples tests/experiments` | Pass — 41 tests (types from emitted declarations, CSP hash, analyzability probe, Workbench page registry from the regenerated fixtures) |

## 2026-10-17 — M4 registration-entry boundary checks

| Check | Command | Result |
| --- | --- | --- |
| Checker tests | `npx vitest run tests/architecture` | Pass — 15 tests (5 new): side-effect-free barrels, the `define()` implementation, and app entries accepted; a barrel reaching `card.define.ts` through another module rejected with the importing file; example barrels importing a registering `define.ts` or `@acme/ui/define/button` rejected; packages with registration entries and `"sideEffects": false` or a non-matching list rejected, matching globs accepted |
| Deliberate violation | appended `import './define.js'` to `examples/core-counter/src/index.ts`, ran `node scripts/architecture/check-boundaries.mjs`, reverted | Fails as intended: `✖ [boundary.registration.barrel] examples/core-counter/src/index.ts reaches the registration entry examples/core-counter/src/define.ts …`; passes again after reverting |

## 2026-10-17 — M4 `odd-button` and form-strategy prototype

| Check | Command | Result |
| --- | --- | --- |
| Button behavior | `npx vitest run packages/components/test/button.browser.test.ts` | Pass — 13 tests × 3 engines (39): foundation and component entries register nothing, the define entry registers; native `<button part="control">`, spinner part, `start`/default/`end` slots, two adopted sheets; attribute conversion and reflection; `label` → `aria-label`; click, Enter, and Space via real input; focus delegated to the native button; `disabled` and `loading` suppress activation (loading stays focusable with `aria-disabled`); programmatic changes emit no events; scope counts at baseline after 10 reconnects; theme-value changes keep the native node and apply (`--odd-button-radius`, `--odd-color-surface-default`) |
| Form strategy | same file, `forms` suite | Pass in three engines — submit includes `intent=save` via a temporary native submitter (read synchronously in the `submit` listener; the submitter is detached afterwards); `required` fields block submission; a cancelled click or `type="button"` does not submit; `type="reset"` restores values; a disabled fieldset disables the control and blocks submission |
| Import graphs | `npx vitest run packages/components/test/graph.test.ts` | Pass — `dist/button/foundation.js` reaches only `button.js`, `button.template.js`, `button.structural.styles.js` and `@oddkin/core/{element,reactive,styles,template}`; `dist/button/index.js` adds `button.styles.js` and `@oddkin/tokens/refs` and reaches no `*.define.js` |
| Full pipeline | `npm run verify` | Pass — 661 tests, 15 e2e, size budgets, boundaries over 85 source files, packed consumers |

## 2026-10-17 — M4 conformance prototype (`oddkin.button` suite)

| Check | Command | Result |
| --- | --- | --- |
| Suite against implementations | `npx vitest run packages/workbench/test/conformance.browser.test.ts` | Pass — 10 tests × 3 engines (30). All 11 cases pass for `odd-button`, `studio-button` (recomposed with product styles), and `alt-template-button` (different template keeping the anatomy). Mutants rejected on the targeted cases: `<div>` control → `native-control`, `keyboard-activation`; change events on programmatic writes → `programmatic-updates`; missing disabled binding → `disabled`; unowned listener added per connection → `reconnect`; control disabled while loading → `loading`. A filtered run reports the rest `not-executed` |
| Contracts | `npx vitest run packages/workbench/test/conformance.test.ts tests/schemas` | Pass — the suite serializes to valid `conformance.v1` equal to the committed example; `checkConformance` reports id, version, contract, invariant-change, duplicate, and assertion-change problems with paths; schema examples (2 valid, 2 invalid) give the expected results |

## 2026-10-17 — M4 published component metadata

| Check | Command | Result |
| --- | --- | --- |
| Metadata build | `npm run build` (`scripts/build-metadata.mjs`) | Writes `packages/components/custom-elements.json` and `oddkin.metadata.json` with no analyzer diagnostics (the step fails on any) |
| Metadata contract | `npx vitest run packages/components/test/metadata.test.ts` | Pass — CEM valid against `custom-elements-manifest@2.1.0`, enrichment valid against `oddkin-metadata.v1`; `customElements` field, exports, and `files` declare both; module paths exist in `dist`; registrations are package exports; `odd-button` has `@oddkin/components/define/button`, `previewRoles` `role:primaryAction`/`role:secondaryAction`, definition template/styles, token reads without `--odd-button-*` component variables, parts `control`/`spinner`, slots `''`/`end`/`start`, no `_formDisabled` member |
| Packed consumers | `node scripts/verify-packs.mjs` | Pass — now imports every JavaScript subpath export of every package from its tarball (registration entries are checked to load, not to export) and reads `@oddkin/components/custom-elements.json` and `oddkin.metadata.json` from the installed package |

## 2026-10-17 — M4 `odd-card` and the components-only example

| Check | Command | Result |
| --- | --- | --- |
| Card behavior | `npx vitest run packages/components/test/card.browser.test.ts` | Pass — 9 tests × 3 engines (27): entries register nothing; parts and slots; empty header/footer hidden and updated on slot changes; no role without a name; `label` → `region` + `ariaLabel` through `ElementInternals` with no host attributes; a slotted heading → `region` labelled by that element where `ariaLabelledByElements` exists (all three current engines), cleared when removed; `variant`/`padding` reflected and resolved through scoped tokens; `--odd-card-shadow` override; scope baseline after 10 reconnects; theme-value change keeps the base node; recomposed `studio-card` shares the structural sheet |
| Role checks method | — | Playwright role locators read DOM attributes and do not see `ElementInternals` semantics; unit tests read internals through a test-only subclass, and accessibility-tree evidence comes from Chromium CDP below |
| Components-only page | `npx playwright test e2e/components-only.spec.ts` | Pass in Chromium, Firefox, WebKit: no CSP violations or errors under a strict policy; Save (in the card footer, associated by `form="billing"`) submits `email=…&intent=save`; Reset restores the field; Enter on the focused native button submits; the primary button's background equals `--odd-color-action-default`. Chromium `Accessibility.getFullAXTree`: exactly one region, named "Billing"; buttons "Save" and "Reset". Firefox and WebKit annotated as not verified at the accessibility-tree level |
| Import graphs, CSP hashes | `npx vitest run packages/components/test/graph.test.ts tests/examples/csp.test.ts` | Pass — card foundation loads only the class, template, and structural styles; both example pages allow exactly their import map by hash |
| Full pipeline | `npm run verify` | Pass — 732 tests, 18 e2e, size budgets, packed consumers |

## 2026-10-17 — M4 `odd-input`

| Check | Command | Result |
| --- | --- | --- |
| Input behavior | `npx vitest run packages/components/test/input.browser.test.ts` | Pass — 11 tests × 3 engines (33): entries register nothing; label `for` the native input, `aria-describedby` for description and error; `value` attribute acts as `defaultValue` until the value is set or typed; a value assigned before upgrade is kept; typing `x` at offset 1 gives `Axda` with the caret at 2; one `input` and one non-composed `change` at the host (reaching `document`); no events on programmatic writes; form data, `valueMissing`, `typeMismatch`, custom `error`; `aria-invalid` only after a failed submission, cleared on reset; reset restores `defaultValue`; a disabled fieldset disables and excludes it; typed value submitted through `odd-button`; scope baseline after reconnects |
| Test notes | — | Firefox did not move focus on Tab inside the test frame, so the change test blurs the control directly. `checkValidity()` fires `invalid`, which the element cannot distinguish from a submission attempt; it therefore also marks the field touched (documented in the class). Firefox's validation bubble from a failed `requestSubmit()` swallowed the next test's click; the test cancels `invalid` to suppress the bubble (3 consecutive full-file runs pass in all engines afterwards) |
| Full pipeline | `npm run verify`, then remaining stages separately | Lint and typecheck pass. The full parallel run hit 4 load timeouts (5 s and 30 s budgets in `tests/architecture/boundaries.test.ts` and `tests/experiments/analyzability.test.ts`) with CPU at 99% from other applications on the machine; both files pass when re-run (17 tests). `npm run size`, `npm run test:e2e` (18 passed), and `npm run verify:packs` pass. Re-run `npm run verify` on an idle machine before release (done in the next entry: one uninterrupted pass) |

## 2026-10-17 — Naming contract (ADR 0037)

Windows, Node 24.19.0, npm 11. The project, packages, elements, CSS namespace, files, schemas, and command-line tools now follow [ADR 0037](./architecture/decisions/0037-naming-contract.md); behavior, package boundaries, and implementation status are unchanged.

| Check | Command | Result |
| --- | --- | --- |
| Workspace resolution | `npm install`, `npm ls --workspaces` | Pass — every workspace package resolves under `@oddkin/*`; `package-lock.json` and the `node_modules/@oddkin` links were regenerated by npm, not edited |
| Generated outputs | `UPDATE_FIXTURES=1` runs of the token CSS, generated-module, and analyzer core-counter fixture tests | Pass — the 7 regenerated files are byte-identical to the migrated sources (64 tests) |
| Component metadata | `npm run build` | Writes `packages/components/custom-elements.json` (tags `odd-button`, `odd-card`, `odd-input`) and `oddkin.metadata.json` with 0 diagnostics; token reads are recognized through the `--odd-` prefix and recorded by token name (for example `control.height.md`, `space.sm`) |
| CSP hashes | `npx vitest run tests/examples/csp.test.ts` | Pass — import-map hashes recomputed for both example pages after formatting |
| Test correction | `packages/core/test/template-lexer.test.ts` | The first full run failed one test: its regex expected comment markers with the element prefix, while template markers are library-internal (`oddkin-<random>`, as in the attribute-marker test). Regex corrected; no implementation change |
| Analyzer experiment | `node scripts/experiments/analyzer-performance.mjs 50` | Pass — the regenerated synthetic library gives 50 components and 0 diagnostics; the TypeScript 7 probe finds 50; timings within the range recorded in the M3 analyzer entry under current machine load (cold process 2.0 s) |
| Links | Relative-link check over all Markdown files | 72 files, 314 relative links, 0 broken |
| Name search | Case-insensitive search of tracked and untracked file contents (including `package-lock.json`), file names, and rebuilt outputs for the previous project name | No occurrences; the only substring matches are the ordinary words "remote" and "promote". Stale ignored scratch outputs in `.tmp/` from earlier runs were deleted |
| Full pipeline | `npm run verify` | Pass in one uninterrupted run — boundaries (8 packages, 104 source files, 287 imports), build, format, typecheck, 766 tests in 72 files, size budgets (counter 9,522 B of 9,728 B; component 10,795 B; list 11,298 B; reactive 1,895 B), 18 e2e tests in Chromium, Firefox, and WebKit, packed consumers for all 7 publishable `@oddkin/*` packages |

## 2026-10-17 — CSS architecture, compatibility, and progressive enhancement (ADRs 0009, 0038, 0039)

Windows, Node 24.19.0; current engines from Playwright 1.64.1 (Chromium 156.0.8078.4, Firefox 157.0, WebKit 27.2); floor engines Chrome for Testing 125.0.6422.141 and Firefox 126.0. Contracts: [css-architecture.md](./architecture/css-architecture.md); registry [features.json](./compatibility/features.json); matrix [matrix.md](./compatibility/matrix.md).

| Check | Command | Result |
| --- | --- | --- |
| Compatibility data | `npm i -D -E web-features@3.43.0 @mdn/browser-compat-data@8.1.6 css-tree@3.2.1` | Pinned as exact dev dependencies (no runtime dependency). Floor resolved: Chrome 125 (2024-05-14), Edge 125 (2024-05-17), Firefox 126 (2024-05-14), Safari 17.4 (2024-03-05), and mobile equivalents. Baseline Widely Available on 2026-10-17, computed from web-features: Chrome/Edge 123, Firefox 124, Safari 17.4; the floor is higher only because of custom states (`:state()`, newly available 2024-05-17) |
| Data findings | `scripts/compat/data.mjs` queries | Popover is partial on Safari iOS 17.0–18.2 (no light dismiss on outside taps; ADR 0009 had listed it as required without the exception); `@property` needs Firefox 128; `light-dark()` and `text-wrap: balance` need Safari 17.5; `@scope` is fully supported only from Firefox 146 and Safari 26.4; `position-anchor` is fully supported only from Chrome 151 although `anchor-name` is at Chrome 125; `ElementInternals.ariaLabelledByElements` needs Chrome 135 and Firefox 136 (already feature-detected); `Set` methods need Firefox 127 (excluded by the ES2023 TypeScript library) |
| Registry and lint | `npm run lint:css` | Pass — 69 registered features (foundations, enhancements, experimental, deferred, declined) validated against the schema and BCD; the generator's above-floor syntax list verified; 16 shipped and example stylesheets linted with 150 compatibility keys and no ungated feature outside the floor. During development the lint found `cursor: pointer`/`not-allowed` (no effect on iOS) and `resize` (no handle on iOS or Firefox for Android); both are registered foundations with documented floor exceptions. Ungated shipped CSS needs at least Chrome/Edge 105, Firefox 110, Safari 16.4 |
| Lint rules | `npx vitest run tests/compat` | Pass — 8 tests: floor features and exceptions accepted; ungated enhancements, `var()`-based fallbacks, unregistered and declined features (even when gated), above-floor custom-property values, and above-floor selectors in shared selector lists rejected; registry and token-syntax mismatches reported |
| Schema | `npx vitest run tests/schemas` | Pass — `compatibility.v1` compiles under Ajv 2020 strict mode; the valid example passes and an enhancement without a gate fails |
| Layered token CSS | `npx vitest run --project node packages/tokens` (with `UPDATE_FIXTURES=1` once) | Pass — output starts with the canonical layer order and keeps every declaration inside `odd.tokens`; layered and unlayered outputs hold identical declarations; custom and invalid layer names; CLI `--css-layer`; the two CSS fixtures were regenerated by the generator. Size: 1,827 B gzip layered vs 1,768 B unlayered |
| Above-floor token syntax | same | Pass — `value.syntax.aboveFloor` (warning) for a dimension override with `progress()`, relative colour syntax across modes (one warning), and `anchor-size()` in a profile; floor syntax (`oklch()`, `color-mix()`, `round()`, `clamp()`) accepted; a literal `light-dark()` colour fails `color.invalid` with a suggestion naming Safari 17.4 and no duplicate |
| Cascade and F02 in current engines | `npx vitest run --project browser packages/tokens` | Pass — 69 runs in three engines. `cascade.browser.test.ts`: an unlayered override wins over layered tokens in either order, while with unlayered tokens the same override depends on order; an application layer wins only when ordered after `odd` (or with `@layer odd, app;`); a root override does not cross nested scopes that re-declare the role; a defined property holding syntax no parser accepts makes `background-color` transparent and `color` inherit, ignoring both the earlier declaration and the `var()` fallback, while the `@supports`-gated assignment keeps the baseline |
| Component styling | `npx vitest run --project browser packages/components/test/styling.browser.test.ts packages/components/test/input.browser.test.ts` | Pass in three engines — with the shipped token stylesheet loaded (guarded): long unbroken labels, URLs, and compound words stay inside an 8rem container (with the `overflow-wrap` rules removed the button grows to 262 px in all three engines); slots mirror in RTL; cursors; outer `::part()`, component variables, and host styles override, while a page `button { … !important }` rule never reaches internals; 200% root font size doubles control heights without clipping; `:state(user-invalid)` follows `aria-invalid` through failed submission, reset, and `error` |
| Floor probe, floor engines | `npm run compat:floor` | Pass — Chrome for Testing 125.0.6422.141 and Firefox 126.0 (installed outside the repository; Windows sandbox kept on by granting ALL APPLICATION PACKAGES read access instead of `--no-sandbox`) each pass 16/16 checks with the production core build: layer order, mode/density/profile scopes, `color-scheme`, registration through an import map, shared adopted sheets, button colours and target size, `:state(user-invalid)`, form association, container queries, F02 with real syntax (`contrast-color(red)` in Chrome 125, `oklch(from red l c h)` in Firefox 126: naive reader transparent, gated value kept), and `@property` (Chrome 125: a registered initial value masks the `var()` fallback; Firefox 126: unsupported, fallback applies). 20 feature detections per browser match BCD for that version |
| Floor probe, current engines | `npx playwright test e2e/floor-probe.spec.ts` | Pass in Chromium, Firefox, WebKit |
| Engine findings | Minimal pages under a strict CSP | WebKit 27.2 reports one `style-src-attr` violation per native `<select>` (single and multiple) with no page code; Chromium 156 and Firefox 157 report none. CSSOM style writes (`style.x = …`, `setProperty`, `cssText`) report none in any engine. The gallery's first layout had a grid blowout at 320 px (314 px of horizontal overflow: a definite-width child widened an `auto` track); fixed with `grid-template-columns: minmax(0, 1fr)` |
| CSS budgets | `npm run size` | Pass — default theme 1,827 B of 2,048 B; button styles 1,100 B of 1,280 B; card 571 B of 640 B; input 647 B of 768 B (gzip) |
| Gallery and regression scenarios | `npx playwright test e2e/css-compat.spec.ts` | Pass in Chromium, Firefox, WebKit — the gallery prints the emitted token, component, and enhancement CSS and stays themed with the enhancement stylesheet disabled (F01, F16); nested opposite-mode surface re-resolves roles inside shadow roots and sets `color-scheme` (F03); the frame width, not the viewport, switches the native-controls grid between one and two columns, and long content stays inside the frame (F07); reduced motion slows the spinner to 3 s and clearing `loading` hides it (F11); keyboard focus keeps a 2 px solid outline and controls keep a 1 px border with forced colours emulated (all three engines emulate it; 12/12 repeated runs) (F14); the components-only example and the gallery reflow at 320 CSS pixels with long content (F14); hover changes the primary button only where `(hover: hover)` matches (Chromium desktop vs touch emulation; skipped in Firefox and WebKit, which lack `isMobile`). No CSP violations or page errors apart from the WebKit `<select>` reports above |
| Load | `npm run verify`, `npm run test:e2e` | With other applications using 60–85% CPU, two e2e runs hit 30 s fixture timeouts (Firefox page creation in `beforeEach`, a WebKit click); the spec now has a 60 s budget per test (several tests open two pages or contexts) and focuses the field directly before pressing Tab. Rerun: 40 passed, 2 skipped |
| Floor probe rerun | `node scripts/compat/run-floor.mjs` | Pass — 16/16 checks and 20/20 detections matching BCD in both floor browsers after the final build ([floor-results.json](../research/compatibility/floor-results.json)) |
| Full pipeline | `npm run verify` | Pass in one uninterrupted run — boundaries (8 packages, 105 source files, 292 imports), build, CSS compatibility (69 features, 16 stylesheets, 150 keys), format, typecheck, 822 tests in 80 files, size budgets (JS unchanged: counter 9,522 B of 9,728 B; CSS as above), 40 e2e tests passed and 2 skipped in Chromium, Firefox, and WebKit, packed consumers for all 7 publishable packages |
| Coverage gaps | — | Safari 17.4 and Safari iOS 17.4 not run (no automation on this host; WebKit 27.2 is not Safari 17.4); Chrome Android, Firefox Android, and Edge 125 rely on data and the Chrome 125 run; the floor probe is not in CI; screen readers and real browser zoom remain manual (M8) |
| Links | Relative-link check over all Markdown files | 78 files, 374 relative links, 0 broken |

## 2026-10-18 — AI interaction package `@oddkin/ai` (ADR 0040)

Windows 11 (10.0.26300), Intel Core i5-1135G7 (8 logical cores), 16 GiB; Node 24.21.0, TypeScript 7.0.2, Vitest 5.0.5, Playwright 1.64.1 (Chromium 156.0.8078.4, Firefox 157.0, WebKit 27.2); framework fixtures React 19.3.1, React DOM 19.3.1, Vue 3.5.44; axe-core 4.14.0 (exact dev dependencies, never runtime). Contract: [ai-interaction.md](./architecture/ai-interaction.md); traceability: [IMPLEMENTATION_PLAN.md §5j](../IMPLEMENTATION_PLAN.md#5j-ai-interaction-package-oddkinai-summary).

| Check | Command | Result |
| --- | --- | --- |
| Build | `npm run build` | Pass — `@oddkin/ai` compiled (dev and prod outputs); `custom-elements.json` and `oddkin.metadata.json` with 24 components, 14 models, 0 diagnostics; 14 record schemas in `packages/ai/schemas/`; demos bundled with production exports (research 220,560 B, writing 92,868 B, agent 179,302 B minified) |
| Boundaries | `npm run lint:boundaries` | Pass — 9 packages, 283 source files, 941 imports; `@oddkin/ai` may import only core, tokens, and components; its DOM-free entries import in Node |
| CSS compatibility | `npm run lint:css` | Pass — 69 features, 44 stylesheets, 224 keys; `css.properties.resize.none` registered for the composer; matrix regenerated with `npm run compat` |
| Format, typecheck | `npm run format:check`, `npm run typecheck` | Pass. Generated `packages/ai/schemas` are Prettier-ignored. Tests typecheck lists `packages/components/test` first so mixed source/declaration copies of `odd-button` report their duplicate tag-map entry in the skipped `.d.ts` (the same order the program had before the AI tests were added) |
| Contracts and controllers | `npx vitest run --project node packages/ai` | Pass — normalization and explicit `unsupported` parts; attempt, connection, stop, tool, and approval transitions; late events after a conversation switch; identity-only deduplication with repeated text kept; stop racing completion (`too-late`), unconfirmable stop (`unknown`); one decision per approval revision, stale and expired decisions refused; branches; draft revisions; UTF-16 ranges and stale proposals; voice denial, interruption, cleanup |
| Streams | same (`stream.test.ts`) | Pass — WHATWG SSE framing and the AI SDK UI message stream v1 fixtures (`test/fixtures/ui-message-stream/*.sse`) give identical events and state at every byte split point, including multi-byte UTF-8; a replayed resume rebuilds the message without duplicates or a new attempt |
| Markdown and URLs | same (`markdown.test.ts`) | Pass — any prefix parses; earlier blocks are final once later content exists; only listed URL schemes; relative URLs only when enabled |
| Elements | `npx vitest run --project browser packages/ai` | Pass in Chromium, Firefox, WebKit — IME Enter never submits (A01); draft kept on failure and newer edits kept on an older acknowledgement (A02); streamed Markdown split at awkward points with canonical copy (A13); adversarial content inert (A14); explicit fallbacks (A15); history anchor kept and manual scrolling respected, focus and committed DOM kept, jump resumes following (A11, A12); stale proposals refused (A17); no leaked subscriptions, listeners, object URLs, or voice resources after repeated mounts (A18, A19); restore success only when confirmed (A20); announcements once, never streamed text (A21) |
| Framework bindings | `frameworks.browser.test.ts` | Pass in three engines — properties set before definition are replayed; React 19 sets object properties and receives `approval-decide` through `onapproval-decide`; Vue 3.5 binds properties and `onApprovalDecide` (A16) |
| Metadata and graphs | `metadata.test.ts`, `graph.test.ts` | Pass — CEM 2.1.0 and `oddkin-metadata.v1` valid; every element has its `@oddkin/ai/define/<name>` registration, `@useFor`, `@notFor`, `@a11y`; typed events with request semantics; schemas current (`build-ai-schemas.mjs --check`); the root entry is contracts only; controllers load no elements, Markdown, adapters, or frameworks; the conversation registration loads no highlighter, voice, or stream adapter |
| All unit and browser tests | `npx vitest run` | Pass — 997 tests in 98 files (106.7 s) |
| Size budgets | `npm run size` | Pass — `ai-headless` 13,391 B of 14,336 B; `ai-response` 20,607 B of 21,504 B; `ai-chat` 47,747 B of 49,152 B; AI styles 4,388 B of 4,608 B (gzip; budgets set from these measurements); existing budgets unchanged |
| Demos (A22) | `npx playwright test e2e/ai-demos.spec.ts` | Pass — 39 tests in Chromium, Firefox, WebKit against the production bundles under `default-src 'none'` with Trusted Types required: research (history, streamed cited answer, citation preview, tool, artifact, usage; stop confirmed; disconnect then resume to completion; conversation switch ignores an injected late event), writing (rewrite → accept → provenance → undo; translate made stale by an edit cannot be applied; explain; dictation), agent (parallel tools, question, approval revision, approval is not success, confirmed restore; tool failure and retry, approval expiry, failed restore, Stop). axe-core (WCAG 2.0/2.1/2.2 A and AA rules, injected through the automation channel so the CSP stays as served): 0 violations on each demo. 320 CSS px: no horizontal scrolling; reduced motion: no running animations. No page errors; no CSP violations apart from WebKit's per-`<select>` `style-src-attr` reports recorded in the previous entry, which the spec excludes only for native `<select>` targets in WebKit |
| Performance | `node research/benchmarks/ai/run.mjs --samples 5` | 1,000-message history mounts (to settled) in 601 ms Chromium, 681 ms Firefox, 762 ms WebKit (74,340 nodes including shadow trees; snapshot validation 21–29 ms). Streaming 20,062 characters in 2,508 chunks at 3 per frame into that history: per-chunk ingestion p95 0.3 ms (Chromium) and 1 ms (Firefox, WebKit, clamped timers); frame p95 16.8 ms Chromium, 16.7 ms Firefox, 32 ms WebKit (17 ms into an empty conversation); frames over 50 ms 0, 1, and 2; the view followed to the bottom in every run. Chromium heap: about 20.5 KB retained per message, about 2.0 MB growth during the stream, back to baseline after teardown (median −199 KB). Results: [ai-2026-10-18-win32.json](../research/benchmarks/results/ai-2026-10-18-win32.json) |
| Links | Relative-link check over all Markdown files | 85 files, 397 relative links (anchors included), 0 broken |
| Remaining stages | `npm run size`, `npm run test:e2e`, `npm run verify:packs` after the full Vitest pass | Pass — all budgets; 79 e2e tests passed and 2 skipped (the existing hover skips) in Chromium, Firefox, and WebKit; packed consumers for all 8 publishable packages including `@oddkin/ai` (every JS subpath imports in Node, declarations resolve, no third-party runtime dependency) |

**Findings:** (1) Prettier formats the HTML inside `html` tagged templates; it added line breaks inside a diff container styled `white-space: pre-wrap`, which would have shown blank lines around every proposal. The whitespace-preserving style moved to an inline span around the bound segments; three exact `textContent` assertions now compare trimmed text. (2) The analyzer mapped registrations only through `default`/`import` export targets, which point at `dist/prod` in packages with a dev/prod split; it now also maps the `development` target, so registrations read `@oddkin/ai/define/<name>`. (3) Under the full parallel run, subprocess- and schema-bound Node tests exceeded their budgets (`tests/experiments/analyzability.test.ts` 30 s, the AI metadata and graph tests 5 s); they take under 1 s alone. Budgets are now 120 s and 30 s; no assertion changed. (4) One full `npm run verify` stalled inside Vitest for 8 minutes after a Firefox timeout in `packages/components/test/button.browser.test.ts` ("register nothing", 16 s); the run was stopped. The suite then passed in full (997 tests), followed by the remaining stages below. The stall did not reproduce; watch for it in the next runs.

**Coverage gaps:** screen-reader output (NVDA, JAWS, VoiceOver, TalkBack) not exercised; forced-colors and 200 %/400 % zoom reviewed only through styles, not manually; Safari 17.4 not run; no live AI SDK backend (contract fixtures only); AG-UI is a design note without an adapter.

## 2026-10-18 — Shared style primitives and opt-in document stylesheets (M4 foundation completion)

Environment as the previous entry. Contracts: [theming-and-styling.md §7](./architecture/theming-and-styling.md#7-styling-contract), [css-architecture.md §5](./architecture/css-architecture.md#5-cascade-encapsulation-and-customization).

| Check | Command | Result |
| --- | --- | --- |
| Primitives | `npx vitest run --project node packages/components/test/styles.test.ts` | Pass — `hostStyles` and `visuallyHiddenStyles` read no theme tokens; `focusRingStyles` reads the focus tokens; the only `!important` rules are `:host([hidden])` and `[hidden]` |
| Document stylesheets | same | Pass — `reset.css`, `base.css`, `utilities.css` start with the canonical layer order and keep every rule in `odd.reset`, `odd.base`, `odd.utilities`; no `!important`; `.odd-visually-hidden` and the focus rules in `base.css`/`utilities.css` have exactly the declarations of the shadow-root primitives |
| Behavior in browsers | `npx vitest run --project browser packages/components` | Pass in Chromium, Firefox, WebKit — a page rule setting `display` does not reveal a `hidden` host, and a component rule setting `display` does not reveal a `hidden` internal element; button and input draw the same 2 px solid ring from the focus tokens; button and input share the host-defaults and focus-ring constructed sheets. Existing button, input, and card tests unchanged except sheet counts (2 → 4) and foundation export lists (+ `hostStyles`); a recomposed card shares the host and structural sheets with `odd-card` |
| Metadata | `npm run build` | Pass — the analyzer records styles imported from another package (`@oddkin/ai` definitions using `@oddkin/components/styles`) by specifier and name instead of failing; 0 diagnostics |
| Full pipeline | `npm run verify` | Pass in one uninterrupted run — boundaries (9 packages, 288 source files, 959 imports), CSS compatibility (69 features, 50 stylesheets, 229 keys), format, typecheck, 1,011 tests in 99 files, size budgets (button CSS 1,054 B, input 586 B, card 557 B, shared primitives 297 B of 384 B, document stylesheets 612 B of 768 B; JavaScript budgets unchanged except `ai-response` 20,681 B and `ai-chat` 48,129 B, within their budgets), 79 e2e tests passed and 2 skipped, packed consumers for all 8 packages |

**Findings:** (1) Inside a flex container the visible spinner's computed `display` is `block` (blockified), so the hidden test asserts "not `none`" rather than a specific value. (2) The architecture docs said Oddkin ships no `!important`; `@oddkin/ai` already did inside shadow roots. The statement now names the single shadow-root exception and keeps document stylesheets free of `!important`.

## 2026-10-18 — Approved palette, role vocabulary, and text-style roles (ADR 0041)

Environment as the previous entry. Design source: Figma file `E7LfRysny8V3qU24tv082i` (frames 8:29, 31:441, 49:579; variables read with `get_variable_defs`). Contract: [theming-and-styling.md §10.1–§10.3](./architecture/theming-and-styling.md#101-approved-default-palette-and-role-vocabulary-implemented-adr-0041).

| Check | Command | Result |
| --- | --- | --- |
| Generator and fixtures | `$env:UPDATE_FIXTURES=1; npx vitest run --project node packages/tokens`, then without the variable | Pass, 66 tests — fixtures and `src/generated/default-{names,values}.ts` regenerated through the generator; `status.warning` accepted by config, schema, and ramps; overriding secondary text now reports two contrast pairs (default surface and canvas); `values.color.action.default` is `#6250e8` / `#b4a8ff` |
| Default theme | `generate()` on `themes/default.theme.json` | `ok: true`, no diagnostics — every approved light/dark pair in `CONTRAST_PAIRS` meets its minimum (text on canvas, surfaces, and specimen; on-action and selection; link, focus ring, strong border; each status foreground on the default surface and its status surface) |
| Renamed roles | `git grep` for the removed names outside generated output | No references remain in sources, tests, or examples; `token()` would reject them at type-check time |
| Components | `npx vitest run packages/components/test/card.browser.test.ts` | Pass in three engines — `variant="elevated"` reads `--odd-elevation-hover`; `--odd-card-shadow: none` still removes it |
| Full pipeline | `npm run verify` | Pass — lint (boundaries, CSS compatibility with 50 stylesheets, format), typecheck, 1,011 tests in 99 files, size budgets (default token CSS 2,380 B of 2,560 B, previously 1,827 B of 2,048 B; button 1,056 B, card 534 B, input 590 B, AI styles 4,387 B), 79 e2e passed including axe-core on the three AI demos with the new palette, packed consumers |

**Findings:** (1) The approved values are hand-tuned rather than ramp steps, so the default theme pins them as overrides and the generic preset keeps contrast-selected roles for other brands. (2) Pale iris is reserved for specimen stages; the AI pressed text button now uses the selection roles, and transient highlights (prompt drag target, revealed source) use `surface.hover`. (3) Font files are not shipped; without Jost, Inter, or JetBrains Mono installed, text falls back to system fonts. (4) Components do not yet use the text-style roles, and the restyled components have not been compared visually with the Figma frames; that is the next slice.

## 2026-10-18 — Complete foundation scales (ADR 0042; ADR 0041 amended)

Environment as the previous entry. Decision: only the colour palette comes from the design; every other value is an Oddkin scale. Contract: [theming-and-styling.md §10.2–§10.3](./architecture/theming-and-styling.md#103-foundation-scales-implemented-adr-0042).

| Check | Command | Result |
| --- | --- | --- |
| Generator | `$env:UPDATE_FIXTURES=1; npx vitest run --project node packages/tokens`, then without the variable | Pass, 68 tests — reduced-motion block on `:root` and `[data-odd-theme]` sets exactly the four durations to `0ms`, and an override keeps its reduced value; `unit.invalid` for a unitless duration, a keyword or out-of-range easing, and a fractional `z-index`; negative y control points accepted; `values.color.selection.background` is per mode (previously light only); fixtures and generated modules regenerated through the generator |
| Card | `npx vitest run packages/components/test/card.browser.test.ts` | Pass in three engines — `variant="elevated"` reads `--odd-elevation-md` |
| AI voice test | `npx vitest run packages/ai/test/elements.browser.test.ts -t A19` | Pass in three engines after replacing two fixed sleeps with `expect.poll` (WebKit missed the 40 ms window under full-suite load) |
| Full pipeline | `npm run verify` | Pass — boundaries (9 packages, 288 files, 959 imports), CSS compatibility (69 features, 50 stylesheets, 228 keys), format, typecheck, 1,013 tests in 99 files, size budgets (default token CSS 2,764 B of 3,072 B; card 531 B; AI styles 4,374 B), 79 e2e passed and 2 skipped, packed consumers for all 8 packages |

**Findings:** (1) Two load-induced timeouts surfaced during this run and were fixed in the tests, not by retrying: the artifact boundary test spawns Node (now 30 s), and the slowest AI e2e test deliberately streams at 120 ms per chunk (~26 s alone in Firefox; now `test.slow()`). (2) Values reverted from ADR 0041 change component rendering back to the pre-0041 sizes: `font.size.md` 1rem, `control.radius` 8 px, `card.radius` 12 px. (3) Opacity and scrim tokens were not added; no component needs them.

## 2026-10-18 — Components adopt text styles and motion tokens

Environment as the previous entry. Contract: [theming-and-styling.md §10.2](./architecture/theming-and-styling.md#102-text-styles-implemented-adr-0042).

| Check | Command | Result |
| --- | --- | --- |
| Components and AI | `npx vitest run packages/components packages/ai` | Pass, 310 tests in Chromium, Firefox, WebKit, and Node — no expectation changed |
| Rendering | css-gallery card at `http://localhost:4180/examples/css-gallery/` (integrated browser screenshot) | Card heading in the `title` style, field label in `ui`, help text in `small`, control text at the body size, primary and secondary buttons in `ui` |
| CSS | `npm run lint:css`, `npm run compat`, `npm run size` | Pass — 232 compatibility keys; button 1,119 B of 1,280 B; card 678 B (budget raised 640 → 768 B for the body text and slotted-heading default); input 743 B (budget 768 → 896 B); document stylesheets 621 B of 768 B |
| End to end | `npm run test:e2e` | 79 passed, 2 skipped — the gallery hover check polls until the 100 ms background transition settles |
| Full pipeline | `npm run verify`, then `npm run test:e2e` and `npm run verify:packs` after the e2e fix | Lint, typecheck, 1,013 tests, size budgets pass; first e2e run failed twice in Firefox under four workers (simulated research streaming exceeded 30 s, with a Firefox software-compositor crash in the log); passes alone and after the fix; packed consumers OK |

**Findings:** (1) The research demo streams for 20–26 s per test alone in Firefox, so its e2e groups now have a 90 s timeout and wait up to 45 s for completion; nothing in the demos changed. (2) The input control stays at the body size (1rem) rather than `ui`, because iOS Safari zooms the page when a focused field is smaller than 16 px. (3) The card's heading default uses `::slotted()`, which loses to any light-DOM rule for the heading, so page styles keep control.


## 2026-10-18 — Core controllers (M4 foundation completion)

Environment as the previous entry. Contract: [core-contracts.md §4.1](./architecture/core-contracts.md#41-shared-controllers-oddkincorecontrollers-implemented-m4).

| Check | Command | Result |
| --- | --- | --- |
| Controllers | `npx vitest run packages/core/test/controllers.browser.test.ts` | Pass, 18 tests in Chromium, Firefox, WebKit — roving focus (arrows by orientation, RTL mirroring, Home/End, wrap on and off, disabled skipped, pointer focus followed, callback mode writes no `tabindex`, no handling after disposal, Tab stop moved when the active item is removed); focus recovery after removal, `hidden`, and `disabled`, never after the user moved focus out, native focusability of a focusable fallback kept; announcer (two regions, keys once, joined messages, `reset()`, routed caller-named event cancelled by the nearest announcer only, nothing written after disposal); resize deliveries and disconnection, `'frame'` merging, intersection; form value, mirrored `valueMissing` and message, custom error first, reset, restore, and fieldset disabled |
| Migration | `npx vitest run packages/components packages/ai packages/core` | Pass, 783 tests — no expectation changed for `odd-input` or the AI elements |
| DOM-free imports | `npm run lint:boundaries` | The four controller entries import in Node without DOM globals |
| Size | `npm run size` | `ai-chat` 48,782 B (was 48,157 B; budget raised to 50,176 B); other JavaScript and CSS budgets unchanged |
| Full pipeline | `npm run verify`, then `npm run test:e2e` and `npm run verify:packs` after the import-map fix | Lint, typecheck, unit and browser tests, size pass; e2e first failed in 19 tests because the CSS gallery and the floor probe load `odd-input` through import maps that lacked `@oddkin/core/controllers/form`; after adding it (gallery CSP hash recomputed) 79 passed, 2 skipped; packed consumers OK |

**Findings:** (1) Pages that load components through import maps must list every core subpath the components import; the failure is a page that never becomes ready, with no console error in the test output. (2) The previous AI focus helper set `tabindex=-1` on any fallback without one, which would have removed a natively focusable fallback (a button) from the Tab order; the controller only does so for elements that are not focusable. (3) Live-region creation is a separate function so elements that render their regions do not ship it.

## 2026-10-18 — Core localization helpers (M4 foundation completion)

Environment as the previous entry. Contract: [core-contracts.md §4.2](./architecture/core-contracts.md#42-localization-helpers-oddkincorei18n-implemented-m4).

| Check | Command | Result |
| --- | --- | --- |
| Helpers | `npx vitest run packages/core/test/i18n` | Pass — Node: typed overrides (defaults object returned unchanged without overrides; unknown keys and non-strings ignored), plain-text placeholders, plural categories in English, German, and Arabic with localized counts and `other` fallback, formatter caching per kind/locale/options, invalid locale falls back to the default, invalid options fall back to `String(value)`, dates from `Date`, ISO text, and timestamps with `undefined` for missing or invalid input; browsers (three engines): nearest `lang` and resolved `dir` across a shadow root, including a nested override |
| AI migration | `npx vitest run packages/ai packages/core` | Pass — the AI string helpers re-export `@oddkin/core/i18n`; the controllers import-graph test now also allows that DOM-free entry |
| Full pipeline | `npm run verify` | Pass in one run — boundaries (291 files, 969 imports), CSS compatibility, format, typecheck, 1,076 tests in 106 files, size budgets (`ai-chat` 49,121 B of 50,176 B), 79 e2e passed and 2 skipped, packed consumers |

**Findings:** (1) The AI number and date helpers constructed a new `Intl` formatter on every call (each render of a usage meter or timestamp); the cache removes that work. (2) `dirOf` reads computed style, which costs a style recalculation; call it on demand (key handling), not in render.

## 2026-10-18 — Oddkin-bound layout and layout.css (M4 foundation completion)

Environment as the previous entry. Contract: [layout-recipes.md §12](./architecture/layout-recipes.md#12-oddkin-bound-layout-oddkincomponentslayout-implemented-m4).

| Check | Command | Result |
| --- | --- | --- |
| Helpers, recipes, stylesheet | `npx vitest run packages/components/test/layout.test.ts packages/core/test/layout.test.ts` | Pass — helper defaults are the layout roles; `condition()` returns the media and container at-rules; recipes resolve `navigation.expanded` and layer under `odd.layout.*`; caller conditions and layer prefixes win; unknown names report `recipe.condition.unknown`; `layout.css` starts with the canonical order and its declarations are the helpers' with one override property per option; core rejects `Odd.layout` and `odd..layout` and nests a dotted prefix |
| Browsers | `npx vitest run packages/components/test/layout.browser.test.ts` | Pass in Chromium, Firefox, WebKit — `.odd-split` side by side at 500 px and wrapped at 250 px or with a wider `--odd-split-side-width`; `.odd-auto-grid` 4, 2, and 1 columns at 500, 220, and 80 px; gaps from the role, from `--odd-stack-gap`, and an unlayered page rule winning; a shadow-root recipe switches from 1 to 3 columns when its `shell` container reaches 48rem, with no script |
| Metadata | `npm run build` | The analyzer now recognizes `defineLayoutRecipe` from `@oddkin/components/layout` and ignores calls inside functions (wrappers and factories); the fixture's factory adds no diagnostic |
| CSS | `npm run lint:css`, `npm run compat`, `npm run size` | 51 stylesheets (layout.css added to the lint list), 232 keys; `components:layout` 411 B of 512 B |
| Full pipeline | `npm run verify`, then `npm run test:e2e` | Lint, typecheck, 1,095 tests in 110 files, size pass; one e2e `locator.check` timed out under four workers and passed on the rerun (79 passed, 2 skipped); packed consumers OK |

**Findings:** (1) The build's metadata step failed on the new wrapper until the analyzer distinguished recipe definitions (module scope) from factories that forward a definition. (2) `layout.css` was not in the CSS compatibility lint until the stylesheet list was extended; the lint's file list is explicit, so new document stylesheets must be added there. (3) The intermittent `locator.check` timeout is recorded rather than retried away; the test that hit it was not identified from the run output.

## 2026-10-18 — `odd-side-nav` and the navigation model (M4 layout and data slices)

Environment as the previous entry. Contracts: [data-composition.md §12](./architecture/data-composition.md#12-odd-side-nav-implemented-m4), [layout-recipes.md §9–§10](./architecture/layout-recipes.md#9-optional-build-time-extraction).

| Check | Command | Result |
| --- | --- | --- |
| Model | `npx vitest run packages/components/test/models.test.ts` | Pass — valid navigation returned without copying; `@ts-expect-error` for a link without `href` and an action without `action`; external data reports `model.required.missing`, `model.url.unsafe`, `model.label.empty`, `model.kind.unknown`, and a nested `model.id.duplicate` at JSON-pointer paths; version 0 (`title`, `children`) migrates; version 2 is `model.version.unsupported`; Ajv with the emitted schema agrees with `validate()` |
| Element | `npx vitest run --project browser packages/components/test/side-nav.browser.test.ts` | Pass in Chromium, Firefox, WebKit (13 tests) — named `<nav>` with native links, badge, `rel` for new tabs, actions, and a nested group; `java\tscript:` and disabled links have no `href`; groups open when they contain `current`, toggle, and stay put when `odd-toggle` is cancelled; controlled `expanded` only reports; `odd-action` only for enabled actions; changing `current` moves `aria-current` and opens the group with the same nodes; reorder, insert, and remove keep nodes and focus; slotted links, empty header and footer hidden, `items` wins with one warning; one column at 300 px and three at 800 px without a `ResizeObserver`; roles read through the shadow root with the target minimum kept; 20 reconnects keep nodes and 1,000 mount, replace, and unmount cycles return to the scope and listener baseline |
| Extraction | `npx vitest run packages/components/test/recipes.test.ts` | Pass — `side-nav.recipe.styles.ts` is byte-identical to `sideNavRecipe.cssText`; regenerated with `UPDATE_FIXTURES=1` |
| Import graphs | `npx vitest run packages/components/test/graph.test.ts` | Pass — the foundation loads its five modules, `hostStyles`, and four core subpaths; the registration entry loads no layout engine, model validators, or schema emitter |
| Example | `npx playwright test e2e/side-nav.spec.ts` | Pass in three engines (15) — narrow and wide instances of one definition; recipe and handwritten CSS agree on 11 computed properties at 12, 24, 36, 44, and 56rem; slotted and hybrid sources; `navigation.compact` reduces padding and dark mode changes colour inside their scopes; Tab order, Enter and Space on a group, an action, a solid focus ring; no horizontal scrolling or clipped entries at 320 px with 200% text; no CSP violations or console errors. WebKit keeps links out of the Tab order by default, so its keyboard test starts at the first button |
| Schemas and size | `npm run build`, `npm run size` | `schemas/oddkin.navigation.v1.json` generated (Prettier-ignored like the AI schemas); `side-nav` 14,517 B of 15,360 B; `components:side-nav` 1,234 B of 1,536 B |
| Full pipeline | `npm run verify` steps run one by one (`npm test -- --reporter=verbose`) | Pass — boundaries (304 files, 1,016 imports), CSS compatibility (56 stylesheets, 237 keys), format, typecheck, 1,142 tests in 115 files, size, 94 e2e passed and 2 skipped, packed consumers |

**Findings:** (1) Item templates inside `repeat()` run outside render tracking, so attributes such as `aria-current` read from plain values never updated; they are now bound as `computed()` readables. (2) The recipe engine was 3.4 KB of the 17.9 KB element bundle; build-time extraction with a byte-identity test removed it. (3) The example's 320 px reflow failed at first: a non-wrapping label row and long words in the heading; both fixed in the example's CSS. (4) Two Node tests that take under 250 ms alone (CEM schema compilation and a temporary-workspace boundary check) exceeded the 5 s default while three browsers ran beside them; the Node project timeout is now 20 s. (5) The CSS size measurement counted a recipe's text twice when a module exported both the recipe and its extracted styles; it now counts each distinct text once. (6) Unresolved: one `npm run verify` run stalled in the browser test project for 9 minutes with WebKit processes busy and no output (the default reporter prints only at the end, so the test was not identified); it was stopped. A browser-project rerun then failed once to load `packages/tokens/test/cascade.browser.test.ts` in Firefox ("error loading dynamically imported module"), which passed alone, and the step-by-step run above passed. Use `--reporter=verbose` when a run stalls.

## 2026-10-18 — Editable list example (M4 data slice)

Environment as the previous entry. Contract: [data-composition.md §10, §13](./architecture/data-composition.md#13-editable-list-example-implemented-m4).

| Check | Command | Result |
| --- | --- | --- |
| Rows, typing, ownership | `npx vitest run --project browser tests/examples/editable-list.browser.test.ts` | Pass in Chromium, Firefox, WebKit (6 tests) — one keyed fieldset per member, submission in display order, edge buttons disabled; typed text, caret (5–5), focus, and the `odd-input` node survive an insert, a removal above, another row moving past, and the focused row moving; at an edge focus moves to the row's other move button; a duplicate address after a reorder is reported at `/2/email` and lands on the right row (custom validity, form invalid) and typing clears it; `model.label.empty` maps to the name field and `model.id.duplicate` is returned unplaced; each keystroke aborts the previous address check, removal aborts the pending one, undo restores the typed values with a new scope, a late answer is ignored, and `scopeStats()` returns to baseline; 200 add/remove/undo cycles and `dispose()` return to baseline |
| Example | `npx playwright test e2e/editable-list.spec.ts` | Pass in three engines (15) — edit, move with announcement, remove (focus on Undo), Undo with Enter (focus on the restored Name), add (focus on the new Name), save: submitted JSON in display order with typed values; an edge move hands focus to Move down; an empty added row blocks native submission and marks only its own fields; a duplicate address is caught on save with focus on the field and cleared by editing; a taken address shows the server message and blocks saving; no horizontal scrolling at 320 px and 200% text; no CSP violations or console errors |
| Full pipeline | `npm run verify` steps one by one (`npm test -- --reporter=verbose`) | Pass — boundaries, CSS compatibility (57 stylesheets, 237 keys), format, typecheck, 1,161 tests in 118 files, size, 109 e2e passed and 2 skipped, packed consumers |

**Findings:** (1) Fieldsets default to `min-inline-size: min-content`, which would push wide rows past a narrow viewport; the example resets it. (2) Model rules run only after the schema passes, so the page reports a blank name before it can report duplicate addresses; the example accepts that order rather than adding a second validation pass. (3) A test that moved a row out of range passed vacuously at first (`move()` ignores out-of-range targets); it now asserts the row's new position before checking focus.

## 2026-10-18 — Authored component examples (M4, ADR 0021 Accepted)

Environment as the previous entry. A second agent was editing `odd-input` and the form controller in the same working tree during this run. Contract: [workbench.md §7](./architecture/workbench.md#7-authored-examples-defineexamples), [ADR 0021](./architecture/decisions/0021-define-examples.md).

| Check | Command | Result |
| --- | --- | --- |
| Contract and serialization | `npx vitest run packages/components/test/examples.test.ts` | Pass (3 tests) — every example's property keys are public writable fields, its attributes and slots exist in the published CEM; `toExamplesJSON` validates against `examples.v1` and drops fixture code; each component has a `default` example, the examples show exactly the declared preview roles, and button and input have an in-form fixture |
| Mounted examples | `npx vitest run --project browser packages/components/test/examples.browser.test.ts` | Pass in Chromium, Firefox, WebKit (7 tests) — all 30 examples mount through `mountExample` with their properties, attributes, and slot text, and `dispose()` returns `scopeStats()` to its value before mounting; the button fixture submits `project=Atlas&intent=create`; the input fixture blocks an empty submission and then submits the typed address; the invalid input shows its message through custom validity; the headed card fills header and footer; controlled side navigation expands through `odd-toggle`; the wide example has three columns in a 1,000 px frame |
| Build order and boundaries | `npx vitest run tests/architecture/boundaries.test.ts`, `npm run lint:boundaries` | Pass — example files may import `@oddkin/workbench` only when it is a `devDependency`; a shipped module importing an example file is `boundary.import.devSource`; no `*.examples.*` file is in `packages/components/dist`; the components project builds without referencing Workbench |
| Full pipeline | `npm run verify` steps one by one | Typecheck, size, and packed consumers pass. Lint failed only on formatting of the other agent's uncommitted `packages/core/test/form-association.browser.test.ts`. Tests: 1,202 passed and 1 failed (`input.browser.test.ts` "typing then submitting…" in Firefox); e2e: 106 passed, 3 failed in Firefox (two `css-compat.spec.ts` tests and the editable-list validation test). All four failures passed when rerun alone (`input.browser.test.ts` 39/39; the two e2e files 11/11 in Firefox), while both agents were running tests |

**Findings:** (1) `odd-input` does not reflect `name`, and a form-associated element submits under its `name` **attribute**, so `input.name = 'email'` set as a property submits nothing; the example uses the attribute. Reported to the agent working on form association (it owns `input.ts`). (2) `odd-button` submits after the click's task, so tests must poll for the submission rather than read it right after the click. (3) The browser-test frame is narrower than 40rem, so a container-width example must be mounted in a wider container to show its wide layout. (4) Full runs from two agents in one working tree compete for CPU; Firefox timing failures there are not evidence until rerun alone.
