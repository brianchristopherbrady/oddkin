# Change impact, conformance, explanation, and reproduction

Status: **proposal**. Nothing in this document is implemented unless §1 says so. Decision record: [ADR 0034](./decisions/0034-change-impact-and-conformance.md). Planned work: [IMPLEMENTATION_PLAN.md](../../IMPLEMENTATION_PLAN.md) §5h.

**Objective.** Mote helps teams author and customize components, understand why they behave and appear as they do, assess the consequences of changes, and verify that supported customizations preserve required behavior.

**Intended outcome.** Teams can customize shared Mote components, determine which products a change may affect, run the relevant verification, inspect supported explanations, and export reproducible failures, all through one coherent set of contracts and optional tools.

These are optional development capabilities built from existing sources through typed relationships. There is no second analyzer, token engine, reactive engine, component registry, or documentation catalog. Production runtime size, startup, dependencies, and package boundaries are unchanged; the size budgets (ADR 0031) and boundary checks enforce this.

## 1. Sources reused

| Source | Status today | Used for |
| --- | --- | --- |
| Analyzer metadata (CEM + `mote.metadata.json`, stable ids, provenance) | Implemented (M3) | Contract snapshots, identity matching, definition → module edges |
| Token generator + inspection JSON (aliases, origins, re-declaration sets) | Implemented (M2) | Token snapshots, alias edges, styling explanations |
| Recipe descriptions (`describeRecipe`) and recipe metadata | Implemented (M3) | Recipe and condition edges |
| `defineExamples` / `examples.v1` / `checkExamples` | Implemented (M3, DOM-free) | Example identity, fixtures, verification selection |
| `scopeStats()` (counts of live scopes and owned work) | Implemented (M3) | Ownership baselines; no per-instance records yet |
| Stable `MoteError` codes and development/production builds | Implemented (M3) | Diagnostics in reports and explanations |
| Playwright and Vitest browser runners, size checks, packed-consumer checks | Implemented (M1–M3) | Executing selected checks, screenshots, clean-directory verification |
| Composition API (`compose()`, `define(definition)`, `extends`) | Implemented (M4, ADR 0036) | Definition edges, recomposed implementations under test |
| Portable conformance: `conformance.v1`, `conformance-result.v1`, `@mote/workbench/conformance`, `./conformance/button`, `./testing` (`runConformance`) | **Prototype implemented** (M4) | §3; accepts `mote-button`, `studio-button`, and an alternative-template button; rejects 5 mutants in three engines |
| `mote analyze --compare`, Workbench previews, share payload, `runExample`, product configurations, agent operations | **Planned** (M5–M11) | Extended here |
| Reactive dependency and per-scope ownership records | **Not implemented**; proposed development-only instrumentation (§4.2) | Runtime explanations |

Static dependency facts (*extracted*), authored guidance (*authored*), runtime observations (*observed*), and verification evidence (*verified*, with conditions) stay distinguishable in every output.

## 2. Change impact

### 2.1 Comparison snapshots

A `comparison-snapshot.v1` manifest references existing artifacts by content hash rather than copying them:

- public component contracts and package exports (CEM, `mote.metadata.json`, `package.json` `exports`);
- definitions, foundation relationships (`extends`), and dependencies;
- templates, styles, and declared customization and anatomy contracts (by source reference and hash);
- token definitions, aliases, resolved values, and provenance (token inspection JSON per theme);
- recipe regions, variants, profiles, and conditions;
- product configurations and component-family mappings;
- examples, fixtures, and conformance suites with their versions;
- package, schema, generator, and analyzer versions.

**Identity matching.** Items match by stable id (`component:<tag>`, `property:<tag>#<name>`, `token:<name>`, `recipe:<name>`, `example:<tag>/<name>`, definition and product ids). A rename is reported as a rename **only** when an authoritative identity or migration record says so: a `@renamedFrom` declaration, a token deprecation with a replacement, a product id alias, or a migration entry. Otherwise it is reported as an addition plus a removal, optionally with an *unresolved possible rename* note; the note is never treated as a match.

