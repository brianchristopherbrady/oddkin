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

## 2026-10-18 — Independent CEM consumer (M4 metadata validation)

Environment as the previous entry; `custom-element-vs-code-integration` 1.5.0 added as a pinned root dev dependency. Contract: [metadata-and-analyzer.md §4](./architecture/metadata-and-analyzer.md#4-outputs).

| Check | Command | Result |
| --- | --- | --- |
| Third-party consumer outside the workspace | `npm run verify:packs` | Pass — the tarballs are installed into a temporary consumer; for each installed package with a `customElements` field, the third-party generator's `getVsCodeHtmlCustomData` and `getVsCodeCssCustomData` read that manifest. Every element of `@oddkin/components` (4) and `@oddkin/ai` (24) appears with all its attributes, CSS custom properties, and `::part()` names; `odd-button`'s `appearance` values are `primary`, `secondary`, `ghost` |
| Formatting | `npx prettier --check scripts/verify-packs.mjs package.json` | Pass |

Only the packed-consumer script changed, so the test suites were not rerun for this entry; the previous entry's run covers the same code.

**Findings:** None: the generator needed no Oddkin-specific options, and no element, attribute, property, or part was dropped. It derives enumerated values from the attribute's type text, so union types written as string literals are what editors will offer.

## 2026-10-18 — Form association: owner, reassociation, and submission (M4 forms)

Environment as the previous entry. Another agent was editing other files in the same working tree. Contract: [core-contracts.md §4.1](./architecture/core-contracts.md#41-shared-controllers-oddkincorecontrollers-implemented-m4).

| Check | Command | Result |
| --- | --- | --- |
| Engine behavior | Temporary probe test (not kept) logging the four callbacks of a bare form-associated element | All three engines call `formAssociatedCallback` on insertion (after `connectedCallback`), removal (`null`), moves between forms, `form` attribute changes, and when the named form is inserted, removed, or renamed; `formDisabledCallback` on moves into and out of a disabled fieldset. Order on a move differs (finding 1). `moveBefore` exists in Chromium and Firefox, not in WebKit 27.2 |
| Controller | `npx vitest run --project browser packages/core/test/form-association.browser.test.ts` | Pass in Chromium, Firefox, WebKit (6 tests; the `moveBefore` test is skipped in WebKit) — the `form` readable and FormData follow insertion, a move, removal, the `form` attribute, and the named form appearing, leaving, and being renamed; the value effect of the new connection submits later changes; `moveBefore` keeps the connection, `scopeStats()`, and the value effect; a disabled fieldset disables and excludes the element until it moves out; the `formdata` entry lists of `requestSubmit()` contain the element only for its owner, which alone validates and resets it; an element without `static formAssociated = true` gets `controller.form.notAssociated` and the scope owns no effect |
| `odd-input` | `npx vitest run --project browser packages/components/test/input.browser.test.ts` | Pass in three engines (14 tests) — moved to another form it submits, validates, and resets only with the new owner; it follows its `form` attribute to a form inserted later and leaves it when the attribute is removed; a `name` set as a property is reflected and submitted, and `undefined` removes it |
| Full pipeline | `npm run verify` steps one by one (`npm test -- --reporter=verbose`) | Lint (boundaries, CSS compatibility, format), typecheck, size, e2e (109 passed, 2 skipped), and packed consumers pass. Tests: 1,261 passed, 1 skipped, 11 failed in the combined run — 8 in the other agent's uncommitted `contract.browser.test.ts` (`odd-button` CEM contract, Firefox and WebKit; this slice does not change `odd-button`), `button.browser.test.ts` activation and `input.browser.test.ts` "typing then submitting…" in Firefox after 19–21 s, and a WebKit `conversation.browser.test.ts` announcement test. Rerun alone: the button, input, and controller files pass (98 passed, 1 skipped) and the conversation file passes (21) |

**Findings:** (1) When an element moves between forms, Chromium and WebKit call `disconnectedCallback` before `formAssociatedCallback(null)` and Firefox after it; all three connect before reporting the new owner. The controller re-reads the owner in `connect` rather than relying on the order. (2) With `moveBefore`, Chromium and Firefox report `formAssociatedCallback(null)` and then the new owner without disconnecting. (3) `odd-input` did not reflect `name`, so a name set as a property submitted nothing (previous entry, finding 1); React 19 and Vue set properties on custom elements that define them. `name` now reflects and has no default, so fields without a name gain no `name=""` attribute. (4) In the Vitest browser runner, a GET submission into an iframe could be read back (`?x=hello`) in Chromium and WebKit, but in Firefox the frame (a 404 response) was not readable after 3 s; the controller tests read the `formdata` entry list instead of a frame URL.

## 2026-10-18 — CEM contract tests (M4 metadata validation)

Environment as the previous entry. Another agent was editing other files in the same working tree. Contract: [metadata-and-analyzer.md §4](./architecture/metadata-and-analyzer.md#4-outputs).

| Check | Command | Result |
| --- | --- | --- |
| Published CEM against live elements | `npx vitest run --project browser packages/components/test/contract.browser.test.ts` | Pass in Chromium, Firefox, WebKit (5 tests × 4 elements) — literal defaults equal the property values; every CEM attribute is observed and converts to its field, for every value of a string-literal union, and removing it restores the default; exactly the fields marked `reflects` write their attribute (booleans remove it again); the declared events equal the element's defined events; every documented slot and part is rendered by at least one authored example (mounted in a 1,000 px frame) |
| Mutation probe | Temporary script drifting the generated `custom-elements.json` (`size` default `'lg'`, `appearance` without `reflects`, an extra `icon` part), then `node scripts/build-metadata.mjs` | The drifted manifest fails the default, removal, reflection, and part checks in all three engines; the regenerated manifest passes 60/60 |

**Findings:** (1) A CEM field without a literal default makes no claim: `odd-input`'s `value` is an accessor over `defaultValue` and reads `''`, so the test checks literal defaults only. (2) The enrichment manifest has no event facts (bubbles, composed, cancelable); the test can compare event names only. (3) The results are not yet attached as *verified* provenance; doing so needs a record tied to the inputs tested.

## 2026-10-18 — Minimal component consumers (M4 metadata validation)

Environment as the previous entry. Another agent was editing `odd-button` in the same working tree during the full run. Contract: [packages.md](./architecture/packages.md) (`@oddkin/components` entries).

| Check | Command | Result |
| --- | --- | --- |
| Reachable modules | `npx vitest run --project node packages/components/test/consumers.test.ts` | Pass (16 tests) — every JavaScript export of `@oddkin/components` except the opt-in `./models`, `./layout`, and `./side-nav/recipe` is walked across packages through their `exports`; none reaches model validators, `@oddkin/core/model`, `@oddkin/core/model/schema`, a composition renderer, `@oddkin/core/layout/inspect`, `@oddkin/core/layout`, layout presets, the token generator, Workbench, the analyzer, or agent tooling; the opt-in entries do reach the model builder and the recipe engine |
| Related checks | `npx vitest run --project node packages/components/test/{consumers,metadata,recipes,graph}.test.ts`, `npm run size` | Pass (28 tests); `side-nav` 14,517 B and `components:side-nav` 1,234 B, unchanged |
| Full pipeline | `npm run verify` steps one by one (`npm test -- --reporter=verbose`) | Pass — boundaries (308 files, 1,031 imports), CSS compatibility (57 stylesheets, 237 keys), format, typecheck, 1,288 tests in 129 files (1 skipped), size, 109 e2e passed and 2 skipped, packed consumers including the new `./side-nav/recipe` subpath |

**Findings:** (1) `@oddkin/components/side-nav` exported `sideNavRecipe`, so importing the component entry loaded the recipe engine (about 3.4 KB gzip) even though the element itself uses extracted CSS. The recipe now lives in the opt-in `@oddkin/components/side-nav/recipe`; the registration entry was never affected, so the measured size is unchanged.

## 2026-10-18 — Example references in published metadata (M4 metadata)

Environment as the previous entry. Another agent had uncommitted changes to `odd-button`, `odd-input`, their tests, and a new stylesheet during the full run. Contract: [metadata-and-analyzer.md §2](./architecture/metadata-and-analyzer.md#2-supported-authoring-patterns).

| Check | Command | Result |
| --- | --- | --- |
| Analyzer | `npx vitest run --project node packages/analyzer` | Pass (19 tests) — the composed fixture's `panel.examples.ts`, excluded from its program, yields `example:acme-panel/default` (preview role `role:surface`) and `example:acme-panel/dismissible` (`hasFixture`); in the dynamic fixture a computed tag and a computed role list are `analyzer.examples.dynamic` and an example for an unregistered tag is `analyzer.examples.unknownComponent`, each with its line |
| Published metadata | `npm run build`, `npx vitest run --project node packages/components/test/examples.test.ts packages/components/test/metadata.test.ts packages/workbench` | Pass (31 tests) — the strict metadata build reports nothing; `oddkin.metadata.json` lists the 30 examples exactly as the runtime example sets define them, and validates against `oddkin-metadata.v1` |
| Full pipeline | `npm run verify` steps one by one | Size, e2e (109 passed, 2 skipped), and packed consumers pass. Lint failed on the compatibility matrix and typecheck on `styling.browser.test.ts`, both from the other agent's uncommitted files; tests: 1,133 passed and 2 failed in Firefox (`button.browser.test.ts`, under the other agent's changes, and `examples.browser.test.ts`, which passed 81/81 with `contract.browser.test.ts` when rerun alone) |

**Findings:** (1) Example files are outside the package program, so the analyzer finds them on disk under `rootDir` instead of through TypeScript's file list. (2) Static and runtime views agree for all 30 examples, so the published references can be trusted without running fixtures.

## 2026-10-18 — Side navigation: overrides, nested components, no resize work (M4 layout slice)

Environment as the previous entry. Contract: [layout-recipes.md §10](./architecture/layout-recipes.md#10-side-navigation-prototype-acceptance-fixture).

| Check | Command | Result |
| --- | --- | --- |
| Side navigation | `npx vitest run --project browser packages/components/test/side-nav.browser.test.ts` | Pass in Chromium, Firefox, WebKit (15 tests, 3 new) — across width changes a `MutationObserver` on the shadow root and the host records no mutation and no `ResizeObserver` is created; two instances share their adopted sheets, `sideNavRecipe.extend()` returns different CSS and leaves the recipe's unchanged, a host role and an unlayered `#nav-a::part(link)` rule change only that instance, and the shared sheets' rule text is identical before and after; an `odd-button` in the footer slot shows the footer region, slots its label, takes focus, and reads `--odd-button-radius` set on the page through both shadow boundaries |

**Findings:** (1) The first run of this file failed with Vitest "Unknown session id" errors while the other agent ran browser tests at the same time; a rerun alone passed 45/45. Two Vitest browser runs in one working tree interfere, so their results do not count until rerun alone. (2) 400% zoom was not tested separately: a 1,280 px window at 400% is 320 CSS px, which the existing reflow test covers (the equivalence WCAG 1.4.10 uses).

## 2026-10-18 — Side navigation in React and Vue without Oddkin state (M4 data slice)

Environment as the previous entry (React 19 and Vue 3.5 as already used by `@oddkin/ai`). Contract: [data-composition.md §10](./architecture/data-composition.md#10-acceptance-fixtures).

| Check | Command | Result |
| --- | --- | --- |
| React and Vue | `npx vitest run --project browser packages/components/test/frameworks.browser.test.ts` | Pass in Chromium, Firefox, WebKit (2 tests) — React 19 (`createElement`, `'onodd-toggle'`, `'onodd-action'`) and Vue 3.5 (`h`, `onOddToggle`, `onOddAction`) set `items`, `current`, and controlled `expanded` as properties (no `items` attribute); a toggle reaches framework state, which opens the group through `expanded`; an action reports `{ id: 'create', action: 'project.create' }`; replacing `items` with a reordered array keeps the link nodes; framework re-renders emit no intent events |

**Findings:** (1) A deep Vue `ref` passes the element a reactive proxy of the array instead of the array itself; rendering is unaffected (entries are keyed by id), but the element no longer holds the caller's object. `shallowRef` passes the original immutable data and is the documented choice. (2) Angular and Svelte are not installed; their fixtures need new dev dependencies.

## 2026-10-18 — Multi-product token fixtures (M4 multi-product prototype)

Environment as the previous entry. Contract: [multi-product.md §9](./architecture/multi-product.md#9-product-configuration-distribution-and-scope-isolation).

| Check | Command | Result |
| --- | --- | --- |
| Fixtures | `npx vitest run --project node packages/tokens/test/products.test.ts` | Pass (7 tests) — a theme without `products` emits no product rule; with 1, 2, 3, and 10 products (deep-frozen configurations) generation reports nothing, is identical on a second run, emits one `[data-odd-product]` rule per product that declares only `--odd-ref-*` and `--odd-color-*` properties, and with those rules removed equals the single-product output byte for byte; changing product 3 of 10 changes only its rule; the output grows by exactly the product rules, and gzip grows less than the raw bytes |
| Sizes | Temporary script (`generate()` from the built package, gzip level 9) | Default theme: 0 products 26,326 B raw / 2,720 B gzip; 1: 29,455 / 2,928; 2: 32,584 / 3,099; 3: 35,713 / 3,241; 10: 57,254 / 4,346 |

**Findings:** (1) A product rule declares only values that differ from the base theme: a hue close to the base brand (`#6d28d9` against `#6250e8`) leaves the tinted neutral ramp unchanged and declares 36 properties instead of 41, so per-product size is bounded but not constant. (2) Products are emitted in configuration order, so reordering the `products` map changes the bytes but never the cascade (an element has one product). (3) Frozen configurations generate without errors, so the generator does not mutate its input.

## 2026-10-18 — Condition-threshold invalidation (M2 item, M4 side navigation)

Environment as the previous entry. Contract: [theming-and-styling.md §11](./architecture/theming-and-styling.md#11-layout-roles-responsive-conditions-and-profiles).

| Check | Command | Result |
| --- | --- | --- |
| Thresholds | `npx vitest run --project browser packages/components/test/conditions.browser.test.ts` | Pass in Chromium, Firefox, WebKit (2 tests) — `odd-side-nav` in a 39rem frame stays one column after `--odd-layout-sidebar-width`, `--odd-layout-main-min`, `--odd-navigation-item-gap`, and `font-size: 8px` are set on it, and becomes three columns at 40rem; a recipe built with `defineLayoutRecipe` from `generate()` conditions for `navigation.expanded` at 40rem and at 30rem differs only in that query; the first recipe's constructed sheet has the same rules afterwards, and in a 35rem frame it gives one column while the regenerated one gives three |

**Findings:** (1) `rem` thresholds follow the root font size, so a component's own `font-size` never moves them. (2) The side navigation's threshold is part of its extracted styles, not a theme condition: a theme can change named conditions for recipes it generates, while a component threshold changes only through a new recipe and extraction. The Workbench side-nav preview that regenerates its own sheet arrives with M5.

## 2026-10-18 — Side navigation in product and density scopes (M4 layout slice)

Environment as the previous entry. Contract: [layout-recipes.md §10](./architecture/layout-recipes.md#10-side-navigation-prototype-acceptance-fixture).

| Check | Command | Result |
| --- | --- | --- |
| Scopes | `npx vitest run --project browser packages/components/test/side-nav.scopes.browser.test.ts` | Pass in Chromium, Firefox, WebKit (2 tests) — with the CSS generated for a theme with a `clinic` product adopted by the document, `data-odd-product="clinic"` changes the current-page marker colour and not the padding; `data-odd-density="compact"` reduces the padding and not the colour; both on one element combine; `data-odd-mode="dark"` changes the text colour; a compact scope nested in a product scope gives the product colour with the compact padding |

**Findings:** None. The element's shadow styles needed no change: every scope re-declares roles on an ancestor and the shadow root inherits them.

## 2026-10-18 — Side navigation: data, slotted, and hybrid sources (M4 data slice)

Environment as the previous entry. Contract: [data-composition.md §10, §12](./architecture/data-composition.md#12-odd-side-nav-implemented-m4).

| Check | Command | Result |
| --- | --- | --- |
| Equivalence | `npx vitest run --project browser packages/components/test/side-nav.scopes.browser.test.ts` | Pass in Chromium, Firefox, WebKit (3 tests) — under a generated theme, the same three links from `items`, as slotted `<a>` elements, and from `items` with header and footer slots have the same names, targets, and `aria-current`, and identical display, alignment, minimum height, padding, marker width and colour, radius, background, colour, font, decoration, and rendered height (including a label that wraps); all three name the landmark "Primary" |
| Mutation probe | The slotted current-page selector removed temporarily | The current slotted link differs from the data link in all three engines; restored |
| Related | `npx vitest run --project browser packages/components/test/side-nav.browser.test.ts`, `npx playwright test e2e/side-nav.spec.ts`, `npm run size` | Pass (45 tests; 15 e2e); `side-nav` 14,543 B and `components:side-nav` 1,261 B of 1,536 B |

**Findings:** (1) Slotted links were `display: block` and lacked the current-page marker, semibold weight, background, hover state, centred alignment, and link-colour reset that data entries have, so a page using native links looked different from one using `items`. They now share those rules (`::slotted(a)`, `::slotted(a[aria-current='page'])`, `::slotted(a:hover)`), +27 B gzip CSS. (2) Slotted links keep the author's markup: data entries are list items, slotted links are a list only if the author writes one, and `::slotted()` styles only top-level slotted links.

## 2026-10-18 — Side navigation label renderer (M4 data slice, customization ladder level 3)

Environment as the previous entry. Contract: [data-composition.md §4, §12](./architecture/data-composition.md#12-odd-side-nav-implemented-m4).

| Check | Command | Result |
| --- | --- | --- |
| Renderer | `npx vitest run --project browser packages/components/test/side-nav.browser.test.ts` | Pass in Chromium, Firefox, WebKit (18 tests, 3 new) — custom content renders inside the element's link (keeping `href` and `aria-current`), action button, and group toggle, with `{ current, depth }` correct for a nested current link; a signal read by the renderer for one entry updates only that entry's label (one renderer call), keeps the link node, and `renderLabel = undefined` restores the plain label; a string assigned to `renderLabel` reports `element.prop.invalid` and keeps `undefined` |
| Package | `npm run build`, `npx vitest run packages/components`, `npm run size` | Pass (369 tests in 42 files); `side-nav` 14,708 B of 15,360 B (+165 B) |

**Findings:** (1) Item templates run outside render tracking, so the renderer runs inside a computed binding per label; reading `current` there also keeps the `current` flag of the context live. (2) Invalid property values are reported through the diagnostics handler (`setErrorHandler`), which tests must install to observe them.

## 2026-10-18 — Multi-product customization levels 1–3 (M4 multi-product prototype)

Environment as the previous entry. Another agent had uncommitted changes to `odd-button` source during this run. Contract: [multi-product.md §5–§6](./architecture/multi-product.md#6-customization-ladder).

| Check | Command | Result |
| --- | --- | --- |
| Levels 1–3 | `npx vitest run --project browser packages/components/test/multi-product.browser.test.ts` | Pass in Chromium, Firefox, WebKit (4 tests) — level 1: in `alpha` and `beta` product scopes the same `odd-button` constructor shows different primary backgrounds, and switching the scope attribute keeps the element and its control node; level 2: `--odd-card-radius` and `odd-button::part(control)` rules scoped to `beta` change only `beta`; level 3: `studio-button` and `studio-card` composed from `buttonDefinition` and `cardDefinition` render beside `odd-*` with their own styles, are subclasses with distinct constructors, and adopt the same `buttonStructuralStyles` sheet; registry: the same definition again is a no-op, `registry.constructorReused`, `registry.definitionConflict` |

**Findings:** (1) The button's colour transition (`motion.duration.fast`) delays the computed colour after a product switch; the test turns transitions off for that part rather than waiting. (2) Composition from the public `@oddkin/components/button` and `./card` exports was enough for a second implementation; no internal module was needed.

## 2026-10-18 — Shared interaction fixtures on derived definitions (M4 multi-product prototype)

Environment as the previous entry. Another agent had uncommitted changes to `odd-button` and `odd-input` source during this run. Contract: [multi-product.md §7, §11](./architecture/multi-product.md#11-verification).

| Check | Command | Result |
| --- | --- | --- |
| Published contract on both tags | `npx vitest run --project browser packages/components/test/contract.browser.test.ts` | Pass in Chromium, Firefox, WebKit (48 tests). Every CEM check runs on `odd-*` and on `derived-*`, which is composed from the exported definition with the same template and structural styles and a different skin. The checks: defaults, attribute conversion for every allowed value, reflection, declared events, and slots and parts reached by the authored examples. Public methods and read-only members (`checkValidity`, `reportValidity`, `form`, `validity`, `validationMessage`, `willValidate`) give equal results in a form, valid and invalid. Three instances of each tag adopt the same shared sheets, the derived skin only on derived tags, with rules unchanged. |
| Interactions on both tags | `npx vitest run --project browser packages/components/test/interactions.browser.test.ts` | Pass in Chromium, Firefox, WebKit (10 tests). The `oddkin.button` suite: all 11 cases on both button tags. Input: delegated focus, label, one `input` per keystroke and `change` on leaving, none on programmatic writes; `typeMismatch`/`valueMissing`, submission, reset to the default, fieldset exclusion. Navigation: Enter and Space toggle a group with `odd-toggle` details and focus kept; Enter on an action emits `odd-action`; disabled actions and links take no focus or action. |
| Mutation probes | temporary edits, reverted | Derived classes that stop observing attributes, or drop the shared styles: 24 failures, all derived or shared-sheet cases. `checkValidity()` always `true`: 3 failures, the `odd-input` method comparison only. No-op `focus()` and `_action()`: 9 failures, the derived button suite, input focus, and navigation actions only. |

**Findings:** (1) `FormValue` in `@oddkin/core/controllers/form` mirrors the inner control's failing validity flags even when the control is barred from constraint validation. In that state its `validationMessage` is empty, so `ElementInternals.setValidity(flags, '')` throws inside the form effect in all three engines. Triggers: an `odd-input` whose value fails a constraint (e.g. `type="email" value="x"`) while it is `disabled`, `readonly`, or inside a disabled fieldset. With `readonly` the host also stays invalid, unlike a native read-only input. Reported to the forms lane; the fixture disables the fieldset only while the value is valid. (2) For these four elements, a subclass composed from the public definition needed nothing internal to pass the same fixtures.

## 2026-10-18 — Analyzer: definitions derived from another package (M4 multi-product prototype)

Environment as the previous entry. Contract: [metadata-and-analyzer.md §3.2, §8](./architecture/metadata-and-analyzer.md#8-behaviors-settled-in-the-m3-implementation).

| Check | Command | Result |
| --- | --- | --- |
| Product package | `npx vitest run --project node packages/analyzer/test/products.test.ts` | Pass (6 tests). `tests/fixtures/analyzer-product` recomposes the published `@oddkin/components` button three ways. `studio-button` gets a new skin; `studio-quiet-button` changes only name and class; `studio-icon-button` gets a new template with structural styles only. Outputs validate against the CEM 2.1.0 and `oddkin-metadata.v1` schemas. Ids are `component:studio-*` with `extends: component:odd-button`, and inherited template and styles are `{ package, module, name }` references. Members, attributes, events, slots, parts, and states equal the published `odd-button` declaration, inherited by package. `studio-button` adds only `--studio-button-radius`. Token reads: the foundation's for the skin-only variant, `color.action.default` only for the new skin, none for structural styles alone. The icon variant has only its template's slot and parts. Reusing the published class for another name reports `analyzer.dynamic.definition`. |
| Publisher without facts | same file | `tests/fixtures/analyzer-legacy` vendors a package with a CEM and definition facts but no per-source facts, plus an undocumented element class. Results: `analyzer.published.sources` (info) and `analyzer.published.missing` (warning); the undocumented class's subclass is left out; the legacy token read is kept rather than guessed away. |
| Existing outputs | `npx vitest run --project node packages/analyzer tests/schemas packages/components/test/metadata.test.ts packages/ai/test/metadata.test.ts packages/workbench` | Pass. The committed `core-counter` fixture gains only the `templates` and `styles` sections. `node scripts/build-metadata.mjs` reports no diagnostics for `@oddkin/components` and `@oddkin/ai`. The AI package now records the shared styles it imports with `package` and the publisher's reads. |
| Mutation probes | temporary edits, reverted | Without published-definition spreads: 3 failures, including the legacy case. Without published style reads in the overlay: 1 failure, the token-read test. |

**Findings:** (1) Published CEM and definition facts were enough for the contract, but not for replacing a skin accurately: the per-component CSS properties and token reads do not say which style source provided them, so per-source facts were added. (2) Template anatomy is published per template for the same reason: a replaced template must drop the slots and parts only the old one rendered.

## 2026-10-18 — Contract results as `verified` provenance (M4 metadata)

Environment as the previous entry. Another agent had uncommitted changes to `odd-button` and `odd-input` source; the recorded implementation hash covers exactly the files that ran. Contract: [metadata-and-analyzer.md §3, §5](./architecture/metadata-and-analyzer.md#3-normalized-metadata-model).

| Check | Command | Result |
| --- | --- | --- |
| Records | `npx vitest run --project browser packages/components/test/contract.browser.test.ts` | Pass in Chromium, Firefox, WebKit (144 tests). Twelve `conformance-result.v1` records (4 elements × 3 engines), each holding the browser version and SHA-256 hashes of the tested `custom-elements.json` and of the component sources plus the core and tokens development builds. |
| Attach | `npm run verify:metadata` | 122 facts verified (odd-button 44, odd-card 17, odd-input 40, odd-side-nav 21). None failed, none skipped. Every record validates against `conformance-result.v1`, and the metadata with `verification` entries validates against `oddkin-metadata.v1`. The hashes computed in the browser (Vite raw imports) and in Node (from disk) agree. |
| Staleness | temporary extra file in `packages/components/src`, removed | All 12 records ignored as stale, 0 facts verified, every element reported missing, exit 1. After removal: 122 facts, exit 0. |
| Unit tests | `npx vitest run --project node packages/analyzer/test/verification.test.ts tests/metadata` | Pass (6 + 2). Covered: attach with conditions; stale records ignored; failed and not-executed cases never verified; earlier evidence replaced; required tags without evidence reported; latest record per browser. The implementation hash changes with sources and with the core and tokens builds, but not with the production build, declarations, or docs. |

**Findings:** (1) The first design hashed `core/src`, but the page runs `@oddkin/core` from `dist` through the `development` export condition. The hash now covers the files that actually ran. (2) With every record stale, the attach step at first reported nothing missing and passed. It now requires current evidence for every component in the metadata.

## 2026-10-18 — Contract checks for @oddkin/ai (M4 metadata)

Environment as the previous entry. Contract: [metadata-and-analyzer.md §3](./architecture/metadata-and-analyzer.md#3-normalized-metadata-model).

| Check | Command | Result |
| --- | --- | --- |
| Shared harness, components | `npx vitest run --project browser packages/components/test/contract.browser.test.ts` | Pass in Chromium, Firefox, WebKit (144 tests, unchanged after moving the checks to `tests/contract/cem-contract.ts`); 122 facts verified as before. |
| AI elements | `npx vitest run --project browser packages/ai/test/contract.browser.test.ts` | Pass in Chromium, Firefox, WebKit: 288 checks over all 24 published elements. Covered: defaults, attribute conversion for every allowed value (including number attributes, new in the harness), reflection, and declared events. The 72 slot and part checks are skipped: the package has no authored examples. |
| Attach | `npm run verify:metadata` | `@oddkin/components` 122 facts, `@oddkin/ai` 196 facts across 24 elements, in three engines. AI slot and part cases are listed as not executed and stay unverified. Exit 0. |
| Hash coverage | `npx vitest run --project node tests/metadata` | Pass (3): a package's hash covers exactly the dependency builds it declares (`@oddkin/ai` also hashes the `@oddkin/components` build). |

**Findings:** (1) All 24 AI elements already matched their published manifest; the harness needed only number attribute samples. (2) Because slot and part facts can't be verified without examples, authored AI examples are the next step for full verification (AI track).

## 2026-10-18 — Project item kinds for odd-side-nav (M4 data slice)

Environment as the previous entry. Contract: [data-composition.md §4, §12](./architecture/data-composition.md#12-odd-side-nav-implemented-m4).

| Check | Command | Result |
| --- | --- | --- |
| Element | `npx vitest run --project browser packages/components/test/side-nav.browser.test.ts -t "project item kinds"` | Pass in Chromium, Firefox, WebKit (4 tests). Project links and actions render inside the built-in wrappers, including in a group: `href`, a script URL rendered without `href`, `aria-current` and the group opening for a current project entry, and `odd-action` with the entry's action. An element without the kinds warns `model.kind.unknown` once per kind, renders the built-in entries, and leaves `navigationKinds` unchanged. A new registry re-renders project entries and keeps the built-in link node. Five invalid registrations throw `navigation.kind.invalid`; a non-registry `kinds` is `element.prop.invalid`. |
| Model | `npx vitest run --project node packages/components/test/models.test.ts` | Pass (6). `navigationModel(kinds)` accepts project kinds at any depth; `NavigationItemModel` reports them as `model.kind.unknown` with paths; field types and unique ids are checked across kinds; the JSON Schema agrees. |
| Suite, graph, size | `npx vitest run packages/components`; `npm run size` | 509 tests pass. The side-nav foundation graph adds only `side-nav/kinds.js` and `@oddkin/core/diagnostics`; the model builder stays out. `side-nav` is 15,328 B gzip (budget 15,360 B), after merging the registration messages into one. |

**Findings:** (1) Building `NavigationItemModel` from a shared helper made it unreadable to the analyzer (`analyzer.dynamic.model`). The literal definition stays, and `navigationModel` derives its built-in variants from it, rebinding each group's `items` to the new recursive schema. (2) Inferring a model type over open variants exceeds the compiler's instantiation depth, so `navigationModel` is typed by the entries it accepts (`NavigationEntry[]`). (3) The side-nav budget is now 99.8% used.

## 2026-10-18 — Example import maps cover every import (M4)

Environment as the previous entry. The full pipeline after the project-kinds commit failed all 15 side-nav end-to-end tests: `side-nav/kinds.js` imports `@oddkin/core/diagnostics`, which `examples/side-nav/`'s import map did not map, so the page never started.

| Check | Command | Result |
| --- | --- | --- |
| Fix | `node scripts/update-csp-hash.mjs examples/side-nav/index.html`; `npx playwright test e2e/side-nav.spec.ts` | Mapping added and the CSP hash updated; 15 passed. |
| New static check | `npx vitest run --project node tests/examples/import-maps.test.ts` | Pass (5 pages). Each strict-CSP example's static import graph is walked from its module script through the import map, as the browser would; every specifier must resolve to a file. With the new mapping removed, the test fails naming `@oddkin/core/diagnostics (from packages/components/dist/side-nav/kinds.js)`. |

**Full pipeline otherwise:** lint, typecheck, and one Firefox unit test fail only on another agent's uncommitted styling work (stale `docs/compatibility/matrix.md`, two type errors and one assertion in `styling.browser.test.ts`). Other results: 1,797 unit tests pass (73 skipped), `verify:metadata` 122 + 196 facts, size within budgets, packed consumers OK.

## 2026-10-18 — Side navigation robustness: focus, bounds, direction, forced colors (M4)

Environment as the previous entry. Contract: [data-composition.md §12](./architecture/data-composition.md#12-odd-side-nav-implemented-m4).

| Check | Command | Result |
| --- | --- | --- |
| Before | temporary probe, reverted | In all three engines, removing the focused link left focus on `<body>`, and collapsing its group through `expanded` left focus on a link inside the hidden list. |
| Robustness | `npx vitest run --project browser packages/components/test/side-nav.browser.test.ts -t robustness` | Pass in Chromium, Firefox, WebKit (3 tests). Removal and outside collapse move focus to the `<nav>` landmark (`tabIndex` -1, never in the Tab order). Focus that left for an outside button stays there. `dir="rtl"` puts the current marker on the right. 1,000 entries and five nested groups render with `aria-current` at depth 5, and all text comes from the caller. With the fallback disabled, only the focus test fails (3 engines). |
| Forced colors | `npx playwright test e2e/side-nav.spec.ts` | 18 passed. The new test emulates `forced-colors: active` in Chromium, Firefox, and WebKit, and requires the current marker to be the engine's `Highlight` and disabled text `GrayText`. |
| Static checks | `npx vitest run --project node tests/examples packages/components/test/graph.test.ts` | The import-map check flagged `@oddkin/core/controllers/focus` for `examples/side-nav/` before e2e ran; mapping and CSP hash updated. The foundation graph adds the focus controller. |
| Size | `npm run size` | `side-nav` 15,715 B gzip; budget raised from 15 to 16 KiB for the shared focus controller (+374 B; the AI chat budget grew 625 B for the same controllers). `components:side-nav` CSS 1,274 B. |

**Findings:** (1) The forced-colors rules were in the structural styles, but the default skin's state rules come later with equal specificity, so in forced-colors mode the current marker and disabled text were forced to the skin's colours. Prefixing the forced-colors selectors with `.root` fixes it without `!important`, which css-architecture.md reserves for the `hidden` guarantee. A first attempt with `!important` was replaced. (2) A CSS comment inside a `css` template ships in the bundle (+97 B gzip); explanations belong in the JSDoc.

## 2026-10-18 — Framework-facing contract: accessors, pre-upgrade values, typed listeners, remounts (M4)

Environment as the previous entry. Contract: [data-composition.md §12](./architecture/data-composition.md#12-odd-side-nav-implemented-m4), [metadata-and-analyzer.md §3](./architecture/metadata-and-analyzer.md#3-normalized-metadata-model).

| Check | Command | Result |
| --- | --- | --- |
| Accessors and pre-upgrade values | `npx vitest run --project browser packages/components/test/contract.browser.test.ts packages/ai/test/contract.browser.test.ts` | 528 checks pass in Chromium, Firefox, WebKit (72 slot and part checks skipped without AI examples). Every published property of the 4 component and 24 AI elements is detectable as `name in element`. Every attribute-backed property assigned on an element parsed in a `<template>` keeps its value once the element is adopted and upgraded, read back through the accessor with no own property left. `npm run verify:metadata`: 187 + 370 verified facts. |
| Replay probe | built `@oddkin/core` replay disabled, restored | The checks still read the right values, because core's second guard repairs the shadowing field. It reports `element.prop.shadowed` 180 times, which fails the run as unhandled errors, so a replay regression is caught either way. |
| Typed listeners | `npx vitest run --project node packages/components/test/events.types.test.ts`; `npm run typecheck` | Pass (3). `odd-action` and `odd-toggle` are in `GlobalEventHandlersEventMap` in the built declarations with their detail types. Element and `document` listeners type `event.detail`, and a wrong detail field is a type error. Unprefixed published names are only re-dispatched native events (`input`, `change`). |
| Remounts | `npx vitest run --project browser packages/components/test/frameworks.browser.test.ts` | Pass (4 × 3 engines). React 19 StrictMode (mount, unmount, mount) delivers one `odd-action` per click. Vue `v-if` re-creation gives a new instance with fresh uncontrolled expansion and one `odd-toggle` per click. Both return to the `scopeStats()` baseline after unmount. |

**Findings:** (1) Neither package declared its events for TypeScript listeners. The side-nav now does. The AI package's event names (`prompt-submit`, `attempt-retry`, …) are unprefixed, so adding them to the global map would risk collisions; recorded as remaining. (2) The installed TypeScript 7 no longer ships `lib.dom.d.ts` on disk, so the native-event rule lists the re-dispatched native events explicitly.

## 2026-10-18 — Examples use public entry points (M4 agent-kit contracts)

Environment as the previous entry. Contract: [agent-tooling.md §7](./architecture/agent-tooling.md#7-executable-examples-as-shared-evidence).

| Evidence level | Command | Result |
| --- | --- | --- |
| Static: public entry points | `npx vitest run --project node tests/examples/public-imports.test.ts` | Pass (44 checks). Every `@oddkin/*` specifier in the 11 example apps (HTML, JS, TS) and the 4 authored `*.examples.ts` files is an `exports` entry of its workspace package. Authored examples import package internals for types only. Probes: a deep import (`@oddkin/components/side-nav/side-nav.js`) and a runtime relative import in an authored example each failed it. |
| Static: example contents and pages | `npx vitest run --project node packages/components/test/examples.test.ts tests/examples/import-maps.test.ts` | Existing: properties, attributes, and slots against the published CEM; page import maps resolve every import. |
| Compile | `npm run typecheck` | Examples and tests compile, apart from another agent's uncommitted styling test. |
| Browser | `npx vitest run --project browser packages/components/test/examples.browser.test.ts packages/components/test/contract.browser.test.ts` | Existing: every authored example mounts and releases its resources in three engines; slots and parts are rendered from the examples. |

Packed-package checks of the same examples are M12.

## 2026-10-18 — Agent-kit contract schemas (M4)

Environment as the previous entry. Contract: [agent-tooling.md §4, §5, §9.1](./architecture/agent-tooling.md#91-diagnostic-envelope-drafted-as-diagnosticv1-extends-the-existing-shapes).

| Check | Command | Result |
| --- | --- | --- |
| Schemas | `npx vitest run --project node tests/schemas/schemas.test.ts` | Every schema compiles under Ajv 2020 strict mode. The six new examples give the expected result. Valid: a repairable analyzer diagnostic with subject, docs, and fix; a project context with packages, exports, registrations, a derived component, theme axes, conventions, commands, a capability path, and a fingerprint; a kit manifest with generated and authored entries, a guide budget, and packaging targets. Invalid: an unknown severity and an empty fix; an unknown capability path and a non-SHA-256 fingerprint; a missing guide budget and a guessed provenance. |
| Envelope conformance | `npx vitest run --project node tests/schemas/diagnostics.test.ts` | Pass (5). Diagnostics produced by `generate()` (invalid colour, invalid product name), `analyze()` (the dynamic fixture), `NavigationItemModel.validate()`, `checkExamples()`, and `collection()` (missing and duplicate keys) all validate against `diagnostic.v1` unchanged. |
| Collections | `npx vitest run --project node packages/core/test/collections.test.ts` | Pass (9); `CollectionDiagnostic` now carries `severity: 'error'`. |

**Findings:** (1) Workbench diagnostics use `path` for a JSON Pointer or a stable id, so the envelope documents both rather than requiring a pointer. (2) A cross-file `$ref` between draft schemas depends on compile order in the test, so the kit manifest inlines the fingerprint shape it shares with the project context.

## 2026-10-18 — Explained incorrect examples (M4 agent-kit contracts)

Environment as the previous entry. Contract: [agent-tooling.md §7](./architecture/agent-tooling.md#7-executable-examples-as-shared-evidence).

| Evidence level | Command | Result |
| --- | --- | --- |
| Static: usage diagnostics | `npx vitest run --project node packages/workbench/test/examples.test.ts packages/components/test/examples.test.ts` | Pass. On the analyzed `demo-greeting` contract, each of five incorrect examples gives exactly its declared code (`usage.attribute.propertyOnly`, `usage.boolean.false`, `usage.attribute.value`, `usage.attribute.unknown`, `usage.slot.unknown`); correct examples and global attributes (`id`, `data-*`, `aria-*`) give none; `fullWidth` as an attribute names `full-width`. `checkExamples` rejects an incorrect preset/preview role, a mistake pointing at another mistake, and a missing explanation. On the published components CEM, the five component mistakes give their declared codes and every correct example gives none. |
| Static: metadata and pages | `npx vitest run --project node packages/analyzer/test packages/workbench/test/pages.test.ts packages/components/test/examples.test.ts tests/schemas` | Pass. The analyzer records `incorrect: { diagnostic, correct: example:… }` and leaves out an incorrect example with a computed diagnostic (`analyzer.examples.dynamic`, line 13 of the dynamic fixture); metadata matches the authored examples exactly and validates against `oddkin-metadata.v1`; `examples.v1` accepts the new field. A component whose only example is a mistake gets no examples section. |
| Browser | `npx vitest run --project browser packages/components/test/examples.browser.test.ts packages/components/test/contract.browser.test.ts` | Pass in Chromium, Firefox, and WebKit. Each mistake is mounted beside its correct example: side-nav with an `items` attribute renders no links; `disabled="false"` leaves the button disabled; `appearance="danger"` falls back to `secondary` and reports `element.attribute.invalid` (the only mistake core sees at runtime); `required="false"` leaves an empty input `valueMissing`; content in a `body` slot is not assigned. Correct examples differ and report nothing. |
| Provenance | `node scripts/build-metadata.mjs; node scripts/verify-metadata.mjs` | Contract records re-run for components and AI (both hashes include `packages/components/src`); 187 + 370 verified facts current. |
| Mutation probe | `node .tmp/mutate-usage.mjs` (not committed) and a manual edit | 6 of 6 killed: ignoring `"false"` booleans, accepting any enum value, treating property-only names as unknown attributes, allowing incorrect presets, listing non-literal mistakes in metadata, counting mistakes as page examples. Mounting mistakes in the usable-example loop failed in all three engines (`disabled="false"` reflects as `disabled=""`). |

**Not covered (code-level mistakes):** registration, event names and details, direct vs tracked bindings, reconnect-owned work, theme scopes, and framework differences are not expressible as props, attributes, and slots. They need code examples and a source-level checker (M11 authored references).

## 2026-10-19 — Agent-facing metadata: property-only values and event intent (M4)

Environment as the previous entry. Contract: [metadata-and-analyzer.md §3.1](./architecture/metadata-and-analyzer.md#31-agent-facing-extensions-planned-m4-reviewed-at-m8), [core-contracts.md §2](./architecture/core-contracts.md#2-public-properties-without-decorators).

| Evidence level | Command | Result |
| --- | --- | --- |
| Static: published facts | `npx vitest run --project node packages/components/test/metadata.test.ts` | Pass. `odd-side-nav`: `propertyOnly` = `expanded`, `items`, `kinds`, `renderLabel`; `odd-action` and `odd-toggle` have `user` intent (authored, with source). `odd-input`: `propertyOnly` = `value` (the `value` attribute sets `defaultValue`); `input` and `change` intents are `{ known: false }`, not inferred from their names. Button and card have neither. Metadata validates against `oddkin-metadata.v1`. |
| Static: analyzer | `npx vitest run --project node packages/analyzer/test` | Pass. A computed `intent` gives `analyzer.dynamic.value` (dynamic fixture, `src/events.ts` line 10) and an unknown intent; the derived `studio-nav` (product fixture, `compose({ ...sideNavDefinition })` with its own class) has the same `propertyOnly` and intents as `odd-side-nav` under its own ids, without the publisher's source location; the core-counter golden file gains `events` (unknown) and `propertyOnly` (`history`). |
| Browser: contract | `npx vitest run --project browser packages/components/test/contract.browser.test.ts packages/ai/test/contract.browser.test.ts` | Pass in Chromium, Firefox, and WebKit. New case `event:<tag>#<name>/not-programmatic` for each `user` event, on `odd-side-nav` and `derived-side-nav`: no event while setting every scalar property and every property of the six correct authored examples, connected. Verified facts: 189 (components, +2) and 370 (AI), current. |
| Size | `node scripts/check-size.mjs` | `intent` is type-only in core; side-nav 15,725 B gzip (budget 16,384). |
| Mutation probe | `node .tmp/mutate-facts.mjs` (not committed) and a manual edit | 5 of 5 killed: accessors left out of `propertyOnly`, declared intent dropped, published intents ignored by derived definitions, computed intent accepted silently; and a side-nav that emits `odd-action` when mounted fails `not-programmatic` in every engine. |

**Not covered:** contract references (`contract:core/*`), deprecations and migrations, and customization paths are the remaining §3.1 facts. `odd-input` event intent is left to the forms lane (its source has uncommitted work).

## 2026-10-19 — Change-impact prototype (M5)

Environment as the previous entry. Contract: [change-impact-and-verification.md §2](./architecture/change-impact-and-verification.md#2-change-impact) (§2.7 describes the prototype).

| Evidence level | Command | Result |
| --- | --- | --- |
| Known answers | `npx vitest run --project node packages/analyzer/test/impact.test.ts` | Pass (46). A five-component library (`impact.fixture.ts`: a derived quiet button, a dialog that renders the button, an example whose fixture renders the button, seven tokens with aliases) with 1, 2, 3, and 10 products. p1 has its own brand, p2 overrides `radius.control`, and p3 applies to two components. Each expected selection is written out by hand; equality means no missed dependency and no extra one. Cases: a token value change; a token unit change (incompatible, with p2 keeping its own `radius.control`); a token type change; a shared structural-style change; a foundation template change (reaches the derived definition); a foundation skin change (does not); a product-only override (only that product); an `analyzer.dynamic.*` diagnostic and an unresolved token read (every example of the package, but only when it is affected); a renamed token without a migration record (removal and addition, with an unconfirmed possible rename) and with one (`renamed`). States: `reused` only from a passing baseline, with its conditions copied; a missing or failed baseline result is `selected`; every check has exactly one state. Fallbacks: a generator version change and a snapshot schema major change select everything without reuse. API classification: removed part and narrowed union incompatible, widened union review, description-only informational. Explained mistakes are never checks. Snapshot and report validate against `comparison-snapshot.v1` and `impact-report.v1`; Markdown renders. |
| Real outputs | `npx vitest run --project node packages/analyzer/test/impact.components.test.ts` | Pass (3). On the built `@oddkin/components` CEM, metadata, and dist sources with the default theme's inspection JSON: no coverage gaps (component variables are told apart from tokens). A side-nav structural-style edit selects exactly the six usable side-nav examples. A button template edit selects the ten usable button examples, `odd-card/headed`, and `odd-input/inForm`, whose fixtures render a button (metadata `uses`). |
| Static: analyzer and schemas | `npx vitest run --project node packages/analyzer packages/components/test/examples.test.ts tests/schemas` | Pass. Example `uses` is read from literal markup and `createElement()`. A computed tag is not guessed (composed fixture). Published metadata lists `uses` for `odd-button/inForm` (input) and `odd-card/headed` and `odd-input/inForm` (button). |
| Boundaries | `node scripts/architecture/check-boundaries.mjs --artifacts` | OK. `@oddkin/analyzer/impact` imports only `node:crypto`. |
| Mutation probe | `node .tmp/mutate-impact.mjs` (not committed) | 9 of 9 killed: product scopes not blocking, product theme changes without roots, migration records ignored, unresolved dependencies not widening, failed baselines reused, derived definitions tied to the foundation component instead of its class, dependency edges dropped, unit changes not incompatible, version changes ignored. |

**Not covered:** the `oddkin impact` CLI, snapshots written by a build, executing selected checks and merging their results (item 851), and visual baselines. Product contexts come from `product.v1` and theme scopes; component-family mappings wait for M8.

## 2026-10-19 — Change impact executed (M5)

Environment as the previous entry. Contract: [change-impact-and-verification.md §2.7](./architecture/change-impact-and-verification.md#27-prototype-m5).

| Evidence level | Command | Result |
| --- | --- | --- |
| Merge and CLI | `npx vitest run --project node packages/analyzer/test/impact-cli.test.ts` | Pass (4). `mergeResults` passes a check only when all three runs passed, fails it on one failed run (message kept), and makes it `not-executed` when no run happened, including a selected suite check. A reused check keeps its baseline. `oddkin-impact snapshot` on built `@oddkin/components` has no unresolved items; two snapshots of the same build compare with 0 changes. `compare --results` with a failed run exits 1 and writes the same Markdown it prints. Usage errors exit 2. |
| Real run | `node scripts/impact.mjs snapshot --out .oddkin/impact/base.json`, then `compare .oddkin/impact/base.json .oddkin/impact/edited.json --run` (head: base with the side-nav and button structural-style hashes changed) | The snapshot of `@oddkin/components` and `@oddkin/ai` has 945 items, 1,202 edges, and 0 unresolved. 2 changes; 19 checks selected and run through Vitest in Chromium, Firefox, and WebKit: 10 button examples, `suite:oddkin.button#odd-button`, `odd-card/headed` and `odd-input/inForm` (their fixtures render a button), and 6 side-nav examples. All 19 passed. The selection file was removed afterwards. |
| Ordinary runs | `npx vitest run --project browser tests/impact/selected.browser.test.ts` | Skipped in three engines without a selection file. |
| Packaging | `node scripts/verify-packs.mjs`; `node scripts/architecture/check-boundaries.mjs --artifacts` | OK. The packed `@oddkin/analyzer` includes `./impact` and the `oddkin-impact` bin. |

**Not covered:** base snapshots of a git revision (the base is taken before the change), visual baselines, and product contexts in this repository (it configures none; the known-answer fixtures cover them).

## 2026-10-19 — Agent-facing metadata: deprecations, since, customization paths (M4)

Environment as the previous entry. Contract: [metadata-and-analyzer.md §3.1](./architecture/metadata-and-analyzer.md#31-agent-facing-extensions-planned-m4-reviewed-at-m8).

| Evidence level | Command | Result |
| --- | --- | --- |
| Static: analyzer | `npx vitest run --project node packages/analyzer/test/analyzer.test.ts packages/analyzer/test/products.test.ts` | Pass. `tests/fixtures/analyzer-lifecycle` covers three deprecations. A property's (`kind`) replacement `tone` becomes `property:acme-banner#tone`, with a migration record. An event constant's (`acme-close`) replacement becomes `event:acme-banner#acme-dismiss`. A component's (`acme-notice`) replacement `acme-banner` becomes `component:acme-banner`. Standard CEM carries the reasons on the member, its attribute, the event, and the declaration; both outputs validate. `@since` is a separate component fact, not a deprecation date. `@customization 1 2` gives authored levels; `@customization 1 9` gives `analyzer.tag.invalid` and unknown levels. In the legacy fixture, the derived `acme-legacy-button` keeps the vendored package's deprecated `look`: reason from its CEM, replacement and migration from its metadata, under the derived ids. |
| Static: published | `npx vitest run --project node packages/components/test/metadata.test.ts` | Pass. `odd-side-nav` customization levels 1–3 (authored; level 3 is exercised by `derived-side-nav`), with its slots and parts. Button, card, and input levels are unknown (their sources are in the forms lane). Button variables include `--odd-button-radius`. No slice component is deprecated. |
| Contract evidence | `npx vitest run --project browser packages/components/test/contract.browser.test.ts packages/ai/test/contract.browser.test.ts`; `node scripts/verify-metadata.mjs` | Pass after the side-nav JSDoc change; 189 + 370 verified facts current. |
| Mutation probe | `node .tmp/mutate-lifecycle.mjs` (not committed) | 4 of 4 killed: deprecations never read, replacements kept as written, any `@customization` accepted, publisher metadata ignored by derived definitions. |

**Not covered:** contract references (`contract:core/*`) need published contract pages with stable anchors to point at.

## 2026-10-19 — Live condition editing with preview-owned stylesheets (M2)

Environment as the previous entry. Contract: [theming-and-styling.md §11](./architecture/theming-and-styling.md) (Invalidation, Live condition editing), [layout-recipes.md §11](./architecture/layout-recipes.md#11-behaviors-settled-in-the-m3-implementation).

| Evidence level | Command | Result |
| --- | --- | --- |
| Static: recipes | `npx vitest run --project node packages/core/test/layout.test.ts` | Pass (11). `sideNav.extend({ conditions: { 'navigation.expanded': … 30rem } })` differs from the original only in that threshold, keeps its regions and profile, and leaves the original's CSS unchanged. Inputs for a condition the recipe does not use change nothing. |
| Browser | `npx vitest run --project browser packages/workbench/test/preview.browser.test.ts` | Pass in Chromium, Firefox, and WebKit. A recipe built from a generated theme's `navigation.expanded` (40rem) is extended with the theme regenerated at 30rem; `previewStyles(...).update()` switches the previewed element at 35rem to three columns while an identical element outside the preview stays one column, and the shared sheet keeps its rules. For `odd-side-nav`, the edited instance keeps every shadow node, its focused link, and its expanded group (no remount or re-render); another instance and the shared sheet are untouched. Repeated edits reuse one preview sheet, `refresh()` covers an element added later, and `restore()` puts the shared sheet back. |
| Existing | `npx vitest run --project browser packages/components/test/conditions.browser.test.ts` | Unchanged: runtime custom properties and `font-size` never move the side-nav threshold, and a changed theme threshold arrives only through newly generated CSS. |
| Size and packaging | `node scripts/check-size.mjs`; `node scripts/verify-packs.mjs`; `node scripts/architecture/check-boundaries.mjs --artifacts` | Within budgets; packed `@oddkin/workbench` resolves `./preview`; boundaries OK. |
| Mutation probe | `node .tmp/mutate-preview.mjs` (not committed) | 3 of 3 killed: `extend()` ignoring new condition inputs, preview edits written to the shared sheet, a preview swapping sheets outside its scope. |

**Not covered:** preview frames themselves (M5 isolated previews) and elements that move into a preview after `refresh()`. Variable-based query syntax is not used anywhere, so it needs no browser evidence yet.

## 2026-10-19 — Container, wrapper, and region contract (M2)

Environment as the previous entry. Contract: [layout-recipes.md §5](./architecture/layout-recipes.md#5-container-responsive-composition), [css-architecture.md §5.4](./architecture/css-architecture.md#54-selectors-and-customization-surface).

| Evidence level | Command | Result |
| --- | --- | --- |
| Browser (plain shadow roots) | `npx vitest run --project browser packages/core/test/container-contract.browser.test.ts` | Pass (8 × 3 engines). An element that is its own query container never matches its own query; its descendants do. Inline-size containment gives an inline-block and an absolutely positioned box zero width (shrink-to-fit ignores content). Slotted light-DOM content resolves both an unnamed page query and the shadow tree's `::slotted()` query against a region inside the shadow tree (flat-tree ancestry). An unnamed query uses the nearest container; a named query skips to the named one. `::slotted()` styles top-level slotted elements only; a compound `::slotted(p) span` matches nothing. `::part()` reaches the declared part only: not its descendants, not `::part()[attr]`, and not a nested component's part unless forwarded with `exportparts`. Page selectors never match private shadow markup with the same class names. An inherited role reaches shadow internals, slotted content, and a nested shadow root, and a declaration on a region wins inside it. |
| Finding | same test | Container names are **not** encapsulated in Chromium, Firefox, or WebKit: a page query `@container region (…)` styles slotted content against a container named `region` inside the component's shadow tree. Internal container names are therefore public; the contract now says to name only the host (as Oddkin recipes do) or to namespace internal names. |
| Existing | `packages/core/test/layout.browser.test.ts`, `packages/components/test/styling.browser.test.ts`, `side-nav.browser.test.ts`, `tests/floor/probe.js` | Unchanged: a host container responds per instance, roles reach slotted content, parts and component variables override, page selectors never reach button internals, and container queries work in the floor browsers. |

**Not covered:** floor-browser runs of the new checks (the floor probe covers basic container queries only).

## 2026-10-19 — Change impact against git revisions (M5)

Environment as the previous entry. Contract: [change-impact-and-verification.md §2.7](./architecture/change-impact-and-verification.md#27-prototype-m5).

| Check | Command | Result |
| --- | --- | --- |
| Base revision | `node scripts/impact.mjs compare --base-ref HEAD` | HEAD (`4dff571`) was checked out in a temporary worktree with its own `node_modules` (`@oddkin/*` linked to the worktree's packages), built (`tsc -b`, metadata), and snapshotted: 934 items, 0 unresolved. The head is this working tree with another agent's uncommitted forms work: 945 items. 14 changes, none incompatible, and they are exactly that work: five `form*` properties and attributes on `odd-button`, changed button and input classes, the new `./css/button.css` export, and changed button styles. 20 checks selected. The worktree and its links were removed; the main `node_modules` (79 entries, `@oddkin/*` junctions) and the working tree were unchanged. |
| Determinism | `snapshot` twice on the same build, then `oddkin-impact compare` | 0 changes. Tool versions (content hashes of the core, tokens, and analyzer builds) match between the HEAD worktree and this working tree, which share those sources. |

Also closed: item 612's link from the side-nav preview to the invalidation contract (`previewStyles`, 2026-10-19 live condition editing entry).

## 2026-10-19 — Machine-readable `@oddkin/ai` examples (AI track)

Environment as the previous entry. Contract: [ADR 0021](./architecture/decisions/0021-define-examples.md), [metadata-and-analyzer.md](./architecture/metadata-and-analyzer.md).

| Evidence level | Command | Result |
| --- | --- | --- |
| Static | `npx vitest run --project node packages/ai/test/examples.test.ts` | Pass (5). The 24 elements each have a `default` example (43 in total, `packages/ai/src/**/*.examples.ts`). Correct examples use only public properties, attributes, and slots from the published CEM. Each of four explained mistakes gets exactly its declared diagnostic from `validateUsage`, and correct examples get none: `odd-sources` `sources` attribute (`usage.attribute.propertyOnly`), `odd-prompt-input` `disabled="false"` (`usage.boolean.false`) and a `toolbar` slot (`usage.slot.unknown`), `odd-artifact` `mode="code"` (`usage.attribute.value`). All sets validate against `examples.v1`; the metadata listing equals the analyzer's static read, including `incorrect` diagnostics and correct-example ids. |
| Static | `npx vitest run --project node tests/examples/public-imports.test.ts` | Pass. Examples import package internals for types only; the voice example takes its scripted adapter from `@oddkin/ai/controllers`. |
| Browser | `npx vitest run --project browser packages/ai/test/examples.browser.test.ts` | Pass in Chromium, Firefox, and WebKit. Every correct example mounts, renders its shadow tree, reports nothing, and releases every scope it owned. Each mistake shows its stated consequence and its correct example does not: no listed source, a disabled composer, unassigned toolbar content, the preview mode. Only `mode="code"` is reported at runtime (`element.attribute.invalid`). |
| Contract evidence | `npx vitest run --project browser packages/ai/test/contract.browser.test.ts`; `node scripts/build-metadata.mjs`; `node scripts/verify-metadata.mjs` | The harness renders AI slots and parts from the authored examples. The 76 slot and part facts recorded as not executed now pass in three engines: 446 AI facts verified (was 370), 189 for `@oddkin/components`. The user-intent check is skipped for all 24 AI elements: none of their 43 events declares an intent. |
| Boundaries | `node scripts/architecture/check-boundaries.mjs --artifacts` | OK. Only `*.examples.ts` in `@oddkin/ai` may import `@oddkin/workbench` (dev dependency); the package build excludes them. |
| Mutation probe | slot mistake made correct (`toolbar` → `toolbar-start`), restored | Killed by both suites: `validateUsage` reports nothing for it, and its content is assigned. |

**Not covered:** fixtures that compose AI elements with each other (no example uses another element), and AI event intent.

## 2026-10-19 — `@oddkin/ai` event intent and undeclared events (M4 metadata, AI track)

Environment as the previous entry. Contract: [metadata-and-analyzer.md §3.1, §8](./architecture/metadata-and-analyzer.md), [ai-interaction.md §7, §10](./architecture/ai-interaction.md).

| Evidence level | Command | Result |
| --- | --- | --- |
| Static | `npx vitest run --project node packages/analyzer/test/analyzer.test.ts` | Pass (22). A fixture class that emits a declared and an undeclared event reports one `analyzer.event.undeclared` warning at the undeclared `this.emit` call, naming the event; its CEM events stay the declared ones. |
| Analyzer on the packages | `node scripts/build-metadata.mjs` | Before the fix: two warnings, both `odd-response` (`copy()` emits `ai-announce` without declaring it, so its CEM and metadata listed no events). None for `@oddkin/components` or any other AI element. After declaring it: no warnings. |
| Metadata | same | All 44 AI element events declare intent: 34 requests are `user`, the 10 `ai-announce` declarations are `notification`. |
| Browser (contract) | `npx vitest run --project browser packages/ai/test/contract.browser.test.ts`; `node scripts/verify-metadata.mjs` | Pass in Chromium, Firefox, and WebKit. The user-intent check now runs on the 20 AI elements with user events (scalar writes, then every authored example mounted and its values written again): 34 `not-programmatic` facts pass. 481 AI facts verified (was 446), 189 for `@oddkin/components` (rerun after the other lane's component edits made its records stale). |
| Mutation probes | `odd-voice-input` emitting `voice-transcript` on connect; `odd-response` without its `static events` | Killed: the contract fails on `voice-transcript` not-programmatic; the analyzer reports the undeclared event. |

**Not covered:** a notification mislabelled `user` survives when no harness write triggers it. `ai-announce` marked `user` passed, because announcements need the opt-in `announce` property and a status transition, and the harness never sets them. Events dispatched by controllers on other targets, or through a variable the analyzer cannot resolve, are not compared with the declarations.

## 2026-10-19 — Authored references resolve (M4 agent kit)

Environment as the previous entry. Contract: [metadata-and-analyzer.md §5](./architecture/metadata-and-analyzer.md#5-validation), [agent-tooling.md](./architecture/agent-tooling.md) (`agent.guidance.unknownReference`).

| Evidence level | Command | Result |
| --- | --- | --- |
| Static (known answers) | `npx vitest run --project node packages/analyzer/test/references.test.ts` | Pass (5). For a synthetic element, package, token set, and recipe: 23 valid citations (elements with attributes, states, and parts; members, methods, attribute values, slots, parts, states, CSS properties, token variables and ids, entry points including `*` patterns, events, recipes) report nothing, and prose spans (HTML, ARIA, `role`, native `submit` event, `detail.reason`, DOM APIs, bare words, other scopes) stay unchecked. Each of 18 wrong citations reports exactly one finding with the reason. Member-shaped spans resolve only against the element the text describes. `authoredTexts` gathers CEM descriptions, authored metadata facts with their source, and example texts, and skips extracted facts. The analyzer reads a literal mistake explanation with its file, line, and column. |
| Real packages | `node scripts/build-metadata.mjs` (`npm run build`) | Exit 0: no finding in 215 authored texts (92 from CEM and metadata, 123 from `@oddkin/components` and `@oddkin/ai` example labels, guidance, and explanations), checked against both packages' elements, the `exports` of all workspace packages, the 210 default-theme tokens and 345 theme variables, and the `side-nav` recipe. |
| Probes | `.tmp/refs-mutants.mjs` (not committed); a wrong citation in `sources.examples.ts` | 10 real citations perturbed one at a time (`.items`, `reveal()`, `elevation.md`, `enter-behavior="newline"`, `odd-input:state(user-invalid)`, `@oddkin/components/css/button.css`, `odd-task-plan`, the `side-nav` recipe, `variant="elevated"`, `checkValidity()`): each reported. `.sourcez` added to an AI example's guidance fails `build-metadata` (exit 1) at `packages/ai/src/sources/sources.examples.ts:29:15`. |
| Packaging | `node scripts/architecture/check-boundaries.mjs --artifacts`; `node scripts/verify-packs.mjs` | OK: the analyzer still depends only on TypeScript; the packed `@oddkin/analyzer` exports the checker. |

**Not covered:** bare names (`sources`, `toolbar-start`) are prose by design, so a citation must use a checked form to be checked; a native event written with a hyphen before the word "event" would be reported. Tokens are the default theme's, not a configured product theme's. Workbench content pages (`docs-content.v1`) are not authored yet, so nothing reads them.

## 2026-10-19 — Button/form strategy: submission overrides, reassociation, native-button path (M4 forms)

Environment as the previous entry. Another agent was editing other files in the same working tree. Contracts: [css-architecture.md §5.1, §10.1](./architecture/css-architecture.md#101-implemented), `odd-button` and `odd-input` JSDoc (`@limitation`).

| Check | Command | Result |
| --- | --- | --- |
| Engine behavior | Temporary probes (not kept): Enter in fields of forms with `odd-input`, native inputs, `odd-button`, and native submit buttons; computed styles of disabled buttons | Same in Chromium, Firefox, WebKit: Enter in an `odd-input` never submits (its inner input has no form owner), even with a native submit button; Enter in a form's only text field submits with no submitter when the only submit button is an `odd-button`, and does nothing with two text fields; a native submit button is the default button. Disabled `odd-button`s kept their appearance's background (finding 2) |
| Button | `npx vitest run --project browser packages/components/test/button.browser.test.ts` | Pass in three engines (16 tests): `formaction`, `formmethod`, `formenctype`, `formtarget`, `formnovalidate` reflect and reach the temporary submitter, which `formnovalidate` lets past an empty required field; without overrides the submitter carries none; reassociation through `form` and a move submits the new owner and nothing outside a form; Enter submits with no submitter or through a native button, never through `odd-button`; `form.requestSubmit(oddButton)` throws `TypeError` |
| Input | `npx vitest run --project browser packages/components/test/input.browser.test.ts` | Pass in three engines (15 tests): Enter in the field does not submit; a native button does |
| Native-button path | `npx vitest run --project browser packages/components/test/styling.browser.test.ts`, `npx vitest run --project node packages/components/test/styles.test.ts` | Pass in three engines: 25 computed properties of `<button class="odd-button">` equal the `odd-button` control's in 36 cases (3 appearances × 3 sizes × enabled/disabled × light/dark), by default, with all six `--odd-button-*` variables, and at full width; same focus ring; hover reaches the same `action.hover`/`surface.hover` colours. `button.css` starts with the canonical layer order, keeps its rules in `odd.components`, and has no `!important` |
| Real submissions | `npx playwright test e2e/forms.spec.ts` (fixture `tests/forms/`) | Pass in three engines (2 tests; 24 of 24 with `--repeat-each=4`). Requests intercepted with `page.route`: GET with `item` and `intent`; the draft button's POST, multipart body, and `drafts` frame, with an empty required field; a blocked submission (`invalid` fired, nothing sent); a text/plain POST to the form's own action and frame. Each `odd-button` request equals the request of a native submit button with the same attributes. The submitter is a `button` disconnected after dispatch. The native `.odd-button` is the submitter and the default button for Enter, has the primary background from the tokens, and an `odd-button` outside the form submits it through `form` |
| CSS | `npm run lint:css`, `npm run compat`, `npm run size` | 58 stylesheets; `components:button` 1,150 B (1,119 B before the disabled fix); new `components:button.css` budget 1,024 B, measured 864 B |
| Full pipeline | `npm run verify` steps one by one (`npm test -- --reporter=verbose`, then `npm run verify:metadata` directly after it) | Lint: boundaries and CSS compatibility pass; formatting failed only on the other agent's uncommitted `references.ts` and `build-metadata.mjs`. Typecheck, size, e2e (118 passed, 2 skipped), packed consumers, and metadata evidence (189 + 481 verified facts) pass. Tests: 2,249 passed, 34 skipped, 1 failed — `packages/ai/test/elements.browser.test.ts` in Firefox after 17.5 s, which passes alone (54) |

**Findings:** (1) Implicit submission cannot reach `odd-button`: the HTML default button is the first submit button in tree order, which a form-associated custom element never is. Enter in the form's only text field submits with no submitter, so the button's `name`, `value`, and overrides are missing; `odd-input` blocks implicit submission entirely. Both are documented, and `button.css` is the native alternative. (2) Disabled `odd-button`s kept their appearance's background and border, because `:host([appearance]) button` outranked `button:disabled`; fixed with `:host button:disabled` (+31 B gzip). (3) For a GET form whose button sets `formmethod="post" formenctype="text/plain"`, Chromium 156 sends a urlencoded body labelled `text/plain`, while Firefox 157 and WebKit 27.2 send the text/plain encoding. Native submit buttons in Chromium do the same, so the spec compares each `odd-button` request with a native twin. (4) `requestSubmit()` accepts only native submit buttons, so an `odd-button` cannot be passed as the submitter. (5) A Firefox validation bubble left open by a blocked submission swallowed the next test's click (no click event reached the document). The tests now handle `invalid` and cancel the bubble. (6) The first full run failed a native-button comparison in Firefox: the pointer, left by an earlier test, rested over a newly rendered `odd-button`, so its hover background was compared. Reproduced in all three engines by parking the pointer there and waiting 300 ms. The tests now move the pointer onto plain text and wait for running transitions before comparing. (7) Transient: on 2026-10-18 the new e2e spec timed out in Firefox in three runs while the other agent's suites were running, and the passing Firefox test took 14.5 s. On 2026-10-19 it took 6.5 s alone and passed 24 of 24 repeats. (8) `npm run compat` also refreshed the side-nav structural row (37 → 36 keys) left stale by commit `2c7bb15`.

## 2026-10-19 — Product-aware composite candidates (M4 prototype, decision at M8)

Environment as the previous entry. Contract: [multi-product.md §8](./architecture/multi-product.md#8-component-families-and-product-aware-composites). Results and recommendation: [research/experiments/composite](../research/experiments/composite/README.md).

| Evidence level | Command | Result |
| --- | --- | --- |
| Browser | `npx vitest run --project browser research/experiments/composite` | Pass in Chromium, Firefox, and WebKit (18 tests each). Keyed member rows, each with an input and a "Move up" button, are rendered with `odd-*` and recomposed `studio-*` children by element-reference parts, a child directive, and family-specific templates. For each: the family's children are upgraded, configured, and wired (a button click reorders through the composite); two families render side by side; the same child element keeps its typed text and focus through a reorder, a re-render with new member objects, and an insert above; and removing the composite returns `scopeStats()` to its baseline. Element-reference parts reuse one rewritten strings array per call site and family, reject names outside the custom-element grammar (including `x"><img src=x>`), and accept references only in tag position. The child directive creates one element per key and role, writes only changed values, and forgets removed keys. |
| Compile | `npx tsc -p tsconfig.tests.json` (now includes `research/experiments`) | Pass, including `@ts-expect-error` on a child property of the wrong type. |
| Size | `node research/experiments/composite/measure.mjs` | Helpers, gzip with core external and development messages: element-reference parts 594 B (974 B minified), child directive 438 B (783 B), family factories 0 B. The rows template itself is 1,786 B gzip in every variant; a second literal family adds 7 B gzip on top of the first. |
| Mutation probes | rewritten-strings cache removed; child properties written on every render | Killed: the first breaks identity across re-renders and the call-site cache test; the second overwrites typed text. |

**Not covered:** Trusted Types and CSP were reasoned, not exercised under an enforced policy; no analyzer run over the variants (literal tags exist only in the family templates by construction); the full team editor (validation, undo) was not ported to each candidate.

## 2026-10-19 — External stores and optional-feature graph guards (M2 core contracts)

Environment as the previous entry. Contracts: [core-contracts.md §5](./architecture/core-contracts.md#5-reactivity-oddkincorereactive-dom-free), [ADR 0031](./architecture/decisions/0031-dev-prod-builds-and-size-budget.md).

| Evidence level | Command | Result |
| --- | --- | --- |
| Unit (DOM-free) | `npx vitest run --project node packages/core/test/external.test.ts packages/core/test/reactive.test.ts` | Pass (7 new, 36 existing). `fromExternal` reads a fresh snapshot while unobserved without subscribing, and computed values over it follow the store. The first observer subscribes once for effects, `subscribe` listeners, and observed computed values together. The last observer leaving unsubscribes, and so does disposing the `Scope` that owns the effect, with `scopeStats()` back at its baseline. Equal snapshots (`Object.is` or a custom `equals`) notify nothing. Store changes inside `batch` notify once. A change made while subscribing is not missed. `toExternal` calls listeners without arguments and round-trips through `fromExternal`. |
| Browser | `npx vitest run --project browser tests/interop` | Pass in Chromium, Firefox, and WebKit. An `OddkinElement` rendering a plain store subscribes on connect and re-renders on change, but not for the same snapshot. It unsubscribes on disconnect with scopes back at baseline, and reads current state and resubscribes when reconnected. React 19 reads a signal through `useSyncExternalStore(toExternal(signal))`, skips a render for an equal value, and unsubscribes on unmount. |
| Types | `npx tsc -b packages/ai` | `@oddkin/ai` re-exports core's `ExternalSource` in place of its identical interface. |
| Size and graphs | `node scripts/build-production.mjs`; `node scripts/check-size.mjs` | Within budgets: counter 9,522 B, component 10,798 B, list 11,310 B, reactive 1,898 B gzip. `fromExternal` and `toExternal` add 168 B when imported and are tree-shaken otherwise. New graph rules hold: no measured graph loads schema emitters, recipe inspection, the analyzer, Workbench, or TypeScript. The counter and component load no layout, collections, model, helpers, i18n, or controllers; the list loads no layout, model, or controllers; side-nav loads no layout, collections, model, helpers, or i18n. |
| Mutation probes | never unsubscribing; not refreshing while unobserved; a used `collections` import in the counter fixture | Killed: 3, 2, and the graph rule (plus the budget). |

**Not covered:** stores that notify during a computed evaluation, and concurrent React rendering beyond `flushSync`.

## 2026-10-19 — Accessible names across shadow boundaries (M4 accessibility)

Environment as the previous entry. Another agent was editing other files in the same working tree. Contract: [css-architecture.md §12.1](./architecture/css-architecture.md#121-implemented).

| Evidence level | Command | Result |
| --- | --- | --- |
| Example | `examples/components-only/` | Now registers `odd-input` (label and description in its shadow root, required email), an icon-only `odd-button` named by `label`, and a card named by its slotted heading beside the `label`-named and unnamed cards; import map extended (form controller, `live`), CSP hash recomputed |
| Playwright ARIA snapshot (three engines) | `npx playwright test e2e/components-only.spec.ts` | Pass in Chromium, Firefox, WebKit. Identical snapshots: `textbox "Email": ada@example.com` named by the label in its own shadow root; buttons `Reset`, `Save` from slotted text and `Billing help` from `label`; headings; after emptying the field and a blocked submission, `textbox "Email" [invalid]`. Playwright computes this tree from each engine's DOM, styles, and open shadow roots, not from the browser's accessibility tree, and it does not read `ElementInternals`, so no card region appears in it |
| Browser accessibility tree (Chromium only) | same, DevTools protocol `Accessibility.getFullAXTree` | Regions `Billing` (from `label`) and `Plan` (from the slotted heading, `ariaLabelledByElements`), none for the unnamed card; buttons `Reset`, `Save`, `Billing help`; textbox `Email` with description "Receipts go to this address.", `required` true, `invalid` false, then true after the blocked submission. Skipped in Firefox and WebKit: Playwright 1.64 offers no native accessibility tree for them |
| Other users of the page | `npx playwright test e2e/css-compat.spec.ts`; `npx vitest run --project node tests/examples/csp.test.ts tests/examples/import-maps.test.ts` | Pass. The first version of the example named its icon button "Clear email", which made `getByLabel('Email')` in `css-compat.spec.ts` ambiguous (Playwright matches labels as case-insensitive substrings); the button became "Billing help" after Save, so Reset stays the first `odd-button` and the Tab target from the field |
| Full pipeline | `npm run verify` steps one by one (`npm test -- --reporter=verbose`, then `npm run verify:metadata`) | Lint: boundaries and CSS compatibility pass; formatting failed only on the other agent's uncommitted `packages/core/test/external.test.ts` and `tests/interop/external-store.browser.test.ts`. Typecheck, 2,317 tests (34 skipped), metadata evidence (189 + 481 verified facts), size, e2e (122 passed, 4 skipped), packed consumers pass |

**Not covered:** native accessibility trees in Firefox and WebKit, and any screen reader; no assistive technology was run. The Playwright snapshot is DOM-derived evidence about names and states, not about what a platform accessibility API exposes.

## 2026-10-19 — Styling contract: inherited roles, component variables, parts (M4 styling)

Environment as the previous entry. Another agent was editing other files in the same working tree. Contract: [theming-and-styling.md §7](./architecture/theming-and-styling.md#7-styling-contract) ("Verified behavior").

| Check | Command | Result |
| --- | --- | --- |
| Static | `npx vitest run --project node packages/components/test/styling-contract.test.ts` | Pass (16) for `odd-button`, `odd-input`, `odd-card`: no sheet declares a custom property; every `--odd-*` read that is not a component variable is declared by the generated theme; every component variable the theme does not declare is read with a fallback, and the theme-declared ones without; the documented variables (CEM, all with descriptions) equal the variables read; structural styles read no `--odd-*`; exactly `--odd-card-padding` and `--odd-card-radius` are both theme roles and component variables |
| Browser | `npx vitest run --project browser packages/components/test/styling-contract.browser.test.ts` | Pass in Chromium, Firefox, WebKit (17 tests each), with `default.css` loaded, transitions set to 0 s, and the pointer parked on plain text. The test table covers exactly the 16 documented variables. Each variable takes effect on the host and on an ancestor. Unset, each property equals its role resolved beside the element in light and dark `data-odd-mode` scopes and inside a nested shadow root (dark differs from light). `initial` on the host restores the fallback; for the two theme roles it removes the value. `--odd-button-radius: banana` resets the radius to its initial value. A disabled button keeps `surface.sunken`, `text.disabled`, and a transparent border, and an input with an error keeps the danger border, whatever their variables. A custom background persists on hover unless `#custom::part(control):hover` is styled. Every documented part, and only those, renders and takes an outer `::part()` outline. `odd-input:state(user-invalid)::part(control)` follows the error. Card padding: `none`, `sm`, `md`, `lg` give 0, `space.sm`, `card.padding`, `space.lg` in the default scope and under `layout.compact` (where `md` is 16 px instead of 24 px); `--odd-card-padding` changes only `md` |
| Mutation probes | Temporary source edits, reverted | Killed, 3 of 3: the old `var(--odd-card-padding, <step>)` padding rule (static fallback check; padding test in three engines); `--odd-color-surface-default` declared on the card's `:host` (static declaration check; variable and scope tests in three engines); the button radius read without `--odd-button-radius` (static documented-variables check; variable test in three engines) |
| Existing suites | `npx vitest run --project browser` on the card, multi-product, examples, styling, and styling-contract tests | Pass (147) |
| Full pipeline | `npm run verify` steps one by one (`npm test -- --reporter=verbose`, then `npm run verify:metadata`) | Lint (boundaries, CSS compatibility, format), typecheck, metadata evidence (189 + 481 verified facts), size (`components:card` 678 → 668 B), e2e (122 passed, 4 skipped), packed consumers pass. Tests: 2,383 passed, 34 skipped, 1 failed — `button.browser.test.ts` "does not submit when the click is cancelled…" in Firefox, timed out "waiting for click" at its second `userEvent.click`; the file passes alone (48 of 48, twice) |

**Findings:** (1) The theme's component roles `card.padding` and `card.radius` produce `--odd-card-padding` and `--odd-card-radius`, the same names as the card's documented variables. Because the theme always sets them, the card's `padding="none|sm|lg"` rules, written as `var(--odd-card-padding, <step>)`, never applied on a page with the theme: all four steps rendered 24 px in all three engines. The existing card test did not load the theme, so it passed. The steps now set their value directly and `md` reads the role. (2) In the default theme `padding="lg"` (`space.lg`) and `md` (`card.padding`, through `layout.inset`) are both 24 px, so `lg` looks the same as the default. The theme values are unchanged here; this is a design follow-up. (3) Firefox stalls in full runs also hit unmodified suites: button activation and input typing on 2026-10-18, each waiting in `userEvent.click`, and today an AI elements test that only mounts an element and reads text (17.5 s). All of them pass alone. They happened while three browsers and Node ran together; the cause is not identified.

## 2026-10-19 — Nesting limits for models and collections (data contracts)

Environment as the previous entry. Contract: [data-composition.md §5, §11](./architecture/data-composition.md#11-behaviors-settled-in-the-m3-implementation).

| Evidence level | Command | Result |
| --- | --- | --- |
| Before | `.tmp/deep-probe.mjs` (not committed) against the built packages | `NavigationItemModel.validate()` on untrusted data threw `RangeError: Maximum call stack size exceeded` at 1,000 nested groups instead of returning diagnostics. `collection().set()` threw at 10,000 levels. 200,000 flat entries validated in 0.9 s. |
| Unit (DOM-free) | `npx vitest run --project node packages/core/test/model.test.ts packages/core/test/collections.test.ts` | Pass (4 new). Models: 32 recursive levels validate, and 33 report `model.depth.exceeded` at the JSON pointer of the first level too deep; a model's `maxDepth` changes the limit; 100,000 levels and a self-referencing object each return one diagnostic. Collections: 32 levels render 33 entries, and a 33rd level is reported once (`collection.depth.exceeded`, also through the error handler) and not rendered; a caller `maxDepth` of 1 renders two levels; 100,000 levels render 33 entries with one diagnostic. |
| After | same probe after `node scripts/build-production.mjs` | `validate()` returns `model.depth.exceeded` at 100, 1,000, 10,000, and 100,000 levels; the collection renders 33 entries with one diagnostic at each depth; 200,000 flat entries validate in 0.7 s. |
| Regression | `npx vitest run --project node`; `npx vitest run --project browser packages/components packages/ai/test/contract.browser.test.ts tests/examples` | Node: 591 pass. Browser: pass; 8 Firefox click and form tests failed under the concurrent run and pass alone (50/50). `verify:metadata`: 189 + 481 facts. |
| Size | `node scripts/check-size.mjs` | Within budgets: `list` 11,385 B (+75 B), `ai-headless` 13,527 B. |
| Mutation probes | either limit disabled | Killed: 2 model tests and 2 collection tests fail. |

**Not covered:** `odd-side-nav` renders nested groups through its own template recursion and does not validate `items` in production. Its tested bounds remain 1,000 entries and five levels; deeper unvalidated data is the caller's responsibility (validate with `NavigationItemModel` first).

## 2026-10-19 — A component authored in `.css` (M4 styling)

Environment as the previous entry. Another agent was editing other files in the same working tree. Contract: [theming-and-styling.md §7](./architecture/theming-and-styling.md#component-authoring-from-css--scss-files).

| Check | Command | Result |
| --- | --- | --- |
| Generation | `UPDATE_FIXTURES=1 npx vitest run --project node packages/components/test/css-sources.test.ts`, then without the flag | Pass (2). `card.styles.ts` is regenerated from `card.styles.css` and formatted with the repository's Prettier configuration. Its CSS is the handwritten module's apart from the header and doc comments. The shipped text equals the authored CSS (comments and whitespace aside). An unknown `--odd-colour-text-primary`, a token read with a fallback, and a file without a leading comment fail generation; a component variable with a token fallback becomes `var(--odd-x-gap, ${token('space.sm')})` |
| Same output | Node, before and after (`dist/card/card.styles.js`, `custom-elements.json`, `oddkin.metadata.json`) | `cardStyles.cssText` byte-identical (1,538 characters); CEM declaration identical; component metadata identical apart from `verification`, the test-evidence records that a rebuild sets aside until the tests run again |
| Theme behavior | `npx vitest run --project browser packages/components/test/styling-contract.browser.test.ts` | Pass in Chromium, Firefox, WebKit (18 tests each). The `.css`-authored card and the CSS-in-TS button and input give the same surface colour in light mode, again after the scope switches to dark (a different colour), and again after a page-level override of the role. The card also passes the same variable, scope, state, and part checks as the other two |
| Full pipeline | `npm run verify` steps one by one (`npm test -- --reporter=verbose`, then `npm run verify:metadata`) | Pass: lint (boundaries, CSS compatibility, format), typecheck, 2,393 tests (34 skipped), metadata evidence (189 + 481 verified facts), size (`components:card` 668 B), e2e (122 passed, 4 skipped), packed consumers. An earlier test run that overlapped the other agent's browser runs was stopped after it stalled. In that run, single tests took 207–223 s, Firefox conformance suites timed out "waiting for click", Chromium reported 57 results and then nothing, and Firefox never reported `styling-contract.browser.test.ts`. All processes were idle when it was stopped. The rerun on a quiet machine passed |

**Findings:** (1) Generating `token()` calls rather than embedding `var()` text keeps metadata stable: the analyzer records `token()` reads as token names, and literal `var(--odd-…)` text would have appeared as variable names. (2) Prettier formats CSS inside `css` templates, so the generator formats its output with the repository's Prettier configuration instead of reproducing the layout itself.

## 2026-10-19 — Components-only example from packed tarballs (M4 consumers)

Environment as the previous entry. Another agent was editing other files in the same working tree. Contract: [examples/components-only/README.md](../examples/components-only/README.md).

| Check | Command | Result |
| --- | --- | --- |
| Packing | `node -e "import('./examples/components-only/packed.mjs').then((m) => m.packConsumer())"` | 6.7 s: three tarballs installed into `%TEMP%`; `npm ls --all` lists only `@oddkin/components`, `@oddkin/core`, `@oddkin/tokens`. The generated import map has 10 entries, all to installed `dist` files, with core's from `dist/prod`. Unlike the workspace page's hand-written map it has no `@oddkin/core/scope`, which the production modules import only as a type. The token stylesheet points at the installed `dist/css/default.css`, and the CSP hash is recomputed |
| Example | `npx playwright test e2e/components-only.spec.ts` | Pass in Chromium, Firefox, WebKit: 7 tests each (the accessibility-tree test runs in Chromium only); with `--repeat-each=3`, 51 passed and 12 skipped. The form flows, ARIA snapshots, and the Chromium accessibility tree run against the workspace build and the packed page. The packed-only test checks: only the three packages installed; every map entry an `@oddkin/core`, `tokens`, or `components` specifier resolved to `dist` (core to `dist/prod`); every request either the page's own file or a published `dist` file of those packages; no CSP violations or page errors |
| Server lifecycle | two runs, then `npx playwright test e2e/plain-html.spec.ts` | One directory, `%TEMP%\oddkin-components-only-4174`, replaced on each pack. Playwright stops web servers on Windows without running signal handlers, so a per-run temporary directory would have been left behind; the first version left two after two runs. A run of another spec packs nothing (7.4 s, no directory created) |
| Full pipeline | `npm run verify` steps one by one (`npm test -- --reporter=verbose`, then `npm run verify:metadata`) | Pass: lint (boundaries, CSS compatibility, format), typecheck, 2,394 tests (34 skipped), metadata evidence (189 + 481 verified facts), size, e2e (132 passed, 6 skipped), packed consumers |

**Findings:** (1) In WebKit the existing theme check read the primary button mid-transition (`rgb(96, 78, 229)` instead of `rgb(98, 80, 232)`), right after Enter had activated it; the check now moves the pointer away and polls until the transition settles. (2) A hand-written import map must list every core subpath the components import, while a map generated from the installed module graph lists exactly what loads; the workspace page keeps its hand-written map (CSP hash and import-map tests).

## 2026-10-19 — axe-core for odd-button and odd-input (M4 accessibility)

Environment as the previous entry; axe-core 4.14.0 (pinned dev dependency, never shipped). Another agent was editing other files in the same working tree. Contract: [css-architecture.md §12.1](./architecture/css-architecture.md#121-implemented).

| Check | Command | Result |
| --- | --- | --- |
| Component states | `npx vitest run --project browser packages/components/test/accessibility.browser.test.ts` | Pass in Chromium, Firefox, WebKit (3 tests each). axe ran WCAG 2.0, 2.1, and 2.2 A and AA rules over a container with the shipped theme, transitions off, and canvas and text colours set as `base.css` would set them. Light and dark mode: no violations and no incomplete results; 15 rules passed, including `button-name`, `label`, `color-contrast`, and `aria-allowed-attr`. States covered: 3 appearances × 3 sizes, disabled (each appearance), loading, icon-only with `label`, start and end icons, full width, submit and reset; fields with label, description, required, error, every `type`, placeholder, read-only, disabled, a disabled fieldset, and `aria-invalid` after a blocked submission; cards named by `label` or a heading, unnamed, and elevated with `padding="sm"`. Guard: an unlabelled `odd-input`, an icon-only `odd-button` without `label`, and `--odd-button-color: #f2f2f2` give `label`, `button-name`, and `color-contrast` violations, each targeting the node inside the shadow root (`[["odd-input", "#control"]]`, and so on) |
| Page | `npx playwright test e2e/components-only.spec.ts` | Pass in three engines, for the workspace build and the packed tarballs (9 tests per engine; the accessibility-tree test runs in Chromium only). axe runs over the whole document with reduced motion emulated, in light mode, in dark mode (`data-odd-mode="dark"` on the root), and after a blocked submission: no violations. It is injected through the automation channel, so the CSP stays as served |
| Full pipeline | `npm run verify` steps one by one (`npm test -- --reporter=verbose`, then `npm run verify:metadata`) | Pass: lint (boundaries, CSS compatibility, format), typecheck, 2,403 tests (34 skipped), metadata evidence (189 + 481 verified facts), size, e2e (138 passed, 6 skipped), packed consumers |

**Findings:** (1) The first dark-mode run reported `color-contrast` only for the test fixture's own headings: black text, because the test page has no `base.css`, on the dark canvas. The fixture now sets text and background as `base.css` would; no component was involved. (2) axe names a node inside a shadow root by its host selector followed by its inner selector; the guard asserts that form, so a clean result is evidence about shadow content, not a sign that axe skipped it. (3) Not covered: screen readers, and anything axe cannot read (`ElementInternals` roles and names, which the Chromium accessibility tree covers).

## 2026-10-19 — Core contracts packaged in @oddkin/core (M4 agent-kit contracts)

Environment as the previous entry. Another agent was editing other files in the same working tree. Contract: [core-contracts.md](./architecture/core-contracts.md), [metadata-and-analyzer.md §3.1](./architecture/metadata-and-analyzer.md).

| Check | Command | Result |
| --- | --- | --- |
| Generation | `npm run contracts`, then `npm run lint:contracts` | 14 sections marked in core-contracts.md (binding-rule, composition, properties in two ranges, events, lifecycle, scope, controllers, i18n, reactivity, external-store, templates, rendering, update-complete, failure-ownership) generate `packages/core/CONTRACTS.md` and `contracts.json` (title, anchor, sha256 per id); the check reports them up to date |
| Contracts | `npx vitest run --project node tests/contracts` | Pass, 6 tests: generated files current; the stable id list, each id with one anchor and one title and no relative links or citations left in the text; `files` and `exports` of `@oddkin/core` include both files; malformed markers (wrong scope, reopened id, mismatched close, unclosed range, a marker quoted in prose) reported; offline resolution returns the text, anchor, hash, and installed version, and `undefined` for unknown and malformed ids; metadata references only index ids, with matching hashes |
| Analyzer | `npx vitest run --project node tests/contracts packages/analyzer` | Pass, 101 tests; the golden fixture regenerated with each component's contracts and the referenced sections' hashes; an unpublished id in an authored reference is reported |
| Packed consumer | `npm run verify:packs` | Pass: the core tarball contains `CONTRACTS.md` and `contracts.json`; a consumer outside the workspace resolves all 14 ids through the installed `@oddkin/analyzer`, reads the section text from `node_modules`, and gets the installed version |
| Mutants | edit a section without regenerating; rename `contract:core/scope` and regenerate; drop `contracts.json` from core's `files` | 3 of 3 killed: `lint:contracts` exits 1 naming both stale files and `npm run contracts`, and the currency test fails; the rename fails 3 of 6 tests (stable ids, resolution, metadata); `verify:packs` fails on the missing file |
| Pipeline | `npm run lint`, `npm run typecheck`, `npx vitest run --project node`, `npx vitest run --project browser`, contract evidence, `npm run verify:packs` | Pass: lint (contracts; build, then boundaries with artifacts; CSS compatibility; format); 598 Node tests; 1,822 browser tests passed and 34 skipped, with one Firefox failure in the `odd-input` form example of `examples.browser.test.ts` that passed when rerun alone (8 of 8); metadata evidence 189 + 481 verified facts. e2e not rerun |

**Findings:** (1) The artifact boundary check lexed every export target as JavaScript and threw on `CONTRACTS.md`; document and data exports are now checked for existence only. (2) A marker quoted in prose is a malformed marker, so the status line in core-contracts.md describes the markers instead of quoting one. (3) Editing contract text changes the section hashes in the analyzer golden fixture; CONTRIBUTING.md says to regenerate it with `UPDATE_FIXTURES=1`.

## 2026-10-19 — odd-side-nav in Angular and Svelte (M4 framework fixtures)

Environment as the previous entry; Angular 22.2.3 (`@angular/common`, `compiler`, `core`, `platform-browser`), Svelte 5.57.2, and `@sveltejs/vite-plugin-svelte` 7.3.1, exact-pinned dev dependencies (rxjs installed as Angular's peer; no zone.js). Contract: [data-composition.md §10](./architecture/data-composition.md#10-acceptance-fixtures).

| Check | Command | Result |
| --- | --- | --- |
| Fixtures | `npx vitest run --project browser packages/components/test/frameworks` | Pass in Chromium, Firefox, WebKit: 9 files, 24 tests (React and Vue unchanged; 2 Angular and 2 Svelte tests per engine). Angular (JIT, zoneless, `CUSTOM_ELEMENTS_SCHEMA`) and Svelte (runes, `$state.raw`): `items` arrives as the same array and no `items` attribute is written; controlled `expanded` keeps the group holding `current` closed until `odd-toggle` updates framework state; `odd-action` reaches the framework handler; a reordered `items` keeps the existing link node; the framework re-render echoes no intent event. The second test removes and re-creates the element through `@if`/`{#if}`: a new element, one handler call per click, and scope and listener counts back to baseline after teardown |
| Mutants | bind `items` as an attribute (`[attr.items]`, `items={JSON.stringify(items)}`); import Svelte, then a used Angular `signal`, into the `side-nav` size entry | 4 of 4 killed: the attribute bindings fail all 4 tests in Chromium; `check-size` reports `side-nav pulls in node_modules/svelte` (30,372 B gzip) and `node_modules/@angular` (135,668 B gzip) |
| Production graphs | `node scripts/check-size.mjs` | Pass: no measured entry includes React, Vue, Angular, or Svelte; the framework list now applies to every entry |
| Typecheck | `npm run typecheck` | Pass; `.svelte` modules typed by `packages/components/test/svelte.d.ts` |

**Findings:** (1) Vitest does not run the Angular compiler, so the fixture uses JIT (`@angular/compiler`) and calls `Component({...})` on a class instead of using decorators. (2) Angular declares `sideEffects: false`, so a bare `import '@angular/core'` is removed by tree shaking and the size guard cannot see it; the probe used a value. (3) The first Svelte re-creation test failed because it passed `current` while uncontrolled, which opens the group holding the current page; the uncontrolled case now passes an empty `current`. Not covered: framework forms, typed JSX or template declarations, and elements defined after the framework renders them.

## 2026-10-19 — Forms lane completed: barred validity, odd-input event intent, framework form bindings, keyboard targets

Environment as the previous entry; `@angular/forms` 22.2.3 added as an exact-pinned dev dependency (it brings `zod` and `@standard-schema/spec`, dev-only). Contracts: [core-contracts.md §4.1](./architecture/core-contracts.md), [css-architecture.md §12.1](./architecture/css-architecture.md#121-implemented), [data-composition.md §10](./architecture/data-composition.md#10-acceptance-fixtures).

| Check | Command | Result |
| --- | --- | --- |
| Barred validity | `npx vitest run --project browser packages/core/test/controllers.browser.test.ts packages/core/test/form-association.browser.test.ts packages/components/test/input.browser.test.ts packages/components/test/interactions.browser.test.ts` | Pass in Chromium, Firefox, WebKit (152 tests, 1 skipped). Before the fix the new core test and the new `odd-input` test failed, and the error handler received `setValidity`'s `TypeError`. Now a control barred from constraint validation counts as valid: the core field with an invalid email while its control is disabled or read-only, and `odd-input` with `type="email" value="x"` while `disabled`, `readonly`, or in a disabled fieldset, with the form valid, nothing reported, read-only still submitted, and the type mismatch and native message back once unbarred. The shared interaction fixture now disables the fieldset while the value is invalid, for `odd-input` and its derived tag |
| Event intent | `npx vitest run --project browser packages/components/test/contract.browser.test.ts`, then `npm run verify:metadata` | `odd-input` `input` and `change` declare `user` intent; the contract suite verifies neither is emitted by property writes, for `odd-input` and `derived-input` (180 passed, 12 skipped). Metadata evidence: 191 component facts (from 189) and 481 AI facts |
| Framework forms | `npx vitest run --project browser packages/components/test/frameworks-forms.browser.test.ts` | Pass in three engines, 4 tests each, no adapter code: React 19 `value` and `onInput`; Vue `v-model`, which Vue compiles to `vModelText` on a custom element; Angular Reactive Forms through the built-in `DefaultValueAccessor` (`ngDefaultControl` with `[formControl]`); Svelte `value` and `oninput`. One scenario for all four: the value arrives as a property (no `value` attribute), typing mid-value reaches framework state with the caret kept through the write-back, framework writes reach the element, its validity (`valueMissing`), and `FormData`, and no `input` or `change` is echoed. Angular also: blur marks the control touched, `disable()` disables the element and drops it from the form data |
| Keyboard targets | `npx vitest run --project browser packages/components/test/keyboard.browser.test.ts` | Pass in three engines: Tab stops through all four components (buttons enabled, disabled, loading, icon-only; inputs enabled, disabled, read-only, in a disabled fieldset; a named card with a button inside; an unnamed card; a side navigation) equal those through equivalent native markup, forward and with Shift+Tab back. Observed: 10 stops in Chromium and Firefox; 9 in WebKit, which leaves the navigation link out for native and component alike |
| Mutants | see findings | 6 of 6 killed: the original `FormValue` (2 tests fail); `readonly` removed from `odd-input`'s watch list (the read-only case fails); the `value` setter emitting `change` (the not-programmatic check fails for `odd-input` and `derived-input`); `name` not reflected (React, Vue, and Svelte form fixtures fail; Angular writes static attributes as attributes, so it passes); the `value` setter emitting `input` (all four form fixtures fail); a focusable wrapper inside `odd-input` (the keyboard test fails) |
| Pipeline | `npm run lint`, `npm run typecheck`, `npx vitest run --project node`, `npx vitest run --project browser`, contract evidence, `node scripts/check-size.mjs`, `npm run verify:packs`, `npx playwright test` | Pass: lint (contracts regenerated after the §4.1 edit; build, then boundaries with artifacts; CSS compatibility; format); 598 Node tests; browser 1,849 passed and 28 skipped, with one Firefox failure (the `odd-input` form example in `examples.browser.test.ts`, a locator click timeout) that passed alone (8 of 8); size budgets; packed consumers; e2e 138 passed, 6 skipped |

**Findings:** (1) A native control barred from constraint validation keeps its failing validity flags but reports an empty `validationMessage`, and `ElementInternals.setValidity()` rejects failing flags without a message, so `FormValue` now mirrors the control only while `willValidate` is true. `odd-input` also did not re-sync when `readonly` changed. (2) Components import `@oddkin/core` through its package exports, which resolve to `dist`: after a core source change, component browser tests run the old core until `tsc -b` and the production build run. (3) Svelte 5 refuses `bind:value` on a custom element at compile time (`bind_invalid_target`), so Svelte consumers bind `value` and handle `oninput`. (4) In the first full three-engine run the new keyboard test failed once in Firefox; it then passed alone (4 of 4, run together with `input.browser.test.ts`), under a Firefox-only run of the component and AI tests (2 of 2), and in the next full run. Like the examples flake, it depends on keyboard focus under concurrent load. (5) Not covered: screen readers (NVDA with Firefox, VoiceOver with Safari), native accessibility trees in Firefox and WebKit, IME and autofill.

## 2026-10-19 — Definition after the framework renders; typed listeners, tag names, and React JSX typings

Environment as the previous entry. A `.vscode/` folder another person added during this work fails `prettier --check` and was left untouched. Contracts: [core-contracts.md](./architecture/core-contracts.md) (events, rendering), [packages.md](./architecture/packages.md), [data-composition.md §10](./architecture/data-composition.md#10-acceptance-fixtures).

| Check | Command | Result |
| --- | --- | --- |
| Late definition | `npx vitest run --project browser packages/components/test/frameworks-late.browser.test.ts` | Pass in Chromium, Firefox, WebKit (5 tests each). Each framework renders a tag that is defined only afterwards. Angular `[items]`, Vue `.items`, and Svelte (object value) set a property before the upgrade: the element gets the same array, renders its two links, and reports nothing. React 19 and Vue without `.prop` write `items="[object Object],[object Object],[object Object]"`: after the upgrade `items` is unset and `element.attribute.propertyOnly` is reported once; the framework's next render sets the property and the links appear. Observed identically in all three engines before the diagnostic existed |
| Diagnostic | `npx vitest run --project browser packages/core/test/element.browser.test.ts` | Pass in three engines (87 tests): two property-only attributes (`items`, lowercase `renderlabel`) report twice, a normal attribute and a clean element report nothing, and the property keeps its default. The production build has no trace of it: `dist/prod/element/element.js` contains neither the code nor the message, and the counter stays 9,522 B gzip. The first version, a private method called under `DEV`, left the method and its message in production; it is now inline under `if (DEV)` |
| Typed listeners | `npm run typecheck`; `npx vitest run --project node tests/types packages/components/test/events.types.test.ts packages/analyzer` | Pass. `ElementEvents<typeof Self>` maps `static events` to `CustomEvent<Detail>` (native type for `input`, `change`); 23 elements declare it as `_events`, and `OddkinElement`'s listener overloads read it. Compile-time checks: AI listeners get their detail types, a listener for another detail type and a missing detail field are errors, and a document listener for an AI event gets a plain `Event` (no global entries). `odd-side-nav`'s `static events` keys became the event names. The analyzer reports `analyzer.event.key` for a key that differs from its name once `_events` is declared (fixture `dyn-keyed`), and not for shorthand keys without `_events` (96 analyzer tests) |
| Tag names | `npm run build`, then `tests/jsx/react.types.tsx` | Every `define/*` declaration now starts with `/// <reference path="<element>.d.ts" preserve="true" />` (28 entries), so importing only a registration entry types `HTMLElementTagNameMap`; before, those declarations were `export {}` and `querySelector('odd-side-nav')` was untyped. An `import type {}` was dropped from the emitted declaration, and a type re-export would have added an export to the CEM. CEM and metadata gain no `_events` or `_props` members |
| React JSX | `npx tsc -p tsconfig.jsx.json` (in `npm run typecheck`); `npm run verify:packs` | Pass. `@oddkin/components/jsx/react` (types only) types `odd-side-nav`, `odd-input`, `odd-prompt-input`, and `odd-conversation` with properties (including `renderLabel`), `ref`, React's own attributes and `onInput`/`onChange`, and `on<event>` props with detail types; six expected errors fire (string for `items`, unknown property, wrong detail field twice, undeclared `type` value, read-only `form`). A TSX file in the packed consumer compiles against the installed tarballs with `skipLibCheck: false`. The boundary rules allow React's types only from `src/jsx/` and only in types-only entries (`typeOnly`); 5 checker cases: type import accepted; value import, the same import elsewhere, another package, and a JavaScript target rejected |
| Mutants | see findings | 6 of 6 killed: the property-only check disabled (core test fails); `_events` removed from `odd-prompt-input` (the source test, the listener type test, and the JSX test fail); `on<event>` props typed `any` (two expected JSX errors stop firing); and the boundary cases above for value imports, JavaScript targets, and other packages |
| Pipeline | `npm run lint`, `npm run typecheck`, `npx vitest run --project node`, `npx vitest run --project browser`, contract evidence, `node scripts/check-size.mjs`, `npm run verify:packs`, `npx playwright test` | Lint passes except the untracked `.vscode/settings.json`. 601 Node tests. Browser: the first full run failed the two explained-mistake example tests in all engines, because the side-nav `items` and AI `sources` attribute mistakes are now reported (`element.attribute.propertyOnly`); the tests pinned "no runtime report" and were updated. The next full run had 1,865 passed and 28 skipped, with 3 failures under load (Firefox editable list and layout CSS, WebKit keyboard) during repeated screenshot timeouts; each passed alone 3 of 3. e2e 137 passed and 6 skipped, with one WebKit editable-list failure that passed on rerun and 3 of 3 times alone. Metadata evidence 191 + 481 facts; size budgets unchanged |

**Findings:** (1) React 19 and Vue decide property or attribute per render (`name in element`), so data given before a lazy definition loads is silently lost until the next render; the development diagnostic makes it visible, and Angular, Svelte, and Vue `.prop` are unaffected. (2) A class cannot both extend `HTMLElement` and take a second base type redeclaring `addEventListener` (TS2320); `this`-polymorphic overloads on `OddkinElement` plus a type-only `_events` member avoid that and need no per-element runtime code. (3) `HTMLElementEventMap` includes `GlobalEventHandlersEventMap`, which side-nav augments, so filtering "native" events by that map dropped `odd-action`; React 19 adds any lowercase `on<name>` prop on a custom element as a listener, so no filter is needed. (4) The keyboard test failed under full load in Firefox before and WebKit now; it retries twice, and a real mismatch fails every attempt. (5) Core's production `define.js` keeps a bare `import "./element.js"` that esbuild ignores with a warning in size builds; it predates this work (same at HEAD in a separate worktree). (6) Not covered: Vue templates (`vue-tsc`) and Svelte markup (`svelte-check`), neither installed.

## 2026-10-19 — Vue and Svelte typings checked by vue-tsc and svelte-check

Environment as the previous entry; vue-tsc 3.3.13, svelte-check 4.7.7, and TypeScript 5.9.3, exact-pinned in `tooling/framework-types` (own lockfile, `legacy-peer-deps` so Vue and Svelte resolve from the repository root: one copy each). Another agent was editing `packages/state` in the same working tree. Contract: [packages.md](./architecture/packages.md).

| Check | Command | Result |
| --- | --- | --- |
| Toolchain | `npm view`, `node -e "require('typescript').createProgram"` | svelte-check 4.7.7 declares TypeScript `^5.0.0 \|\| ^6.0.0`; vue-tsc drives TypeScript's JavaScript API, which TypeScript 7.0.2 (the repository's compiler) does not have (`createProgram` is undefined; ADR 0018). Installed at the root they would resolve TypeScript 7, so they run from `tooling/framework-types` with TypeScript 5.9.3, the analyzer's version. The first install also added a second Svelte (peer auto-install); `legacy-peer-deps` removed it, and `svelte-check` resolves `svelte` to the root copy |
| Vue | `node scripts/check-framework-types.mjs` (in `npm run typecheck`) | Pass with `strictTemplates`: `tests/frameworks/vue/Shell.vue` binds `:items`, `@odd-action`, `@odd-toggle`, `v-model` on `odd-input`, and `@prompt-submit` with typed details; four `@vue-expect-error` cases fail as expected (number for `items`, wrong detail field twice, undeclared input `type`). The first run showed Vue's template compiler camelizes listeners (`@odd-action` → `onOddAction`) and checks `v-model` on a custom element as `modelValue`; the typings declare both |
| Svelte | same | Pass: `tests/frameworks/svelte/Shell.svelte` (properties, `onodd-action`, `oninput` with `currentTarget.value`, `onprompt-submit`) has no errors, and `Mistakes.svelte` produces exactly the four expected errors in `mistakes.expected.json`. svelte-check ignores `@ts-expect-error` comments in markup, so the expected errors are asserted by the runner instead |
| React | `tsc -p tsconfig.jsx.json` | Pass, unchanged; the entry moved from `./jsx/react` (never published) to `./frameworks/react` |
| Packed | `npm run verify:packs` | Pass: a consumer of the installed tarballs type-checks `frameworks/vue` (`GlobalComponents['odd-side-nav']` props) and `frameworks/svelte` (`SvelteHTMLElements['odd-side-nav']`) with `skipLibCheck: false`, each rejecting a number for `items` |
| Boundaries | `node scripts/architecture/check-boundaries.mjs --artifacts` | Pass: `typeOnly` now allows `react`, `vue`, and `svelte` types from `src/frameworks/` in three types-only entries |
| Mutants | event handler types replaced with `any` in the Vue and Svelte typings | Killed: vue-tsc reports two unused `@vue-expect-error` directives, and `Mistakes.svelte` produces two of its four expected errors |

**Findings:** (1) Vue's template type checker reads listeners on custom elements in camel case and `v-model` as `modelValue`, while the runtime binds `value` and `input` (verified earlier in `frameworks-forms.browser.test.ts`). (2) The types-only entries still compile to empty `export {}` modules in `dist/frameworks`; no export points at them.
