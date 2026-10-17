# Mote package architecture

Status: **draft proposal**. APIs below are design sketches for evaluation and are not implemented yet.

## Products

| Unit | Kind | Purpose |
| --- | --- | --- |
| `@mote/core` | npm package | Authoring foundation: reactive primitives, `MoteElement`, templates, properties, lifecycle, styles, registration |
| `@mote/state` | npm package (optional) | Stores, actions, selectors, derived state, scoped context, lifecycle-aware subscriptions, persistence |
| `@mote/app` | npm package (optional) | Application startup/teardown, routing, navigation, async resources |
| `@mote/tokens` | npm package | Theme configuration, generators, schema, generated CSS/SCSS/JSON, typed token references, inspection data |
| `@mote/components` | npm package | Layout primitives and Mote layout presets, accessible controls, composites, component styles, metadata |
| `@mote/analyzer` | npm package (optional, **dev-only**, Node) | Static analysis → normalized metadata → CEM, `mote.metadata.json`, Workbench indexes, editor/agent outputs — see [metadata-and-analyzer.md](./metadata-and-analyzer.md) |
| `@mote/workbench` | npm package (optional tooling) | Reusable metadata-driven documentation shell (Foundations, Components with integrated interactive examples, Theme Studio, optional Products and modes), page registry, isolated previews, `defineExamples`, `mote` CLI — see [workbench.md](./workbench.md), [workbench-pages.md](./workbench-pages.md) |
| `@mote/agent` | npm package (optional, **dev-only**) | Portable agent instructions, deterministic project/metadata tools, optional MCP adapter — see [agent-tooling.md](./agent-tooling.md) |
| `apps/docs` (`@mote/docs`, private) | application | Product documentation and learning; embeds public Workbench panels |

All browser packages, the Workbench browser bundle, and the docs app have zero third-party runtime dependencies. `@mote/analyzer` and `@mote/agent` are Node-only development tooling (they may use dev-time third-party tools such as the TypeScript compiler) and are never part of a browser or deployed graph.

## Dependency rules

```text
@mote/tokens      → (none)
@mote/core        → (none)
@mote/state       → @mote/core
@mote/app         → @mote/core, @mote/state
@mote/components  → @mote/core, @mote/tokens
@mote/analyzer    → @mote/tokens (node/DOM-free), @mote/core (DOM-free model types); TypeScript compiler (dev tool)
@mote/workbench   → phased:
                    M3  ./examples, ./config, ./pages — DOM-free, independently buildable, no browser deps
                    M5  browser shell + panels: core, tokens, components (runs without state/app)
                    M6–M7+ shell integrates state/app after those services exist
                    reusable panels never force consumers to create an app root or router
                    node CLI/dev server: @mote/analyzer, @mote/tokens/node
@mote/agent       → @mote/analyzer (API), @mote/tokens (Node/DOM-free entries); reads published metadata
apps/docs         → core, state, app, tokens, components, workbench (browser panels) — public exports only
                    (never @mote/analyzer or @mote/agent at runtime)
```

- Core knows nothing about Mote tokens, brand, components, routes, or stores. Its `css` helper is generic.
- Tokens knows nothing about core, components, state, or app. Its browser entry points touch no DOM globals.
- Components never import state or app, never require a provider, global store, or bootstrap.
- The generic layout-recipe mechanism lives in core and is unbranded; Mote defaults and presets live in `@mote/components/layout`; tokens stay unaware of recipes. See [layout-recipes.md](./layout-recipes.md).
- No browser package, minimal consumer, or the docs app's runtime graph may reach `@mote/agent` or `@mote/analyzer`. Ordinary component consumers never receive `@mote/workbench` either; components never depend on it.
- Data models and collections are generic in core (`./model`, `./collections`); component models, validators, schemas, and the optional composition renderer live in components. Model metadata and JSON Schemas are produced at build time by `@mote/analyzer` (using `core/model/schema`), not by a runtime package. See [data-composition.md](./data-composition.md).
- Minimal consumers must not contain `components/models`, `core/model/schema`, `components/compose`, or unused recipe presets.
- No private deep imports, no cycles. Enforced by `scripts/architecture/check-boundaries.mjs`.

