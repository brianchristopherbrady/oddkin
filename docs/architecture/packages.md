# Oddkin package architecture

Status: **draft proposal**. APIs below are design sketches for evaluation and are not implemented yet.

## Naming

[ADR 0037](./decisions/0037-naming-contract.md): packages `@oddkin/*`; custom elements `<odd-*>`; CSS custom properties (design tokens and component variables) `--odd-*`; theme-scope attributes `data-odd-*`; JavaScript `Oddkin*`, `oddkin*`, `ODDKIN_*`; command-line tools `oddkin`, `oddkin-tokens`, `oddkin-analyze`, `oddkin-agent`; files `oddkin.*`; schemas under `https://oddkin.dev/`. HTML and CSS use `odd`; everything else uses `oddkin`. Element classes and tags differ accordingly: `OddkinButton` is registered as `<odd-button>`.

## Products

| Unit | Kind | Purpose |
| --- | --- | --- |
| `@oddkin/core` | npm package | Authoring foundation: reactive primitives, `OddkinElement`, templates, properties, lifecycle, styles, registration |
| `@oddkin/state` | npm package (optional) | Stores, actions, selectors, derived state, scoped context, lifecycle-aware subscriptions, persistence |
| `@oddkin/app` | npm package (optional) | Application startup/teardown, routing, navigation, async resources |
| `@oddkin/tokens` | npm package | Theme configuration, generators, schema, generated CSS/SCSS/JSON, typed token references, inspection data |
| `@oddkin/components` | npm package | Layout primitives and Oddkin layout presets, accessible controls, composites, component styles, metadata |
| `@oddkin/ai` | npm package (optional, implemented) | AI interaction records, DOM-free controllers, stream adapters, and `odd-*` elements for conversations, inline assistance, research, and agent workflows — see [ai-interaction.md](./ai-interaction.md) |
| `@oddkin/analyzer` | npm package (optional, **dev-only**, Node) | Static analysis → normalized metadata → CEM, `oddkin.metadata.json`, Workbench indexes, editor/agent outputs — see [metadata-and-analyzer.md](./metadata-and-analyzer.md). `./impact` (M5 prototype): comparison snapshots and change-impact reports over those outputs; never loads TypeScript — see [change-impact-and-verification.md](./change-impact-and-verification.md) §2 |
| `@oddkin/workbench` | npm package (optional tooling) | Reusable metadata-driven documentation shell (Foundations, Components with integrated interactive examples, Theme Studio, optional Products and modes), page registry, isolated previews, `defineExamples`, `oddkin` CLI. `./preview` (M4): preview-owned stylesheets for live editing (`previewStyles`) — see [workbench.md](./workbench.md), [workbench-pages.md](./workbench-pages.md) |
| `@oddkin/agent` | npm package (optional, **dev-only**) | Portable agent instructions, deterministic project/metadata tools, optional MCP adapter — see [agent-tooling.md](./agent-tooling.md) |
| `apps/docs` (`@oddkin/docs`, private) | application | Product documentation and learning; embeds public Workbench panels |

All browser packages, the Workbench browser bundle, and the docs app have zero third-party runtime dependencies. `@oddkin/analyzer` and `@oddkin/agent` are Node-only development tooling (they may use dev-time third-party tools such as the TypeScript compiler) and are never part of a browser or deployed graph.

## Dependency rules

```text
@oddkin/tokens      → (none)
@oddkin/core        → (none)
@oddkin/state       → @oddkin/core
@oddkin/app         → @oddkin/core, @oddkin/state
@oddkin/components  → @oddkin/core, @oddkin/tokens
@oddkin/ai          → @oddkin/core, @oddkin/tokens (refs), @oddkin/components (odd-button); never state/app/tooling or frameworks
@oddkin/analyzer    → @oddkin/tokens (node/DOM-free), @oddkin/core (DOM-free model types); TypeScript compiler (dev tool)
@oddkin/workbench   → phased:
                    M3  ./examples, ./config, ./pages — DOM-free, independently buildable, no browser deps
                    M5  browser shell + panels: core, tokens, components (runs without state/app)
                    M6–M7+ shell integrates state/app after those services exist
                    reusable panels never force consumers to create an app root or router
                    node CLI/dev server: @oddkin/analyzer, @oddkin/tokens/node
@oddkin/agent       → @oddkin/analyzer (API), @oddkin/tokens (Node/DOM-free entries); reads published metadata
apps/docs         → core, state, app, tokens, components, workbench (browser panels) — public exports only
                    (never @oddkin/analyzer or @oddkin/agent at runtime)
```

