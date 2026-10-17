# Verification log

Recorded results of checks. Each entry states the date, environment, command, and outcome. Never record a result that was not observed.

## 2026-10-17 — M1 workspace skeleton

**Environment:** Windows, Node 24.19.0, npm 11.17.0, TypeScript 7.0.2, Vitest 5.0.5, Playwright 1.64.1 (Chrome for Testing 156.0.8078.4, Firefox 157.0, WebKit 27.2), Prettier 3.9.10, es-module-lexer 3.0.4, Ajv 8 + ajv-formats 3.

| Check | Command | Result |
| --- | --- | --- |
| Build | `npm run build` | Pass — 5 packages + `apps/docs` built with `tsc -b` (ESM + declarations + maps) |
| Boundaries | `npm run lint:boundaries` | Pass — 6 packages, 6 source files, 10 imports; manifests, sources, built artifacts, and the DOM-free `@mote/tokens` entry checked |
| Deliberate violation | Added `import '@mote/state'` to `packages/components/src/index.ts`, ran the checker, reverted | Fails as intended: `✖ [boundary.import.forbidden] @mote/components may not import @mote/state.` with file and fix |
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
| DOM-free entries | `npm run lint:boundaries` | Pass — `@mote/core/reactive` and `@mote/core/scope` import in Node without DOM globals; 6 packages, 11 source files, 21 imports |
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
| DOM-free import | `npm run lint:boundaries` | Pass — every `@mote/core` entry (root, `reactive`, `scope`, `template`, `styles`, `element`, `diagnostics`) imports in Node without DOM globals; `@mote/state` now depends on `@mote/core/reactive` only |
| Full pipeline | `npm run verify` | Pass — 90 Node + 147 browser unit tests, 6 e2e, packed consumers |

**Findings:** (1) TypeScript 7.0.2 has no in-process compiler API; only `typescript/unstable/*` (IPC) — recorded in ADR 0018. (2) A trailing `<` before a binding (`<${tag}>`) was lexed as text; now rejected as a dynamic tag name. (3) Importing the core root in Node threw (`HTMLElement` undefined), which would also break server imports in framework apps; the base class now falls back to a stub and `define()` is a no-op without a registry. (4) Import-map consumers need an entry for every subpath loaded transitively (`@mote/core/reactive`).

**Data point, not a measurement:** unminified `@mote/core` output with comments is 87.7 KB raw / 21.7 KB gzip in total (template 8.6 KB, element 6.7 KB, reactive 4.2 KB gzip). Minified per-entry sizes, startup, update, and memory measurements remain M3 work.
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
| Cascade | `packages/tokens/test/generate.browser.test.ts` | Pass in all three — computed colours, spacing, and min-heights match `resolveToken()` for nested light/dark/system, product, and density scopes and inside a shadow root; the empty `--mote-mode-dark: ;` toggle is accepted |
| DOM-free entries | `npm run lint:boundaries` | Pass — `@mote/tokens`, `./theme`, `./generate` import in Node without DOM globals |
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
| Packed consumer | `npm run verify:packs` | Pass — `@mote/tokens/css/default.css` and `schema.json` resolve through `exports` from the tarball; the installed `mote-tokens` binary runs `init` and `build --strict` in a project outside the workspace |
| Full pipeline | `npm run verify` | Pass — 138 Node + 234 browser unit tests, 12 e2e, packed consumers |

**Findings:** (1) Custom spacing scales without the step names the preset's roles use failed with bare `alias.missing`; the diagnostic now explains the requirement. (2) `.gitignore` and `.prettierignore` appends had merged with their last lines, so `.tmp/` and `.vitest/` were not ignored and six Vitest failure screenshots had been committed; they are removed from the index and both files end with newlines.
## 2026-10-17 — M2 conditions, profiles, and unit policy

**Environment:** as the previous entry.

| Check | Command | Result |
| --- | --- | --- |
| Conditions | `packages/tokens/test/conditions-profiles.test.ts` | Pass — named and unnamed container queries (logical and physical sizes), media ranges and preference features serialize to literal `{ kind, query, atRule }`; `@mote/tokens/conditions` imports without a DOM; `var()`, `%`, unitless, logical media sizes, invalid preference values, empty ranges, reserved container names, missing features, and unknown kinds report codes and paths; `px` thresholds warn |
| Profiles | same | Pass — attribute-scoped overrides with alias closure; nested-scope re-application selector emitted; profiles after products and densities; only layout/component roles; unknown roles, invalid values, missing references, and tier violations reported under `/profiles/…`; overlaps warn and name the winner; target minimums checked per profile and per profile × density for affected roles only |
| Unit policy | same | Pass — unitless line heights, font weights 1–1000, lengths with units; `px` warns for type and control sizes, not borders |
| Cascade | `packages/tokens/test/generate.browser.test.ts` | Pass in Chromium, Firefox, WebKit — a profile applies in dark mode and **survives inside a nested compact density**; lengths compared within 0.05px because WebKit snaps margins to 1/64px (`0.8438rem` → 13.5px vs 13.5008px elsewhere) |
| CSS-only page | `npx playwright test e2e/tokens-css-only.spec.ts` | Pass in all three under light and dark preferences — profile padding, and profile + nested compact density, equal `resolveToken()` |
| Full pipeline | `npm run verify` | Pass — 149 Node + 240 browser unit tests, 12 e2e, packed consumers |