## Entry points (proposed)

### `@mote/core`
| Export | Contents | DOM? | Side effects |
| --- | --- | --- | --- |
| `.` | Re-exports the default authoring path (no heavy optional modules) | yes | none |
| `./reactive` | `signal`, `computed`, `effect`, `batch`, `untracked`, `Readable` | **no** | none |
| `./scope` | `Scope`, `createScope`, controller protocol | **no** | none |
| `./element` | `MoteElement`, `MoteElement.with()`, `prop`, typed events | yes | none |
| `./template` | `html`, `when`, `repeat`, `match` | yes | none |
| `./styles` | `css`, `unsafeCSS`, `adoptStyles`, `MoteStyles` | yes (attachment only) | none |
| `./layout` | `defineLayoutRecipe`, `stack`, `row`, `grid`, `autoGrid`, `split`, `createLayoutHelpers` (unbranded) | **no** (produces CSS text) | none |
| `./layout/inspect` | `describeRecipe` for metadata and tooling | **no** | none |
| `./collections` | `collection` (keys, reconciliation, nesting), selection/expansion/disabled/active models | **no** | none |
| `./model` | `m`, `defineModel`, `Infer`, `validate`, `migrate` (unbranded model builder) | **no** | none |
| `./model/schema` | JSON Schema emitter for model portable subsets (tooling) | **no** | none |
| `./registry` | `define`, collision diagnostics | yes | none until called |
| `./controllers/*`, `./helpers/*` | Optional behaviors (observers, focus, form, refs, `classMap`, live input) | yes | none |
| `./diagnostics` | Dev warnings configuration | no | none |

Subpaths are created only when implemented; an empty export is not a delivered feature.

### `@mote/state`
`./store`, `./context`, `./element`, `./persist`, `./inspect`; root re-exports. `./store` is DOM-free.

### `@mote/app`
`./app`, `./router`, `./resource`; optional `./node` scaffolding entry (after APIs stabilize); root re-exports.

### `@mote/tokens`
| Export | Contents | Environment |
| --- | --- | --- |
| `./theme` | `defineTheme`, `ThemeConfig` types | any |
| `./generate` | Pure pipeline: `resolveTheme(config) → { tokens, diagnostics }`, `emitCSS`, `emitDTCG`, `emitSCSS`, `emitTypes` | any (browser + Node) |
| `./refs` | `token(name, fallback?) → 'var(--mote-…)'`, generated `TokenName` type | any, no DOM |
| `./values` | Static literal values for the default theme(s) | any |
| `./conditions` | Named responsive conditions → literal query strings | any, no DOM |
| `./inspect` | Resolved graph metadata; `computedToken(name, element)` with explicit element context | `computedToken` needs DOM |
| `./schema.json` | JSON Schema for theme configuration | data |
| `./css/default.css`, `./css/tokens.css`, `./css/themes/*.css` | Generated stylesheets | CSS, no script |
| `./scss/refs`, `./scss/values` | Sass map/function wrappers | Sass (dev tooling) |
| `./json/*` | DTCG-format JSON, inspection metadata | data |
| `./node` + bin `mote-tokens` | File loading, CLI `init`/`build`/`check` | Node only |

### `@mote/components`
| Export | Contents | Side effects |
| --- | --- | --- |
| `./button`, `./input`, `./side-nav`, … | Element classes and their model types (e.g. `NavigationItem`, `navigationKinds`), no registration | none |
| `./models` | Runtime validators and migrations for component models | none |
| `./schemas/*.json` | Generated JSON Schemas for portable model subsets | data |
| `./compose` | Composition schema renderer (later, experimental; never in ordinary consumers) | none |
| `./define` | Registers every element | registers `mote-*` |
| `./define/button`, … | Registers one element and its dependencies | registers |
| `./layout` | Mote-bound layout helpers (roles, named conditions), `condition()`, preset recipes (e.g. side navigation) | none |
| `./layout/layout.css` | Page-author layout classes (`mote-stack`, `mote-split`, …) generated from the same helpers | CSS, no script |
| `./metadata` | Rich docs metadata (separately loadable) | none |
| `./custom-elements.json` | Custom Elements Manifest | data |
| `./mote.metadata.json` | Versioned Mote schema: recipes, token usage, accessibility/lifecycle contracts, examples | data |