- Core knows nothing about Oddkin tokens, brand, components, routes, or stores. Its `css` helper is generic.
- Tokens knows nothing about core, components, state, or app. Its browser entry points touch no DOM globals.
- Components never import state or app, never require a provider, global store, or bootstrap.
- The generic layout-recipe mechanism lives in core and is unbranded; Oddkin defaults and presets live in `@oddkin/components/layout`; tokens stay unaware of recipes. See [layout-recipes.md](./layout-recipes.md).
- No browser package, minimal consumer, or the docs app's runtime graph may reach `@oddkin/agent` or `@oddkin/analyzer`. Ordinary component consumers never receive `@oddkin/workbench` either; components never depend on it.
- Data models and collections are generic in core (`./model`, `./collections`); component models, validators, schemas, and the optional composition renderer live in components. Model metadata and JSON Schemas are produced at build time by `@oddkin/analyzer` (using `core/model/schema`), not by a runtime package. See [data-composition.md](./data-composition.md).
- Minimal consumers must not contain `components/models`, `core/model/schema`, the data-composition renderer `components/composition`, `core/inspect`, conformance or testing helpers, or unused recipe presets. The component-definition composer `compose()` (`@oddkin/core/element`) is ordinary authoring API and allowed.
- No private deep imports, no cycles. Enforced by `scripts/architecture/check-boundaries.mjs`.

## Entry points (proposed)

### `@oddkin/core`
| Export | Contents | DOM? | Side effects |
| --- | --- | --- | --- |
| `.` | Re-exports the default authoring path (no heavy optional modules) | yes | none |
| `./reactive` | `signal`, `computed`, `effect`, `batch`, `untracked`, `Readable` | **no** | none |
| `./scope` | `Scope`, `createScope`, controller protocol | **no** | none |
| `./element` | `OddkinElement`, `OddkinElement.with()`, `prop`, typed events | yes | none |
| `./template` | `html`, `when`, `repeat`, `match` | yes | none |
| `./styles` | `css`, `unsafeCSS`, `adoptStyles`, `OddkinStyles` | yes (attachment only) | none |
| `./layout` | `defineLayoutRecipe`, `stack`, `row`, `grid`, `autoGrid`, `split`, `createLayoutHelpers` (unbranded) | **no** (produces CSS text) | none |
| `./layout/inspect` | `describeRecipe` for metadata and tooling | **no** | none |
| `./collections` | `collection` (keys, reconciliation, nesting), selection/expansion/disabled/active models | **no** | none |
| `./model` | `m`, `defineModel`, `Infer`, `validate`, `migrate` (unbranded model builder) | **no** | none |
| `./model/schema` | JSON Schema emitter for model portable subsets (tooling) | **no** | none |
| `./element` (registration) | `define`, collision diagnostics — implemented in `./element` and the root entry; there is no separate `./registry` entry | yes | none until called |
| `./inspect` (proposed) | Development-only explanation records (commit causes, dependencies, scope ownership); resolved only under the `development` condition, opt-in and bounded ([change-impact-and-verification.md](./change-impact-and-verification.md) §4.2) | yes | none until enabled |
| `./controllers/focus`, `./controllers/announce`, `./controllers/observe`, `./controllers/form` | `RovingFocus`, `FocusRecovery`; `LiveAnnouncer`, `createLiveRegions`; `ResizeController`, `IntersectionController`; `FormValue` — `Scope`-owned, unbranded (core-contracts.md §4.1). **Implemented** | yes (after `connect`) | none |
| `./helpers/*` | Optional template helpers (refs, `classMap`, `styleMap`, live input) | yes | none |
| `./i18n` | `strings`, `format`, `plural`, `langOf`, `dirOf`, cached `Intl` formatters, `formatNumber`, `formatDate` (core-contracts.md §4.2). **Implemented** | **no** at import | none |
| `./diagnostics` | Dev warnings configuration | no | none |
| `./CONTRACTS.md`, `./contracts.json` | Contract text and its id index (`contract:core/<name>` → anchor), generated from core-contracts.md. **Implemented** | data | none |

Subpaths are created only when implemented; an empty export is not a delivered feature.