**Findings:** (1) A profile changes role expressions, so a nested density/product/mode/theme scope would re-declare base expressions and drop it; each profile rule also targets nested scopes inside its subtree. (2) CSS cannot honour `data-mote-profile` list order; precedence follows configuration order and overlaps are reported. (3) Preset profiles originally referenced `space.2xs`, which custom scales need not define; they now derive smaller values with `calc()` from required steps. (4) Duplicate unit diagnostics and repeated target unit-mismatch warnings were removed.
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
| Fixture library | `npx vitest run --project node packages/analyzer` | Pass — CEM validates against the pinned `custom-elements-manifest@2.1.0` schema and metadata against `mote-metadata.v1`; a module that throws on import is analyzed (never executed); properties, attributes, reflection, defaults, enum types, events with detail types and JSDoc, members (getters, methods), template and JSDoc slots/parts, CSS properties, custom states; inheritance across files with `inheritedFrom`; registrations, export specifiers, re-exports, recipe and model summaries, authored `@a11y`/`@keyboard`/`@category`/`@related` facts with locations; dynamic tag name reported with location; deterministic; incremental program reuse gives identical output |
| core-counter | same | Pass — committed CEM and metadata fixtures; zero diagnostics; `count`/`count-change` sync pair |
| Dynamic fixture | same | Pass — spread, computed key, and computed default reported with lines; unknown default omitted |
| Performance | `node scripts/experiments/analyzer-performance.mjs 50` (two runs) | 50 components: TypeScript 5.9 0.9–1.2 s full in-process, 1.6–1.7 s cold process, 0.8 s after a one-file edit; TypeScript 7 probe 0.5–0.6 s cold but properties only. Recorded in ADR 0018 (Accepted) |
| Packed | `npm run verify:packs` | Pass — `@mote/analyzer` installs from its tarball with `typescript` only beneath it, its declarations typecheck in a consumer, and `mote-analyze --help` runs |

**Findings:** (1) Shorthand `static events = { countChange }` resolved to the property symbol; the analyzer now uses the shorthand value symbol. (2) Module paths were relative to the workspace root when the tsconfig had no `package.json` beside it; the root now defaults to the tsconfig directory. (3) Ajv strict mode needs `strictRequired: false` for the M0 metadata schema's `fact` definition, as in `tests/schemas`.
**Explicit metadata (follow-up):** `packages/analyzer/test/analyzer.test.ts` passes — the dynamic fixture's `@mote-metadata` JSON supplies the spread, computed-key, and computed-default properties; they merge into CEM, appear in `mote.metadata.json` `authored` with their source file, the class's dynamic warnings become `info`, and both outputs still validate.

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

**Findings:** (1) A test element named its handler `remove`, shadowing `Element.remove()`; the type check (`noImplicitOverride`) caught it. Worth a note in authoring docs: instance members on a `MoteElement` share the `HTMLElement` namespace. (2) No core behavior changes were needed: the failure contract held as documented.

## 2026-10-17 — M3 `props()` assessment

| Check | Command | Result |
| --- | --- | --- |
| Prototype contract | `npx vitest run research/experiments/props` | Pass in Chromium, Firefox, WebKit (5 tests): declared keys set from a configuration object; unknown keys and native handler names (`onselect`) reported as `props.key.unknown` and skipped; readable values update without re-running the parent render; removed keys reset to declared defaults; pre-upgrade values replayed (keys unchecked before definition); precedence with an explicit `.label` binding is order-dependent (last change wins), so that contract row is **not met** |
| Cost | esbuild bundle of the helper with core external | 662 B gzip (1,102 B minified) |

**Outcome:** not added to `@mote/core` for M4–M7; the decision stays at M8 (`research/experiments/props/README.md`, data-composition.md §2).

## 2026-10-17 — M3 `@mote/workbench` DOM-free entries

| Check | Command | Result |
| --- | --- | --- |
| Page registry | `npx vitest run --project node packages/workbench/test/pages.test.ts` | Pass (12 tests) — from the analyzer's real core-counter CEM and enrichment: schema-valid registry, components from CEM, summaries from descriptions, fallback group, Foundations kept as an unavailable destination with no invented pages, Theme Studio partial and never a card. From an independent Acme fixture (enrichment validated against `mote-metadata.v1`): spacing partial with authored `visible: true` unable to show a section without data, a foundation with no data hidden, categories from config and enrichment ordered, prefix-stripped titles, enrichment and authored dates only (unknown dates omitted), page aliases, unknown page and section diagnostics, Products in Foundations and primary navigation. Standard-CEM-only libraries get partial components. Deterministic; ids stable across base-path and route changes; Products absent by default and hidden when empty; invalid config gives diagnostics and no registry. Projections: primary navigation, grouped sidebars, cards, search, On this page (two or more sections), history/hash hrefs, legacy redirects keeping share state, static redirect stubs |
| Config | `packages/workbench/test/config.test.ts` | Pass — defaults; agreement with `workbench-config.v1` on its valid and invalid examples; the Playground key explained; eight diagnostics with paths; `defineDocs` output valid against `docs-content.v1` |
| Examples | `packages/workbench/test/examples.test.ts`, `examples.types.ts` (type check) | Pass — frozen definitions; `examples.v1` output with fixtures reduced to `hasFixture`; unknown props, slots, and names reported against the analyzer's CEM; TypeScript rejects unknown keys, wrong value types, and methods for registered tags |
| DOM-free and packed | `npm run lint:boundaries`, `npm run verify:packs` | Pass — `./examples`, `./config`, `./pages` import in Node without DOM globals; the tarball installs and its subpath entries import and typecheck in a consumer |

**Findings:** (1) `mote-metadata.v1` stores `library.prefix` with its trailing hyphen and example references as component ids (`component:<tag>`); the registry accepts both forms. (2) A Products page placed in both Foundations and primary navigation must belong to the Foundations section to appear in its cards and sidebar. (3) `verify-packs` assumed every package had a root entry; it now checks subpath-only packages. (4) As the suite grew, a process-spawning CLI test exceeded 5 s on a busy machine; it now has the analyzer's 30 s budget.