Snapshots with incompatible schema major versions are not compared item by item. The report states this and falls back to full verification.

### 2.2 Change categories

- Public API (properties, attributes, events, methods, slots, parts, CSS properties, custom states, exports).
- Registration and dependency.
- Anatomy and supported customization.
- Token name, type, unit, alias, and value.
- Recipe, condition, profile, and layout.
- Selected product implementations and component families.
- Visual differences (from screenshots).
- Observed interaction regressions (from executed checks).
- Metadata-only or documentation-only changes, where determinable.

Each change is classified **incompatible** (a definite contract incompatibility: a removed export, property, event, slot, part, or registration entry; a narrowed type; a removed token; a changed token type or unit), **review** (needs human judgment: token value changes, default changes, visual differences, anatomy edits), or **informational**. A token value change is never mapped automatically to a semantic-version increment. Only definite incompatibilities carry a suggested impact, as the planned `--compare` already does.

### 2.3 Dependency traversal

| Edge | From → to | Provenance |
| --- | --- | --- |
| Definition parts | Definition → class, template, structural styles, visual styles, dependencies | extracted |
| Foundation | Derived definition → foundation definition | extracted |
| Token reads | Style module → token / component variable | extracted (potential: a read does not prove rendered effect) |
| Aliases and re-declaration | Token → alias tokens; scope → re-declared closure | generator (declared) |
| Recipes | Recipe → regions, conditions, profiles; component → recipe | extracted |
| Products | Product → component family → definitions; product → theme config and overrides | configuration |
| Examples | Example → component, definition, product, fixtures | authored (`defineExamples`) |
| Suites | Conformance suite → contract → definitions it targets | authored + extracted |

- Every edge keeps its provenance and whether its source was complete.
- Traversal works on available sources, installed packages, supplied metadata, and explicit product manifests. A report never claims coverage of repositories it could not read; it lists them as coverage gaps.
- **Unknown or dynamic dependencies** (`analyzer.dynamic.*`, unresolved imports, external CSS) stay visible as unresolved edges and widen verification (§2.5).

### 2.4 Verification selection and states

Impact information selects examples and checks. Every selected item ends in exactly one state:

| State | Meaning |
| --- | --- |
| `selected` | Chosen for verification; not yet run |
| `passed` | Executed and passed (with browser, configuration, and suite version) |
| `failed` | Executed and failed (with assertion and diagnostic) |
| `reused` | Baseline result reused because no input on its path changed; the baseline's conditions are listed |
| `not-executed` | Selected but not run (skipped, filtered, or environment unavailable) |
| `unresolved` | Could not be decided (unsupported, missing inputs) |

An untested example is never shown as passing.

### 2.5 Conservative fallbacks

| Situation | Selection |
| --- | --- |
| Shared configuration changed (preset, base theme, structural styles, core or generator version) | All dependents of that input across every product in scope |
| Ambiguous or dynamic dependency | Every example of the affected package |
| Incompatible snapshots | Full verification; no reuse |
| Missing baseline | Execute; never reuse |
| Analyzer, generator, schema, or browser version changed | Reused results invalidated for affected checks |

### 2.6 Reports and visual baselines

An `impact-report.v1` JSON document, plus a readable Markdown rendering, serves the CLI, Workbench, agent operations, and CI artifacts. It contains:

- compared revisions and versions;
- changed contracts and values;
- affected products, definitions, and examples, each with the reason (edge path) for inclusion;
- known coverage gaps;
- executed checks and their conditions;
- API, visual, and interaction differences;
- source references and reproducible example links (§5).

Generation runs locally. It needs no hosted service and never publishes anything.