### `@oddkin/state`
| Export | Contents | DOM? | Status |
| --- | --- | --- | --- |
| `./store` | `createStore`, `action`, `shallowEqual` ([core-contracts.md](./core-contracts.md) §7.1) | **no** | **Implemented** (M6) |
| `./inspect` | `inspect` (bounded update log with action causes, live subscribers), `storeStats` | **no** | **Implemented** (M6) |
| `./context` | `createContext`, `provide`, `consume`, `ContextRequestEvent`, `ContextProviderEvent` (community context protocol; [core-contracts.md](./core-contracts.md) §7.2) | imports without DOM globals; providers and consumers need a DOM | **Implemented** (M6) |
| `./persist` | Versioned persistence adapter | no (storage reached only when called) | Planned (M6) |
| `./element` | Element-specific helpers | yes | Not needed so far: providers and consumers are controllers for any element's `scope.use()` |
| `.` | Re-exports `./store` and `./context`; inspection and persistence stay separate imports | no | **Implemented** (M6) |

Each entry has a development build (`dist/`, the `development` condition) and a production build (`dist/prod/`, the default), as in `@oddkin/core` (ADR 0031).

### `@oddkin/app`
`./app`, `./router`, `./resource`; optional `./node` scaffolding entry (after APIs stabilize); root re-exports.

### `@oddkin/tokens`
| Export | Contents | Environment |
| --- | --- | --- |
| `./theme` | `defineTheme`, `ThemeConfig` types | any |
| `./generate` | Pure pipeline: `resolveTheme(config) → { tokens, diagnostics }`, `emitCSS`, `emitDTCG`, `emitSCSS`, `emitTypes` | any (browser + Node) |
| `./refs` | `token(name, fallback?) → 'var(--odd-…)'`, generated `TokenName` type | any, no DOM |
| `./values` | Static literal values for the default theme(s) | any |
| `./conditions` | Named responsive conditions → literal query strings | any, no DOM |
| `./inspect` | Resolved graph metadata; `computedToken(name, element)` with explicit element context | `computedToken` needs DOM |
| `./schema.json` | JSON Schema for theme configuration | data |
| `./css/default.css`, `./css/tokens.css`, `./css/themes/*.css` | Generated stylesheets; declarations in the `odd.tokens` cascade layer after the canonical Oddkin layer order (ADR 0039) | CSS, no script |
| `./inspect/default.json` | The default theme's token inspection (definitions, values per mode, origins, provenance, scopes) for tooling; component metadata `foundations` reference it. **Implemented** | JSON, no script |
| `./scss/refs`, `./scss/values` | Sass map/function wrappers | Sass (dev tooling) |
| `./json/*` | DTCG-format JSON, inspection metadata | data |
| `./node` + bin `oddkin-tokens` | File loading, CLI `init`/`build`/`check` | Node only |

### `@oddkin/components`
| Export | Contents | Side effects |
| --- | --- | --- |
| `./button`, `./input`, `./side-nav`, … | Element classes, templates, styles, definitions, and model types (e.g. `NavigationItem`, `navigationKinds`), no registration. **Implemented:** `./button`, `./card`, `./input`, `./side-nav` (with `NavigationItem`; the recipe is the opt-in `./side-nav/recipe`; `navigationKinds` planned) | none |
| `./button/foundation`, … | Skin-free foundation: behavior class, template, structural styles (multi-product.md §4). **Implemented:** `./button/foundation`, `./card/foundation`, `./input/foundation`, `./side-nav/foundation` | none |
| `./models` | Runtime validators and migrations for component models. **Implemented:** `NavigationItemModel` | none |
| `./schemas/*.json` | Generated JSON Schemas for portable model subsets. **Implemented:** `oddkin.navigation.v1.json` (`scripts/build-component-schemas.mjs`) | data |
| `./composition` | Data-composition schema renderer `renderComposition()` (later, experimental; never in ordinary consumers). Not the component-definition composer `compose()` | none |
| `./define` | Registers every element | registers `odd-*` |
| `./define/button`, … | Registers one element and its dependencies. **Implemented:** `./define/button`, `./define/card`, `./define/input`, `./define/side-nav`. Its declarations reference the element's, so a registering import also types `HTMLElementTagNameMap` and the element's listeners | registers |
| `./frameworks/react`, `./frameworks/vue`, `./frameworks/svelte` | Opt-in typings for every loaded `odd-*` element (`@oddkin/ai` included) in React 19 JSX, Vue templates (`GlobalComponents`), and Svelte markup (`SvelteHTMLElements`): properties from the element classes, events from `static events`. Types only (the build emits empty modules no export points at); the only third-party imports in a browser package, allowed type-only by the boundary rules (`typeOnly`). Checked with tsc, vue-tsc, and svelte-check. **Implemented** | none |
| `./styles` | Shared style primitives for shadow roots: `hostStyles`, `focusRingStyles`, `visuallyHiddenStyles` (theming-and-styling.md §7). **Implemented** | none |
| `./css/reset.css`, `./css/base.css`, `./css/utilities.css` | Opt-in document stylesheets in `odd.reset`, `odd.base`, `odd.utilities` (css-architecture.md §5.1). **Implemented** | CSS, no script |
| `./layout` | Oddkin-bound layout helpers (roles, named conditions), `defineLayoutRecipe` (`odd.layout` prefix), `condition()` (layout-recipes.md §12). **Implemented**; the side navigation's `sideNavRecipe` is exported from `./side-nav/recipe` (kept out of `./side-nav`, so component consumers never load the recipe engine), other preset recipes planned | none |
| `./css/layout.css` | Page-author layout classes (`odd-stack`, `odd-row`, `odd-cluster`, `odd-grid`, `odd-auto-grid`, `odd-split`) generated from the same helpers, in `odd.layout`. **Implemented** | CSS, no script |
| `./css/button.css` | Native `<button class="odd-button">` styled like `odd-button` (same tokens, component variables, focus ring), in `odd.components`, for forms that need native submit-button semantics (css-architecture.md §10.1). **Implemented** | CSS, no script |
| `./metadata` | Rich docs metadata (separately loadable) | none |
| `./custom-elements.json` | Custom Elements Manifest | data |
| `./oddkin.metadata.json` | Versioned Oddkin schema: recipes, token usage, accessibility/lifecycle contracts, examples | data |

