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