Visual differences reuse Playwright screenshot assertions. Baselines are files keyed by example id, configuration hash, browser, and browser version. They are updated only by an explicit accept command that lists the differences being accepted; current output is never silently accepted as a new baseline.

**Ownership.** Snapshot creation, comparison, traversal, and selection live in `@mote/analyzer` (Node; extends the planned `compare`). Execution uses the project's existing Vitest/Playwright runners. Report rendering is shared by the CLI, the Workbench verification view, and `@mote/agent`.

## 3. Portable conformance suites

Libraries publish reusable verification suites for supported component contracts. A consuming team runs a foundation's suite against its customized implementation through a documented adapter.

### 3.1 Contract and adapter

A `conformance.v1` suite declares:

- the behavior being verified and the component contract version it targets (foundation definition id + version range);
- required public capabilities (properties, attributes, events, methods, slots, anatomy roles);
- supported fixtures and setup (example ids or owned fixture hooks using the existing fixture/`Scope` contract);
- adapter requirements;
- assertions and expected outcomes;
- environmental conditions (engines, direction, preferences).

Adapters reach the implementation only through public properties, events, methods, slots, accessible relationships, and deliberately supported targets (documented parts and anatomy roles). Tests never depend on private class names or incidental DOM unless a documented anatomy requirement makes that structure contractual. A default adapter is derived from the anatomy contract; custom implementations supply overrides. Suites contain no mandatory state-machine DSL and no second component implementation.

### 3.2 Assertions and invariants

**Assertions** are written by authors. Metadata alone cannot infer correct interaction or accessibility behavior. They cover:

- property and attribute behavior;
- event payloads, propagation, cancellation, and ordering;
- keyboard interaction;
- focus movement and restoration;
- disabled, loading, invalid, and other supported states;
- native form integration;
- reconnection and cleanup;
- controlled and uncontrolled use.

**Invariants** relate a *declared change* to what must survive it:

- a theme-value change preserves an input's value and caret;
- a density change preserves selection;
- programmatic updates emit no user-intent events;
- keyed reordering preserves identity and focus;
- reconnection does not duplicate owned work (`scopeStats()` baseline);
- an invalid theme draft preserves the last valid preview and its instances.

Each invariant names its change kind, and identity invariants apply only to value changes: a legitimate structural replacement (ADR 0030, multi-product.md §6) is never required to preserve a removed node.

### 3.3 Coverage and evidence

- **Targets:** default Mote components, product-specific visual implementations, supported alternative templates.
- **Settings:** relevant theme, density, direction, viewport, and container settings, plus reduced motion, forced colours, and font-size preferences where applicable.
- **Products:** configurations with 1, 2, 3, and 10 products. Coverage is representative, with targeted checks for declared differences, never an automatic product of every axis.
- **Mutants:** each suite ships intentionally broken implementations it must reject (e.g. a button not activatable by keyboard, an input emitting `input` on programmatic writes, a list losing focus on reorder) and legitimate customized implementations it must accept (e.g. `studio-button`).
- **Evidence:** a `conformance-result.v1` record names the suite id and version, the implementation (definition id, package@version), the configuration hash, the browser and version, and the date. Automated results and manual accessibility evidence are recorded separately; passing a suite is not accessibility certification.

### 3.4 Distribution

| Entry | Contents | Environment |
| --- | --- | --- |
| `@mote/workbench/conformance` | `defineConformance`, contract/adapter/result types, serialization (DOM-free) | any |
| `@mote/workbench/testing` | `runConformance` (implemented) and `runExample` (planned). The runner's `expect` and user-input API are passed in, so the entry imports no test framework | browser test runner |
| `@mote/workbench/conformance/<component>` | Mote's suites for its own components; implementation-agnostic (tag, public properties, native events, documented anatomy roles). Implemented: `./conformance/button` | any (DOM touched only when run) |

- Workbench already depends on components, so Mote's suites live there; `@mote/components` never imports Workbench.
- Third-party libraries publish suites from their own development entry.
- Ordinary component imports include no runner, assertion library, browser automation, or adapter.
- A suite's version is tied to the foundation contract version it targets.