Component styles ship as pre-built JS modules; consumers need no CSS loader or Sass. Importing a component never pulls in the preset recipe catalog beyond the recipes it uses.

`custom-elements.json` and `oddkin.metadata.json` are produced by `@oddkin/analyzer` at build time; `package.json` declares `"customElements": "./custom-elements.json"`.

**Source organization (implemented, M4; see [IMPLEMENTATION_PLAN.md](../../IMPLEMENTATION_PLAN.md) §3.3).** Each component lives in its own folder, assembled through the public composition API (`compose()`, `define(definition)` — [core-contracts.md](./core-contracts.md) §1.1). Entry points map onto the folders:

| Source file | Purpose | Reached through |
| --- | --- | --- |
| `src/card/card.ts` | Element class: properties, state, methods, lifecycle | `./card` (via `index.ts`) |
| `src/card/card.template.ts` | External template; type-only import of the host class | `./card`, `./card/foundation` |
| `src/card/card.structural.styles.ts` | Styles the behavior depends on; no visual tokens | `./card`, `./card/foundation` |
| `src/card/card.styles.ts` | Default visual styles | `./card` |
| `src/card/card.definition.ts` | `compose()` of class, template, styles, and dependencies | `./card` (via `index.ts`) |
| `src/card/card.define.ts` | `define(cardDefinition)` — the only side-effectful file | `./define/card` |
| `src/card/foundation.ts` | Behavior, template, and structural styles without the default skin | `./card/foundation` |
| `src/card/index.ts` | Side-effect-free public exports (`OddkinCard`, `cardDefinition`, styles, public types) | `./card` |
| `src/card/card.examples.ts` | `defineExamples` — development-only, excluded from the build (ADR 0021) | tests, analyzer metadata |
| `src/side-nav/side-nav.recipe.ts` | Layout recipe (source of the arrangement) | `./side-nav/recipe` (opt-in) |
| `src/side-nav/side-nav.recipe.styles.ts` | Recipe CSS extracted at build time; checked byte for byte against the recipe | used by the definition |

The foundation entry loads the behavior, template, and structural styles but no default visual styles (multi-product.md §4, ADR 0033). Installation dependencies and import graphs are documented separately: installing `@oddkin/components` does not mean a foundation consumer loads its default skins, theme generation, catalog, or tooling (`packages/components/test/consumers.test.ts`).

Files inside a folder import siblings directly, never through their own `index.ts`. No ordinary barrel reaches a registration entry. `npm run lint:boundaries` enforces it: from every `index.*` in package and example sources, it follows relative imports and fails with `boundary.registration.barrel` on a `*.define.*` module, a registering `define.*`/`define/` module, or a package `define` subpath. A package containing registration entries must list them in `"sideEffects"` (`boundary.registration.sideEffects`).