Component styles ship as pre-built JS modules; consumers need no CSS loader or Sass. Importing a component never pulls in the preset recipe catalog beyond the recipes it uses.

`custom-elements.json` and `mote.metadata.json` are produced by `@mote/analyzer` at build time; `package.json` declares `"customElements": "./custom-elements.json"`.

**Source organization (planned, M4; see [IMPLEMENTATION_PLAN.md](../../IMPLEMENTATION_PLAN.md) §3.3).** Each component lives in its own folder, assembled through the public composition API (`compose()`, `define(definition)` — [core-contracts.md](./core-contracts.md) §1.1). Entry points map onto the folders:

| Source file | Purpose | Reached through |
| --- | --- | --- |
| `src/card/card.ts` | Element class: properties, state, methods, lifecycle | `./card` (via `index.ts`) |
| `src/card/card.template.ts` | External template; type-only import of the host class | internal unless intentionally public |
| `src/card/card.styles.ts` | Component styles | internal unless intentionally public |
| `src/card/card.definition.ts` | `compose()` of class, template, styles, and dependencies | `./card` (via `index.ts`) |
| `src/card/card.define.ts` | `define(cardDefinition)` — the only side-effectful file | `./define/card`, `./define` |
| `src/card/index.ts` | Side-effect-free public exports (`Card`, `cardDefinition`, public types) | `./card` |

Files inside a folder import siblings directly, never through their own `index.ts`. No ordinary barrel imports a `*.define.ts` module; the boundary check will enforce this once the convention lands.

### `@mote/analyzer` (dev-only)
`.` (Node API `analyze`, `compare`), `./schema/mote-metadata-v1.json`, bin delegated through `mote analyze`. Node only.

### `@mote/workbench`
| Export | Contents | Environment |
| --- | --- | --- |
| `./panels/*` | Embeddable elements: foundations overview and foundation detail, components catalog, component detail (documentation + interactive example + editable API table), preview, event log, token inspector, Theme Studio, products (optional) | browser |
| `./app` | Full Workbench shell (page registry–driven navigation and routes) | browser |
| `./pages` | Page registry types, route/page contracts, legacy-redirect contracts (DOM-free) | any |
| `./content` | Built-in localizable explanatory copy (message catalog keyed by page/section id) | any |
| `./examples` | `defineExamples` (DOM-free definitions) and types | any |
| `./testing` | `runExample` for browser tests | browser test runner |
| `./config` | `defineWorkbenchConfig` (incl. navigation, categories, products, content overrides), `defineDocs` and types | any |
| `./node` + bin `mote` | `analyze`, `workbench dev`, `workbench build`, `workbench products --discover` | Node only |

### `@mote/agent` (dev-only)
`./operations`, `./context` (project context, capability paths, freshness), `./kit` (agent-kit generator: entry guide, references, JSON, Agent Skills packaging, managed `AGENTS.md` section, `llms.txt`), `./cli` (bin `mote-agent`), `./instructions` (thin IDE adapters generated from `./kit`), optional `./mcp`. Node only. Kit generation never requires the Workbench application ([agent-tooling.md](./agent-tooling.md) §5, ADR 0032).

## Authoring, state, and resource contracts

Layout recipes: [layout-recipes.md](./layout-recipes.md). Data-driven composition: [data-composition.md](./data-composition.md). See [core-contracts.md](./core-contracts.md) for the proposed `MoteElement.with()` property factory, lifecycle hooks, `Scope`, reactivity, templates, stores, context, resources, and router.

Package-level sketch of the data flow between an application-owned store and a reusable component:

```ts
import { createStore } from '@mote/state/store';

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
- Uses `@mote/workbench/panels/*` for foundation pages, component catalog and detail pages, previews, token inspection, and Theme Studio rather than duplicating foundation or component explorers or token engines.