## 4. Component explanations

One optional workflow connects a selected preview element to what Mote can actually explain, using one `explanation.v1` model for Workbench, CLI operations, and agent/MCP interfaces. Agents receive the same uncertainty and provenance shown to developers.

### 4.1 Styling

For a selected component or supported part, where available:

- observed computed value;
- source-unit token value;
- component variable and semantic role;
- alias chain;
- product, theme, mode, density, or profile context (from ancestor scope attributes);
- relevant configured override;
- known recipe or condition relationship;
- source and configuration reference;
- provenance and limitations.

Rules:

- Relationships stay labelled *declared*, *potentially relevant*, or *observed*. Mote never claims a complete CSS cascade reconstruction from token metadata, and it reports ordinary external CSS, unreadable or cross-origin stylesheets, closed or unsupported roots, and missing source maps as limitations.
- A responsive condition is reported as **active** only with reliable observation: `matchMedia` for media conditions, or verified instrumentation for container conditions (a candidate is a generated probe property inside the condition rule, adopted only after three-engine verification). Otherwise its state is unknown. No JavaScript responsiveness emulation.
- Measurements run only in an explicit inspection action, never during ordinary binding commits (core contracts forbid hidden layout reads).

### 4.2 Runtime

Where instrumentation supports it:

- whether an update used render-level tracking or a direct binding;
- relevant readable and property dependencies;
- scheduling and commit information;
- the `Scope` owning a listener, effect, request, or controller;
- whether owned work is active, cancelled, superseded, suspended, or disposed;
- relevant diagnostics and source references.

Cancellation (aborted with a reason), supersession (a newer generation replaced it), stale-result rejection (a late completion ignored), suspension (page frozen; [core-contracts.md](./core-contracts.md) §9.1), and disposal (scope ended) stay distinct. Mote never invents causal histories for work it did not observe.

**Instrumentation:**

- a development-only core entry (proposed `@mote/core/inspect`, resolved only under the `development` export condition) that records, per enabled root, bounded ring buffers of commits and ownership changes;
- opt-in per preview or development session, owned by that session's `Scope`, removable, and bounded;
- no duplicate reactive graph: records are taken from the existing graph at commit time;
- stale references are invalidated when instances, frames, registrations, or source versions change;
- absent from production builds and ordinary consumer graphs, which size and import-graph checks verify; overhead is measured (§6).

## 5. Runnable reproductions

Two artifacts stay distinct:
- a **share link** (`share-payload.v1`) reproduces preview settings;
- a **runnable reproduction** is a project or fixture directory with declared dependencies and setup.

A `reproduction.v1` manifest covers supported inputs:

- package versions and public import paths;
- component definition and example identity;
- foundation and product implementation references;
- theme and product configuration;
- supported property and slot inputs;
- fixture ids and parameters;
- viewport and container dimensions;
- direction and relevant preferences;
- supported interaction steps;
- expected and observed outcomes;
- failing assertions or diagnostics;
- browser and environment information;
- known limitations.

Rules:

- **Only declared representations travel.** Functions, services, external stores, network state, files, private dependencies, and arbitrary application state need declared adapters or setup instructions; they are listed explicitly, never silently stringified or dropped.
- **Repeatability, not replay.** Fixture inputs are deterministic and timing is controlled where the test infrastructure supports it. Repeatable fixture execution is distinguished from exact replay of an arbitrary browser session.
- **Pinned sources.** Source references resolve against the captured version. Unavailable private dependencies, assets, fonts, services, or external setup are reported.
- **No repository copy.** Exports never copy a whole repository or dependency tree. They use public exports and normal package resolution without workspace aliases.
- **Ownership:** export is a Workbench Node command (`mote workbench repro export`) and an agent operation. It writes only to the chosen output directory, preserves authored files, and never publishes, deploys, or sends anything. Generation and replay stay outside ordinary component imports.
- **Verification:** representative exports run their declared failing scenario in a clean directory from packed or version-pinned packages.