### `@oddkin/ai` (implemented)
| Export | Contents | DOM? | Side effects |
| --- | --- | --- | --- |
| `.` | Records and contracts only (same as `./contracts`) | **no** | none |
| `./contracts` | Record models (`MessageModel`, …), types, normalization, capabilities | **no** | none |
| `./controllers` | `ConversationController`, `ComposerController`, `DocumentSession`, `VoiceController`, transitions, announcement policy, `bindIntents`, `selectSource`, `createConversationView` | **no** at import | none |
| `./events` | Typed user-intent event definitions | **no** | none |
| `./stream` | WHATWG SSE parser, AI SDK UI message stream v1 adapter, simulation adapter | **no** (fetch/streams when called) | none |
| `./markdown`, `./highlight` | Streaming Markdown renderer and URL policy; optional highlighter | renders into a given node | none |
| `./announce` | `createAnnouncer(container)` | when called | none |
| `./voice/web-speech`, `./voice/recorder` | Optional voice adapters | when called | none |
| `./<element>` | Element class, template, styles, definition, strings (24 elements, e.g. `./conversation`, `./prompt-input`) | yes | none |
| `./define/<element>` | Registers one element and its dependencies | yes | registers `odd-*` |
| `./schemas/*.json`, `./custom-elements.json`, `./oddkin.metadata.json` | Generated record schemas and metadata | data | — |

### `@oddkin/analyzer` (dev-only)
`.` (Node API `analyze`, `compare`), `./schema/oddkin-metadata-v1.json`, proposed `./impact` (comparison snapshots, impact traversal, verification selection, `impact-report.v1`; [change-impact-and-verification.md](./change-impact-and-verification.md) §2), bin delegated through `oddkin analyze` and `oddkin impact`. Node only.

### `@oddkin/workbench`
| Export | Contents | Environment |
| --- | --- | --- |
| `./panels/*` | Embeddable elements: foundations overview and foundation detail, components catalog, component detail (documentation + interactive example + editable API table), preview, event log, token inspector, Theme Studio, products (optional) | browser |
| `./app` | Full Workbench shell (page registry–driven navigation and routes) | browser |
| `./pages` | Page registry types, route/page contracts, legacy-redirect contracts (DOM-free) | any |
| `./content` | Built-in localizable explanatory copy (message catalog keyed by page/section id) | any |
| `./examples` | `defineExamples` (DOM-free definitions) and types | any |
| `./testing` | `runConformance` (implemented), `runExample` (planned); the project's `expect` and user-input API are passed in | browser test runner |
| `./conformance` | `defineConformance`, `checkConformance`, `toConformanceJSON`, adapter and result types (DOM-free, implemented) | any |
| `./conformance/button`, … | Oddkin's conformance suites for its own components; implementation-agnostic. Implemented: `./conformance/button` | any (DOM touched only when run) |
| `./config` | `defineWorkbenchConfig` (incl. navigation, categories, products, content overrides), `defineDocs` and types | any |
| `./node` + bin `oddkin` | `analyze`, `impact`, `workbench dev`, `workbench build`, `workbench products --discover`, `workbench repro export` (proposed) | Node only |

### `@oddkin/agent` (dev-only)
`./operations`, `./context` (project context, capability paths, freshness), `./kit` (agent-kit generator: entry guide, references, JSON, Agent Skills packaging, managed `AGENTS.md` section, `llms.txt`), `./cli` (bin `oddkin-agent`), `./instructions` (thin IDE adapters generated from `./kit`), optional `./mcp`. Node only. Kit generation never requires the Workbench application ([agent-tooling.md](./agent-tooling.md) §5, ADR 0032).

## Authoring, state, and resource contracts

Layout recipes: [layout-recipes.md](./layout-recipes.md). Data-driven composition: [data-composition.md](./data-composition.md). See [core-contracts.md](./core-contracts.md) for the proposed `OddkinElement.with()` property factory, lifecycle hooks, `Scope`, reactivity, templates, stores, context, resources, and router.

Package-level sketch of the data flow between an application-owned store and a reusable component:

```ts
import { createStore } from '@oddkin/state/store';

const filters = createStore({ query: '', tags: [] as string[] });
const query = filters.select(s => s.query);

query.subscribe(value => { input.value = value; });
input.addEventListener('input', () => {
  filters.update(s => ({ ...s, query: input.value }));
});
```

Reusable components receive values as properties and report changes as events; the application feature owns the store.

## Docs application

- Lives at `apps/docs`.
- Consumes packages by name through `exports`; integration builds use packed `dist/` output.
- Owns navigation content, routes, docs stores, tutorials, fixtures, recipes, and migration walkthroughs.
- Uses `@oddkin/workbench/panels/*` for foundation pages, component catalog and detail pages, previews, token inspection, and Theme Studio rather than duplicating foundation or component explorers or token engines.
