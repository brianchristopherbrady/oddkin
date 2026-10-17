# Mote Implementation Plan

Mote is an original, modular frontend framework built on custom elements and browser APIs. It includes a reusable design system, an independent token pipeline, optional application services, optional developer tooling (analyzer, Workbench with Theme Studio, agent tooling), and a separate documentation application that consumes the published packages. Public names: `@mote/*`, `<mote-*>`, `--mote-*`.

The aim is to make correct, maintainable components easy to write and easy to document: clear ownership, predictable state, stable DOM, simple cancellation, accessible behavior, useful defaults, and documentation generated from the real contracts. Performance and usability improvements are **hypotheses to verify**, not claims established by this document.

**Developer assurance objective.** Mote helps teams author and customize components, understand why they behave and appear as they do, assess the consequences of changes, and verify that supported customizations preserve required behavior. Intended outcome: teams can customize shared Mote components, determine which products a change may affect, run the relevant verification, inspect supported explanations, and export reproducible failures through one coherent set of contracts and optional tools (§5h). These capabilities are optional development tooling; production runtime size, startup, dependencies, and boundaries are unchanged.

**Legend:** `[ ]` todo · `[x]` implemented **and** verified · `[~]` in progress · `[!]` blocked (add note). A milestone is complete only with its acceptance evidence. Once the workspace exists, every milestone leaves packages buildable and the current docs/Workbench slice runnable; before the docs slice exists, keep a working plain-HTML consumer.

### Documents

| Document | Role |
| --- | --- |
| **This plan** | Single source of truth for scope, milestones, and acceptance |
| [docs/architecture/packages.md](./docs/architecture/packages.md) | Package boundaries, dependency map, entry points |
| [docs/architecture/core-contracts.md](./docs/architecture/core-contracts.md) | Authoring, lifecycle, `Scope`, reactivity, templates, stores, resources, router |
| [docs/architecture/theming-and-styling.md](./docs/architecture/theming-and-styling.md) | Theme config, token pipeline, spacing, scopes, outputs, styling, layout roles/conditions/profiles |
| [docs/architecture/layout-recipes.md](./docs/architecture/layout-recipes.md) | Layout recipes, helpers, precedence, container-responsive rules, side-nav fixture |
| [docs/architecture/data-composition.md](./docs/architecture/data-composition.md) | Component data models, collections, hybrid composition, model validation/schema, optional composition schema |
| [docs/architecture/metadata-and-analyzer.md](./docs/architecture/metadata-and-analyzer.md) | `@mote/analyzer`, normalized metadata model, CEM + enrichment outputs, provenance |
| [docs/architecture/workbench.md](./docs/architecture/workbench.md) | `@mote/workbench`: controls, isolated iframes, Theme Studio behavior, `defineExamples`, CLI |
| [docs/architecture/workbench-pages.md](./docs/architecture/workbench-pages.md) | Workbench information architecture: page registry, shell, Foundations, Components (docs + interactive example), Theme Studio destination, optional Products and modes, content layers |
| [docs/reference/design-system-lab-audit.md](./docs/reference/design-system-lab-audit.md) | Rendered-browser audit of the reference application's structure and presentation |
| [docs/architecture/agent-tooling.md](./docs/architecture/agent-tooling.md) | Optional dev-only `@mote/agent`: generated agent kits, project context and freshness, shared contracts, operations (CLI/MCP), diagnostics, preview feedback, evaluation |
| [docs/architecture/multi-product.md](./docs/architecture/multi-product.md) | Multi-product design systems: product identity and scale, layered component exports, recomposition, customization ladder, anatomy contracts, component families, distribution, scope isolation, verification |
| [docs/architecture/change-impact-and-verification.md](./docs/architecture/change-impact-and-verification.md) | Comparison snapshots and change impact, verification selection and states, portable conformance suites, component explanations, runnable reproductions, prototype priorities |
| [docs/research/synthesis.md](./docs/research/synthesis.md) | Ecosystem research, conclusions, differentiation thesis, legacy source register plus direct research links in §12 |

All API examples in these documents are proposed contracts, not existing exports.

---

## Current state (2026-10-17)

- **Status from repository evidence** ([verification log](./docs/verification.md); `npm run verify` runs lint, boundaries, typecheck, unit and three-engine browser tests, size budgets, e2e, and packed consumers):
  - **M0** — architecture drafts, ADRs 0001–0030, and draft JSON Schemas done; source register mapping, reference audit, rubric, per-library write-ups, and the reference inventory remain (`[~]`/`[ ]`).
  - **M1** — workspace, enforced boundaries, dev/prod builds, and packed-consumer checks implemented and verified; remaining verification: `dev` script (M5), a CI run on a remote, licence and npm scope, axe integration (M4); two `[~]` items (DOM-entry side-effect check, helper entries before colocated examples) await re-verification now that the M3 entries exist.
  - **M2** — `@mote/tokens` implemented and verified: `ThemeConfig`, the canonical generator, CSS scopes with alias-closure re-declaration, `refs`, `values`, conditions, profiles, inspection JSON, CLI, Worker parity, CSS-only consumer. Remaining: condition-threshold invalidation linked to the side-nav preview (M4). Sass and DTCG outputs are planned.
  - **M3** — complete: `@mote/core` (reactive, scope, element incl. `define`, template, styles, layout recipes, collections, models, helpers, diagnostics, dev/prod builds with size budgets), `@mote/analyzer` (CEM + `mote.metadata.json`, no execution), `@mote/workbench` DOM-free `./examples`, `./config`, `./pages`, benchmarks and walkthroughs.
  - **M4–M12** — planned. `@mote/components`, `@mote/state`, and `@mote/app` are skeletons with root entries only; the Workbench shell, Theme Studio, docs app, and `@mote/agent` do not exist yet.
- **Status vocabulary:** *implemented and verified* (`[x]` with a verification entry) · *implemented with remaining verification* (`[~]`) · *planned* (`[ ]`) · *experimental* (`research/experiments`, e.g. the `props()` assessment) · *explicitly deferred* (§9). Capabilities added by later planning passes — composition API and component folders (§3.3), agent kits (§5e), multi-product foundations (§5g), change impact, conformance, explanation, reproduction, and page suspension (§5h) — are planned; none is implemented.
- Desk research (§1) is complete. Executable comparisons, the reference-site audit (including the reference Theme Studio), and usability studies are implementation tasks.
- The docs site is devoted to Mote. A separate personal portfolio may link to it; portfolio pages, résumé routes, and employer review paths are out of scope.
- Authority: this plan governs scope and sequencing; the architecture documents govern their detailed contracts; [synthesis.md](./docs/research/synthesis.md) governs source identities (R01–R55). Disagreements are resolved explicitly, not left implicit. §12 is the direct-source reading map.
- Reference audit: every primary Design System Lab route was inspected in a rendered browser on 2026-10-17, including Theme Studio interactions, dark mode, and basic keyboard landmarks ([audit](./docs/reference/design-system-lab-audit.md)); detailed component pages, screen-reader output, forced colors, zoom, and screenshots remain.
- Unverified: the CVD simulation source. The reference states it uses the Machado, Oliveira and Fernandes (2009) model; the linked author page must still be read and the method verified before Mote adopts it (M0/M9).

---

## 1. Research synthesis (summary)

Full table and sources: [docs/research/synthesis.md](./docs/research/synthesis.md). Reviewed: Lit, FAST, Web Awesome/Shoelace, Spectrum WC, Material Web, UI5 WC, Stencil/Ionic, React, Angular, Vue, Svelte, Solid.

1. **Ownership is the central abstraction.** One `Scope` owns listeners, timers, effects, observers, subscriptions, and child work. Connections, effect runs, and requests have different lifetimes.
2. **One reactive model** for local signals, public properties, store selectors, context, and resources.
3. **Targeted updates are ordinary.** Cached static templates, concrete binding parts, preserved node identity.
4. **The default authoring path is small** — base class, signal, template, registration. No provider, reducer, decorator transform, compiler, or theme generator required.
5. **A complete system through optional modules** that share one ownership protocol; components remain usable from any framework.
6. **Delivery and documentation are framework features** — exports, no-build examples, errors, metadata, generated docs, migrations, token tooling.
7. **Prove improvements** with reproducible evidence, including unfavorable results.

**Differentiation thesis:** a coherent combination of an understandable browser-based authoring core, explicit automatic cleanup, binding-level reactivity, first-class token tooling, documentation and Theme Studio generated from real contracts, and optional application services with compatible semantics. The ideas exist individually elsewhere; implementation and evidence must establish the value of the combination.

---

## 2. Product and package contracts

### 2.1 Packages and dependencies

| Package | Responsibility | Internal deps |
| --- | --- | --- |
| `@mote/core` | Reactive primitives, `Scope`, element lifecycle, templates, styles, layout recipes, collections, models, registration | none |
| `@mote/tokens` | Theme config, pure generation, CSS/SCSS/JSON/TS outputs, CLI | none |
| `@mote/state` | Stores, selectors, context, persistence, inspection | core |
| `@mote/app` | App lifetime, router, resources, optional Node scaffolding | core, state |
| `@mote/components` | Accessible, themed custom elements, Mote layout presets, component models, published CEM + enrichment | core, tokens |
| `@mote/analyzer` (optional, dev-only, Node) | Static analysis → normalized metadata → CEM, `mote.metadata.json`, Workbench indexes, editor and agent outputs; comparison snapshots and change impact (planned, §5h) | tokens (Node/DOM-free), core (DOM-free model types); compiler/parser dependencies confined to Node tooling |
| `@mote/workbench` (optional tooling) | Reusable metadata-driven documentation shell (Foundations, Components with integrated interactive examples, Theme Studio, optional Products and modes), page registry, isolated previews, `defineExamples`, `mote` CLI; portable conformance suites, explanations, and reproductions (planned, §5h) | browser: core, tokens, components; state/app integrated only after M6–M7; Node: analyzer, tokens/node; DOM-free examples/config entries independently buildable |
| `@mote/agent` (optional, dev-only, Node) | Project context, generated agent kits (entry guide, references, JSON, optional Agent Skills / `AGENTS.md` / `llms.txt` packaging), deterministic operations, CLI, optional MCP adapter | analyzer (API), tokens |
| `apps/docs` (private) | Product docs, tutorials, migrations, architecture; embeds Workbench panels | core, state, app, tokens, components, workbench panels — public exports only |

**Forbidden:** core → tokens; tokens → any Mote package; components → state/app/analyzer/workbench/agent; any browser package, ordinary component consumer, or the docs runtime → `@mote/analyzer` or `@mote/agent`; ordinary component consumers → `@mote/workbench`; reverse deps; cycles; cross-package source aliases. Core is unbranded and works without Mote tokens.

**Runtime dependencies:** none from third parties in shipped browser code (browser packages, the Workbench browser bundle, the deployed docs app, published static Workbench builds). Node-only tooling (`@mote/analyzer`, `@mote/agent`, Workbench CLI/dev server) may use third-party tools (TypeScript compiler, Vite, test runners, Sass for fixtures). These are development tools for Mote consumers; a dependency needed when running an installed CLI must be bundled, declared in that tooling package’s `dependencies`, or supplied through a documented peer contract. Do not place a required CLI dependency only in unpublished `devDependencies`. Research/integration fixtures may install competing frameworks outside shipped code.

### 2.2 Import surfaces

Entry points per [packages.md](./docs/architecture/packages.md). Rules:

- Subpaths are created when implemented; a list of empty exports is not a delivered feature.
- `core/reactive`, `core/scope`, `core/layout`, `core/collections`, `core/model`, `state/store`, token browser entries (`theme`, `generate`, `refs`, `values`, `conditions`), and `workbench/examples`, `workbench/config`, `workbench/pages`, `workbench/content`, and the planned `workbench/conformance` are DOM-free. DOM-free is **not** an SSR renderer. The planned `core/inspect` entry resolves only under the `development` export condition and never appears in production graphs.
- Only explicit Node entries import `node:*`. Importing a class never defines an element; only `define` entries have registration side effects.
- Browser exports work from native ESM/import maps and packed tarballs without workspace aliases or a Mote build plugin.
- `package.json` of element packages declares `"customElements"`.

### 2.3 Developer questions the docs must answer

What does Mote provide? · Which packages do I need? · How do I install and use them? · How do I create a theme or component? · How do I lay out a component or page? · How do I build an application? · How do I document my own component library? · How do I adopt Mote incrementally? · How do I get my IDE agent to use Mote correctly? · How do I generate accurate agent support for my own library?

---

### 2.4 Capability ladder and supported integrations

Keep five independent entry paths explicit: tokens/CSS only; consume components in any app; author unbranded custom elements with core; opt into Mote state/application services; document a library with Workbench. Each path gets a minimal install, a plain-JavaScript example, a TypeScript example where relevant, and a packed-consumer verification.