## 6. Prototypes, priority, and measures

Priority:
1. Portable interaction verification.
2. Change-impact reporting.

Both are prototyped on one real interactive foundation (`mote-button`) and customized implementations before any public tooling is generalized. Explanation and reproduction follow from the proven contracts.

| Prototype | Developer task improved | Inputs | Authoritative | Unknown | Minimal acceptance | Cost | Owner / milestone | Expand, revise, or defer when |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Conformance | "Does my product button still behave like the foundation?" | Button foundation, anatomy contract, examples, `studio-button`, mutants | Authored assertions; public contracts | Behavior not asserted; manual AT results | Suite accepts default + `studio-button`, rejects every mutant, in three engines; results recorded with conditions | Dev-only entry; test time | `@mote/workbench/conformance` + `./testing` · M4 | Expand to input and editable list if false-failure rate is zero on legitimate variants; revise the adapter if overrides are needed per variant |
| Change impact | "Which products and examples does this change affect, and what must I run?" | Two snapshots of analyzer outputs, token inspection, examples, 1/2/3/10-product fixtures | Stable ids, extracted edges, generator graph | Dynamic deps, external CSS, unavailable repos | Known-answer fixtures: no missed dependency; every unresolved edge widens selection; states correct | Node CLI time; snapshot size | `@mote/analyzer` · M5 (evidence at M8) | Expand to visual baselines and products when known-answer misses are zero; defer product traversal if product metadata is incomplete |
| Styling explanation | "Why is this button this colour here?" | Preview frame, token inspection, metadata, scope attributes | Generator provenance; computed style (observed) | External cascade; container-condition state | Correct chain for fixture overrides in nested product scopes; limitations listed | Inspection action only | `@mote/workbench` · M9 | Expand to recipes once condition observation is verified |
| Runtime explanation | "Why did this re-render, and who owns this listener?" | Dev-only core records | Recorded commits and scopes | Unrecorded work | Records match known fixtures; zero production bytes; bounded memory | Measured overhead in dev builds | `@mote/core/inspect` + Workbench · M11 | Defer if overhead or size checks fail |
| Reproduction | "Send a failing case someone else can run" | Share payload, example, fixture, versions | Example and fixture definitions | Undeclared services and state | Representative failures re-fail in a clean directory from packed packages | Node export | `@mote/workbench` Node + agent · M11 | Expand fixture adapters from real reports |

**Measures:**
- incorrect impact predictions and missed dependencies in known-answer fixtures;
- false-positive conformance failures on legitimate customizations, and missed mutants;
- stale explanation records after instance, frame, registration, or source changes;
- reproduction success rate in clean directories;
- tool-output size;
- instrumentation overhead (development builds) and zero production bytes.

Research: [Chromatic TurboSnap](https://www.chromatic.com/docs/turbosnap/), [Storybook testing](https://storybook.js.org/docs/writing-tests), [Playwright assertions](https://playwright.dev/docs/test-assertions), [Zag introduction](https://zagjs.com/overview/introduction), [Zag styling, parts, and states](https://zagjs.com/guides/styling), [APG](https://www.w3.org/WAI/ARIA/apg/), [WCAG 2.2](https://www.w3.org/TR/WCAG22/), [Chrome DevTools CSS reference](https://developer.chrome.com/docs/devtools/css/reference), [CSS custom properties](https://www.w3.org/TR/css-variables-1/), [Custom Elements Manifest](https://github.com/webcomponents/custom-elements-manifest), [Storybook AI manifests](https://storybook.js.org/docs/ai/manifests) (preview; React, Angular, and Vue frameworks only) — register R26, R30, R33, R47–R52, and R55. These are prior art and references; comparative claims need measured evidence.