- [ ] Keep recipes, collections, model validators/schema emitters, persistence, inspection, and tooling out of the core counter and component-consumer graphs unless imported. Package ownership does not imply that every feature belongs in the root barrel.
- [ ] Define a small interoperable readable/subscription contract with deterministic teardown. Document how external stores can connect without introducing a second Mote graph or requiring Mote stores.
- [ ] Generate opt-in event, tag-name, JSX, and editor declarations from the same contracts where each target supports them. Keep framework-specific declarations/adapters separate; native DOM compatibility does not automatically provide typed JSX or framework form integration.
- [ ] Cover rich object properties, event casing/detail, initial property detection, pre-definition values, remounts, and framework forms in pinned integration fixtures. Start with [React custom elements](https://react.dev/reference/react-dom/components#custom-html-elements), [Angular CUSTOM_ELEMENTS_SCHEMA](https://angular.dev/api/core/CUSTOM_ELEMENTS_SCHEMA), [Angular ControlValueAccessor](https://angular.dev/api/forms/ControlValueAccessor), [Vue](https://vuejs.org/guide/extras/web-components), and [Svelte](https://svelte.dev/docs/svelte/custom-elements).

### 2.5 Compatibility and version coexistence

- [ ] Publish a feature-by-feature browser/AT baseline, including fallbacks or explicit unsupported behavior for custom states, form association, adopted stylesheets, move-preserving DOM APIs, scoped registries, and query syntax. A standards draft is not evidence of shipped cross-browser support.
- [ ] Registration is idempotent only for the same compatible definition. Never silently accept a different constructor/version already registered under the same name. Diagnose conflicts, document one-global-tag-set limits, and use isolated frames for incompatible Workbench versions. Custom prefixes are not a promise that an arbitrary constructor can be registered twice or its internal dependencies automatically renamed.
- [ ] Test two independently built consumers and compatible duplicate core installations; define which public protocols cross package copies/realms and which require matching versions. Avoid undocumented global singletons and `instanceof` assumptions at interoperability boundaries.
- [ ] Define compatible version ranges and migrations across packages, token outputs, CEM/enrichment, config, examples, share payloads, and frame protocols. Use released artifacts for compatibility checks, not only workspace sources.

Research: [custom-element registration](https://html.spec.whatwg.org/multipage/custom-elements.html#dom-customelementregistry-define), [Node package exports](https://nodejs.org/api/packages.html), and the platform references in §12.3.

---

## 3. Authoring model (summary)

Detailed contracts: [core-contracts.md](./docs/architecture/core-contracts.md) §1–§6.

- **Counter** needs `MoteElement`, `signal`, `html`, `define`. `${this.count.value}` inside `render()` tracks a render-level dependency (render re-runs, deduplicated); `${this.count}` binds the part directly without re-running `render()`. Both use the same engine.
- **Properties** via `MoteElement.with({ name: prop.string({...}) })` — typed, decorator-free, normal DOM accessors, metadata from the same definition (statically analyzable).
- **Lifecycle:** constructor (local initialization only; no external work) → `connected(scope)` → `mounted(scope)` → `updated(changes)` → `disconnected()`; plus `adopted`, `moved`, `updateComplete` with precise boundaries. Page suspension and back/forward cache restoration are not disconnects; application-level policy is an explicit `@mote/app` service (core-contracts.md §9.1, ADR 0035).
- **Scope:** `signal`, `listen`, `timeout`, `interval`, `add`, `child`, `effect`, `use`, `dispose`. No mirrored manual cleanup in normal code.
- **Reactivity:** synchronous `signal`/`computed`/`batch`; glitch-free; `Object.is` default; microtask-deduplicated commits; derivation → DOM → post-commit effects.
- **Interpretable APIs:** explicit definitions and dependencies, consistent terminology, strongly typed inputs and outputs in ordinary TS/JS/HTML/CSS, clear `Scope` ownership, one recommended approach per common task (alternatives with concrete reasons), and precise errors for ambiguous usage ([core-contracts.md](./docs/architecture/core-contracts.md) §1.2). Agent interpretability is a review criterion for every public API.
- **Templates:** text, attribute, `?bool`, `.prop`, `@event`, readables, nested templates; `when`, keyed `repeat`, `match`. No `eval` or implicit untrusted string-to-HTML conversion. Static tagged-template markup is parsed through an explicit CSP/Trusted Types-compatible path; dynamic strings become text by default. Strict CSP and Trusted Types tested.

### 3.1 Authoring semantics that must be explicit

- [ ] Implement and document the binding rule (settled):
  - `render()` executes synchronously within a reactive tracking context. Readable `.value` accesses during that execution — including synchronous helper calls — register render-level dependencies. Changes schedule a deduplicated render.
  - Readables passed directly into template bindings (`${this.count}`) subscribe at the binding level and update without rerunning the enclosing `render()`.
  - Primitive values are snapshots. Reading `.value` outside a tracked context establishes no subscription. Deferred event handlers and asynchronous callbacks do not inherit the render's tracking context.
  - Internal reads used to initialize direct bindings must not register render-level dependencies. When a dependency participates in both paths, scheduling coalesces the work and avoids duplicate DOM writes.
  - Public properties declared with `prop.*` are readables for this purpose: reading them in `render()` tracks them; tests cover both paths.
- [ ] Publish a binding-value matrix for empty/null/undefined/unset, text, attributes, properties, booleans, classes/styles, listeners, nodes, and SVG. Specify removal versus empty-string behavior and whether functions are callbacks, explicit derivations, or unsupported values; never silently guess.
- [ ] Specify when templates are created, mounted, updated, disconnected, resumed, and disposed; define node ownership and what happens when the same DOM node/template instance is supplied to multiple places. Document slot projection separately from generated child ownership.
- [ ] Publish ordering examples for property writes, attributes, `batch`, `computed`, DOM commits, effects, `updated`, and `updateComplete`. Define nested updates, errors, detached writes, and whether readiness includes child elements. `updateComplete` must not imply that fonts, layout, network resources, or paint have completed.
- [ ] Keep constructors free of network requests, global listeners, and connection-owned subscriptions. Allow legal local initialization and stable public property accessors so browser upgrades and framework property detection work.
- [ ] Make `Scope` examples cover external event targets, observers, timers, fetch signals, user-supplied signals, already-aborted signals, disposal during callbacks, and reconnect. A disposed connection gets a fresh scope; do not reuse an aborted signal. Distinguish cleanup, stopping observation, and cancellation of work that actually supports cancellation.
- [ ] If custom template helpers/directives or controllers are public, give them a small typed extension contract for binding identity, updates, ownership, and teardown. Add an extension point only after two real use cases; ordinary functions and native CSS remain sufficient for simple composition.
- [ ] Specify event target/currentTarget, retargeting, propagation flags, cancellation, and listener options. Public state notifications are distinguishable from user intent; programmatic property assignments must not accidentally create framework feedback loops.

Research: [Lit expressions](https://lit.dev/docs/templates/expressions/), [FASTElement](https://fast.design/docs/3.x/getting-started/fast-element/), [Solid fine-grained reactivity](https://docs.solidjs.com/advanced-concepts/fine-grained-reactivity), and [AbortController](https://dom.spec.whatwg.org/#interface-abortcontroller).

### 3.2 Failure handling and production diagnostics

- [ ] Define error ownership for property conversion, derivations, effects, render/commit, cleanup, example setup, lazy imports, and asynchronous commands. Decide propagation versus an explicit owner error hook/fallback. Preserve unrelated scopes and make retry/reset behavior testable; do not imply that a Scope can intercept every detached promise rejection or native callback error.
- [x] Use stable error codes and source/binding/phase context. Development diagnostics should explain a fix; production preserves essential failures without shipping full inspectors, source content, debug histories, or expensive validation by default. Test development and production builds. *(M3, ADR 0031: `development` → `dist/`, default → `dist/prod/`; production keeps `[code]`, behaviors and security checks; phase and owner are in the code (`element.<hook>.error`, `reactive.effect.cleanupError`) and `origin`; `packages/core/test/production.test.ts`.)*
- [ ] Provide opt-in bounded graph/lifetime inspection using existing ownership records rather than a second reactive engine. Keep logs, histories, caches, and observers bounded and removable.
- [ ] Batch writes and avoid hidden layout reads during binding commits. Any measurement helper must state its scheduling and cleanup; do not introduce preemptive scheduling or a compiler through this requirement.

---

### 3.3 Component composition and repository organization (planned — not yet implemented)

Mote's own component implementations use **one folder per component**, assembled through the **same public composition API** that consumers use. Consumers may keep colocated authoring (class, template, and styles in one module, as in `examples/core-counter` today); both paths are supported and stay exercised. No source files have been reorganized yet; the API and migration are M4 work (see M4 "Composition API and component folders").

```text
card/
  card.ts             element class: properties, state, methods, lifecycle
  card.template.ts    external template (type-only import of the host class)
  card.styles.ts      component styles
  card.definition.ts  compose(): class + template + styles + optional dependencies
  card.define.ts      explicit browser registration — the only file with side effects
  index.ts            side-effect-free public exports
```

```ts
// card/index.ts — never registers the component or its dependencies
export { Card } from './card.js';
export { cardDefinition } from './card.definition.js';

// card/card.define.ts — registration stays explicit
import { define } from '@mote/core/element';
import { cardDefinition } from './card.definition.js';

define(cardDefinition);
```

- Component-specific tests, examples (`card.examples.ts`), fixtures, and authored documentation live in or beside the folder where the repository's tooling supports it. Extra files are added only for a concrete purpose.
- `index.ts` exposes the supported public API and public types. Templates and styles are exported from it only when they are intentionally supported customization APIs.
- Files inside a component import their siblings directly, never through their own `index.ts`, which can create cycles. External templates use `import type` for their host class where appropriate.
- Package entries map onto the folders: `@mote/components/card` → `card/index.ts`; `@mote/components/define/card` → `card/card.define.ts`. Ordinary barrels never import a `*.define.ts` file.
- Recomposable components (§5g) add `card.structural.styles.ts` and a skin-free `foundation.ts` barrel reached through `@mote/components/card/foundation`; exporting a template or styles is a deliberate compatibility commitment.

## 4. State, resources, applications (summary)

Detailed contracts: [core-contracts.md](./docs/architecture/core-contracts.md) §7–§9.

- **Stores:** `createStore(initial)`, `update`, memoized `select`, read-only snapshots; optional action instrumentation; context, persistence, inspection as separate imports.
- **Resources:** inert construction; `scope.use(resource)`; source-driven generations with abort **and** generation guards; discriminated `idle | pending | success | error`; opt-in retry/cache/dedupe; reads only — mutations are explicit commands.
- **App & router:** `createApp({ root, setup })` with idempotent `start`/`stop`; URL/History/anchors/`import()`; typed params; focus/title/scroll/announcements; base path; hash mode for static hosts. SSR, hydration, compiler, preemptive scheduling are deferred.

### 4.1 State and application adoption contracts

- [ ] Document immutable snapshot semantics for nested objects, arrays, maps/sets, equality, and unsupported values. Provide one clear recommended update pattern; freeze/validation policy must not silently change behavior between development and production.
- [ ] External subscriptions have stable snapshots, selected-value equality, reentrancy rules, and explicit teardown. Context keys are typed, provider precedence is deterministic, and missing-provider behavior is actionable.
- [ ] Persistence is an optional versioned adapter with explicit selection, migration/reset, and storage-failure handling. It does not automatically persist every public component property.
- [ ] Distinguish aborting a read from undoing a server mutation. Commands define pending/error/result ownership; automatic retries of mutations require an explicit policy. Avoid adding a mandatory query cache, middleware stack, or action ceremony to the basic state path.
- [ ] Route fixtures cover native anchors, modifiers/download/external links, back/forward, query/hash changes, nested route errors, lazy-load failures, rapid navigation, and stop/restart. Locale and deployment base path are explicit inputs rather than global assumptions.
- [ ] Page suspension and restoration (core-contracts.md §9.1, ADR 0035): distinguish element disconnect/reconnect, application stop/restart, page suspension, back/forward cache restoration, and permanent disposal; never dispose on `pagehide`; lifecycle listeners only through an explicit owned app service; declared service suspend/resume; resource `revalidateOnRestore` policy with stale-result guards; no automatic mutation retries; no `unload`; `freeze`/`resume` only as verified enhancements. Owned by M7.

Research: [History API](https://html.spec.whatwg.org/multipage/nav-history-apis.html#the-history-interface), [Fetch and abort](https://fetch.spec.whatwg.org/), and [DOM AbortController](https://dom.spec.whatwg.org/#interface-abortcontroller).

---

## 5. Tokens, theming, styling (summary)

Detailed design: [theming-and-styling.md](./docs/architecture/theming-and-styling.md).

- `defineTheme()` (TS) and JSON + schema → one resolved model shared by files, CLI, and Theme Studio.
- Precedence: Mote defaults → preset → user config → explicit named overrides. Provenance recorded per token.
- Pipeline: load/validate → defaults/preset → scales/palettes → aliases → theme/product/density composition → context validation → emit. Pure, deterministic, browser-compatible; Node I/O separate. **The only token engine** — equivalent resolved inputs and emitter versions produce byte-identical canonical token artifacts in CLI and browser execution. Environment-specific paths, timing, and diagnostic reports are separate from canonical artifacts.
- Spacing: `multiples` | `ratio` | `explicit`, mutually exclusive; 4-decimal rounding in source unit; stable names; semantic roles alias scale steps explicitly.
- Colour: OKLCH ramps + documented sRGB gamut mapping; WCAG checks on actual role pairs; APCA/CVD labelled supplementary.
- Outputs: CSS (no JS needed), typed `refs`, separate literal `values`, `inspect` with explicit element context, Sass refs + literals, DTCG 2025.10 JSON, provenance metadata, validation reports.
- Scopes via `data-mote-theme|mode|product|density|profile`; each scope re-declares the affected alias closure. Research: [CSS custom properties](https://www.w3.org/TR/css-variables-1/) and [Shadow DOM styling/inheritance](https://drafts.csswg.org/css-shadow-1/).
- Styling: CSS custom properties are the contract; plain `.css`, CSS-in-TS (`css` + `token()`), and Sass all supported; one constructed sheet per style definition per document; `<style>` fallback with CSP nonce; bounded `::part` / component-variable surface.
- Token categories: foundation → semantic layout roles → component roles, plus **named conditions** (literal thresholds) and **profiles** (explicit role overrides). Responsive layout, density, typography preference, and target size stay distinct.

### 5.1 Theme portability and scope correctness

- [ ] Keep spacing strategy semantics discoverable: a base plus explicit factors, or a base/ratio with counts before and after it, or an explicit scale. Define counts, rounding, zero/negative values, bounds, and extension behavior. Avoid ambiguous `default`/`multiplier`/`range` fields; semantic/t-shirt names are explicit aliases rather than automatically renumbered identities.
- [ ] `rem` outputs respect the consumer's root size. Never force a global root font size or silently assume a pixel conversion. Distinguish CSS references from literals, preserved units from observed pixels, and context-dependent values from pure generated results.
- [ ] Test CSS-only system-mode selection and first paint, explicit mode overrides, nested mode/product/density/profile combinations, inherited aliases, consumer overrides, forced colors, and user font-size preferences. Any reset, font loading, or page defaults are explicit opt-in assets.
- [ ] Adopted stylesheet sharing follows document ownership; externally supplied mutable sheets have explicit ownership rules. A preview-owned mutable theme sheet must not become a shared component static sheet.
- [ ] Define legal composition/precedence and generated CSS size for multiple scope axes. Measure selector/rule growth before generating every possible cross-product. Report conflicting or redundant overrides with provenance.
- [ ] DTCG output uses the pinned format's actual typed representation and documents Mote extensions, supported token types, aliases, and lossless versus lossy mappings. A Mote resolved-theme JSON file is not automatically a valid DTCG document; verify with an independent reader. DTCG import/round-trip is a separate, explicit scope decision.
- [ ] DTCG Resolver 2025.10 experiment ([theming-and-styling.md](./docs/architecture/theming-and-styling.md) §9, R53): map defaults/preset/configuration/overrides, modes, products, density, profiles, conditions, and aliases onto sets, modifiers, contexts, and `resolutionOrder` through the canonical generator; test shared presets, independent overrides, preserved units, and 1/2/3/10 products; record determinism, permutation count, and output size; check with an independent Resolver implementation where practical; document supported, lossy, and unsupported mappings and precedence differences; decide export, import, both, a bounded subset, or an evidence-backed deferral. Format support never implies Resolver support. Owned by M9.
- [ ] Text, focus, disabled/invalid/loading, and interaction colors have semantic contracts. Palette generation reports inaccessible role pairs and offers explicit corrections without silently changing a user's brand inputs.

Research: [DTCG Format 2025.10](https://www.designtokens.org/tr/2025.10/format/), [CSS variables](https://www.w3.org/TR/css-variables-1/), [CSS Color 4](https://www.w3.org/TR/css-color-4/), [Style Dictionary](https://styledictionary.com/), and [Tokens Studio](https://docs.tokens.studio/).

---

## 5a. Layout recipes and composition (summary)

Detailed design: [layout-recipes.md](./docs/architecture/layout-recipes.md).

- `defineLayoutRecipe({ container, regions, variants, when })` with `stack`, `row`, `grid`, `autoGrid`, `split`; module-scope evaluation; ordinary reusable CSS; no build transform; optional extraction emits identical CSS.
- Unbranded mechanism in `@mote/core/layout`; Mote defaults, conditions, presets, and page-author `layout.css` in `@mote/components/layout`.
- Cascade layers `recipe.base → variant → condition`; among normal author rules in the same encapsulation context (across stylesheets), unlayered declarations outrank layered ones. Shadow-root recipes stay encapsulated — consumers customize via role/token custom properties, component variables, exposed `::part`, and host styles; light-DOM recipes can be overridden by page unlayered rules. `!important` reverses layer precedence and has different cross-context ordering (layout-recipes.md §4). `:where()` flattening; `extend()` without mutation.
- Explicit container rules; intrinsic-first; no `ResizeObserver` for responsiveness. Component-author and page-author paths.
- [ ] Document the exact container/wrapper/region contract: queries affect eligible descendants, containment changes sizing, and external selectors do not gain access to private shadow markup. Validate flat-tree/slot behavior, nested container selection/names, `::part`/`::slotted` limits, and inherited role variables in all baseline engines.
- [ ] Treat named thresholds as generated literal query inputs for the portable baseline. Do not assume ordinary runtime token overrides change compiled thresholds. Live condition editing must regenerate the relevant preview-owned query/recipe stylesheet without remounting or mutating shared static sheets. Any variable-based query syntax is progressive enhancement only after browser evidence.
- [ ] Page-author recipes expose useful CSS classes and CSS custom properties; component-author recipes stay ordinary readable CSS. Show handwritten equivalents and compare emitted rules and authoring time before adding template styling directives.

Research: [CSS container queries](https://drafts.csswg.org/css-conditional-5/#container-queries), [CSS Shadow](https://drafts.csswg.org/css-shadow-1/), and [cascade layers](https://drafts.csswg.org/css-cascade-5/).

## 5b. Data-driven composition (summary)

Detailed design: [data-composition.md](./docs/architecture/data-composition.md).

- Typed discriminated component models via JS properties; never mutated; intent events; native links; controlled **or** uncontrolled interaction state.
- Shared `@mote/core/collections` (keys, reconciliation, nesting, per-item `Scope`, state models); keyboard per APG pattern; no identity-only caching.
- One authoritative source per region; customization ladder (options → slots/parts → render functions → registered kinds); local vs portable configuration.
- `@mote/core/model` generates types, validators, JSON Schema, migrations, metadata. Optional composition schema later.
- [ ] Clarify which types are inferred in TypeScript and which files are emitted. A single runtime definition supplies supported validators/schema/metadata; production components do not import schema emitters or a universal JSON renderer merely to accept typed objects.
- [ ] Define stable keys, duplicate/missing-key diagnostics, large/deep input limits, locale-aware labels, and focus fallback when the focused item is removed. DOM identity preservation cannot preserve a node intentionally removed from the model.
- [ ] Plain object configuration remains sufficient for ordinary consumers. Builders are optional authoring aids. Serializable models cannot contain executable callbacks; local render functions, registered kinds, and services require explicit nonportable adapters.
- [ ] Keep native links and accessible component semantics intact in declarative, data-driven, and hybrid paths. Data configuration does not automatically choose a correct APG pattern.

## 5c. Analyzer and metadata (summary)

Detailed design: [metadata-and-analyzer.md](./docs/architecture/metadata-and-analyzer.md).

- Optional, Node-only `@mote/analyzer` understands Mote authoring patterns (`MoteElement.with`, `prop.*`, inheritance, re-exports, events, slots, parts, CSS properties, custom states, `define` entries, token references, recipes, models, JSDoc/TSDoc and Mote tags, preview roles, examples) using the **TypeScript compiler API** — no hand-written parser, no regex-first analysis, **never executes** component modules or expressions.
- Unsupported dynamic definitions → diagnostics + explicit static metadata.
- One normalized, versioned metadata model with stable ids and provenance (`extracted` / `authored` / `observed` / `verified`); unknown values stay unknown.
- Outputs: standard `custom-elements.json` (validated against a pinned CEM schema; `package.json` `customElements`), separately versioned `mote.metadata.json`, Workbench indexes and module maps, editor/schema outputs, agent bundles.
- Deterministic; watch + incremental; references validated against `exports`; public API comparison for releases.
- [ ] Separate source analysis from loading trusted Node configuration/build plugins. The no-execution guarantee applies to analyzed component modules and arbitrary source expressions; it must not imply that running an author's `.ts` config is a sandbox.
- [ ] Support published declarations and existing standard CEM as explicit input paths where source is unavailable; do not claim source inference that did not occur. Define merge precedence, contradictory metadata diagnostics, cache invalidation, and compatible schema migrations.
- [ ] Make analyzer output directly useful in editors: source positions, actionable diagnostic codes, custom data/schema exports, and correct installed-version links. A dedicated IDE language server is not required for v1.
- [ ] Share canonical metadata schemas as build inputs and emit browser-safe type/schema artifacts. Do not leak TypeScript compiler types, Node globals, or runtime imports from the analyzer into Workbench/browser declarations; record the owning contract entry before its first consumer ships.
- [ ] Evaluate a thin adapter/plugin for the existing CEM Analyzer ecosystem after the Mote vertical slice; reuse its interchange format without making that analyzer a runtime requirement or replacing the planned Mote-aware front end.

Research: [CEM schema repository](https://github.com/webcomponents/custom-elements-manifest), [existing analyzer and plugin model](https://custom-elements-manifest.open-wc.org/analyzer/getting-started/), and [TypeScript compiler API](https://github.com/microsoft/TypeScript/wiki/Using-the-Compiler-API).

## 5d. Workbench and Theme Studio (summary)

Detailed design: [workbench.md](./docs/architecture/workbench.md).

- Optional `@mote/workbench`: one reusable shell driven by metadata, config, component entry points, and optional examples. Full Mote experience, a defined standard-CEM baseline, and explicit "unknown/not documented" labels instead of invented behavior. Custom prefixes and branding. Presentation follows Design System Lab's structure with each library's own data (§5d.2).
- Component detail pages combine generated documentation with the interactive example and an **editable API table** (contract-correct controls: property vs attribute, `''`/`0`/`false`/`null`/unset, read-only, model editors, fixtures for non-serializable values); methods never auto-invoked; reset via clean instance; sync only through declared contracts; robust event log; reproducible plain HTML/JS snippets. No separate Playground destination.
- **Iframe-isolated previews** (own registry, module graph, styles, theme scopes, errors), owned by host and frame `Scope`s; independent viewport/container sizes; theme-value edits (incl. density, profiles, thresholds, presets, undo/redo, Reset theme) preserve instances; only component/example/composition/role-component changes, adapter/fixture/provider changes, registration replacement (fresh frame), or explicit Reset preview may replace the smallest affected region (workbench.md §5).
- **Theme Studio** as its own primary destination (`/theme-studio`) in every fully configured Workbench: same `ThemeConfig`, validation, and generator; form + JSON editors on one draft; strategy-aware controls; foundation/generated/alias/override labels; live, latest-wins regeneration preserving state and last valid preview; replaceable specimen recipe with light/dark panels; the library's own components mapped to specimen roles via declared capabilities or adapters (never tag-name guessing); token inspection and visualizations; comparison, undo/redo, presets, versioned sharing, canonical exports; static builds keep full client-side editing.
- `defineExamples` colocated, typed from metadata; reused by Workbench, docs, browser/visual tests, Theme Studio, agents.
- `mote analyze` · `mote workbench dev` · `mote workbench build`; never publishes or deploys; deterministic; authored files preserved.
- `apps/docs` embeds Workbench panels (foundations, component catalog/detail, Theme Studio); no duplicate foundation or component explorers or token engines.

### 5d.1 Workbench correctness, accessibility, and loading

- [ ] Version and validate the shell/frame handshake, message source/origin, frame identity, request/generation IDs, and serializable payloads. Ignore messages from disposed or superseded frames. Incompatible library registrations require a fresh realm; HMR cannot unregister and redefine a custom element in place.
- [ ] Treat local component modules/examples as executable project code. Iframe isolation of registries/styles is not a promise of a security sandbox for arbitrary untrusted code. A user-code editor remains deferred.
- [ ] Lazy-load selected component modules, examples, detailed metadata, and heavy visualizations. Do not mount one iframe per catalog entry. Bound event logs, undo history, previews, and caches; coalesce slider edits while preserving a responsive input surface. Worker/latest-wins behavior must also measure wasted obsolete work, not just suppress stale commits.
- [ ] Test Workbench itself: landmarks/headings, skip links, keyboard navigation, accessible control names, error associations, restrained announcements, frame titles/focus entry and exit, numeric alternatives to sliders, textual swatch/state labels, reduced motion, forced colors, contrast, and narrow layouts. Generated docs accessibility is part of the product's definition of done.
- [ ] Unknown or unavailable controls remain explained and discoverable; unsupported adapters/providers do not produce misleading empty success previews. Implement the remount policy table in workbench.md §5: theme-value edits and compatible CSS/token/doc/metadata HMR update in place; component code HMR replacing a registration uses a fresh frame. Never derive component keys or frame identity from a theme configuration hash. Instance preservation does not freeze internal DOM; preserve state, focus, and selection where the elements remain present.
- [ ] `defineExamples` has one plain serializable description layer plus explicit owned fixture hooks. Keep generic example/config helpers importable and testable without mounting Workbench. Resolve the build as runtime components → analyzer metadata → example typechecks/tests → Workbench shell, with helper entries available first; no production dependency from components to tooling.
- [ ] Theme Studio's complete interactive capability is available in static builds; initial gallery samples, request logs, and share settings use deterministic fixtures and explicit versioning. Export pending/error states are visible and never silently export an older configuration as the latest draft.

Research: [Storybook Web Components](https://storybook.js.org/docs/get-started/frameworks/web-components-vite), [WCAG 2.2](https://www.w3.org/TR/WCAG22/), [APG](https://www.w3.org/WAI/ARIA/apg/), and [HTML cross-document messaging](https://html.spec.whatwg.org/multipage/web-messaging.html#crossDocumentMessages).

### 5d.2 Information architecture and presentation (Design System Lab structure, project data)

Detailed design: [workbench-pages.md](./docs/architecture/workbench-pages.md). Reference: [design-system-lab-audit.md](./docs/reference/design-system-lab-audit.md).

- [ ] **Page registry** is the single source for routes, primary navigation, contextual sidebars, overview cards, search entries, visibility, and legacy redirects; stable page/section ids shared with metadata and authored content.
- [ ] **Shell** reproduces the reference's presentation with the library's branding: persistent primary navigation, contextual left sidebar (grouped where applicable; collapsible on narrow screens), eyebrow + title + summary headers, back links, "On this page" table of contents, restrained surfaces, card overviews (3/2/1 columns by container width). Shell appearance and preview appearance are separate.
- [ ] **Primary navigation**: Foundations · Components · Theme Studio · Products and modes (only when enabled; configurable placement) · guides and other registry sections. No separate Playground destination.
- [ ] **Foundations overview**: cards for Token architecture, Color, Typography, Spacing, Borders and radii, Elevation, Motion, Themes, Responsive behavior — each only when supported; title, summary, `Updated · tags` from metadata and authored overrides; dates only from declared metadata or source history, never build time; no specimens in cards; Theme Studio never appears as a card or sidebar entry.
- [ ] **Foundation detail pages** generated from the library's configuration and metadata (table in workbench-pages.md §5.2), with Spacing as the reference vertical slice: scale table (token, CSS custom property, source-unit value, proportional sample), semantic vocabulary and precedence only where declared, derived counts/ranges, computed pixels only with an explicit preview context. Pages show the saved/generated baseline unless a Theme Studio draft is explicitly selected and labelled; never mixed.
- [ ] **Components catalog**: grouped sidebar, search (name, summary, tags), configurable category filter with fallback group, result counts, grouped cards, URL filter state, no previews in cards, evidence-backed claims only.
- [ ] **Component detail page** combines Overview · Interactive example (preview, presets, Reset, Copy example link, preview settings, generated plain HTML/JS) · API (editable table: Name, Type, Default, Current value, Description, attribute/reflection) · slots, events, methods, parts, CSS properties, custom states · Examples · Tokens (property → CSS property → token trace; every token read with tier, read-through, and context; declared/potential/observed labels) · Behavior and accessibility · Guidance · Source · Known limitations. Preview stays observable while editing (adjacent/sticky on wide screens; stacked on narrow).
- [ ] **Products and modes** disabled and absent by default; explicit product definitions from local theme config, installed packages, or versioned manifests (snapshotted at build time); workspace discovery only suggests.
- [ ] **Content layers**: built-in reusable copy, generated facts (authoritative for values and contracts), and authored overrides keyed by stable ids (typed `mote.docs.ts` / Markdown front matter) that survive regeneration, with validation, precedence, localization, and migration rules.

---

## 5e. AI-friendly architecture and generated agent kits (summary)

Detailed design: [agent-tooling.md](./docs/architecture/agent-tooling.md); decision: [ADR 0032](./docs/architecture/decisions/0032-generated-agent-kits.md) (extends ADR 0022).

**Central outcome:** a team adopting Mote can generate accurate, version-aware agent support for its own library from the same authoritative inputs used by its documentation and Workbench — component metadata, configuration, authored guidance, and examples. The kit covers that team's own packages and exports, prefix and component APIs, tokens and theme axes (themes, modes, density, profiles), recipes and conditions, examples and composition patterns, design guidance, repository conventions, and verification commands, and must help an assistant that starts with no knowledge of Mote or the library.

- Optional, dev-only `@mote/agent` over analyzer outputs: project context, kit generation, instructions, operations (inspect project, find/inspect components, tokens, recipes, explain/validate config, validate usage, scaffold, migrations, data validation, composition advice, preview-role mapping, export verification, preview inspection, run checks), CLI and optional MCP adapter as separate layers. Uses the developer's IDE agent/model; Mote supplies contracts, deterministic operations, and evidence.
- **One metadata model.** Agent-facing facts are views of the normalized model (CEM for interoperability, Mote enrichment kept separate), referencing existing property, event, model, and composition declarations by stable id. Provenance stays *extracted* / *authored* / *observed* / *verified* (with conditions); unresolved information is explicit; nothing is inferred from names or types; the no-execution guarantee holds.
- **Project- and version-aware.** Installed versions, exports, registrations, project components, token configuration, recipes, examples, conventions, and commands are resolved locally; every artifact and result carries a fingerprint and freshness state; stale artifacts are detected and never silently replaced by newer website docs. Capability paths (core-only, tokens-only, components without state, full application) are respected.
- **Generated kit.** A small entry guide plus focused references loaded on demand (install/consume, choosing components, authoring, theming, layout, data models, lifecycle and `Scope`, frameworks, debugging, migration), in Markdown and JSON. Exact API references are generated; authored design guidance is checked for valid API references at build time. Optional packaging: Agent Skills, a managed `AGENTS.md` section that preserves existing text, IDE adapters, and clean Markdown + `llms.txt` for static docs (client loading behavior documented, not assumed). Independent of building or publishing Workbench.
- **Examples as shared evidence**, including explained incorrect examples for common mistakes; compiling, static validity, and browser verification stay distinct.
- **Repairable diagnostics** through an optional envelope over the existing diagnostic shapes, and **preview feedback** through Workbench frames that execute only trusted project examples.
- Reports provenance; schema validity is never presented as proof of accessibility, behavior, or design quality. AI support stays optional: ordinary component consumers need no agent tooling, Workbench, Mote state, application services, or hosted AI service; no mandatory embedding service, hosted model, or second analyzer.
- Improved AI usability is a hypothesis verified by the evaluation in agent-tooling.md §11.

Research: R33–R41 in [synthesis.md](./docs/research/synthesis.md) and §12.4.

---

## 5f. Product documentation, localization, and maintainability

- [ ] Give each adoption path one recommended starting point, an honest package/feature matrix, copyable JS/TS examples, and a direct route from an error code to the relevant guide. Optional features should not require understanding the entire system.
- [ ] Keep Mote architecture/decision case studies visible: problem, constraints, alternatives, selected API, working demonstration, measurements, and limitations. Separate measured results from design hypotheses; adapt the original application's design-engineering discussions into product content.
- [ ] Define localization contracts for visible component strings, accessible names, validation/status messages, inherited `lang`/`dir`, logical layout, and browser `Intl` formatting. Keep consumer-provided labels first-class and avoid coupling localization to stores/router. A translation platform is not required.
- [ ] Plan static, readable documentation content and page metadata, stable canonical links, local search indexes, and version labels. Decide which API/guide content should be readable/indexable before client boot through build-time document generation; this does not imply a Mote SSR/hydration renderer. Keep deferred SSR/hydration limits explicit in framework guides.
- [ ] Define loading/failure/fallback presentation for unregistered elements, lazy routes, fonts/assets, and unavailable modules. Do not hide an entire application until every custom element is defined or claim zero-JavaScript interactive custom elements.
- [ ] Include an optional `mote doctor` operation in tooling for installed versions, exports, config/schema compatibility, registrations, and supported setup checks. Existing focused commands remain usable without installing Workbench; any unified CLI delegates to the same implementations rather than duplicating them.
- [ ] Package optional agent instructions/plugin assets alongside installed-version metadata and deterministic operations. Support the developer's existing IDE agent; no hosted model service is required. Evaluate generated source changes and migration patches against the same checks as handwritten work.
- [ ] Review scope at every milestone: remove or defer helpers with no demonstrated reuse, keep public APIs smaller than internals, and extract behavior controllers only from working components. Do not add SSR, an editor platform, a page builder, or a broad server framework to complete this plan.

Research: [Intl / ECMA-402](https://tc39.es/ecma402/), [HTML language and direction](https://html.spec.whatwg.org/multipage/dom.html#the-lang-and-xml:lang-attributes), [MCP specification](https://modelcontextprotocol.io/specification/latest), and the framework-integration sources in §12.2.

---

## 5g. Multi-product design systems (summary)

Detailed design: [multi-product.md](./docs/architecture/multi-product.md); decision: [ADR 0033](./docs/architecture/decisions/0033-multi-product-foundations.md) (extends ADR 0026).

**Contract:** Mote supports shared interaction foundations, product-specific visual implementations, and scoped token themes. Teams reuse supported behavior and templates through public exports; product implementations keep documented interaction contracts and pass shared verification fixtures.

- **Identity.** Product identity is independent of repository, component family, design language, theme, mode, density, and profile. Two products may share a design language; one product may support several themes. Design languages map onto existing theme scopes and product values onto existing product scopes; no new runtime provider or CSS scope axis is mandatory.
- **Any number of products.** One, two, three, ten, or more products use one model keyed by stable ids: no hardcoded counts, fixed comparison slots, or product-specific schema fields. A single product needs no product configuration or selection ceremony. Shared presets, token contracts, families, and foundations are referenced, not duplicated; products override only what differs; changing one product never mutates shared presets or another product's resolved output. Products may live in one repository, several workspaces, separate repositories, or installed packages. Two-product fixtures are representative, not a limit.
- **Layers.** Recomposable components export behavior, template (anatomy), documented structural styles, default visual styles, and a composed definition; a `foundation` entry loads no default skin. Mote's own components are built from the same public pieces. Import graphs are documented separately from installation dependencies.
- **Recomposition.** `compose()` reuses an existing definition to create a new frozen definition with its own identity and a traceable foundation link, without mutating the source or copying registration state; elements resolve configuration by exact constructor. One style-ordering policy; sheets stay shared per document. Existing registration rules hold (`registry.collision`, `registry.constructorReused`) plus `registry.definitionConflict`; scoped registries are never assumed.
- **Customization ladder:** theme values → component variables/parts/slots/options → product styles composed with structural styles → alternative template satisfying an anatomy contract → reused or extended behavior. Levels 1–2 update instances in place; levels 3–5 select a different implementation and follow the structural replacement rules.
- **Anatomy contracts** for components that support alternative templates; alternative templates and styles are verified against shared interaction fixtures, and foundation verification never certifies downstream skins.
- **Component families:** a composite renders the product's children through one explicit, analyzable mechanism connecting named roles, selected definitions, rendered references, registration, and compatibility — chosen by prototype, never tag guessing or global substitution.
- **Distribution and scopes:** explicit package/config/manifest references; foundation compatibility ranges; scope behavior specified for Shadow DOM, slotted content, overlays, relocation, and adoption; resets and fonts opt-in; CSS growth measured, not emitted for every combination.
- **Tooling:** metadata records foundations, derived definitions, layered sources, families, anatomy, and compatibility; Workbench compares chosen products with searchable selection and on-demand loading (Products and modes stays optional and absent by default); agent lookups are scoped to a product and generated on demand.

Research: R26, R42–R46 in [synthesis.md](./docs/research/synthesis.md) and §12.1.

---

## 5h. Change impact, conformance, explanation, reproduction, and page lifecycle (summary)

Detailed design: [change-impact-and-verification.md](./docs/architecture/change-impact-and-verification.md) (ADR 0034) and [core-contracts.md](./docs/architecture/core-contracts.md) §9.1 (ADR 0035).

These build on the composition API and folders (§3.3), agent kits (§5e), and multi-product foundations (§5g) as integration constraints, and reuse existing sources through typed relationships: component definitions and public contracts, analyzer metadata, the canonical token generator and its graph, recipes and conditions, shared examples and fixtures, reactive and `Scope` records, Workbench and Theme Studio, and optional CLI/agent operations. No second analyzer, token engine, reactive engine, registry, or documentation catalog. Extracted, authored, observed, and verified facts stay distinguishable.

- **Change impact** (`@mote/analyzer`): versioned comparison snapshots over existing artifacts; stable-id matching; renames only from authoritative identity or migration records; incompatible / review / informational classes with no automatic semver mapping for token values; traversal with edge provenance across components, derived definitions, tokens, recipes, products, families, examples, and suites; unresolved edges widen verification; conservative fallbacks; verification states `selected`, `passed`, `failed`, `reused`, `not-executed`, `unresolved`; local `impact-report.v1` for CLI, Workbench, agents, and CI; explicit visual-baseline accept.
- **Portable conformance suites** (`@mote/workbench/conformance`, `./testing`): versioned contracts, adapters over public capabilities and documented anatomy, author-written assertions, invariants bound to declared change kinds (respecting structural replacement), mutants that must fail and customizations that must pass, representative coverage of products (1/2/3/10) and environments, evidence per implementation/configuration/browser/suite version; never accessibility certification; never in ordinary component imports.
- **Explanations** (`explanation.v1`, one model for Workbench, CLI, and agents): styling chains from observed values through component variables, roles, aliases, scopes, overrides, and recipes, with limitations; responsive conditions active only when reliably observed; measurement only in explicit inspection; runtime records (tracking path, dependencies, commits, owning scope, active/cancelled/superseded/suspended/disposed) from a development-only, opt-in, bounded `@mote/core/inspect` absent from production graphs.
- **Runnable reproductions** (`reproduction.v1`): distinct from share links; only declared inputs; undeclared services/state listed with required adapters; deterministic fixtures, not arbitrary replay; public exports and normal resolution; verified in clean directories; never published.
- **DTCG Resolver**: explicit experiment and decision (§5.1); Format support never implies Resolver support.
- **Page suspension and restoration**: five distinct lifecycles; no disposal on `pagehide`; explicit owned app service; declared service and resource restore policies; real persisted-restoration evidence only.
- **Priority:** prototype portable interaction verification, then change-impact reporting, on `mote-button` and customized implementations before generalizing; explanation and reproduction follow from the proven contracts. Reuse existing runners, browser automation, screenshots, and diagnostics; build no new runner, automation framework, screenshot engine, or hosted service. Each prototype records task, inputs, authority, unknowns, acceptance, cost, owner, and expand/revise/defer condition (change-impact-and-verification.md §6).

Research: R26, R29, R30, R33, R47–R55 in [synthesis.md](./docs/research/synthesis.md) and §12.

---

## 6. Milestones

| # | Milestone | Depends on |
| --- | --- | --- |
| M0 | Reconcile research, reference inventory (incl. Theme Studio reference), ADRs, metadata contracts | — |
| M1 | Workspace, distribution, enforced boundaries (incl. tooling packages) | M0 ADRs |
| M2 | Token vertical slice: config → CSS → CSS-only consumer; roles, conditions, profiles | M1 |
| M3 | Core: reactivity, `Scope`, element, templates, styles, recipes, collections, models, registry; **analyzer prototype + metadata model v1 draft**; first measurements | M1 |
| M4 | Button, input, **card**, side-nav (recipe + data), editable list; analyzer emits validated CEM + enrichment; interoperable consumers | M2, M3 |
| M5 | **Workbench vertical slice** (docs, controls, isolated previews, event log, snippets, first Theme Studio) on the four components + docs app slice | M4 |
| M6 | Stores, context, persistence/inspection, app root | M3 |
| M7 | Resources, router, async recipe; docs and Workbench on the router; static builds under a subpath | M5, M6 |
| M8 | Correctness, accessibility, performance, ergonomics → **v1 compatibility checkpoint** | M4–M7 |
| M9 | Complete token domains/outputs + **complete Theme Studio** | M2, M5, M8 |
| M10 | Component catalog + behavior controllers; examples and metadata per component | M8, relevant M9 domains |
| M11 | Docs IA, guides, Workbench completion, migrations, onboarding, **`@mote/agent`** | M7, M9, M10 |
| M12 | Packed consumers, release verification, deployment readiness | all |

M2 and M3 run in parallel after M1. M6 can run alongside M4–M5. Benchmark fixtures start in M3. Metadata contracts are defined in M0, prototyped by the analyzer in M3, validated on four real components in M4–M5, and receive an initial compatibility checkpoint at M8. Additive M9–M11 capabilities must be validated before the final release freeze at M12; material schema changes require an explicit version/migration decision. Agent-kit metadata and diagnostic contracts are drafted with M4's metadata validation; local project context and generated references are piloted on the M4–M5 slice; agent-facing contracts are reviewed at M8; `@mote/agent` operations, packaging, and the MCP adapter can start once analyzer outputs exist (after M5) but ship in M11; packed verification and the evaluation complete before the M12 freeze. Conformance and impact prototypes come first (M4, M5), with evidence reviewed at M8; explanation and reproduction expand in M9–M11; page-lifecycle policy follows the app services in M7. Multi-product customization levels are prototyped on M4 components before catalog expansion, reviewed at M8, and completed for tokens and Workbench in M9 and per component in M10. **Do not expand the catalog, recipe presets, data composition, or Workbench features beyond the vertical slices before M8 resolves foundation problems.**

---

### M0 — Reconcile evidence and architecture

**Research and ecosystem review**

- [x] Desk synthesis of Lit, FAST, Web Awesome/Shoelace, Spectrum WC, Material Web, UI5 WC, Stencil/Ionic, React, Angular, Vue, Svelte, Solid → [synthesis.md](./docs/research/synthesis.md)
- [~] Map source register R01–R32 in [synthesis.md](./docs/research/synthesis.md) to direct primary-source URLs (30 mapped and checked to resolve on 2026-10-17; R06 Spectrum base and R08 UI5 development model unresolved — only docs roots confirmed). Remaining: resolve R06/R08; pin exact sub-pages where noted; record versions/commits and access dates when each source is used in an experiment; refresh fast-changing status claims when publishing.
- [ ] Shared rubric `docs/research/rubric.md`: authoring, templating, styling/theming, token distribution, accessibility, forms, framework interop, distribution, metadata/docs, footprint, DX, project health
- [ ] Per-library write-ups `docs/research/<library>.md` for the seven design-system libraries; optional Carbon, Fluent UI WC, Vaadin, Style Dictionary, Tokens Studio, Open UI / APG
- [ ] Research addendum: layout primitives, container queries, responsive tokens; data-driven navigation/menus/tables/trees; metadata exposure to agents; **documentation tooling** (Custom Elements Manifest analyzer, Storybook web-components, Web Awesome/Shoelace docs, API Viewer–style tools) — what they extract, how they handle controls, previews, and theming, and where they fall short
- [x] Pin the Custom Elements Manifest schema version: `custom-elements-manifest@2.1.0` (npm latest; repo HEAD `d2f79f0`, checked 2026-10-17); `package.json` `customElements` field points at the published manifest ([metadata-and-analyzer.md §4](./docs/architecture/metadata-and-analyzer.md))
- [ ] Select and pin upstream versions for executable comparisons

**Reference audit (Design System Lab)**

- [~] Audit all routes and interactions of [https://brianchristopherbrady.github.io/design-system-lab/](https://brianchristopherbrady.github.io/design-system-lab/) and its source in a rendered browser; record gaps. Done: structure of every primary route, all foundation pages, Button/Input/Card/Tabs, Playground, dark mode persistence, skip link, `aria-current` ([audit](./docs/reference/design-system-lab-audit.md)). Remaining: remaining component pages in detail, composite-widget keyboard traversal, screen-reader output, forced colors, zoom/reflow, and reproducible screenshots via a scripted Playwright job (embedded-browser captures were unreliable and were discarded)
- [~] Dedicated audit of the reference **Theme Studio** ([https://brianchristopherbrady.github.io/design-system-lab/foundations/theme-studio](https://brianchristopherbrady.github.io/design-system-lab/foundations/theme-studio)): structure, preset/shape interactions, URL state, token-file outputs, and stated methods recorded. Remaining: brand-colour input behavior, specimen states, download/copy, accessibility; no parity claimed without verification
- [ ] Inventory `docs/reference/inventory.md`: feature · developer need · keep/adapt/retire · destination (package, Workbench panel, docs section) · verification
- [ ] Adapt personal case studies into product architecture/decision docs; label fictional scenarios

**Architecture records**

- [x] Draft packages, core contracts, theming/styling, layout recipes, data composition, and agent tooling docs — reconciled with this plan
- [x] Draft [workbench-pages.md](./docs/architecture/workbench-pages.md) (page registry, shell, Foundations, Components, Theme Studio destination, Products and modes, content layers); workbench, metadata, packages, theming, and agent docs updated
- [x] Draft [metadata-and-analyzer.md](./docs/architecture/metadata-and-analyzer.md) and [workbench.md](./docs/architecture/workbench.md); packages, agent, theming, recipe, and data docs updated
- [x] ADR template + log: [docs/architecture/decisions/](./docs/architecture/decisions/README.md)
- [x] ADRs 0001–0030 written ([log](./docs/architecture/decisions/README.md)): process · reactivity and binding rule · property definitions · Scope/reconnection · rendering/security · colour/gamut · alias scope generation · style delivery/CSP · browser support baseline · layout recipes and cascade layering · container/query baseline · token categories/conditions/profiles · component data models and region sources · collections and keyed invalidation · model builder · normalized metadata model · CEM vs enrichment · analyzer front end and no-execution rule · preview isolation · specimen roles · `defineExamples` · `@mote/agent` boundaries · page registry · content layers · baseline vs draft · products and modes · updated-date provenance · legacy redirects · M8/M12 versioning · remount policy. Statuses are recorded per ADR: 16 Accepted, 14 Proposed pending the named experiments
- [x] ADRs (Workbench IA): page registry, content layers, baseline vs draft, products and modes, updated-date provenance, legacy redirects — included in 0023–0028
- [x] Draft JSON Schemas ([docs/schemas/](./docs/schemas/README.md)): `mote-metadata` v1 (incl. foundations, categories, docs, products), Workbench config, page registry, authored content, product definition/manifest, examples, Theme Studio composition, share payload — compiled under Ajv 2020 strict mode with valid/invalid example instances (2026-10-17). Move into owning packages and CI in M1
- [ ] Platform vs Mote abstractions table
- [ ] Link every research task/ADR to the relevant direct sources in §12; record the exact question, expected evidence, version, result, and decision. Source access alone does not complete the experiment.
- [ ] Decide the small default authoring path, live-binding semantics, production diagnostic policy, frame trust/version model, native form strategy, locale contracts, and early Workbench/helper build ordering before their dependent slices.

**Acceptance:** research conclusions link to sources; inventory (incl. Theme Studio) has evidence or explicit gaps; ADRs and draft schemas make contracts actionable. Repeating the desk review is not required before M1.

---

### M1 — Workspace, distribution, and boundaries

- [x] `git init`; npm workspaces (`packages/*`, `apps/*`); strict TS project references (TypeScript 7.0.2, `NodeNext`); ESM output with declarations and maps; Node engine `>=24.12`. Vite is added with the docs/Workbench shell in M5 (dev only)
- [~] Scripts: `build` (topological `tsc -b`), `typecheck`, `lint` (boundaries + format), `test`, `test:e2e`, `verify`, `verify:packs` done. Remaining: `dev` (with the M5 docs shell)
- [x] Five runtime packages + private `apps/docs`, each with manifest, tsconfig, `src/`, test, README; `sideEffects: false`; skeleton root entries only (no empty subpaths); all `private: true` until licence/scope are confirmed
- [x] Reserve `packages/analyzer` (create in M3), `packages/workbench` (DOM-free examples/config/pages helper entries in M3; shell in M5), `packages/agent` (create in M11) — rules pre-declared in `scripts/architecture/boundaries.config.mjs`
- [x] `scripts/architecture/check-boundaries.mjs`: dependency map, undeclared and private/deep imports, cycles, imports leaving a package, third-party runtime deps and imports in browser code, Node-only packages and Node entries unreachable from browser code — on manifests, sources, **and** built artifacts (JS and `.d.ts`); reports scan counts and fails if the scanner finds no imports; 11 fixture-workspace tests
- [~] DOM-free entries import in Node without DOM globals (checked from config for every listed entry that exists); `node:*` only in Node sources/entries. Remaining: "DOM imports have no registration/global-listener side effects" once DOM entries exist (M3)
- [~] README (product-focused), CONTRIBUTING, release-process stub, Prettier formatting, CI workflow written. Remaining: CI has not run (no remote); licence and npm scope ownership unconfirmed
- [~] Unit + browser test infrastructure (Vitest 5; Playwright 1.64 with Chromium, Firefox, WebKit) and the plain-HTML import-map consumer, passing in all three engines. Remaining: axe integration with the first DOM components (M4)
- [~] Production builds compile `src/` only; tests, e2e, and configs typecheck separately (`tsconfig.tests.json`). Remaining: Workbench helper entries before colocated examples (M3)
- [ ] Node tooling's required compiler/build dependencies are available from its packed installation; browser graphs contain neither those dependencies nor their loaders. Preserve manual/no-build adoption paths. (Applies once `@mote/analyzer` exists, M3)

**Acceptance:** a deliberate forbidden import fails with a useful error; build/typecheck/lint pass; DOM-free modules import without DOM; packed ESM + declarations resolve outside the workspace. **Met for the M1 skeleton on 2026-10-17** ([verification log](./docs/verification.md)); remaining `[~]` items depend on later milestones or CI.

---

### M2 — Token vertical slice

- [x] `ThemeConfig` types, `defineTheme`, JSON Schema, defaults/preset resolution, stable naming, provenance, structured diagnostics (code, JSON-pointer path, message, suggestion)
- [x] Validation: conflicting strategies, non-finite numbers, invalid units/names, missing refs, cycles, duplicate names, invalid CSS serialization
- [x] Spacing `multiples` / `ratio` / `explicit`; 4-decimal rounding; explicit `snap` only; stable names on extension; provisional default preset
- [x] Unit policy: `rem` spacing/type, `px` borders/optical, unitless line height, intentional `em`; per-output unit validation
- [x] Provisional brand palette + semantic roles sufficient for button/input/card/side-nav; explicit roles separate from generated ramps
- [x] CSS emit: `:root` + `data-mote-theme|mode|product|density` scopes, alias-closure re-declaration, explicit vs system mode, nested combinations
- [x] `mote-tokens init|build|check`; JSON/JS loading; documented `.ts` path; browser generation independent of Node I/O
- [x] Token categories with allowed-reference validation; initial layout roles and navigation component roles
- [x] Named `conditions` → literal queries; `@mote/tokens/conditions`; diagnostics
- [x] `profiles` → `[data-mote-profile~=…]` rules with alias closure; composition/precedence; overlap warnings; target-size minimum check
- [x] Generator runs in a Web Worker unchanged (prerequisite for live Theme Studio editing)
- [x] Verify stable spacing names/count semantics, source-unit rounding, canonical serialization, root-size independence, scope-axis precedence, alias closure, and bounded emitted-rule growth. Theme-mode first paint works in the CSS-only fixture.
- [ ] Define how changed condition thresholds invalidate generated query CSS; do not imply that changing an unrelated custom property rewrites a literal query. Link the side-nav preview to this contract.
- [x] `examples/tokens-css-only/`: HTML + `<link>` + own CSS, **no script**; Playwright verifies computed styles, nested aliases, dark mode, a nested profile

**Verification**

- [x] `{ brand: { primary } }` alone → complete theme, byte-identical across runs and between Node and browser/Worker
- [x] Multiples (`0.25rem` × 1, 2, 3, 4.5, 9) → `0.25rem, 0.5rem, 0.75rem, 1.125rem, 2.25rem`
- [x] Ratio (`0.75rem`, 1.5, 2/2) → `0.3333rem, 0.5rem, 0.75rem, 1.125rem, 1.6875rem`
- [x] Invalid configs → expected codes and paths
- [x] Conditions and profiles emit deterministically; no profile lowers target size below minimum

**Acceptance:** config/diagnostics/spacing criteria and CSS-only consumption pass; roles, conditions, profiles validate and emit deterministically; Node and browser generation are identical.

---

### M3 — Core authoring, ownership, and analyzer prototype

**Core**

- [x] Reactivity: `signal`/`computed`/`batch`/`untracked`/`effect`, `Readable`; tests for diamonds, dynamic deps, equality, nested batches, reentrancy, errors, cycles, disposal
- [x] `Scope`: lazy signal, children, timers, listeners, early release, effect-run scopes, controller activation; cleanup-error isolation and ordering
- [x] Prototype `MoteElement.with()` + `prop.*` (types, declaration emit, subclassing, object defaults, pre-upgrade replay, reserved names, class-field shadowing, **static analyzability**). **Decided: `with()` is the primary API (ADR 0003 Accepted)**
- [x] Attribute/property conversion, opt-in reflection, boolean presence, diagnostics
- [x] Typed events (detail, bubbles, composed, cancelable); declared state/event sync pairs (e.g. `value` + `input`) for tooling
- [x] Custom states via `ElementInternals.states` where components need them
- [x] Lifecycle ordering, paused detached bindings, generation guards, reconnect, adoption, supported moves, `updateComplete`
- [x] Templates: cached parsing, all bindings, direct readables, nested templates/nodes, `when`, keyed `repeat`, `match`; disposal; render-failure recovery; SVG
- [x] Security: unsafe sinks, URL policy, strict CSP, Trusted Types
- [x] Optional helpers (refs, `classMap`, `styleMap`, live input) with behavioral tests
- [x] Styles: trusted fragments, interpolation grammar, per-document sheet reuse, `<style>` fallback + CSP nonce, light-DOM scoping; no rebuild on updates
- [x] `@mote/core/layout`: `defineLayoutRecipe`, helpers with neutral defaults, region mapping, parts, variants, conditions, `extend()`; layered CSS generation; diagnostics; `describeRecipe`; byte-identical extraction
- [x] `@mote/core/collections`: keys, diagnostics, reconciliation, nesting, per-item `Scope`, state models; invalidation tests; keyboard controllers separate
- [x] `@mote/core/model`: `m`, `defineModel`, `Infer`, `validate`, `migrate`; `./model/schema`
- [x] Assess `props()` helper *(prototype on public APIs, three-engine contract tests; not in core for M4–M7; decision stays at M8 — [assessment](./research/experiments/props/README.md))*
- [x] `define()`: idempotence, collision error, dependency registration, tag-name typing
- [x] `examples/core-counter/` and typed demos with their own visual identity

**Analyzer prototype (`@mote/analyzer`)**

- [x] Create package (Node, dev-only); TypeScript compiler API program over a library's sources/declarations; no module execution (asserted by a test library whose modules throw on import)
- [x] Extract: `MoteElement` subclasses and `with()` factories, `prop.*`, inheritance, re-exports, events, slots/parts (template + explicit), CSS custom properties, custom states, `define` entries, `exports` → module map, JSDoc/TSDoc + Mote tags, `token()` references, recipes, models
- [x] `analyzer.dynamic.*` diagnostics with locations; explicit static metadata merge with `authored` provenance
- [x] Normalized metadata model v1 draft: stable ids, provenance, unknowns; JSON Schema
- [x] Emit CEM (validated against the pinned schema) and `mote.metadata.json`; deterministic output
- [x] Analyze the core-counter example as a first fixture
- [x] Bootstrap only the DOM-free `@mote/workbench/examples` and `config` helper entries needed by M4; defer the shell and its component/state/app dependencies to their owning milestones. Component runtime builds and analysis precede example compilation; no production component export imports these helpers.
- [x] Introduce the DOM-free `@mote/workbench/pages` contracts early: page registry types, stable page/section ids, visibility and availability rules, legacy-redirect entries; and the enrichment schema draft for foundations, component categories, docs metadata (titles, summaries, tags, declared/source-history dates), and products. Registry generation unit-tested from fixture metadata (no shell yet). *(`packages/workbench`: `defineExamples` typed from `HTMLElementTagNameMap`, `examples.v1` serialization, `checkExamples`; `resolveWorkbenchConfig`/`defineDocs`; `buildPageRegistry` + projections + legacy redirects, tested from the analyzer's core-counter output and an independent fixture library against `page-registry.v1` and `mote-metadata.v1`. The enrichment fields were drafted in M0's `mote-metadata.v1`)*
- [x] Performance experiment: TS compiler API full vs incremental on a 50-component synthetic library

**Measurements**

- [x] Collection update work, allocations, retained memory at 10/100/1,000 items vs handwritten `repeat` *(`research/benchmarks/`; found and fixed quadratic WebKit reorders: 319 → 9 ms for reversing 1,000 items)*
- [x] First honest size/startup/update/memory measurements and API walkthroughs (§8) *(`research/benchmarks/results/`: sizes, cold startup, click to next frame with a plain-DOM control, mount/update, lists, CDP memory, ownership after 100 cycles; size budgets in `npm run verify` (ADR 0031); walkthroughs: `examples/core-counter`, `examples/binding-rule`)*
- [x] Demonstrate render-tracked `.value` reads vs direct readable bindings vs untracked snapshots (event handlers, async callbacks), public-property bindings, dual-path coalescing (no duplicate DOM writes), no-op writes, and update/ready boundaries in plain JS and TS. Document the outcome of helper/directive/controller experiments. *(`examples/binding-rule`: identical render/write counts for plain-JS and TS elements in three engines, `e2e/binding-rule.spec.ts`; outcomes in its README)*
- [x] Exercise conversion/derivation/effect/commit/cleanup failures, production diagnostics, external signal composition, disposal during callbacks, and fresh reconnect scopes. Verify no implicit whole-host rerender or layout read on a direct binding update. *(`packages/core/test/failure-paths.browser.test.ts`, three engines; ownership table in core-contracts §6.2)*

**Acceptance:** counter and property examples run; direct readable updates skip `render()`; nodes/focus survive updates; owned resources return to baseline after reconnect tests; one sheet shared by 100 instances; no state/app/token code in the core fixture; unbranded recipe works core-only; analyzer produces valid CEM for the counter without executing it.

---

### M4 — First interoperable components and validated metadata

- [x] `@mote/tokens/refs` and `@mote/tokens/values` — DOM-free, registration-free
**Composition API and component folders** (§3.3; build before the four components so they are born in the new structure)

- [x] Design and record (ADR) the public composition API: `compose({ name, element, template, styles, dependencies? })` returning a definition, and `define(definition)` alongside the existing `define(tagName, ctor)`. Requirements: an external template runs in the same tracked render context as `render()`, so the binding rule, lifecycle order, `Scope` cleanup, and DOM identity are unchanged; templates are typed from a type-only host import; definitions are side-effect free and statically analyzable; the counter, component, and list size budgets (ADR 0031) still pass. The name clash is resolved: `compose()` (`@mote/core/element`) is the definition composer; the optional data-composition schema renderer becomes `renderComposition()` from `@mote/components/composition`. *([ADR 0036](./docs/architecture/decisions/0036-component-composition-api.md); `packages/core/src/element/definition.ts`; `packages/core/test/definition.browser.test.ts`, 17 tests in three engines; counter 9,521 B of 9,728 B)*
- [x ] Analyzer: follow `compose()` definitions and external template and style modules (slots, parts, CSS properties, token reads) and recognize `define(definition)` registrations; fixtures cover both the folder structure and colocated authoring. *(`tests/fixtures/analyzer-composed` vs `analyzer-library`: identical CEM declarations; `definition` metadata with `extends`, template, styles, dependencies; `@internal` excluded; dynamic cases diagnosed)*
- [ ] Boundary check: no ordinary barrel or `index.ts` reaches a `*.define.ts` module; registration entries are listed as side-effectful in package metadata; each component folder's `index.ts` imports without registering anything.
- [ ] **Migrate existing component work** to the folder structure. Current inventory (2026-10-17; nothing moved yet):
  - `examples/core-counter` (`demo-counter`, `demo-greeting`) — reference examples that teach component authoring: **migrate**. Its `src/index.ts` registers on import today, so its registration moves to explicit define entries.
  - `tests/fixtures/analyzer-library` (`acme-panel`, `acme-alert`) — analyzer fixtures: **add** a folder-structured counterpart; keep the colocated fixture so both paths stay covered.
  - `tests/fixtures/analyzer-dynamic` (`dynamic-element`) — deliberately dynamic definition for diagnostics: **preserve**.
  - `examples/binding-rule` (plain-JavaScript and TypeScript walkthrough elements) — intentionally colocated demonstration: **preserve**.
  - Focused inline fixtures in `packages/*/test`, `research/benchmarks`, and `research/experiments`: **preserve**.
  - `@mote/components`: no components yet; `mote-button`, `mote-input`, `mote-card`, and `mote-side-nav` are created in the new structure.

  For each migrated component:
  1. Inventory its current class, template, styles, registration, exports, and supporting files.
  2. Move its implementation into the component folder structure.
  3. Extract its template and styles without changing behavior.
  4. Assemble its definition through `compose()`.
  5. Keep registration in the explicit registration entry.
  6. Update imports, package exports, examples, documentation, analyzer fixtures, and source references.
  7. Preserve existing public import paths through compatible re-exports where practical.
  8. Verify that no ordinary barrel accidentally imports a registration entry.
- [ ] Migration acceptance, per migrated component (before/after comparison in three engines): the same properties, attributes, events, slots, parts, and styling behavior; the same reactive tracking (render counts and DOM writes), lifecycle ordering, `Scope` cleanup (`scopeStats()` baseline), and DOM identity; side-effect-free ordinary imports and explicit registration; equivalent analyzer metadata, public exports, emitted declarations, and packed-consumer behavior. Existing evidence (e.g. `e2e/core-counter.spec.ts`, its CEM fixture, and its strict-CSP check) must keep passing unchanged or be updated with a recorded reason.
- [ ] Documentation for the convention: core-contracts.md (composition API), packages.md (folder → entry mapping), CONTRIBUTING.md (repository component layout), layout-recipes.md and data-composition.md examples, and agent-tooling.md (`scaffold` output). Docs state that colocated authoring remains supported for consumers.

**Conformance prototype and stable relationships** (change-impact-and-verification.md §3, §6; first priority)

- [ ] Stable relationships for the slice: definition ↔ class/template/styles/dependencies, anatomy contract ↔ definition, example ↔ component/definition/product/fixtures — extracted or authored with provenance, the inputs later used by impact traversal
- [ ] Draft `conformance.v1` and `conformance-result.v1`; `defineConformance` in DOM-free `@mote/workbench/conformance` and `runConformance` in `./testing` on the existing Vitest browser/Playwright runners (no new runner)
- [ ] `mote-button` suite: properties/attributes, events (payload, propagation, cancellation, ordering), keyboard activation, focus, disabled/loading, form submission semantics, reconnection and cleanup; invariants for theme-value change (instance preserved) and programmatic updates (no user-intent events)
- [ ] Runs against the default `mote-button` and `studio-button` (multi-product prototype) through the default anatomy-derived adapter; rejects shipped mutants (not keyboard-activatable, emits on programmatic writes, loses focus target, duplicates listeners on reconnect) in three engines; results recorded with suite version, implementation, configuration, browser
- [ ] Ordinary component imports contain no conformance, testing, runner, or assertion code (import-graph check)

**Multi-product prototype** ([multi-product.md](./docs/architecture/multi-product.md), ADR 0033; prototype the customization levels before catalog expansion)

- [x] Include recomposition in the composition API ADR: `compose()` from an existing definition creates a new frozen definition with its own identity and traceable foundation link (self-referencing `source` field vs explicit `extend()` helper decided by prototype); runtime state in private maps; resolution by exact constructor; style-ordering and `template`-vs-`render()` policy; `registry.definitionConflict` *(lineage: self-referencing `source` → `extends`; ADR 0036; verified with `studio-card` coexistence, no inherited definitions, conflict/reuse/collision codes)*
- [ ] Layered exports for `mote-card` and `mote-button` (behavior, template + typed anatomy, documented structural styles, default visual styles, definition) plus `./card/foundation` and `./button/foundation` entries that load no default skin; import-graph tests prove it
- [ ] Customization levels 1–3 demonstrated on both: two products sharing definitions with different scoped tokens; a second visual implementation (`studio-card`, `studio-button`) composed from the shared foundation; both implementations in one document with distinct names and constructors; reusing a constructor or conflicting definition reports the documented diagnostic
- [ ] Prototype the product-aware composite candidates (element-reference parts, child directive, family-specific templates) on the editable list with product-specific input rows; record CSP/Trusted Types, analyzability, typing, size, and identity/focus results; decision at M8
- [ ] Token fixtures with 1, 2, 3, and 10 products: deterministic output, configuration isolation (frozen inputs; other products byte-identical after one changes), single-product setup without product configuration, and generated CSS bytes/rules per product recorded
- [ ] Shared interaction fixtures run unchanged against default and derived definitions in three engines: properties, methods, events, slots, keyboard, focus, disabled/loading, form semantics; per-instance sheet reuse and no mutation of shared sheets
- [ ] Analyzer emits distinct ids and `extends` links for derived definitions, layered style sources, and family mappings without executing template factories; equal metadata accuracy for default and derived definitions

- [ ] `mote-button`: native semantics, appearance/size/border/radius/loading/disabled/full-width; declared preview roles (`primaryAction`, `secondaryAction`)
- [ ] `mote-input`: form-associated; value/default; label/description/error; reset/restore; disabled fieldsets; validation; focus; `value`/`input` sync pair; preview role `textInput`
- [ ] `mote-card`: surface semantics (sectioning only when headed), padding/border/radius/elevation options backed by roles; header/body/footer slots; preview role `surface`
- [ ] Opt-in `formAssociated` + `ElementInternals` via form controller; reassociation and submission tests ([HTML form-associated custom elements](https://html.spec.whatwg.org/multipage/custom-elements.html#custom-elements-face-example))
- [ ] Cross-shadow accessible naming strategy; real AT checks recorded
- [ ] Prototype the button/form strategy before promising submit/reset parity: test submitter identity, Enter, name/value inclusion, submission overrides, constraint validation, reset, cancellation, disabled fieldsets, and reassociation. Form association alone does not establish native submit-button semantics. Keep a documented native `<button>` styling path, and explicitly document limitations of any custom-element proxy strategy. See [HTML custom elements](https://html.spec.whatwg.org/multipage/custom-elements.html) and [form submission](https://html.spec.whatwg.org/multipage/form-control-infrastructure.html#form-submission).
- [ ] One component authored in `.css`, another in CSS-in-TS; identical theme behavior
- [ ] Inherited roles with fallbacks; component variables + named parts
- [ ] Side-effect-free class exports, `define/<name>` entries
- [ ] Colocated `*.examples.ts` (`defineExamples`) for all four components: default, key variants, preview roles, an in-form fixture for input/button
- [ ] `examples/components-only/` from packed core/tokens/components, no state/app

**Agent-kit contracts** ([agent-tooling.md](./docs/architecture/agent-tooling.md) §3–§9, ADR 0032; contracts only — the `@mote/agent` package ships in M11)

- [ ] Extend the metadata model and `mote-metadata` schema additively with agent-facing facts ([metadata-and-analyzer.md](./docs/architecture/metadata-and-analyzer.md) §3.1): rich-object assignment, event intent, dependencies, contract references (`contract:core/*`), deprecations and migration references, customization paths, and `verified` conditions. Unknowns stay explicit. Extract them for the four slice components.
- [x ] Analyzer recognizes `compose()` / `define(definition)` by following imports and definitions, not file names; folder-structured and colocated fixtures produce equivalent metadata. *(same evidence as the composition analyzer task)*
- [ ] Draft `diagnostic.v1` (optional envelope fields over the existing token, analyzer, model, Workbench, and collection shapes; add `severity` to `CollectionDiagnostic`), `project-context.v1`, and `agent-kit.v1` schemas with valid/invalid examples in the schema test.
- [ ] `examples.v1` gains explained incorrect examples with an expected diagnostic code; add correct/incorrect pairs for the slice components covering attributes vs properties (incl. `.items`), boolean removal, explicit and dependency registration, event names and details, direct vs tracked bindings, reconnect-owned work, slots, and theme scopes.
- [ ] Check every slice example against real public exports (workspace now; packed in M12) and keep compile, static, and browser evidence labelled separately.
- [ ] Authored guidance and examples cite only existing tags, properties, events, slots, parts, tokens, recipes, and imports (`agent.guidance.unknownReference`).

**Layout slice — side navigation** ([layout-recipes.md §10](./docs/architecture/layout-recipes.md))

- [ ] `@mote/components/layout`: Mote-bound helpers, `condition()`, generated `layout.css`
- [ ] Side-nav recipe + component and handwritten-CSS equivalent in `examples/side-nav/`
- [ ] Narrow/wide containers; slots; nested custom elements; container queries only (no `ResizeObserver`/re-render, instrumented)
- [ ] Nested scopes and `navigation.compact` profile; role inheritance into slots and nested shadow roots
- [ ] `extend()`/unlayered overrides don't mutate shared sheets; computed-style equivalence across widths
- [ ] Keyboard, focus, zoom, wrapping, overflow, reflow; scripted reusable suite

**Data slice — navigation collection and editable list** ([data-composition.md §10](./docs/architecture/data-composition.md))

- [ ] `NavigationItemModel` via `defineModel`; type with `mote-side-nav`; validators in `components/models`; JSON Schema
- [ ] `.items`, no mutation, intent events, native links, controlled/uncontrolled state, region sources, customization ladder
- [ ] Data/declarative/hybrid equivalence; identity/focus through insert/remove/reorder; external signal updates; scope disposal; 1,000-cycle baseline
- [ ] External JSON validation and v0→v1 migration
- [ ] Editable list with `mote-input` rows: typing/caret survive changes; per-row validation; correct submission
- [ ] Plain JS and React/Vue/Angular/Svelte fixtures without Mote state
- [ ] Verify initial accessor detection, property assignment before definition, typed event declarations, framework remount behavior, and optional form adapters. Record native submitter limitations and tested naming/focus semantics; no duplicate keyboard targets.
- [ ] Verify removed-item focus fallback, supported model bounds, public string/localization inputs, `lang`/`dir`, forced colors, and both default and custom item render paths.

**Metadata validation**

- [ ] Analyzer runs in the components build; publishes `custom-elements.json` (+ `customElements` field) and `mote.metadata.json`
- [ ] CEM validated against the pinned schema and consumed by an independent CEM tool (e.g. an IDE custom-data generator or a third-party CEM reader) in a fixture outside the workspace
- [ ] Contract tests: metadata defaults, allowed values, reflection, events, slots, parts match browser behavior → results attached as `verified` provenance
- [ ] All module and registration references resolve against `exports` and built files
- [ ] Minimal consumers exclude `components/models`, `core/model/schema`, the `components/composition` renderer, `core/inspect`, conformance/testing helpers, recipe presets, analyzer, Workbench, agent (the definition composer `compose()` is ordinary API)
- [ ] Foundation and docs enrichment for the slice: spacing (strategy inputs, steps, semantic vocabulary, declared precedence), colour roles, and radii referenced from `@mote/tokens` inspection output (no recomputation); component categories, `@useFor`/`@notFor`/`@limitation`, property → CSS property → token mappings where statically determinable; updated dates only from authored metadata or source history

**Acceptance:** browser, form, accessible-name, keyboard, theme, and packed-consumer checks pass; state stays externally owned; side-nav (recipe + data), editable list, and card pass in Chromium, Firefox, WebKit; CEM validates and works with an independent consumer; metadata matches implementation and exports.

---

### M5 — Workbench vertical slice and docs slice

Design: [workbench.md](./docs/architecture/workbench.md), [workbench-pages.md](./docs/architecture/workbench-pages.md). Slice scope: `mote-button`, `mote-input`, `mote-card`, `mote-side-nav`; Foundations overview and the Spacing detail page; Components catalog; Theme Studio destination.

**Workbench shell**

- [ ] Extend the M3 helper-only `@mote/workbench` package with its application shell and public panels; zero third-party runtime deps in the browser bundle. Integrate state/app only after M6–M7.
- [ ] `mote.config.ts` / `defineWorkbenchConfig`; analyzer outputs + config → indexes and page registry; module map → per-frame import maps; assets/fonts/themes from config; custom prefix and branding
- [ ] `mote analyze` and `mote workbench dev` (analyze + watch + validate + live updates); `.mote/` generated dir with marker; authored files never touched
- [ ] Reference-structured shell from the page registry: primary navigation (Foundations · Components · Theme Studio; Products and modes absent), contextual grouped sidebar with narrow-screen disclosure, eyebrow/title/summary headers, back links, "On this page", restrained surfaces; shell appearance control separate from preview settings
- [ ] Searchable navigation across pages, components, recipes, models, tokens — search entries projected from the page registry
- [ ] Lazy-load library modules and detailed panels; cap frame count/logs/history; measure shell startup and selected-preview latency. Do not rely on optional app/state services until implemented.
- [ ] Implement initial shell accessibility: navigation landmarks, headings, skip links, keyboard controls, iframe names/focus exit, text alternatives for visual values, and usable narrow layouts.

**Foundations slice**

- [ ] Foundations overview: card grid (3/2/1 by container width) with title, summary, `Updated · tags`; only supported categories shown; dates omitted when not declared or not in source history; no Theme Studio card or sidebar entry
- [ ] Spacing detail page generated from the library's spacing contracts: derived introduction (strategy, inputs, step count, min/max), scale table (token, CSS custom property, source-unit value, proportional sample, origin), semantic vocabulary and precedence only where declared; baseline context label
- [ ] Two fixture libraries with different spacing strategies, names, and vocabularies produce different, correct pages without template edits
- [ ] Built-in copy + generated facts + authored overrides (`mote.docs.ts`) for these pages; regeneration preserves authored content; unknown content ids diagnosed

**Components catalog and detail pages**

- [ ] Catalog: grouped sidebar, search (name/summary/tags), category filter from metadata/config with fallback group, result count, grouped cards, URL filter state; no previews or module loading in cards; evidence-backed claims only
- [ ] Detail pages with provenance labels: Overview (description, use-for/not-for when authored, imports, registration), Interactive example, API, Examples, Tokens, Behavior and accessibility, Guidance, Source, Known limitations — each section only when supplied, otherwise "Not documented" with the content key
- [ ] Editable API table (Name · Type · Default · Current value · Description · attribute/reflection) as the only control surface: boolean property vs boolean attribute; `''` vs unset; `0`/`false`/`null` distinct; constrained numbers; enums/unions; optional/nullable; read-only inspect-only; model editor for `items`; CSS custom properties with token picker; fixtures required for non-serializable values; stacked rows on narrow screens
- [ ] Slot editors from the real slot contract (text for simple content, fixtures for compositions); no invented `children`-style properties
- [ ] Single write per change; no reflection loops; reset via clean instance; sync only through declared pairs or adapters
- [ ] Presets from `defineExamples`, Reset, Copy example link (versioned share payload), preview settings (mode, product if any, density, direction, profile, width presets + numeric; "Same as site")
- [ ] Event log with safe detail serialization; plain HTML + JS snippets (public imports, registration, object props, slots, listeners, theme attributes); no framework-specific snippets
- [ ] Tokens section: property/state → CSS property → token trace from declared mappings; every-token-read table (token, tier, read-through, resolved value + alias in the stated context); declared/potential/observed labels
- [ ] Preview layout experiment: adjacent sticky vs sticky-top on wide screens; stacked on narrow
- [ ] Basic previews without authored examples; authored examples listed when present; missing fixtures/providers labelled

**Isolated previews**

- [ ] One iframe per preview with own registry, import map, styles, theme scopes; typed versioned `postMessage` protocol
- [ ] Host and frame `Scope`s own frames, channels, observers, timers, fixtures; switching component/example disposes scopes (instrumented)
- [ ] Error isolation and reset; independent viewport and container sizing with real container queries; simultaneous light/dark previews
- [ ] Validate message origins/sources, protocol and generation IDs, disposed frames, incompatible metadata, and HMR requiring fresh registration realms. Check per-realm stylesheet and module ownership.

**First Theme Studio (primary destination)**

- [ ] `/theme-studio` route and primary navigation entry from the page registry; Themes/Spacing pages link to it where relevant
- [ ] Loads the library theme config via dev tooling into the editable JSON model; form editor (brand colour, spacing strategy fields, radius, type scale) and JSON editor on one draft
- [ ] Generation in a Worker with the canonical generator; latest-wins; invalid draft keeps last valid preview with path diagnostics
- [ ] Applied as preview-owned theme stylesheets; no remount; focus/state preserved; overrides and unrelated roles unchanged
- [ ] Default `theme-specimen` recipe with light/dark panels using the four components via declared preview roles; generic fallback specimens labelled
- [ ] Foundation pages show the baseline; "View draft" is explicit and labelled; baseline and draft never mixed

**Change-impact prototype and Workbench verification links** (change-impact-and-verification.md §2, §6; second priority)

- [ ] Draft `comparison-snapshot.v1` and `impact-report.v1`; `mote impact` prototype in `@mote/analyzer` over analyzer outputs, token inspection, examples, product configuration, and suite versions; stable-id matching with authoritative renames only
- [ ] Known-answer fixtures with 1, 2, 3, and 10 products: a token value change, a token type/unit change, a structural-style change, a foundation template change, a product-only override, a dynamic/unresolved dependency, and a renamed token with and without a migration record; zero missed dependencies, unresolved edges widen selection, fallbacks applied, states correct (`reused` only with listed baseline conditions)
- [ ] Selected checks executed through the existing runners; report merges results; Markdown rendering; local only
- [ ] Workbench detail pages link examples to source metadata, token inspection, and conformance/example results with their states and conditions; untested items never shown as passing
- [ ] Visual baselines via Playwright screenshots keyed by example, configuration hash, browser, and version; explicit accept command listing differences

**Agent-kit pilot** (local context and generated references before broader tooling)

- [ ] Prototype `resolveProjectContext` and kit generation as Node scripts over the M4 analyzer outputs, theme config, authored content, and examples, without building Workbench; promote them into `@mote/agent` in M11.
- [ ] Generate the entry guide, per-component references for the four slice components, token and recipe references, and the JSON contract bundles (analyzer output 5) for `@mote/components` and for a fixture library with a different prefix, packages, and theme; record the entry-guide size against a budget.
- [ ] Freshness fingerprints; `--check` detects stale artifacts after metadata, config, guidance, or example changes and names the refresh command.
- [ ] Generate the Mote repository's own concise `AGENTS.md` section (setup, conventions incl. §3.3, verification commands) between managed markers; existing text is preserved.
- [ ] Define the `inspectPreview` request/response over the existing frame protocol (design and types only; implementation in M11).

**Docs app slice**

- [ ] `apps/docs` shell from public packages; Getting started → tokens only; layout → side navigation (recipe, conditions, profile; data/declarative/hybrid); foundation and component pages embedding `@mote/workbench/panels/*`
- [ ] Copied snippets verified in a separate consumer
- [ ] Add a visible architecture/design-decision case study and local search slice. Decide initial static readable guide/reference content and document the client-only/SSR boundary without adding a Mote SSR engine.

**Acceptance:** Foundations overview and Spacing page match the reference's hierarchy using fixture libraries' own data; catalog search/filter/counts/URL state work without loading component modules; each slice component's detail page combines documentation, editable API table, slots, presets, preview settings, reset, sharing, and reproducible code; no Playground destination; Theme Studio is a primary destination absent from Foundations; basic exploration works with no authored stories; control semantics pass a dedicated test matrix; preview isolation and cleanup verified; base-colour/spacing/radius/type edits update real components without remount; invalid drafts keep the last valid preview; CLI and Worker outputs identical; docs app uses Workbench panels through public exports.

---

### M6 — Stores, context, and app ownership

- [ ] `createStore`/`update`/`select`, immutable snapshots, batching, reset/dispose, optional action instrumentation, stable external subscriptions
- [ ] Readables integrate via the existing graph and `Scope`
- [ ] Typed event-based context: nearest provider, overrides, independent roots, Shadow DOM, reparenting, provider replacement
- [ ] Persistence and inspection as separate entries
- [ ] Document external-store subscription semantics, nested snapshot updates, provider absence/reparenting, bounded inspection, persistence selection/versioning, and reset/migration behavior.
- [ ] `createApp()` start/stop/root ownership; restart; two isolated apps on one page

**Acceptance:** selectors notify only on selected-value change; disposal stops work; context follows providers; storage failures isolated; component-only consumers import no state/app code.

---

### M7 — Resources, navigation, real async UI, static builds

- [ ] Resource: inert construction, activation, invalidation, fresh request scopes, discriminated state, refresh/cancel/retry, freshness policy
- [ ] Race, abort-ignoring, disposal-during-parse, abort-vs-error, timeout, reconnect tests
- [ ] Router: parsing, history, lazy/nested routes, errors, URL as source of truth, per-navigation ownership
- [ ] Focus/title/announcement/scroll; native link escapes; base path; hash mode
- [ ] Docs app and Workbench shell on Mote's router; directory/detail recipe with all async states
- [ ] `mote workbench build`: metadata validation, static app with assets, lazy imports, deep links, configurable base path, page-registry legacy redirects (redirect stubs in history mode, in-app redirects in hash mode); never publishes/deploys; deterministic output
- [ ] Static build served under a subpath: deep links, refresh, redirects, share links, Theme Studio editing/generation/export work with no Node or analyzer backend
- [ ] Verify direct-path fallback versus hash routing honestly for the chosen host; test lazy-load failures, native anchor escapes, back/forward, stale navigation, focus/scroll, and available static guide content.
- [ ] Command/mutation examples distinguish cancellation from rollback and use an explicit retry policy.
- [ ] Page suspension and restoration (core-contracts.md §9.1, ADR 0035): explicit `@mote/app` lifecycle service; service suspend/resume; resource restore policies; browser fixtures proving actual persisted restoration (`pageshow.persisted`) distinct from reload and ordinary history navigation; repeated restoration, state preservation, listener counts, resource freshness, and explicit shutdown tested separately; environments that prevent real cache restoration recorded as not verified; no `unload` listeners; components inside other frameworks unaffected

**Acceptance:** search example needs no hand-written cleanup; stale data never wins; page suspension never disposes the app and restoration duplicates no listeners; navigation under base paths works; static Workbench build under a subpath retains full Theme Studio editing.

---

### M8 — Foundation validation and v1 compatibility checkpoint

- [ ] Real-browser tests: typing/selection/IME/autofill, direct bindings, keyed reorder with focus, lifecycle reentrancy, detached updates, moves, adoption, error recovery
- [ ] Forms and names, keyboard, screen readers (recorded browser/AT pairs), forced colours, reduced motion, contrast, 200%/400% zoom, reflow; [APG](https://www.w3.org/WAI/ARIA/apg/) and [WCAG 2.2](https://www.w3.org/TR/WCAG22/)
- [ ] Nested theme/product/density/mode/profile scopes across shadow roots; direction (`dir=rtl`) with logical properties
- [ ] Recipe review from side-nav; conditions in all engines at baseline syntax
- [ ] Data composition review; decide `props()`; composition-schema go/no-go (ADR)
- [ ] **Metadata and tooling review:** analyzer coverage of real components, dynamic-definition diagnostics, provenance accuracy, CEM interoperability, Workbench control-matrix results, preview isolation, Theme Studio live-edit behavior, example reuse in tests
- [ ] **Assurance review:** initial conformance and impact evidence (false-positive conformance failures, missed mutants, missed dependencies and incorrect predictions in known-answer fixtures), inspection-overhead assessment for `@mote/core/inspect` in development builds with zero production bytes, and explicit decisions on the new public contracts (`conformance.v1`, `comparison-snapshot.v1`, `impact-report.v1`, `explanation.v1`, `reproduction.v1`)
- [ ] **Multi-product review:** recomposition semantics, layered exports and foundation entries, style-ordering policy, anatomy contracts, the composite dependency mechanism decision (ADR), metadata fields, and 1/2/3/10-product CSS growth; record candidate v1 contracts for the customization levels actually supported
- [ ] **Agent-kit review:** agent-facing metadata fields, diagnostic envelope, project-context and kit schemas, freshness rules, and the pilot's references for the slice and the fixture library; record candidate v1 contracts alongside the metadata review (additive changes afterward follow ADR 0029)
- [ ] 1,000-cycle lifetime instrumentation + retained memory (components, previews switching, Theme Studio edits)
- [ ] Packed CSS-only, core-only, components-only, full-app consumers; optional and tooling code absent from actual import graphs
- [ ] Initial benchmark and ergonomics studies (§8)
- [ ] Review comprehension of render-tracked reads vs direct readable bindings vs untracked snapshots, production errors/debug stripping, duplicate-core/version behavior, host/slot/container boundaries, form limitations, localization, shell accessibility, and actual import graphs. Revise APIs where novice evidence shows avoidable ceremony.
- [ ] Reconcile every new §2.4–§5f contract with an implemented test, a later owning milestone, or an explicit deferred item; no unowned requirement survives the checkpoint.
- [ ] Simplify from evidence; update ADRs; **record candidate v1 contracts for authoring, recipes, collections/models, metadata, `defineExamples`, and Workbench config**, backed by foundation tests and experiments. Breaking changes afterward require an ADR, affected-consumer analysis, a migration plan, and updated verification. M9–M11 exercise these contracts (compatible additions proceed; material changes follow that process). **Final v1 freeze at M12** covers the contracts actually shipping, after release verification

**Acceptance:** every contract has passing evidence or a scoped blocker. Correctness defects are never traded for catalog size, tooling features, or benchmark scores.

---

### M9 — Complete theming and Theme Studio

**Token domains and outputs**

- [ ] Colour ramps + gamut mapping, explicit palettes/roles, neutral and status colours, additional brand colours, light/dark, interactive states, typography, control sizing/padding, radii, borders, motion (incl. reduced motion), elevation, products, density
- [ ] Contrast reports on actual role pairs; supplementary diagnostics labelled with cited methods
- [ ] One resolved model → CSS, typed refs/values, Sass refs + literals + `mote.when()`, DTCG 2025.10 JSON (+ `$extensions`), provenance metadata, validation reports
- [ ] Equivalent CSS/SCSS/TS consumption of roles and conditions verified
- [ ] Verify typed DTCG encodings and supported mappings using an independent reader; report unsupported/lossy conversions instead of silently flattening. Test explicit user overrides, system-mode first paint, increased root font size, optional reset/fonts, and generated scope CSS growth.

**Theme Studio completion** ([workbench.md §6–§9](./docs/architecture/workbench.md))

- [ ] Controls for every category, strategy-aware; labels for foundation/generated/alias/override; density vs typography vs target size kept distinct
- [ ] Specimens: replaceable recipe; light/dark panels; surface, heading, body, link, badge, labelled input, checkbox, switch, primary/secondary actions, navigation, composed layouts; rest/hover/pressed/focus-visible/disabled/invalid/custom states via interaction or supported fixtures, otherwise labelled token specimens
- [ ] Role mapping: automatic only when unambiguous (declared `@previewRole` or adapter); picker with compatibility diagnostics; adapters over public props/slots/events/fixtures/Scope; saved compositions (versioned)
- [ ] Token inspection: type, configured/generated/override values, alias chain, provenance, variations, computed value in selected preview, declared/potential/observed references (static reference ≠ proof of effect)
- [ ] Visualizations: ramps, light/dark roles, contrast pairs (unknown contexts labelled; not certification), spacing, typography/line height, radius/border/elevation, control sizing/density, alias graph, baseline-vs-draft diff; linked to config fields and consumers
- [ ] Layout roles, conditions, profiles editable with resizable container previews
- [ ] Comparison: baseline vs draft; multiple independent and nested scopes; product/density/direction/profile selection; viewport/container resizing
- [ ] Reset, undo/redo, presets; versioned validated share URLs (non-serializable values excluded with a note); config import/export; CSS/SCSS/JSON/TS exports via the canonical generator only
- [ ] Explicit dev-mode "Save to file" with diff and confirmation; browser never silently overwrites source
- [ ] Standard-CEM baseline: CSS-custom-property editing without generator, clearly labelled
- [ ] Condition/profile edits regenerate only relevant preview-owned generated CSS; do not mutate reusable component static sheets. Verify Worker coalescing, stale-work cost, bounded history, and truthful export pending/error state.
- [ ] Complete keyboard/screen-reader operation of editors, comparison panels, swatches/graphs, mappings, validation messages, and exports; state/value information is available without color alone.
- [ ] Theme Studio page structure from capabilities (Generate · Ramps and roles · Live preview · Contrast · Color vision · Comparison · Inspection · Exports · Method and limits) with an optional sticky live-result summary; remains a primary destination

**Foundation detail pages (all categories)** ([workbench-pages.md §5](./docs/architecture/workbench-pages.md))

- [ ] Token architecture, Color, Typography, Borders and radii, Elevation, Motion, Themes, Responsive behavior pages generated from the canonical token outputs and enrichment, each section only when supplied; tables, specimens, alias chains, variations, interactive motion demos with reduced-motion behavior, resizable responsive examples, usage snippets; Themes links to Theme Studio
- [ ] Every value-bearing section labels its context (baseline by default; explicit labelled draft); computed pixels only with an explicit preview context
- [ ] Built-in explanatory copy for each concept, phrased without asserting library-specific facts; authored overrides per page/section

**Products and modes (optional)** ([workbench-pages.md §9](./docs/architecture/workbench-pages.md))

- [ ] Disabled by default: no route, navigation, card, search entry, or comparison content
- [ ] When enabled: configurable placement; product definitions validated against the product schema; sources from local theme config, installed packages, or versioned manifests fetched and snapshotted at build time; diagnostics for unavailable/incompatible sources
- [ ] Product comparison composed with mode/density/profile using the canonical generator and isolated previews; product identity kept distinct from mode, theme, density, profiles
- [ ] Workspace discovery (`mote workbench products --discover`) reports suggestions with reasons; excludes tooling, docs apps, tests, examples, internal packages by default; never enables or publishes a page
- [ ] Product-aware impact reporting: token, preset, and product-configuration changes report affected products, families, and examples with reasons; verification selection across 1/2/3/10-product configurations
- [ ] Styling explanations in Workbench and Theme Studio (`explanation.v1` §4.1): observed computed value, source-unit token value, component variable, semantic role, alias chain, scope context, overrides, recipe/condition relationships, provenance and limitations; condition activity only when reliably observed; measurements only through explicit inspection; correct in nested product scopes
- [ ] DTCG Resolver experiment and decision (§5.1)
- [ ] Any number of products: searchable product selection, comparison of user-chosen products with only those previews mounted, per-product assets loaded on demand, deselected previews disposed; verified with 1-, 2-, 3-, and 10-product fixtures, including selection, comparison, loading, cleanup, and preview resource usage
- [ ] Additive `product.v1` fields for design language, component family, and foundation compatibility ranges; `product.foundation.incompatible` diagnostics from installed or supplied artifacts without checking out other repositories
- [ ] Token generator: product-specific semantic role overrides and several themes (design languages) per document, with nested-scope verification across shadow roots, slotted content, overlays/popovers, relocated components, and adopted documents; CSS growth re-measured for 1/2/3/10 products; no product × mode × density × profile emission
- [ ] Shared and different design languages; shared and product-specific component families; independent and nested product/theme scopes; product-specific focus visibility, contrast, target size, direction, reduced motion, and forced colours where supported

**Acceptance:** exported config and styles reproduce the preview in an independent consumer; SCSS consumer follows scoped themes; base-colour, spacing, sizing, and typography changes affect compatible components correctly; overrides and unrelated roles preserved; library components replace specimen roles with useful diagnostics; CSS-only adoption still needs no Mote JS; every supported foundation page renders from data with honest absence elsewhere; Products and modes is absent unless enabled and its source paths work in static builds.

---

### M10 — Component catalog and behavior modules

- [ ] Layout recipes preset catalog (side nav, page shell, card grid, toolbar) from demonstrated needs
- [ ] Layout elements decided per layout-recipes.md §7 (behavior/container contracts → custom elements; layout-only wrappers → recipe classes); decisions recorded
- [ ] Primitives: `mote-text` · `mote-heading` · `mote-button` · `mote-badge` · `mote-icon` · `mote-link` · `mote-input` · `mote-select` · `mote-checkbox` · `mote-switch` · `mote-progress` · `mote-skeleton` · `mote-visually-hidden`
- [ ] Composites: `mote-card` · `mote-dialog` · `mote-alert` · `mote-tabs` · `mote-disclosure` · `mote-field` · `mote-page-header` · `mote-empty-state` · `mote-radio-group`
- [ ] Collection components on shared collections with own models and APG keyboard behavior; menus/listbox/tree/table only from demonstrated needs
- [ ] Form descriptions model consumed by `mote-field`/inputs
- [ ] Composition schema (only if M8 go) in `@mote/components/composition` (`renderComposition()`; distinct from the definition composer `compose()`)
- [ ] Controllers extracted only from demonstrated shared needs
- [ ] Conformance suites per catalog component with assertions, invariants, mutants, and accepted customizations; published under `@mote/workbench/conformance/*` with versions tied to their foundation contracts
- [ ] Declare each component's supported customization levels; recomposable components ship layered exports, a foundation entry, a typed anatomy contract, documented structural styles, and shared interaction fixtures; behavior controllers with explicit host requirements only where templates differ substantially and evidence justifies them
- [ ] Extend analyzer and example coverage to each catalog component as it lands: authored design guidance (when appropriate, constraints, labelling and accessibility responsibilities, content relationships and companions, token roles and customization paths, recipes and responsive expectations) with validated references, and correct/incorrect example pairs for its common mistakes

**Per-component definition of done:** typed runtime definition (statically analyzable) · analyzer-generated CEM + enrichment entry with provenance · defaults and allowed values · property/attribute/event-detail contracts · declared sync pairs · slots, parts, CSS variables, custom states, roles and tokens used · preview roles · recipe and container behavior · data model (if structured) · accessibility/keyboard/form guidance · known limitations · category, use-for/not-for, and property → CSS property → token mappings where determinable · `*.examples.ts` (default + key variants + presets + fixtures where needed) · Workbench detail page (documentation + interactive example + editable API table) renders with no gaps beyond labelled ones · docs page, source link · browser and lifetime tests driven by shared examples · narrow/wide check · metadata-vs-implementation contract check · agent-kit reference generated with validated guidance references (missing guidance labelled unavailable) · supported customization levels declared; recomposable components verified with a derived definition against the same interaction fixtures · conformance suite with mutants and evidence records.

---

### M11 — Documentation application, Workbench completion, migrations, onboarding, agent tooling

**Information architecture (`apps/docs`)**

- [ ] Overview + package chooser
- [ ] Getting started — five paths: tokens only · components in any app · author custom elements · full Mote application · **document your own library with Workbench**
- [ ] Installation (npm, native ESM, import maps, browser matrix); plain JS and TS examples
- [ ] Core concepts + API reference
- [ ] Components catalog (embedded Workbench panels; counts and status from metadata)
- [ ] Theming, styling, layout, composition (component and page authors) guides
- [ ] Data composition guide: when to use data, templates, or hybrid; models and runtime validation of external JSON (TS types don't validate JSON); controlled vs uncontrolled state; region sources; customization ladder (options → slots/parts → render functions → registered kinds); local vs portable configuration; versioning and migrations; composition schema (if shipped)
- [ ] **Tooling guides:** analyzer (supported patterns, explicit metadata, diagnostics, provenance, CEM vs enrichment), Workbench (config, examples, adapters, preview roles, standard-CEM baseline, static builds and hosting), Theme Studio (controls, specimens, mapping your components, sharing, exports)
- [ ] Forms, accessibility, debugging (incl. explanations, impact reports, conformance suites, reproductions, page suspension)
- [ ] Agent tooling: install, instructions, CLI, MCP, what it reads, limits
- [ ] Recipes (labelled fictional), framework guides (React/Angular/Vue/Svelte, pinned verified versions); start from [React custom elements](https://react.dev/reference/react-dom/components#custom-html-elements), [Angular schemas](https://angular.dev/api/core/CUSTOM_ELEMENTS_SCHEMA) and [forms adapters](https://angular.dev/api/forms/ControlValueAccessor), [Vue Web Components](https://vuejs.org/guide/extras/web-components), and [Svelte custom elements](https://svelte.dev/docs/svelte/custom-elements)
- [ ] Architecture & decisions, including "How Mote compares"
- [ ] Troubleshooting, upgrades, release notes, contributing
- [ ] Document the binding rule (render-tracked `.value` reads, direct readable bindings, untracked snapshots in handlers/async callbacks), cancellation ownership, common error codes, localization, native form strategies/limits, version coexistence, external-store integration, and client-only versus server-rendered host use.
- [ ] Publish architecture/decision case studies with working examples and measured evidence; version the API references and generate stable searchable links. Build-time readable docs content must not imply runtime SSR support.

**Workbench completion**

- [ ] Composition previews (multiple components, saved compositions), direction selector, recipe/profile previews with region maps
- [ ] Model-driven data editors with validation and JSON import/export of the portable subset
- [ ] Watch-mode robustness (renames, deletions, stale artifact cleanup in marked dirs only)
- [ ] Standard-CEM-only fixture library (outside Mote) documented end to end at the baseline level with missing enrichment labelled; Foundations shows "No foundation data supplied" guidance rather than empty tables
- [ ] Public API comparison wired into release checks (`mote analyze --compare`)
- [ ] Content customization complete: typed `mote.docs.ts` and Markdown front matter for titles, summaries, introductions, section guidance, examples, tags, ordering, visibility, dates; fact interpolation tokens; content schema migrations; per-locale variants; regeneration never overwrites authored files
- [ ] Runtime explanations from development-only `@mote/core/inspect`: tracking path, dependencies, scheduling/commits, owning scope, and active/cancelled/superseded/suspended/disposed work; opt-in, bounded, owned by the preview or session; stale records invalidated on instance, frame, registration, or source change; zero production bytes
- [ ] Runnable reproductions (`reproduction.v1`): `mote workbench repro export` and Workbench **Export reproduction**, distinct from share links; declared inputs only, undeclared ones listed with required adapters; representative exports re-fail in clean directories from packed or pinned packages
- [ ] CI verification selection from impact reports with merged results and explicit visual-baseline acceptance
- [ ] Compare product implementations (default vs derived definitions, product families) using shared examples and interaction fixtures; family/implementation switches follow the structural remount rules
- [ ] Every catalog component's detail page renders without gaps beyond labelled "Not documented" sections; `apps/docs` foundation and component pages are Workbench panels, with no duplicate explorers

**Migration walkthroughs** (prerequisites · start · small steps · before/after · verification · limitations; executed in CI)

- [ ] Adopt Mote components; hard-coded CSS/SCSS → tokens; tokens without JS; `.css` ↔ CSS-in-TS; product theme; author a custom element; compose a feature; optional state/resources/router
- [ ] From Lit / FAST authoring
- [ ] Multi-product guide and walkthrough: second product by theme values; product skin from a foundation; product-aware composite; separate-repository product package with foundation compatibility ranges
- [ ] Repeated layout CSS → recipes, conditions, profiles; repetitive markup → models (or back to templates)
- [ ] **Existing component library → Workbench** (run analyzer, fix dynamic-definition diagnostics, add examples and preview roles, build static site)
- [ ] Supported mappings recorded in metadata for `@mote/agent`

**Agent tooling (`@mote/agent`)**

- [ ] Package (Node only); boundary checks; no browser, ordinary-consumer, or docs-runtime graph reaches it; no mandatory hosted model, embedding service, or second analyzer
- [ ] Agent operations `explainImpact`, `explainElement`, `runConformance`, `exportReproduction` returning the same structured records, uncertainty, and provenance as Workbench and CLI
- [ ] Product-scoped lookups and references (foundation used, fitting customization level, product-specific tokens/styles/templates/dependencies, contracts and checks to preserve), produced on demand; verified with the 10-product fixture
- [ ] `./context`: project context, capability paths, fingerprints, freshness; local lookup offline; remote docs only when versions match and labelled
- [ ] `./kit`: entry guide, task references, component/token/recipe/model references, JSON bundles; optional Agent Skills directory, managed `AGENTS.md` section (existing instructions preserved, diff before write), IDE adapters; `llms.txt` and clean Markdown pages in docs static builds; document client-dependent loading
- [ ] Operations over analyzer outputs: inspect project, exact contracts, search, explain/validate config, scaffold, plan migrations, models/data validation, composition advice, **preview-role mapping**, **export verification**, **product suggestions**, **page/content explanation**, run checks — with provenance; never load element modules
- [ ] Agent-facing capabilities (agent-tooling.md §6.1): inspect project, find components, inspect component, find/explain tokens, inspect recipes, scaffold component, validate usage, plan migration, inspect preview — bounded, searchable responses with stable ids and links to detail
- [ ] CLI (`--json` and readable output), instruction generator, optional MCP adapter (ADR; pinned protocol revision; `inputSchema` and `outputSchema` per tool, `structuredContent`, tool execution errors carrying Mote diagnostics)
- [ ] Scaffolding and migrations produce reviewable patches, default to dry run, and re-check source preconditions before applying
- [ ] `inspectPreview` through Workbench frames: examples and supported compositions, documented properties/slots/interactions, viewport/container/direction/theme changes, runtime errors, events, applicable accessibility and browser checks; reports engine, configuration, and conditions; remount policy preserved; trusted project examples only
- [ ] Evaluation (implementation, theming, explanation, migration, data composition, **Theme Studio role mapping**): API correctness, fabricated names, compilation, browser behavior, completion; with vs without tools
- [ ] Expanded evaluation (agent-tooling.md §11) on Mote and a held-out consuming library: the ten task types × four conditions (docs alone; + generated references; + deterministic tools; + preview feedback); record model/version, starting repository, package versions, task, context, conditions; measure correctness, invented APIs/tokens/claims, selection quality, repairs, time, context/tool-output volume, unnecessary edits, unknown handling, regressions and unintended dependencies; example validity checked independently
- [ ] Agent-generated side nav, editable list, and an example file pass the same checks as handwritten ones
- [ ] `scaffold` generates repository components in the §3.3 folder structure (class, template, styles, definition, define entry, side-effect-free `index.ts`, examples) through the public composition API, and offers colocated output for consumers who ask for it

**Onboarding**

- [ ] Optional scaffolding after APIs stabilize; not advertised until implemented (component scaffolds follow the §3.3 folder structure)
- [ ] One recommended starter per adoption path, plain JS and TS, with only required imports/config. Add optional `mote doctor` over existing validators and an actionable installed-version report; focused token/analyzer commands still work independently.
- [ ] Distribute agent instruction/plugin assets and installed-version manifests with the existing CLI/MCP layer; test them in at least one actual supported IDE setup.
- [ ] Every copied/generated example and exported theme verified in fresh directories from packed releases

**Acceptance:** walkthroughs execute in CI; docs/controls/snippets match metadata; unfamiliar developers complete the usability tasks (§8.3); agent evaluation recorded; shared examples drive docs and tests.

---

### M12 — Distribution, release, deployment readiness

- [ ] Full unit/type/browser suite, three-engine correctness, packed-consumer matrix, size checks; results and limits in `docs/verification.md`
- [ ] ESM/declarations/export maps, licence, README examples, package contents, registration side effects, `customElements` field, independent versions/changelogs
- [ ] Tag-name conflicts documented honestly; scoped-registry/renaming tested separately
- [ ] Independent consumers: plain HTML, CSS-only (incl. `layout.css`), Sass, typed refs, core-only, components-only, full app — none contains analyzer, Workbench, agent, unused presets, validators, the `components/composition` renderer, `core/inspect`, or conformance/testing helpers
- [ ] Packed `@mote/analyzer` + `@mote/workbench` run in a fresh project against a packed component library (Mote and standard-CEM fixture); static build under a subpath with page-registry navigation, legacy redirects, share links, and Theme Studio editing
- [ ] Packed verification of assurance tooling: conformance suites run from packed `@mote/workbench` against packed component and product packages; impact reports compare two packed release candidates; reproductions re-fail in fresh directories; production consumer graphs contain no `core/inspect`, conformance, testing, or reproduction code; compatibility evidence recorded for the capabilities actually shipping
- [ ] Packed multi-product consumers across independently versioned packages (foundation package, product skin package, product theme, application) installed in separate fresh directories; minimal foundation consumers contain no branded skins, theme generation, tooling, or application services; verification results recorded per implementation and configuration
- [ ] Packed `@mote/agent` run against packed metadata
- [ ] Agent kits regenerated from packed `@mote/components` and a packed consuming fixture library in a fresh directory: freshness check clean, references match installed exports, published examples pass against packed packages, `AGENTS.md` merge preserves existing text; evaluation results recorded before the freeze
- [ ] Final v1 freeze covers the actually shipped APIs, token domains, supported DTCG mappings, examples/config/enrichment schemas, frame protocol, and migration/deprecation rules; run compatibility fixtures against an earlier released/pre-release artifact.
- [ ] Verify installed Node tool dependencies, optional framework declarations/adapters, duplicate-version diagnostics, production debug exclusion, shell accessibility, locale strings, and static-readable documentation. Record unsupported platform features explicitly.
- [ ] Framework fixtures in `integration/`; verified versions recorded
- [ ] Reproducible benchmark methods/raw results; comparison pages
- [ ] Docs and Mote Workbench hosting: real base path, deep links, refresh, assets, metadata, fallback content
- [ ] Contribution, release, compatibility, deprecation, upgrade policies (incl. metadata schema versioning). Publishing/deployment is separately authorized

**Acceptance:** a release candidate installs and works without workspace access, private imports, unexpected deps, or undocumented transforms; docs and Workbench demonstrate released APIs and state tested limits.

---

## 7. Global acceptance criteria

| # | Criterion | Evidence in |
| --- | --- | --- |
| 1 | One reactive engine powers local state, readables, selectors, resources; state/app optional for components | M3, M6, M8 |
| 2 | Listeners/timers/observers need no mirrored manual cleanup; teardown, reconnect, moves, adoption follow contracts | M3, M8 |
| 3 | Effect reruns and resource supersession release old work; stale results cannot commit | M3, M7 |
| 4 | Batching and derived reads are predictable; direct bindings avoid unnecessary renders without losing DOM identity | M3, M8 |
| 5 | Templates preserve focus, selection, native control state, keyed identity, cleanup; diagnostics identify binding and phase | M3, M8 |
| 6 | Properties/events/attributes work in plain HTML and tested frameworks; no Mote store mandatory | M4, M12 |
| 7 | Forms, accessible names, keyboard, browser differences have evidence beyond automated scans | M4, M8 |
| 8 | Small config → deterministic tokens; exact spacing outputs with preserved units and stable names; actionable diagnostics | M2 |
| 9 | CSS-only consumer needs no Mote JS; SCSS follows scoped themes; CSS-file and CSS-in-TS equivalent; literals explicit | M2, M4, M9 |
| 10 | Typed reference imports are DOM-free and registration-free | M1, M4 |
| 11 | One sheet per style definition per document; nested aliases and scopes correct across shadow roots | M3, M8 |
| 12 | Optional and tooling imports absent from minimal fixtures; boundary and runtime-dep rules hold in emitted artifacts | M1, M8, M12 |
| 13 | Exported themes and copied snippets work in independent consumers | M5, M9, M11, M12 |
| 14 | Docs, controls, generated code, and implementation stay aligned | M5, M10, M11 |
| 15 | Framework examples exercise the actual state, routing, resource APIs | M7, M11 |
| 16 | Benchmark and usability results back any published claim, including unfavorable results | M8, M12 |
| 17 | Keyboard, form, contrast, resizing, reduced-motion, and browser checks recorded accurately | M8, M12 |
| 18 | Layout recipes produce reusable CSS with documented defaults, precedence, diagnostics; overrides never mutate shared styles | M3, M4, M8 |
| 19 | Container-responsive layout works without JS resize handling across slots and nested custom elements | M4, M8 |
| 20 | Roles, conditions, profiles validate, emit deterministically, re-resolve in nested scopes, never shrink text/targets below minimums | M2, M8, M9 |
| 21 | Same role contracts usable from native elements, custom components, CSS, SCSS, TS | M4, M9, M11 |
| 22 | Typed local objects and validated external JSON; path-precise diagnostics; version migrations | M3, M4 |
| 23 | Data-driven, declarative, hybrid authoring equivalent; region sources documented and diagnosed | M4, M10 |
| 24 | Collections preserve identity/focus/state; external reactive changes update unchanged items; scopes released; repeated mount/unmount returns to baseline | M3, M4, M8 |
| 25 | Controlled vs uncontrolled state and precedence never create competing sources of truth; caller data never mutated | M4, M8 |
| 25a | Data-driven components work from plain JS and tested framework consumers without Mote state, with responsive recipes and nested themes; minimal consumers exclude unused model validators, schema emitters, and composition modules | M4, M8, M12 |
| 26 | **Standard CEM validates against the pinned schema and works with an independent consumer; enrichment is separate and versioned** | M4, M12 |
| 27 | **Metadata is extracted without executing modules, matches implementation and published exports, and labels every fact's provenance; dynamic definitions are diagnosed** | M3, M4, M8 |
| 28 | **Basic Workbench exploration works without authored stories; standard-CEM libraries get the documented baseline; missing enrichment is labelled, never invented** | M5, M11 |
| 29 | **Controls handle property vs attribute, nullable, falsy, read-only, unset, and reset correctly; complex values use schemas, fixtures, or adapters** | M5, M8 |
| 30 | **Preview registries, styles, failures, and lifecycle resources are isolated; switching components/examples disposes previous scopes** | M5, M8 |
| 31 | **Theme Studio uses the canonical config, validation, and generator; CLI and browser outputs are identical; edits update real components without remount, preserve state, keep overrides/unrelated roles, keep the last valid preview on invalid drafts, and latest generation wins** | M2, M5, M9 |
| 32 | **Library components map to specimen roles via declared capabilities or adapters with useful diagnostics; fallbacks labelled** | M5, M9 |
| 33 | **Token provenance, computed values, references (declared/potential/observed), state specimens, and verification labels are accurate; contrast results are not presented as certification** | M9 |
| 34 | **Shared `defineExamples` drive Workbench, docs, browser tests, Theme Studio, and agents** | M4, M5, M10, M11 |
| 35 | **Analyzer watch mode and Workbench builds are deterministic and preserve authored files; static builds work under a subpath with full Theme Studio editing and no backend** | M5, M7, M11 |
| 36 | `@mote/agent` is dev-only; operations return exact installed contracts with provenance; agent output passes the same checks as handwritten code | M11, M12 |
| 37 | Milestone build order is valid; examples/helpers do not create production cycles, and the first Workbench runs before optional state/router services exist | M1, M3–M7 |
| 38 | Render-tracked `.value` reads, direct readable bindings, untracked snapshots, public-property bindings, dual-path coalescing, and update/readiness boundaries are understandable and verified | M3, M8 |
| 39 | Failure ownership and development/production diagnostics are explicit; no silent errors, permanent stopped bindings without recovery guidance, or mandatory debug machinery | M3, M8, M12 |
| 40 | Registry collisions/version limits are diagnosed; protocol, realm, and duplicate-package behavior match the published compatibility policy | M3, M5, M8, M12 |
| 41 | External stores/frameworks integrate through stable public properties/events/subscriptions and optional typed/form adapters without Mote application state | M4, M6, M12 |
| 42 | Container/slot/shadow/cascade behavior and live threshold edits match native CSS constraints and verified baseline syntax | M2, M4, M8, M9 |
| 43 | Native/custom form strategies and limits are explicit; submitter, validation, reset, keyboard, and naming behavior have browser evidence | M4, M8, M12 |
| 44 | Themes preserve units/user font preferences; first paint, overrides, nested aliases, output size, and supported DTCG mappings are independently verified | M2, M8, M9 |
| 45 | Workbench/docs are keyboard/screen-reader usable, localized through documented contracts, lazy-loaded, and bounded in frames/logs/history | M5, M9, M11, M12 |
| 46 | Architecture case studies, static-readable/versioned docs decisions, actionable diagnostics, and novice/agent adoption paths support the released product | M5, M11, M12 |
| 47 | Every research task has a direct primary-source starting link and a recorded decision/evidence status; existing completion claims are not upgraded without verification | M0–M12 |
| 48 | **Foundations matches the reference's card/navigation hierarchy (eyebrow, title, summary, card grid, contextual sidebar) using each library's actual data; detail pages include applicable tables, specimens, aliases, explanations, anchors, and examples; unsupported sections are absent** | M5, M9 |
| 49 | **Different library configurations produce different, correct content without editing application templates; nothing from the reference (inventory, taxonomy, token names, values, claims) is hardcoded** | M5, M9, M11 |
| 50 | **Card dates, tags, counts, and verification statements are accurate or omitted; dates come only from declared metadata or source history, never build time** | M4, M5, M11 |
| 51 | **Configuration changes regenerate content without overwriting authored guidance; generated facts stay authoritative over prose** | M5, M11 |
| 52 | **Components keeps searchable/filterable catalog navigation with counts, configurable categories, fallback group, and URL state; cards load no component modules** | M5, M11 |
| 53 | **Each component detail page combines documentation, editable API table, slots, preview settings, presets, reset, sharing, and reproducible plain HTML/JS code; there is no standalone Playground destination** | M5, M10, M11 |
| 54 | **Theme Studio is a primary destination absent from the Foundations cards and sidebar; foundation pages show the baseline unless a labelled draft is explicitly selected** | M5, M9 |
| 55 | **Products and modes is absent by default; discovery suggests but never invents products; explicit local, installed, and versioned-manifest sources work, including cross-repository, and are snapshotted into static builds** | M9, M12 |
| 56 | **Navigation, routes, cards, search, and visibility stay synchronized through one page registry; legacy routes redirect; static builds, deep links, assets, redirects, and sharing work under a hosting base path** | M3, M5, M7, M12 |
| 57 | **Missing metadata produces honest unavailable/unknown states; Workbench stays accessible, responsive, lazy-loaded, and isolated; shell and preview appearance are independent** | M5, M8, M11 |
| 58 | Mote's own components use one folder per component assembled through the public composition API; ordinary imports never register; migrated components keep their properties, attributes, events, slots, parts, styling, reactivity, lifecycle, cleanup, DOM identity, metadata, exports, and packed behavior; colocated consumer authoring stays supported and tested | M4, M8, M11 |
| 59 | A library built with Mote generates its own versioned agent kit from the same metadata, configuration, authored guidance, and examples as its docs and Workbench, without building Workbench; references match its installed packages, prefix, tokens, recipes, and conventions | M4, M5, M11, M12 |
| 60 | Agent-facing facts come from the one metadata model with provenance and verification conditions; unknowns are explicit; authored guidance cites only existing APIs; nothing is inferred from names or types | M4, M8, M10, M11 |
| 61 | Agent context is version-aware: stale artifacts are detected with a refresh path, results state source version and freshness, and capability paths are respected | M5, M11, M12 |
| 62 | CLI and MCP share one deterministic implementation with schema-defined, bounded, structured results; scaffolds and migrations are reviewable dry-run patches with checked preconditions | M11, M12 |
| 63 | Diagnostics are repairable (code, location, subject, expected/received, references, fix only when supported) and distinguish errors, recommendations, and unresolved analysis; preview feedback reports its conditions and never claims complete accessibility | M4, M8, M11 |
| 64 | AI usability claims rest on the recorded four-condition evaluation with held-out tasks and configurations; AI tooling stays optional for every consumer path | M11, M12 |
| 65 | Any number of products (verified at 1, 2, 3, 10) uses one model with stable ids, no count-specific fields or slots, and no single-product ceremony; product identity stays independent of repository, family, design language, theme, mode, density, and profile | M4, M9, M12 |
| 66 | Recomposed definitions are new, frozen, traceable, and never mutate their source; registration conflicts are diagnosed, never silently replaced; both implementations coexist with distinct names/constructors | M4, M8 |
| 67 | Derived definitions and alternative templates pass the same interaction fixtures (properties, methods, events, slots, keyboard, focus, states, forms) and product-specific accessibility checks; foundation results are never presented as certifying a skin | M4, M10, M12 |
| 68 | Product-aware composites render and register product children through one explicit, analyzable mechanism without tag guessing, global substitution, or a provider | M4, M8, M10 |
| 69 | Configuration changes to one product never alter shared presets or other products; generation is deterministic; CSS growth is measured per product without combinatorial emission | M4, M9 |
| 70 | Workbench selection and comparison, on-demand loading and cleanup, and agent lookups stay scoped and usable as the product collection grows; Products and modes stays absent unless enabled | M9, M11 |
| 71 | Minimal foundation consumers load no branded skins, theme generation, tooling, or application services; packed multi-repository product consumers work through public exports | M4, M12 |
| 72 | Impact reports match by stable identity, recognize renames only from authoritative records, classify changes without automatic semver mapping for token values, keep edge provenance and coverage gaps, and widen verification for unresolved dependencies | M5, M8, M9, M12 |
| 73 | Verification results always carry one state (`selected`, `passed`, `failed`, `reused` with conditions, `not-executed`, `unresolved`); untested examples are never shown as passing; visual baselines change only through explicit acceptance | M5, M11, M12 |
| 74 | Portable conformance suites accept legitimate customizations, reject their mutants, use only public capabilities and documented anatomy, and record evidence per implementation, configuration, browser, and suite version; they are not accessibility certification | M4, M8, M10, M12 |
| 75 | Explanations share one model across Workbench, CLI, and agents; declared, potential, and observed relationships stay labelled; no claimed cascade reconstruction, emulated responsiveness, or invented causal history | M9, M11 |
| 76 | Runtime inspection is development-only, opt-in, bounded, owned, invalidated on change, measured for overhead, and absent from production graphs and size budgets | M8, M11, M12 |
| 77 | Runnable reproductions contain only declared inputs, list what needs adapters, use public exports, re-fail in clean directories, and are never published automatically | M11, M12 |
| 78 | Page suspension never disposes the application; restoration resumes declared services without duplicate listeners and revalidates only by policy; persisted restoration is proven, not inferred from history navigation | M7, M8 |
| 79 | DTCG Resolver support is an explicit, evidence-backed decision with documented mappings, never implied by Format support | M9 |
| 80 | The component-definition composer (`compose()`) and the data-composition renderer (`@mote/components/composition`) are distinct in prose, imports, examples, and dependency checks | M4, M12 |

---

## 8. Performance and ergonomics verification

### 8.1 Hypotheses

| Hypothesis | Decision | Required evidence | Cost to disclose |
| --- | --- | --- | --- |
| Narrow updates reduce work | Direct readable→part subscriptions, cached templates | Unrelated bindings and `render()` do no work; DOM writes, CPU, allocation, end-to-paint | More subscriptions can cost startup and memory |
| Ownership simplifies cleanup | `Scope` across connections, effects, requests, controllers, previews | Reconnect/navigation/preview-switch tests return to zero owned work | Non-cooperative promises still need result guards |
| Local state is obvious | `signal`, `.value`, `.update`, pure `computed` | Counter, derived form, async search without manual flush | Explicit replacement differs from proxy models |
| Setup is easier | Plain ESM example, typed starter, one package path | Fresh-directory scripts and novice walkthroughs from packed releases | TS and CSS transforms still need dev tooling |
| Optional features stay optional | Subpaths, explicit registration, tooling packages separate | Minimal graph has no store, router, generator, inspector, analyzer, Workbench, agent | Many entry points need clear docs and checks |
| Impact-based selection reduces verification work without missing regressions | Snapshots + typed edges + conservative fallbacks | Known-answer fixtures: zero missed dependencies; fraction of checks selected vs full runs; incorrect predictions recorded | Snapshot and graph maintenance; broad fallbacks may select most checks |
| Portable suites keep customizations faithful | Conformance contracts + adapters + mutants | Legitimate variants pass, mutants fail, false-positive rate on real product variants | Authoring suites and adapters; incomplete assertions miss behavior |
| Explanations speed up diagnosis | One explanation model over existing provenance | Time to answer "why" questions in usability tasks; stale-record count; overhead | Instrumentation cost in development builds |
| Themes are easier to adopt | Small config, deterministic outputs, ordinary CSS refs | CSS-only, Sass, CSS-in-TS, nested scope, exported theme fixtures | Generated colours don't guarantee accessible roles |
| Components interoperate | Native properties/events/forms + accurate metadata | Plain HTML and versioned framework fixtures | Framework forms and SSR may need adapters |
| Recipes reduce repeated layout code | Region helpers, layers, `extend()` | Side-nav handwritten vs recipe rules/bytes/equivalence; authoring time | Another abstraction; generated CSS may be larger |
| CSS-native responsiveness is robust | Container queries + intrinsic layouts | No script work during resize; correct across widths, zoom, slots, shadow roots | Containment affects intrinsic sizing |
| Data models make structured components safer | Typed models + collections + validators | Fewer authoring errors; precise diagnostics; update cost vs handwritten `repeat` | API surface and bytes when imported |
| **Generated docs reduce documentation effort and drift** | Analyzer + Workbench + `defineExamples` | Time to document the four slice components vs a handwritten-story baseline; contract tests catch introduced drift; count of authored lines per component | Analyzer constraints on authoring patterns; explicit metadata for dynamic cases |
| Shared foundations reduce multi-product cost | Layered exports + recomposition + shared sheets | Bytes, shared-code reuse, CSS size, startup, and update cost for 1/2/3/10-product fixtures vs per-product implementations; interaction fixtures pass for every derived definition | More public surface and compatibility commitments; anatomy contracts to maintain |
| **Live Theme Studio editing stays responsive** | Worker generation, latest-wins, stylesheet replacement, no remount | p95 edit-to-preview latency for a typical config; no long tasks on the main thread over budget; focus/state preserved | Worker and message overhead; large configs may need incremental generation |
| Project-aware agent tooling improves correctness | Generated agent kits + deterministic operations + preview feedback over analyzer outputs | Four-condition evaluation (docs alone → + generated references → + tools → + preview feedback) on Mote and a held-out consuming library: fewer invented APIs/tokens, higher compile/browser pass rates, fewer repairs and unnecessary edits, correct handling of unknowns | Schema and guidance maintenance; model/IDE/client dependence; context and tool-output volume |

### 8.2 Benchmarks (`research/benchmarks/`, outside shipped code)

- [ ] Pin versions, lockfiles, commits, browsers, build flags, hardware/OS, cache state, commands. Compare equivalent behavior only
- [ ] **Authoring/rendering suite:** native, Mote, Lit, FAST, Stencil, React (incl. React Compiler variant), Angular (signals/zoneless), Vue, Svelte, Solid
- [ ] **Component/application suite:** input/form, dialog/focus, themed region, routed async directory (incl. Web Awesome, Spectrum, Material Web, UI5 where meaningful)
- [ ] **Tooling suite:** analyzer full and incremental time on synthetic 50/200-component libraries; Workbench cold load and preview switch time; Theme Studio edit-to-preview latency
- [ ] Bytes (min/gzip/Brotli), request graph, parse/execute/startup, update-to-paint, style/layout time, allocations, retained memory; documented GC method
- [ ] Warmups, randomized repeated runs, median + p95 with raw samples; correctness on three engines; CI timing informational, graph/size/correctness gates blocking; use [High Resolution Time](https://www.w3.org/TR/hr-time-3/) for clock semantics and the reproducibility rules below

**Initial engineering targets (not results):**

- Minimal production counter incl. Mote code and registration ≤ 8 KiB gzip; revise via ADR if missed — **missed at M3 (9,280 B); revised to 9.5 KiB by [ADR 0031](./docs/architecture/decisions/0031-dev-prod-builds-and-size-budget.md)**
- Direct bindings update only dependent parts; no re-parse, host replacement, sheet rebuild, or listener accumulation
- One sheet per style definition/document; one external listener per registration after any number of reconnects
- After 1,000 mount/remove, route, or preview-switch cycles, owned resources return to baseline
- p95 interaction work within the frame budget for a documented 1,000-row fixture
- Theme Studio: p95 edit-to-preview ≤ 100 ms for the default config on reference hardware (target, not result)
- After M3 baseline: flag > 10% size or > 15% timing change for review
- Report single-item edits, insert/remove/reorder, and full-list replacement separately; a 1,000-row fixture does not imply that every possible 1,000-row operation fits one frame. Include low-powered/reference mobile hardware where available, cold-cache loads, realistic forms/IME, and accessible equivalents.
- Track CSS bytes/rules, dependency/subscription counts, template cache growth, active frames, event-log/history bounds, and main-thread versus Worker generation cost. Attribute regressions to work performed rather than only a headline score.
- Assurance tooling: snapshot and report size, impact traversal time, selected vs total checks, conformance run time, inspection overhead per commit and retained memory in development builds (production delta must be zero), reproduction export size and success rate.

### 8.3 Ergonomics research

- [ ] Eight tasks with developers unfamiliar with Mote: first counter · public property/event · cancelable search · form validation · scoped theme · responsive side navigation with a recipe · data-driven navigation with a custom item kind · **document an existing small component library with Workbench and map one component into Theme Studio**
- [ ] Record time, setup steps, files/imports, errors, doc lookups, cleanup mistakes, ability to explain ownership
- [ ] At least three independent walkthroughs (small sample, no statistical claims); compare with documented Lit/FAST and Storybook-style paths; simplify before adding aliases
- [ ] Include a plain-JavaScript participant/path and explicitly ask participants to explain when `render()` re-runs versus when a direct binding updates, and why a `.value` read in an event handler doesn't subscribe, cleanup ownership, optional packages, and a generated diagnostic. Count authored configuration/example lines and successful copied snippets, not only task completion time.
- [ ] Evaluate documentation/Workbench keyboard and screen-reader workflows with users or recorded manual checks; automated scans are supplementary.

---

## 9. Unresolved decisions and focused experiments

| Decision | Default / recommendation | Resolve at |
| --- | --- | --- |
| Browser support | **Proposed (ADR 0009):** Chrome/Edge 125, Firefox 126, Safari 17.4 from BCD 8.1.6; `moveBefore`, scoped registries, Trusted Types feature-detected; CI confirms | M1 CI / each release |
| Property API | `MoteElement.with()`; static definition only if prototype fails (incl. analyzability) | M3, before M4 |
| Spacing preset | Provisional `rem` scale | M2 / M8 |
| Colour quality | OKLCH + tested sRGB chroma reduction | M2 / M9 |
| Hosted routing | History with base path where rewrites exist; hash mode otherwise | M7 / M12 |
| Docs and Workbench hosting / base path | To be chosen | M7 |
| Scope selector syntax | `data-mote-*` attributes | M2 |
| `@custom-media` output | Optional build output | M9 |
| Recipe helper names / cascade layers | From side-nav slice | M4 / M8 |
| Layout custom elements vs recipe classes | Per layout-recipes.md §7 | M10 |
| Condition syntax beyond baseline | Verified progressive enhancement only | M8 |
| Model builder API / `props()` / dev vs prod validation | Per data-composition.md | M3–M8 |
| Composition schema | Only after M8 with ≥ 2 use cases | M8 go/no-go |
| **Analyzer front end** | TypeScript compiler API; experiment: full vs incremental, and a faster parser for non-type facts | M3 |
| **CEM schema version** | **Pinned:** `custom-elements-manifest@2.1.0`; re-check at each release | Done (M0) |
| **JSDoc/TSDoc tag vocabulary** | Align with common CEM analyzer conventions + Mote tags (`@a11y`, `@keyboard`, `@previewRole`) | M3 / M8 |
| **Preview isolation strategy** | Iframe per preview; experiment: pooled frames | M5 / M8 |
| **Theme generation location** | Web Worker; experiment: main thread for small configs | M5 |
| **`defineExamples` location** | Default: independent DOM-free `@mote/workbench/examples` helper entry in M3; move to a tiny shared dev package only if the build-order experiment justifies it; tests never mount the shell | M3, before M4; review at M8 |
| **Reference Theme Studio layout** | Follow the recorded section structure (Generate, ramps/roles, live preview, contrast, colour vision, exports, method and limits); reproduce functional coverage; redesign where the interaction/accessibility audit shows gaps | M0 / M9 |
| **Component detail preview layout** | Experiment: preview adjacent and sticky beside the API table vs sticky-top; stacked on narrow screens | M5 |
| **Updated-date source** | Authored metadata first, then source history when available in the build; omit otherwise; never build time | M4 |
| **Foundation baseline vs draft** | Baseline by default; explicit labelled "View draft"; never mixed | M5 |
| **Products and modes sources** | Local theme config, installed package, versioned manifest fetched and snapshotted at build time; discovery only suggests | M9 |
| **Overview/home page** | Optional; generated only when configured | M5 / M11 |
| MCP adapter implementation | Original vs dev-only SDK | M11 ADR |
| Agent-kit format and packaging targets | Markdown + JSON baseline; optional Agent Skills, managed `AGENTS.md` section, IDE adapters, `llms.txt` for static docs (ADR 0032) | M5 pilot / M11 |
| Agent-facing metadata fields and diagnostic envelope | Additive `mote-metadata` v1 fields; optional envelope over existing diagnostic shapes | M4 draft / M8 review |
| MCP protocol revision | Pin in the M11 adapter ADR (candidate: 2026-07-28 tools specification) | M11 |
| Entry-guide size budget; `findComponents` ranking | Recorded budget measured in the pilot; deterministic ranking over authored guidance and categories, no embeddings | M5 / M11 |
| Preview driver for `inspectPreview` | Workbench dev-server frames vs a project browser-automation tool | M5 design / M11 |
| Native CSS module scripts | Optional future path | M9 / M12 |
| Licence, npm scope ownership | Verify before publication | Before release |
| Compiler, SSR/hydration, advanced scheduling, executable code editor | Deferred, separate designs | After client foundation |
| Live binding and readiness semantics | **Settled:** `render()` is a tracked context (`.value` reads, incl. synchronous helpers, register render-level dependencies → deduplicated render); readables interpolated directly bind at part level without re-render; `.value` outside tracked contexts and in deferred/async callbacks is an untracked snapshot; binding-initialization reads don't register render dependencies; dual-path dependencies coalesce. Remaining: exact `updateComplete`/readiness boundaries | M3 / M8 |
| Error ownership / production diagnostics | Small explicit owner error policy; opt-in bounded inspection; no silent catch-all | M3 / M8 |
| Native form submission strategy | Prototype before API promise; retain a styled native-button path; disclose custom-host limits | M4 |
| Definition lineage form | Self-referencing `source` field (spread-friendly) vs explicit `extend()` helper (ADR 0033) | M4 prototype / M8 |
| Product-aware composite mechanism | Element-reference parts vs child directive vs family-specific templates, chosen by prototype on the editable list | M4 prototype / M8 ADR |
| Recomposable components and supported customization levels | Card and button prototypes first; declared per component | M4 / M10 |
| Product role overrides and several themes per document | Generator extension with nested-scope verification and measured CSS growth | M9 |
| Component composition API | `compose()` definitions + `define(definition)`; one folder per repository component (§3.3), colocated authoring kept for consumers; name clash resolved (schema renderer moves to `@mote/components/composition`); ADR | M4, review at M8 |
| Live condition editing | Literal-query baseline; explicit generated-sheet invalidation; enhanced syntax only with browser evidence | M2 / M4 / M9 |
| DTCG coverage / import | Publish exact export subset and mappings; import/round-trip only if separately justified | M9 |
| DTCG Resolver 2025.10 | Focused experiment through the canonical generator; decide export/import/bounded subset or evidence-backed deferral; never implied by Format support | M9 |
| Change-impact owner and snapshot format | `@mote/analyzer` `./impact`, `comparison-snapshot.v1` referencing existing artifacts by hash (ADR 0034) | M5 prototype / M8 |
| Conformance entry and suite location | `@mote/workbench/conformance` (DOM-free) + `./testing`; Mote suites in Workbench; third-party suites in their own dev entries | M4 prototype / M8 |
| Runtime inspection entry | Development-only `@mote/core/inspect`, opt-in, bounded; defer if overhead or size checks fail | M8 assessment / M11 |
| Page-lifecycle service | Explicit `@mote/app` service over `pageshow`/`pagehide`/`visibilitychange`; enhancements feature-detected (ADR 0035) | M7 |
| Visual baseline storage and accept flow | Files keyed by example, configuration hash, browser, version; explicit accept listing diffs | M5 / M11 |
| Localization contract | Inherited lang/dir, consumer labels, optional message dictionaries/Intl; independent of stores | M4 / M10 |
| Duplicate core / protocol compatibility | Explicit supported versions and stable interop contracts; no silent registry replacement | M8 / M12 |
| Readable/indexable documentation | Build-time guide/reference HTML where justified; no implied Mote SSR engine | M5 / M7 / M11 |
| Existing CEM analyzer adapter | Thin optional adapter only after the Mote analysis path is proven | M8 / M11 go/no-go |

Ordinary reversible choices inside these contracts can be made during implementation; record material changes with rationale and evidence.

---

## 10. Progress log

| Date | Work | Status |
| --- | --- | --- |
| 2026-10-17 | Plan, architecture drafts, and research synthesis complete | Implementation not started |
| 2026-10-17 | Layout recipes, roles/conditions/profiles, page/component authoring paths, `@mote/agent` integrated | Planning only |
| 2026-10-17 | Data-driven composition, collections, models integrated | Planning only |
| 2026-10-17 | `@mote/analyzer`, normalized metadata + CEM/enrichment, `@mote/workbench` with isolated previews, generated Theme Studio, `defineExamples`; plan restructured around a four-component metadata/Workbench vertical slice | Planning only |
| 2026-10-17 | Holistic review preserved existing scope/status; clarified build order, live-binding/ownership/error semantics, compatibility, forms/CSS constraints, localization, docs/Workbench accessibility, production costs, final release freeze, and direct research links. (Review was performed without repository access; its environment caveats were later removed.) | Planning only |
| 2026-10-17 | Resolved review questions: render-tracked bindings (Q1); M8 checkpoint / M12 final freeze (Q2); cascade-layer encapsulation wording (Q3); Workbench remount policy (Q4); removed stale caveats, mapped R01–R32 to direct links, synced architecture docs (Q5) | Planning only |
| 2026-10-17 | Rendered-browser audit of the reference (Foundations, Spacing, Components, Button, Playground, Theme Studio); Workbench restructured to the reference's presentation with project data: page registry, Foundations overview/detail generation, Components with integrated playground and editable API table, Theme Studio as a primary destination, optional Products and modes, content layers | Planning only |
| 2026-10-17 | M0: reference audit extended to all primary routes, Theme Studio interactions, dark mode, and landmarks; CEM pinned to 2.1.0; ADRs 0001–0030 written (browser baseline from BCD 8.1.6); eight draft JSON Schemas with valid/invalid examples. M1: git, npm workspaces, TypeScript 7 project references, five package skeletons + docs app, boundary checker (manifests, sources, artifacts, DOM-free), Vitest, Playwright in three engines, plain-HTML consumer, packed-consumer verification, README/CONTRIBUTING/CI | M1 skeleton verified locally; CI not yet run |
| 2026-10-17 | M3: `@mote/core/reactive` (push–pull versioned graph: signals, computed, batch, untracked, subscribe, commit/post effects, runaway and cycle diagnostics), `@mote/core/scope` (ordered isolated cleanup, abort signal, listeners, timers, children, per-run effect scopes, controllers, leak counters), `@mote/core/diagnostics` | 53 core tests; DOM-free entries verified; full pipeline passes |
| 2026-10-17 | M3: `@mote/core/template` (lexer with case-preserved attribute names, cached preparation, child/attribute/boolean/property/event parts, readable bindings as commit-phase effects, `when`/`match`/keyed `repeat` with `moveBefore`, SVG, sink and URL rules, Trusted Types policy), `@mote/core/styles` (trusted `css`, per-document shared sheets, nonce fallback), `@mote/core/element` (`MoteElement.with()`/`prop.*`, lifecycle hooks, reflection, typed events, custom states, `define()`); all core entries import without a DOM; `examples/core-counter` under strict CSP + Trusted Types; `with()` analyzability probe on TypeScript 7's unstable API; ADRs 0003 and 0008 accepted | 147 browser tests (49 × 3 engines) + 90 Node tests; 6 e2e; full pipeline passes |
| 2026-10-17 | M3: attribute-directive protocol; `helpers/class-map`, `style-map` (CSSOM, CSP-safe), `ref`, `live` (current-value comparison, IME, caret); event listener options; light-DOM styles shared per root with reference counting; `css` accepts constrained `var()` references | 192 browser tests (64 × 3 engines) + 93 Node tests; 6 e2e; full pipeline passes |
| 2026-10-17 | M2: `@mote/tokens` `./theme` (`ThemeConfig`, `defineTheme`), `./generate` (diagnostics, spacing strategies, OKLCH ramps with chroma-bisection gamut mapping, contrast-selected roles valid for every product, token graph with tier/cycle/reference validation, product and density scopes with alias closure, mode switching by inherited space toggles, CSS emit), `./schema.json`; provisional `mote-default` preset with button/input/card/side-nav roles | 127 Node + 231 browser tests; byte-identical output in Node and three engines; full pipeline passes |
| 2026-10-17 | M2: `@mote/tokens/refs` (`token()`, `TokenName`), `./values`, inspection JSON, `./css/default.css`, `./node` and the `mote-tokens` CLI (`init`/`build`/`check`; JSON, JS, `.ts` configs); Worker generation; script-free `examples/tokens-css-only` built by the CLI | 138 Node + 234 browser tests; 12 e2e; installed CLI verified from tarball; full pipeline passes |
| 2026-10-17 | M2: named conditions (container/media, logical sizes, preference features) with `@mote/tokens/conditions` and CLI output; profiles with alias closure, nested-scope re-application, configuration-order precedence, overlap warnings, and target checks per density; unit policy; schema and CSS-only example extended | 149 Node + 240 browser tests; 12 e2e; full pipeline passes. M2 complete except linking the M4 side-nav preview to the threshold-invalidation contract |
| 2026-10-17 | M3: `@mote/core/layout` and `./layout/inspect` (recipes, helpers, layered CSS, `extend`, diagnostics); `@mote/core/collections` (keyed nested collections, per-entry scopes, selection/expansion/disabled/active models); `@mote/core/model` and `./model/schema` (builder, `Infer`, validation, rules, migrations, JSON Schema); `repeat()` minimal moves with focus restoration | All core entries DOM-free-importable; full pipeline passes |
| 2026-10-17 | M3: `@mote/analyzer` (TypeScript 5.9 front end, ADR 0018 accepted; CEM 2.1.0 + `mote.metadata.json`; inheritance, events, slots/parts, states, registrations, re-exports, recipes, models, authored facts; `analyzer.dynamic.*`; `mote-analyze` CLI); 50-component performance experiment; core-counter fixture | Outputs validate against both schemas; packed analyzer runs; full pipeline passes |
| 2026-10-17 | M3: development/production builds (`development` → `dist/`, default → `dist/prod/`, ADR 0031) with production tests; `repeat` reconciler made pay-for-use; batched WebKit reorder fallback (reversing 1,000 items: 319 → 9–28 ms); `scopeStats()` public; benchmark harness (`research/benchmarks`: sizes, mount/update, collection vs handwritten lists at 10/100/1,000, CDP memory, ownership after 100 cycles) with committed results; size budgets in `npm run verify` | Counter 9,280 B gzip (8 KiB target missed, revised to 9.5 KiB); full pipeline passes |
| 2026-10-17 | M3: binding-rule walkthrough (`examples/binding-rule`, plain JS and TS, identical counts in three engines) with helper/directive/controller outcomes; failure-path suite (conversion, derivation, effect, commit, cleanup, hook, external signals, disposal during callbacks, reconnect scopes, no layout reads, production diagnostics in the browser); failure ownership table (core-contracts §6.2) | 512 tests; 15 e2e; full pipeline passes |
| 2026-10-17 | M3: `props()` assessed with a public-API prototype and three-engine contract tests (element position unavailable, precedence not enforceable, 662 B gzip); not in core for M4–M7, decision stays at M8 | 527 tests; full pipeline passes |
| 2026-10-17 | M3: `@mote/workbench` DOM-free entries — `./examples` (typed `defineExamples`, `examples.v1`, `checkExamples`), `./config` (`resolveWorkbenchConfig` defaults and diagnostics, `defineDocs`), `./pages` (`buildPageRegistry` from CEM + enrichment + authored content, projections, legacy redirects); packed-consumer check covers subpath-only packages; CLI tests given a 30 s budget after a load-induced timeout | 547 tests; full pipeline passes |
| 2026-10-17 | M3: cold startup and click-to-next-frame measurements with a plain-DOM control in three engines; results regenerated | Measurement item closed; M3 open items: none besides M2's side-nav link (M4) |
| 2026-10-17 | Plan: component folder convention (§3.3), public composition API and migration of existing component work added to M4, agent scaffolding (M11), criterion 58, decision row | Planning only; no source files reorganized |
| 2026-10-17 | Plan: AI-friendly architecture and generated agent kits — §5e rewritten; agent-kit contract tasks (M4), local context and reference pilot (M5), review (M8), per-component guidance (M10), operations/packaging/MCP/preview feedback/evaluation (M11), packed verification (M12); criteria 59–64; decision and research rows; ADR 0032; agent-tooling, analyzer, packages, Workbench, styling, layout, composition, core, schema, contribution docs synchronized; research register R33–R41 | Planning only; sources resolved, no experiment completed, nothing implemented |
| 2026-10-17 | Plan: multi-product design systems — §5g, any number of products (1/2/3/10 fixtures), layered exports and foundation entries, recomposition, customization ladder, anatomy contracts, component families, distribution and scope isolation; tasks in M4 (prototype), M8 (review), M9 (tokens, products page scale), M10, M11, M12; criteria 65–71; decision, hypothesis, research rows; ADR 0033; new multi-product.md; core, packages, theming, layout, composition, analyzer, Workbench, pages, agent, schema, contribution docs synchronized; register R42–R46 | Planning only; existing capabilities (product scopes, registration diagnostics, sheet sharing) cited with their evidence; nothing new implemented |
| 2026-10-17 | Plan: change impact, portable conformance, explanations, runnable reproductions, DTCG Resolver experiment, page suspension — §5h, new change-impact-and-verification.md, ADRs 0034–0035; tasks in M4 (conformance prototype), M5 (impact prototype, Workbench links), M7 (page lifecycle), M8 (assurance review), M9 (product impact, styling explanations, Resolver), M10 (suites), M11 (runtime explanations, reproductions, CI selection, agent operations), M12 (packed verification); criteria 72–80; hypothesis, benchmark, decision, research rows; register R47–R55. Corrected: stale Current state (no public API/analyzer/benchmarks), `compose` exclusions now name the `components/composition` renderer, packages.md `./registry` row (define lives in `./element`), CONTRIBUTING `Workflow` heading lost in an earlier edit | Planning only; existing capabilities cited with evidence; nothing new implemented |
| 2026-10-17 | M4: `compose()` and `define(definition)` in `@mote/core/element` (frozen definitions, spread recomposition with `extends`, exact-constructor binding, definition styles/template policy, `registry.definitionConflict`); ADR 0036 | 17 new tests × 3 engines; core 416 tests; size budgets pass (counter 9,521 B) |
| 2026-10-17 | M4: analyzer support for `compose()` definitions (imports, spreads → `extends`, external templates/styles replacing render/static-style facts, dependencies, `define(definition)` registrations, `@internal`), additive `definition` field in `mote-metadata.v1`, folder-structured fixture | 6 new analyzer tests; colocated and folder-structured fixtures give identical CEM declarations |

## 11. Continuation

**Next step:** M4 — first the composition API ADR and implementation (`compose()`, `define(definition)`, analyzer support) and the component folder convention (§3.3), with the migration of `examples/core-counter`; then `mote-button`, `mote-input`, `mote-card`, and `mote-side-nav` in the new structure on core + tokens (side-nav links the last open M2 item), with examples through `@mote/workbench/examples` and analyzer metadata validated, drafting the agent-kit contracts (agent-facing metadata fields, diagnostic envelope, correct/incorrect examples) alongside that metadata work. The first prototype priority is the `mote-button` conformance suite (default, `studio-button`, mutants), followed by the M5 change-impact prototype. The composition API ADR also covers recomposition, and `mote-card`/`mote-button` carry the multi-product prototype (layered exports, foundation entries, customization levels 1–3, 1/2/3/10-product token fixtures).

Use §12 as the direct-source reading map. Resolve Workbench/helper build ordering and the authoring/property prototype first, then the form/container slice; keep those decisions tied to executable evidence.

At every pause: update verified checkboxes and the log; record the next concrete task, unresolved failures, package versions, and test commands/results. Keep the current consumer/docs/Workbench slice working. Never mark performance, accessibility, SSR, framework compatibility, or parity with the reference application as delivered without evidence.

---

## 12. Direct research sources and IDE reading map

These are direct primary-source starting points for the research already required by the plan. For every implementation experiment: open the relevant links, select/pin the applicable version or commit, record access date and findings, and attach executable evidence where behavior matters. Documentation for a moving latest release must not silently stand in for a pinned benchmark version.

This register supplies source locations, not a claim that every linked project's API or status has been audited. The `R01–R32` register in [synthesis.md](./docs/research/synthesis.md) is authoritative for source identities; entries are mapped to direct URLs there where the identity clearly matches, and ambiguous entries are marked unresolved. A resolved citation does not by itself complete an experiment or substantiate every claim about that source. If a source is inaccessible, record the gap and use its official source repository where available.

### 12.1 Component libraries and ecosystem comparisons — M0, M3, M4, M8

| Research subject | Direct sources | Questions / evidence required |
| --- | --- | --- |
| Lit | [Documentation](https://lit.dev/docs/), [expressions](https://lit.dev/docs/templates/expressions/) | Base classes, updates, directives/controllers, cleanup, styling, typed authoring, setup; equivalent executable fixtures |
| FAST | [FASTElement 3.x](https://fast.design/docs/3.x/getting-started/fast-element/), [quick start](https://fast.design/docs/3.x/getting-started/quick-start/), [official source](https://github.com/microsoft/fast) | Select the actual release/branch before comparison; templates, observables, lifecycle/ownership, registration, theming, current package boundaries |
| Web Awesome / Shoelace | [Web Awesome docs](https://webawesome.com/docs/), [Shoelace docs](https://shoelace.style/) | Public component contracts, styling, forms, docs/controls, framework integration, migration and current status; do not conflate releases |
| Spectrum Web Components | [Official docs](https://opensource.adobe.com/spectrum-web-components/) | Accessible behaviors, theming, tokens, forms, component composition and documentation |
| Material Web | [Official docs](https://material-web.dev/), [official source](https://github.com/material-components/material-web) | Public APIs, state layers, form contracts, token customization, current maintenance/release status |
| UI5 Web Components | [Official docs](https://ui5.github.io/webcomponents/) | Localization, accessibility, enterprise forms, delivery, dependency and theme costs |
| Stencil / Ionic | [Stencil introduction](https://stenciljs.com/docs/introduction), [Ionic components](https://ionicframework.com/docs/components) | Compile-time versus runtime tradeoffs, generated outputs/proxies, application versus component costs |
| Optional Carbon / Fluent / Vaadin review | [Carbon docs](https://carbondesignsystem.com/), [Carbon source](https://github.com/carbon-design-system/carbon), [Fluent source](https://github.com/microsoft/fluentui), [Vaadin components](https://vaadin.com/docs/latest/components) | Review only where it answers a specific unresolved question; locate and pin the actual Web Component package rather than treating an entire monorepo as one implementation |
| Native-first patterns | [Open UI](https://open-ui.org/), [APG patterns](https://www.w3.org/WAI/ARIA/apg/) | Which behavior the browser supplies, which controllers are needed, and which patterns require distinct keyboard models |
| Multi-product foundations and recomposition | [FAST 1.x component libraries](https://fast.design/docs/1.x/design-systems/creating-a-component-library/) (historical), [FAST source](https://github.com/microsoft/fast), [Lit styles](https://lit.dev/docs/components/styles/), [Spectrum theme API](https://opensource.adobe.com/spectrum-web-components/tools/theme/api/), [custom element registration](https://html.spec.whatwg.org/multipage/custom-elements.html#dom-customelementregistry-define), [CSS custom properties](https://www.w3.org/TR/css-variables-1/), [CSS Shadow](https://drafts.csswg.org/css-shadow-1/) | Registration-time template/style configuration and why FAST changed it; style composition and inheritance; independently scoped system/colour/scale; one name per constructor; inheritance across shadow boundaries. Record versions; documentation and drafts do not establish browser support or performance |

### 12.2 Frameworks, state models, and consumer integration — M0, M4, M6–M8, M11–M12

| Research subject | Direct sources | Questions / evidence required |
| --- | --- | --- |
| React | [Learning model](https://react.dev/learn), [custom elements](https://react.dev/reference/react-dom/components#custom-html-elements), [React Compiler](https://react.dev/learn/react-compiler) | Initial property detection, rich values/events, typed JSX, wrapper needs, update semantics; compiler and noncompiler benchmark variants |
| Angular | [Signals](https://angular.dev/guide/signals), [zoneless](https://angular.dev/guide/zoneless), [Angular elements](https://angular.dev/guide/elements), [CUSTOM_ELEMENTS_SCHEMA](https://angular.dev/api/core/CUSTOM_ELEMENTS_SCHEMA), [ControlValueAccessor](https://angular.dev/api/forms/ControlValueAccessor) | Separate authoring Angular-as-elements from consuming Mote elements; schemas, rich properties, event typing, form integration, scheduling |
| Vue | [Web Components](https://vuejs.org/guide/extras/web-components), [reactivity](https://vuejs.org/guide/extras/reactivity-in-depth.html) | Custom-element recognition, property/attribute behavior, compiler settings, state model and interoperability |
| Svelte | [Custom elements](https://svelte.dev/docs/svelte/custom-elements), [runes](https://svelte.dev/docs/svelte/what-are-runes) | Distinguish Svelte custom-element output from consuming Mote components; binding, scheduling, lifecycle and compiler costs |
| Solid | [Fine-grained reactivity](https://docs.solidjs.com/advanced-concepts/fine-grained-reactivity) | Derived dependency tracking, ownership/disposal, targeted updates, subscription/startup/memory tradeoffs |
| Platform async/navigation | [AbortController](https://dom.spec.whatwg.org/#interface-abortcontroller), [Fetch](https://fetch.spec.whatwg.org/), [History](https://html.spec.whatwg.org/multipage/nav-history-apis.html#the-history-interface) | Cancellation versus stale-result guards; external signals, native link/history behavior, errors and resource lifetime |

### 12.3 Browser, CSS, form, and accessibility contracts — M0–M4, M8–M10

| Contract | Direct sources | Questions / evidence required |
| --- | --- | --- |
| Custom elements, reactions, registries, forms | [HTML custom elements](https://html.spec.whatwg.org/multipage/custom-elements.html), [registration algorithm](https://html.spec.whatwg.org/multipage/custom-elements.html#dom-customelementregistry-define), [form-associated example](https://html.spec.whatwg.org/multipage/custom-elements.html#custom-elements-face-example), [form submission](https://html.spec.whatwg.org/multipage/form-control-infrastructure.html#form-submission) | Upgrade timing, accessors, reconnect/moves/adoption, duplicate definitions, exact form/submitter semantics, real AT behavior |
| Container-responsive composition | [CSS Conditional Rules 5 / container queries](https://drafts.csswg.org/css-conditional-5/#container-queries), [CSS Containment 3](https://drafts.csswg.org/css-contain-3/) | Flat-tree ancestors, sizing effects, named containers, query syntax and actual baseline-engine support; drafts can contain unshipped features |
| Shadow styling and aliases | [CSS Shadow](https://drafts.csswg.org/css-shadow-1/), [custom properties](https://www.w3.org/TR/css-variables-1/), [cascade layers](https://drafts.csswg.org/css-cascade-5/) | Inheritance/alias resolution, slotted/part boundaries, origins/importance/encapsulation, document-owned sheets and overrides |
| Color and palette generation | [CSS Color 4](https://www.w3.org/TR/css-color-4/), [CSS Color 5](https://www.w3.org/TR/css-color-5/), [APCA author repository](https://github.com/Myndex/SAPC-APCA), [CVD simulation author material](https://www.inf.ufrgs.br/~oliveira/pubs_files/CVD_Simulation/CVD_Simulation.html) | Pin the chosen gamut/contrast/simulation methods; cite limitations and licenses. APCA/CVD stay supplementary; accessibility conclusions use the selected normative criteria and actual contexts. CVD author material is unverified: verify it before choosing a method |
| Accessibility | [WCAG 2.2](https://www.w3.org/TR/WCAG22/), [APG](https://www.w3.org/WAI/ARIA/apg/) | Keyboard/naming, focus, forms, reflow, target size, color/contrast, motion, forced colors; component, shell, and specimen coverage; manual browser/AT matrix |
| Localization | [HTML language](https://html.spec.whatwg.org/multipage/dom.html#the-lang-and-xml:lang-attributes), [Intl / ECMA-402](https://tc39.es/ecma402/) | Inherited language/direction, dictionaries and consumer strings, browser formatting; no mandatory app/store dependency |
| Template and preview policies | [Trusted Types](https://w3c.github.io/trusted-types/dist/spec/), [cross-document messages](https://html.spec.whatwg.org/multipage/web-messaging.html#crossDocumentMessages) | Static template parsing versus dynamic text, CSP-compatible delivery, frame message validation and trusted project-code boundaries |

### 12.4 Tokens, metadata, Workbench, testing, and distribution — M0–M12

| Research subject | Direct sources | Questions / evidence required |
| --- | --- | --- |
| Token interoperability | [DTCG Format 2025.10](https://www.designtokens.org/tr/2025.10/format/), [Style Dictionary](https://styledictionary.com/), [Tokens Studio](https://docs.tokens.studio/) | Exact typed encodings, alias behavior, supported mappings, configuration ergonomics, output portability; no second token engine or runtime dependency |
| CEM and analyzer | [Schema/spec repository](https://github.com/webcomponents/custom-elements-manifest), [existing analyzer](https://custom-elements-manifest.open-wc.org/analyzer/getting-started/), [TypeScript compiler API](https://github.com/microsoft/TypeScript/wiki/Using-the-Compiler-API) | Pin schema/compiler versions; extraction versus explicit metadata, declaration inputs, plugin/adapter feasibility, source locations, determinism and incremental work |
| Documentation/workbench comparison | [Storybook Web Components with Vite](https://storybook.js.org/docs/get-started/frameworks/web-components-vite), [Web Awesome docs](https://webawesome.com/docs/), [Shoelace docs](https://shoelace.style/) | Controls, stories/examples, iframe lifecycle, theming, static output, maintenance effort and authored lines; comparisons use equivalent functionality |
| Reference application | [Design System Lab](https://brianchristopherbrady.github.io/design-system-lab/), [Foundations](https://brianchristopherbrady.github.io/design-system-lab/foundations/), [Spacing](https://brianchristopherbrady.github.io/design-system-lab/foundations/spacing), [Components](https://brianchristopherbrady.github.io/design-system-lab/components), [Button](https://brianchristopherbrady.github.io/design-system-lab/components/button), [Playground](https://brianchristopherbrady.github.io/design-system-lab/playground), [Theme Studio](https://brianchristopherbrady.github.io/design-system-lab/foundations/theme-studio) | Presentation and structure only — never its data. Partial rendered audit recorded in [design-system-lab-audit.md](./docs/reference/design-system-lab-audit.md); remaining routes, interactions, dark mode, and AT behavior pending (M0); no parity is claimed |
| Distribution and CLI packaging | [Node packages/exports](https://nodejs.org/api/packages.html) | Native ESM/import maps, declarations, explicit registration, packed install dependencies, conditional/subpath exports; no private workspace resolution |
| Browser checks and timing | [Playwright assertions](https://playwright.dev/docs/test-assertions), [Web Platform Tests](https://github.com/web-platform-tests/wpt), [High Resolution Time](https://www.w3.org/TR/hr-time-3/) | Browser correctness, timing/clock semantics, raw samples, environment/version pinning, production versus development artifacts; do not infer AT support from automated checks |
| Dependency-based verification and component testing | [Chromatic TurboSnap](https://www.chromatic.com/docs/turbosnap/), [Storybook testing](https://storybook.js.org/docs/writing-tests), [Playwright assertions](https://playwright.dev/docs/test-assertions) | Which inputs drive selection (git + bundler graph vs typed token/product/config edges), baseline reuse rules, screenshot assertions and accept flows; prior art, not a comparative claim |
| Reusable behavior and anatomy | [Zag introduction](https://zagjs.com/overview/introduction), [Zag styling](https://zagjs.com/guides/styling), [APG](https://www.w3.org/WAI/ARIA/apg/), [WCAG 2.2](https://www.w3.org/TR/WCAG22/) | Behavior separated from rendering, part/state hooks as contracts, which assertions conformance suites need; automated checks are not certification |
| Styling explanations and token resolution | [Chrome DevTools CSS reference](https://developer.chrome.com/docs/devtools/css/reference), [CSS custom properties](https://www.w3.org/TR/css-variables-1/), [DTCG Format 2025.10](https://www.designtokens.org/tr/2025.10/format/), [DTCG Resolver 2025.10](https://www.designtokens.org/tr/2025.10/resolver/) | What can be observed vs declared; Resolver sets, modifiers, contexts, `resolutionOrder`, and permutations mapped through the canonical generator |
| Browser page lifecycle | [web.dev back/forward cache](https://web.dev/articles/bfcache) | `pageshow`/`pagehide` `persisted`, paused timers, `freeze`/`resume` as enhancements, avoiding `unload`; test methods that prove a real restoration |
| Agent-facing metadata prior art | [Custom Elements Manifest](https://github.com/webcomponents/custom-elements-manifest), [Storybook AI manifests](https://storybook.js.org/docs/ai/manifests) | Manifest scope and generation; Storybook's feature is in preview and limited to React, Angular, and Vue frameworks |
| Optional agent protocol | [MCP specification](https://modelcontextprotocol.io/specification/latest), [MCP tools, revision 2026-07-28](https://github.com/modelcontextprotocol/modelcontextprotocol/blob/main/docs/specification/2026-07-28/server/tools.mdx) | Pin the selected protocol revision; keep deterministic operations, project/installed-version context, schemas and error contracts independent of any one model or IDE; `inputSchema`/`outputSchema`, `structuredContent`, tool execution errors |
| Agent kit formats and discovery | [Agent Skills](https://agentskills.io/specification), [AGENTS.md](https://agents.md/), [llms.txt](https://llmstxt.org/) | Packaging constraints (front matter, references loaded on demand), repository guidance conventions, discovery index and clean Markdown pages; which clients actually load each format |
| Existing agent integrations | [Web Awesome Agent Skills](https://webawesome.com/docs/ai/agent-skills), [Angular CLI MCP](https://angular.dev/ai/mcp), [shadcn registry MCP](https://ui.shadcn.com/docs/registry/mcp) | Generated-from-CEM references, build-checked design guidance, CLI-hosted tools, registry discovery; record the version/date reviewed; no comparative claim without the agent-tooling.md §11 evaluation |

### 12.5 Research completion format

Every unresolved decision/experiment must record: question → direct source URLs and exact version/commit → minimal reproduction/benchmark → observed result and limits → selected decision or explicit deferral → owning milestone and next action. Link the relevant rows above from the architecture ADR. Research-only entries remain unchecked until their stated evidence exists.

No direct link in this register asserts that a library is faster, more accessible, actively maintained, or easier to use than another. Those conclusions require the comparison and usability evidence already defined in §8.
