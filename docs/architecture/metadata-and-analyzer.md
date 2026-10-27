# Metadata model and `@oddkin/analyzer`

Status: the analyzer core is **implemented** in `@oddkin/analyzer` (M3): extraction (§2) except theme/foundation/docs enrichment, outputs 1–2 (§4), API and one-shot CLI (§6). §8 lists settled behaviors. Workbench indexes, editor/agent outputs, watch mode, `--compare`, and contract tests against runtime behavior are later work. Agent-facing extensions (§3.1, output 5 in §4, §9) are **planned** ([ADR 0032](./decisions/0032-generated-agent-kits.md)). `@oddkin/analyzer` is optional, Node-only development tooling and is never part of a browser or component-consumer graph. Related: [workbench.md](./workbench.md), [agent-tooling.md](./agent-tooling.md), [data-composition.md](./data-composition.md), [layout-recipes.md](./layout-recipes.md).

## 1. Responsibilities

| Unit | Does | Does not |
| --- | --- | --- |
| `@oddkin/analyzer` | Statically analyze a component library's source and declarations; build one normalized metadata model; validate it; emit standard CEM, the Oddkin enrichment manifest, Workbench indexes, editor/schema outputs, and agent-facing outputs | Execute component modules, constructors, registration calls, or arbitrary expressions; render anything |
| `@oddkin/workbench` | Render docs, controls, previews, Theme Studio from analyzer outputs | Re-derive metadata |
| The documented library | Supplies the real component implementations, entry points, theme config, and optional authored examples/guidance | Maintain story files for basic API exploration |
| `@oddkin/agent` | Reads the same outputs (or calls the analyzer API) | Keep its own copy of contracts |

There is **one** metadata generator, used by Oddkin's own packages and by any team pointing the tooling at its library.

## 2. Supported authoring patterns

Analysis uses an established compiler front end — **proposed: the TypeScript compiler API** (program + type checker), so JS (with JSDoc) and TS libraries share one path and declaration types are available. No hand-written JavaScript parser; regular expressions are never the primary analysis strategy.

Recognized statically:
- `OddkinElement` subclasses, `OddkinElement.with({...})` factories, `prop.*` definitions, inheritance chains, mixins written as typed factories, imports and re-exports across files and packages (via declaration files).
- Public properties (type, default when statically known, allowed values, nullable/optional/read-only, reflection, attribute name, converter kind), attributes, public methods (signature only), events (from typed event definitions: name, detail type, `bubbles`/`composed`/`cancelable`), slots and parts (from templates and/or explicit declarations), CSS custom properties, custom states (`ElementInternals.states`).
- Registration: `define('tag', Class)` calls in registration entries, `HTMLElementTagNameMap` augmentations, and package `exports` → browser module entry points.
- Recognition follows actual imports, definitions, and registrations through the type checker, not file names. The composition API (`compose()` definitions that reference external template and style modules, and `define(definition)` registrations; [core-contracts.md](./core-contracts.md) §1.1) is resolved by following the imported symbols. The repository folder convention ([IMPLEMENTATION_PLAN.md](../../IMPLEMENTATION_PLAN.md) §3.3) is a layout the analyzer understands, never a requirement; colocated components analyze identically. *(Implemented, M4; §8.)*
- Token contracts used by component styles (`token('…')` references, `var(--odd-…)` in CSS files), recipes (`defineLayoutRecipe` — analyzed statically), variants, conditions, profiles, data models (`defineModel`).
- JSDoc/TSDoc: descriptions, `@example`, `@deprecated`, `@since`, and Oddkin tags (`@a11y`, `@keyboard`, `@behavior`, `@previewRole`, `@related`, `@category`, `@useFor`, `@notFor`, `@limitation`, `@updated`).
- Theme Studio preview capabilities, composition presets, adapter references from `oddkin.config.*` and colocated example files.
- *(Implemented, M4.)* Colocated `*.examples.ts` are found on disk under the program's `rootDir` (or passed as `analyze({ examples })`), because they are development-only sources outside the package program. `defineExamples('tag', { name: { … } })` calls imported from `@oddkin/workbench/examples` are parsed, never executed, into `examples` entries (`example:<tag>/<name>` → component, name, file, `hasFixture`, preview roles). A computed tag, example, or role list is `analyzer.examples.dynamic`; an example for an element the library does not register is `analyzer.examples.unknownComponent`.
- Foundation and documentation enrichment: foundation categories/sections from the theme config and token inspection output, component categories, authored page content (`oddkin.docs.ts`, Markdown front matter), and explicitly configured product sources (validated against the product schema; remote manifests fetched by Workbench build tooling, not by the analyzer at analysis time).

Unsupported dynamic definitions (computed tag names, properties built in loops, conditional `define` calls, spread of runtime objects) produce `analyzer.dynamic.*` diagnostics with the source location and a suggested explicit declaration:

```ts
/** @oddkin-metadata ./button.metadata.json */  // or an inline `static metadata = defineMetadata({...})` literal
```

Explicit metadata must be a static literal or JSON file; it is merged with extracted facts and recorded with `authored` provenance.

Recipe CSS extraction (layout-recipes.md §9) is a **separate, opt-in build step** that evaluates DOM-free recipe modules; it is not part of analysis.

## 3. Normalized metadata model

One model, versioned (`oddkin-metadata` schema v1), with stable identifiers and provenance for every fact.

```ts
interface OddkinMetadata {
  schema: 'https://…/oddkin-metadata/v1.json';
  library: { name: string; version: string; prefix?: string; packages: PackageInfo[] };
  components: Record<ComponentId, ComponentMeta>;   // 'component:acme-button'
  recipes: Record<RecipeId, RecipeMeta>;            // 'recipe:side-nav'
  stylesheets?: Record<StylesheetId, StylesheetMeta>; // 'stylesheet:typography' (see below)
  models: Record<ModelId, ModelMeta>;               // 'model:oddkin.navigation-item'
  tokens?: TokenIndexRef;                           // pointer to @oddkin/tokens inspection output
  examples: Record<ExampleId, ExampleMeta>;         // 'example:acme-button/loading'
  previewRoles: Record<RoleId, PreviewRoleMeta>;    // 'role:primaryAction'
  foundations?: Record<FoundationId, FoundationMeta>; // 'foundation:spacing' (see below)
  categories?: Record<CategoryId, CategoryMeta>;    // component groups: label, description, order
  products?: Record<ProductId, ProductMeta>;        // only when products are explicitly configured
  docs?: Record<PageId, DocMeta>;                   // labels, summaries, tags, updated dates, section guidance refs
  diagnostics: Diagnostic[];
}

interface FoundationMeta {
  id: string;                                       // 'spacing'
  categories: string[];                             // token categories it covers
  sections: { id: string; available: boolean; reason?: string }[];
  generation?: Fact<GenerationInputs>;              // e.g. spacing strategy + inputs, palette inputs
  tokens: TokenId[];                                // resolved outputs (values live in token inspection output)
  vocabularies?: { id: string; entries: { name: string; token: TokenId; publicValue?: string }[] }[]; // semantic vocabularies, component-facing values
  variations?: ('theme' | 'mode' | 'product' | 'density' | 'profile')[];
  contracts?: Fact<LayoutContract | PrecedenceContract>[];  // declared layout/precedence rules
  related: { recipes?: RecipeId[]; components?: ComponentId[] };
  specimens?: ExampleId[];
}

interface DocMeta { title?: Fact<string>; summary?: Fact<string>; tags?: string[]; updated?: Fact<string>; order?: number; visible?: boolean }

interface Fact<T> {
  value: T;
  provenance: 'extracted' | 'authored' | 'observed' | 'verified';
  source?: { file: string; line: number; column: number } | { test: string; run: string; date: string };
}
```

- **Stable ids**: `component:<tag>`, `property:<tag>#<name>`, `event:<tag>#<name>`, `slot:<tag>#<name|default>`, `part:<tag>#<name>`, `cssprop:<tag>#<name>`, `token:<name>`, `recipe:<name>`, `stylesheet:<name>`, `model:<name>`, `example:<tag>/<name>`, `role:<name>`. Ids survive file moves; renames are reported as remove + add.
- **Provenance labels**: *extracted* (static analysis), *authored* (JSDoc, explicit metadata, examples, guidance), *observed* (recorded by Workbench/runtime inspection, e.g. computed values), *verified* (linked to a passing test run). Workbench and agents display these labels; unverified behavior is never shown as verified.
- **Contract tests (M4).** `packages/components/test/contract.browser.test.ts` checks the published CEM against live elements in three engines: literal defaults, attribute-to-property conversion for every allowed union value, reflection exactly where `reflects` is declared, declared events, and every slot and part rendered by an authored example. A field without a literal default makes no claim. *(Verified provenance, M4:)*
  - **Records:** the checks live in one harness, `tests/contract/cem-contract.ts`. It is used by `packages/components/test/contract.browser.test.ts` and `packages/ai/test/contract.browser.test.ts`, and each package declares the Oddkin builds its page runs (`scripts/verification.mjs` `CONTRACT_TESTS`). Each run writes one `conformance-result.v1` record per element and engine to `packages/<pkg>/.oddkin/verification/oddkin.cem-contract/<browser>/<tag>.json` (generated, not committed). Each fact is a case such as `property:odd-button#size/attribute`, `event:odd-input#change/defined`, `component:odd-input/events`, or `slot:odd-card#header/rendered`. The record's configuration holds the browser and version and two SHA-256 input hashes: the exact `custom-elements.json` text tested, and the implementation files the page ran (the package's sources and the development builds of the Oddkin packages it depends on). Slots and parts are checked through authored examples; a package without them records those cases as not executed, so they stay unverified.
  - **Attaching:** `attachVerification()` (`@oddkin/analyzer`), run by `scripts/build-metadata.mjs` and `npm run verify:metadata`, recomputes both hashes from disk. It ignores records for other inputs. It attaches to `components[…].verification` only facts that passed in Chromium, Firefox, and WebKit, with `provenance: "verified"`, the test source, the browsers and versions, the package version, and the input hashes as conditions.
  - **Never generalized:** a stale run never marks new metadata as verified, and a failed or skipped case stays unverified. `verify:metadata` (part of `npm run verify`) fails on missing current evidence, failed cases, or malformed records.
- **Unknown is a value**: defaults that cannot be determined statically are `{ known: false }`, never guessed.
- **Foundation enrichment** references token data; it does not recompute it. Token values, aliases, provenance, and variations come from `@oddkin/tokens` inspection output produced by the canonical generator. The analyzer only records which foundations, sections, vocabularies, contracts, and relationships exist, so Workbench has no second token engine or foundation parser. *(Implemented, M4, for spacing, colour, and borders and radii: `analyze({ tokens: { inspection, source } })` reads a theme's inspection, for Oddkin `@oddkin/tokens/inspect/default.json`. A scale is the foundation tokens of its prefix that are not aliases (`space.*`, `radius.*`, `border.*`); its vocabularies are the tokens aliasing a step, split into `semantic` (semantic and layout roles) and `component-mappings` (component tokens). Colour roles are the semantic `color.*` tokens, with `variations: ["mode"]` only when a value is keyed by the theme's modes. Sections are listed with their availability and a reason when absent; `generation` records the theme, the tokens' origins, and the inspection's package and export. No strategy is claimed unless the inspection states one. Checked by `packages/analyzer/test/foundations.test.ts`.)*
- **Document stylesheets**: the opt-in CSS a package builds (reset, base, layout classes, and recipes for native elements, component-contracts.md §2.1). *(Implemented, M10: `analyze({ stylesheets })` takes each sheet as built, `{ name, import, layer, css, description?, source? }`; `scripts/build-metadata.mjs` reads them from `@oddkin/components`' `dist/css/index.js` `documentStylesheets` map, fails when a sheet has no `./css/<name>.css` export, and takes each description from the JSDoc of the map entry's constant in `src/css/index.ts` (`stylesheetDocs()`). Each `stylesheets["stylesheet:<name>"]` record holds the import, layer, description, the prefixed classes the rules define (comments excluded), the theme tokens they read (by name, through the token inspection), and the prefixed custom properties they read that are not tokens: the variables an author may set, such as `--odd-stack-gap`. Authored references accept those variables and, as `` `.odd-box` ``, those classes (`ReferenceIndex.classes`). The agent kit writes `references/stylesheets/<name>.md` and `json/stylesheets.json`, and the project context lists the ids. Checked by `packages/analyzer/test/stylesheets.test.ts`, the components metadata test (every `./css/*.css` export is listed), and `tests/agent-kit`.)*
- **Style mappings** for "From property to token" traces (`property/state → CSS property → token`) are extracted from component styles, recipes, and role metadata where statically determinable; otherwise absent. *(Implemented, M4, from styles: `components[…].styleMappings[]` holds `{ when, part?, cssProperty, token }` with `extracted` provenance, for example `control | appearance="primary" (enabled, hover) @media (hover: hover) | background → color.action.hover`. They are read from every style source's CSS in cascade order: local `css` templates and `unsafeCSS('…')` literals, and the published `css` text of sheets from other packages; a source without text leaves the component without mappings. The grammar is `:host` with at most one attribute, or a part's tag or class (optionally after `:host…` and a space), followed by `:hover`, `:active`, `:focus-visible`, `:disabled`, `:enabled` and `:not([aria-disabled='true'])` (both `enabled`), and `[aria-x='v']`. `@media`, `@supports`, and `@container` conditions are appended to `when`. Which elements carry which part is read from every template in the template's file; a tag or class selects every part rendered with it. Each mapping is the declaration that wins for its part, condition, and property by `!important`, cascade layer, specificity, and order; a winning declaration without a token removes the mapping. A part's property stays unmapped when any rule that may set it is outside the grammar (other combinators or pseudo-classes, data attributes, universal selectors, elements with a computed class list, `@scope`); `@keyframes` and `@starting-style` are skipped; nested style rules or a computed selector leave the component without mappings. Shorthands and longhands are separate properties, and a direct `var(--odd-…)` read is not mapped. Recipe options and role metadata are not yet sources; a recipe's generated CSS is read like any sheet. Checked by `packages/analyzer/test/style-mappings.test.ts` and both packages' metadata tests.)*
- **Updated dates** (`docs[*].updated`) come only from authored metadata (`authored`) or source history (`extracted`, last commit touching the declared source files, when history is available in the build). The analyzer never uses build time. Absent dates are omitted. *(Implemented, M4: `docs` is keyed by the Workbench page ids `components/<tag>` and `foundations/<id>`. An `@updated YYYY-MM-DD` tag on a component class is an `authored` date with its source location; a date that is not on the calendar gives `analyzer.tag.invalid`, and the page falls back to history. Otherwise the date is the latest committer date (in the committer's time zone) of the page's declared sources: for a component, the registration module, the class and its base classes in the library, explicit metadata, the definition and the definitions it recomposes, template, styles, and examples; for a foundation, the theme sources the caller declares (`analyze({ tokens: { sources } })`; Oddkin's build declares `packages/tokens/themes/default.theme.json` and `packages/tokens/src/generate/preset.ts` and fails if either is missing). History comes from `analyze({ history })`; `gitHistory(root)` reads it with one `git log` per 200 files and is unavailable outside a repository or in a shallow clone, where the oldest commit would pose as the last change. Without history, pages carry only authored dates. Workbench's page registry shows the dates on the same pages. Checked by `packages/analyzer/test/docs.test.ts` and the components metadata test.)*
- **Page ids** (`foundations/spacing`, `components/<tag>`, `theme-studio`) and section ids are stable and shared with the Workbench page registry and authored content ([workbench-pages.md §2, §10](./workbench-pages.md)).
- **Component categories** come from `@category <Label>` on a registered class: `components[…].category` is `category:<slug>` (lower case, whitespace as `-`), and `categories` holds one `{ label }` record per id, the label being the first spelling in tag order. Another spelling of the same id is `analyzer.category.conflict` (warning, at its tag) and keeps the first label. No `description` or `order` is invented; Workbench orders groups by configuration, then by id. *(Implemented 2026-10-21: `categoryRecords()` in `packages/analyzer/src/emit.ts`; `packages/analyzer/test/categories.test.ts` and both packages' metadata tests, including the page registry grouping `@oddkin/components` by these labels.)*

### 3.1 Agent-facing extensions (planned, M4; reviewed at M8)

These extend the same model; there is no separate agent catalog ([agent-tooling.md](./agent-tooling.md) §3.1).

- **Rich-object assignment:** for `prop.object`/`prop.array` (and any property without an attribute), an explicit fact that values must be assigned as properties, are not parsed from attributes, and are not reflected. *(Implemented, M4: `components[…].propertyOnly` lists every public writable property without an attribute, accessors included (`property:odd-input#value`; its `value` attribute sets `defaultValue`), with `extracted` provenance.)*
- **Event intent:** whether an event reports user intent or a state notification, and that programmatic property writes do not emit it, taken from event definitions or authored text; unknown otherwise. *(Implemented, M4: `components[…].events[]` holds `{ event, intent }`; `intent` is an `authored` fact from the definition's literal `intent` option ([core-contracts.md §2](./core-contracts.md#2-public-properties-without-decorators)), or `{ known: false }`. A computed `intent` is reported (`analyzer.dynamic.value`) and recorded as unknown. A derived definition keeps the publisher's intents, without the publisher's source location. The "not emitted by property writes" claim is verified per engine by the contract suite, not asserted by the analyzer.)*
- **Dependencies:** the elements a `compose()` definition registers. *(Implemented as `definition.dependencies`, §3.2.)*
- **Contract references:** stable ids such as `contract:core/binding-rule`, `contract:core/scope`, `contract:core/lifecycle`, `contract:core/update-complete`, pointing at the published contract text a component relies on, so references can be explained without restating them. *(Implemented, M4. `@oddkin/core` ships `CONTRACTS.md` and `contracts.json` (id → title, anchor, SHA-256 of the section), generated from the marked sections of [core-contracts.md](./core-contracts.md). Each component lists the contracts it relies on (`components[…].contracts`: binding rule, properties, events, lifecycle, `updateComplete`, scope, and composition for composed definitions). Top-level `contracts` holds the entries read from the `@oddkin/core` installed for the analyzed package; an id missing there is `analyzer.contract.unresolved`. `resolveContract(id, from?)` and `contractIndex(package, from?)` in `@oddkin/analyzer` resolve ids offline to the installed package's section text and version. Authored text citing an id that does not exist fails the build (`agent.guidance.unknownReference`).)*
- **Deprecations and migrations:** `@deprecated` with replacement ids, `@since`, and references to migration records. *(Implemented, M4: `@deprecated` on a component class, on a `with({ … })` property entry, or on an event constant, with optional `@replacement` (a tag, a member name, or a stable id; normalized to an id) and `@migration` (where the migration record lives). Standard CEM gets `deprecated` (the reason) on the declaration, member, attribute, or event; metadata gets `components[…].deprecations[]` with `authored` provenance and source. Nothing is inferred from the reason text. A component's `@since` is a separate fact (when it was introduced). Derived definitions keep a publisher's deprecations: the reason from its CEM, the replacement and migration from its metadata, under the derived ids.)*
- **Customization paths:** documented component variables, parts, and slots grouped as the supported customization ladder. *(Implemented, M4: `components[…].customization` lists the variables, parts, and slots (level 2 paths), and `levels`, the supported ladder levels from an authored `@customization 1 2 3` tag, or `{ known: false }`. An invalid tag gives `analyzer.tag.invalid` and stays unknown. Every `@oddkin/components` element declares its levels (7a9c9ab); the `@oddkin/ai` elements do not yet, so theirs are unknown. Private `--_*` custom properties an element's styles read are its own wiring, so they are published neither as CEM `cssProperties` nor as level-2 variables.)*
- **Verified conditions:** a `verified` fact's source adds `conditions` (browser engines and versions, package version, configuration), so evidence is never generalized beyond what ran. *(Implemented: `components[…].verification`, §3.)*

Absent information remains unknown; nothing here is inferred from names or types.

### 3.2 Multi-product extensions (M4 prototype; reviewed at M8)

Additive facts from [multi-product.md](./multi-product.md) §10:
- foundation and derived-definition relationships (`extends`, recognized statically from `compose()` spreads or the chosen lineage form); *(implemented, also across packages, §8)*
- behavior, template, structural-style, and visual-style source references; *(implemented: `definition.template` and ordered `definition.styles`, with `package` on references another package publishes; each exported template and style source is published with its anatomy and reads, §8)*
- component-family mappings (role → definition) and composite dependencies; *(composite dependencies implemented as `definition.dependencies`; family mappings wait for the M8 product-aware composite decision)*
- anatomy and customization contracts (supported levels);
- registration entries;
- foundation compatibility ranges;
- authored guidance and verification evidence bound to the implementation and configuration tested.

Derived definitions get their own component ids. Standard CEM stays interoperable; the rest is enrichment. Template factories and configuration expressions are never executed; dynamic cases report diagnostics.

## 4. Outputs

| # | Output | Location | Consumers |
| --- | --- | --- | --- |
| 1 | `custom-elements.json` (standard CEM) | package root; referenced from `package.json` `"customElements"` | Any CEM tool, IDEs, Workbench baseline, agents |
| 2 | `oddkin.metadata.json` (Oddkin enrichment, separately versioned) | package root; exported via `exports` | Workbench full mode, docs, agents |
| 3 | Workbench indexes: page registry, search index, module/registration map, import-map data, asset list, legacy redirects | generated dir (`.oddkin/` in dev; inside the static build) | Workbench |
| 4 | Editor and schema outputs: VS Code `html.customData` / `css.customData`, JSON Schemas for models and example files, TS declaration checks | generated dir / package | IDEs, validators |
| 5 | Agent outputs: compact contract bundles keyed by stable id, each with a freshness fingerprint (generator version, schema version, package versions, input hash) | generated dir; `json/` in the agent kit | `@oddkin/agent` (`./kit` renders the Markdown references, packaging, and discovery files from these bundles) |

- CEM output is validated against the **pinned CEM schema: `custom-elements-manifest@2.1.0`** (npm `latest`, released 2024-05-06; repository HEAD `d2f79f0` on 2026-10-17; includes `readonly` on properties, clarified reflected attributes, and `CSSCustomState`). Re-check for newer releases at each Oddkin release. Oddkin-specific data never goes into CEM except standard-allowed fields; the enrichment manifest references CEM declarations by module path + name, so standard consumers stay interoperable.
- Interoperability is checked with an independent tool: `npm run verify:packs` runs the third-party VS Code custom-data generator (`custom-element-vs-code-integration`) on the manifests of the installed tarballs, outside the workspace, and requires every element, attribute, CSS custom property, and part to reach its output. Output 4's own VS Code custom data is therefore not needed for editor support today.
- Generation is deterministic: stable key ordering, normalized paths, no timestamps (the run date appears only in verification provenance).

## 5. Validation

- Every module path and registration entry in outputs resolves against the package's `exports` and exists in built output (and in the packed tarball during M12).
- Metadata vs implementation contract tests: defaults, allowed values, reflection, events, and slots in metadata match runtime behavior in browser tests (results attach `verified` provenance; implemented for `@oddkin/components` and `@oddkin/ai`, §3).
- Token references in component metadata exist in the token inspection output; recipe regions referenced by parts exist; model ids resolve.
- **Public API comparison**: `oddkin analyze --compare <baseline-dir|package@version>` reports added/removed/changed contracts with a suggested semver impact; used in release checks.
- **Change impact** (planned, [change-impact-and-verification.md](./change-impact-and-verification.md) §2): `comparison-snapshot.v1` manifests extend this comparison to definitions, foundations, styles, tokens, recipes, products, examples, and suites. Items match by stable id; renames are recognized only from authoritative identity or migration records (e.g. `@renamedFrom`). `oddkin impact` traverses edges with provenance, widens selection for unresolved ones, and writes `impact-report.v1`.
- **Authored references:** every tag, property, event, slot, part, token, recipe, and public import named in authored guidance or examples resolves against the metadata (`agent.guidance.unknownReference`); incorrect examples declare the diagnostic they should produce. *(Implemented, M4: `checkReferences(authoredTexts(manifest, metadata, examples), referenceIndex(…))` in `@oddkin/analyzer`. Authored text is CEM descriptions and deprecation reasons, metadata facts with `provenance: 'authored'` (`@useFor`, `@a11y`, `@keyboard`, …), and literal example labels, guidance, and mistake explanations with their source locations. Code spans in these forms are checked: `odd-x`, `<odd-x attr="v">`, `odd-x:state(s)`, `odd-x::part(p)` (a known element, or an event); `@oddkin/pkg/entry` (an `exports` entry); `--name` (a token variable of the default theme or a declared CSS property); `group.name` whose first segment starts a token id (a token); and, against the element the text describes, `.member`, `method()`, `attr="value"` (declared, and an allowed value for literal unions), `slot="name"`, `::part(p)`, and `:state(s)`. A span followed by "event" or "layout recipe" must name one. Other spans, including bare words, HTML, ARIA, DOM APIs, and native events, are prose. `npm run build` (`scripts/build-metadata.mjs`) fails on any finding, across both component packages, every workspace package's exports, and the default theme.)*

## 6. Operation modes

| Mode | Behavior |
| --- | --- |
| One-shot | `oddkin analyze` writes outputs and a diagnostics report; non-zero exit on errors |
| Watch | Incremental analysis via the compiler's incremental program; re-emits only changed artifacts; pushes updates to the Workbench dev server |
| API | `analyze(config) → { metadata, diagnostics }` for tooling and `@oddkin/agent` (Node only) |
| Impact (planned) | `snapshot()`, `compare(base, head)`, `impact(comparison, { select })` in `./impact`; local only, no hosted service |

Stale generated artifacts are removed only inside directories that carry an Oddkin "generated" marker file; authored files (config, examples, guidance, explicit metadata) are never touched.

## 7. Packaging

- `@oddkin/analyzer`: Node-only; may depend on build-time third-party tooling (the TypeScript compiler) because it is development tooling, not shipped browser code. Optional peer-style dependency on `@oddkin/tokens/node` to resolve token contracts and `@oddkin/core/model` (DOM-free) types.
- Oddkin's own packages run the analyzer at build time (dev dependency) and publish outputs 1–2.
- Boundary check: no browser entry of any package and no published Workbench bundle reaches `@oddkin/analyzer`.

## 8. Behaviors settled in the M3 implementation

- **Front end:** TypeScript 5.9 compiler API, in-process (ADR 0018). `analyze({ project, root?, library?, oldProgram? })` returns `{ manifest, metadata, diagnostics, extraction, program }`; `writeOutputs(result, dir)` writes `custom-elements.json` and `oddkin.metadata.json`; `oddkin-analyze <tsconfig> [--out] [--name --version] [--no-history] [--strict] [--json]` exits 1 on errors (or warnings with `--strict`). The command reads git history for `docs[*].updated` from the tsconfig's directory by default, the same `gitHistory()` the API takes; `--no-history` turns it off, and without full history it says so and publishes only authored dates. It reads no token inspection, so foundation pages come only through the API (`analyze({ tokens })`).
- **No execution:** the analyzed library is never imported; a fixture module that throws on import is analyzed normally.
- **Paths:** module paths are the published output paths, derived from the tsconfig `rootDir`/`outDir` relative to the package root (default: the tsconfig directory); `registration` is the package export specifier for the registering module when `package.json` `exports` maps to it.
- **Extracted:** `OddkinElement` subclasses and `with()` factories (including inheritance across files with CEM `inheritedFrom`), `prop.*` kind/type/attribute/reflection/literal default/description/enum values, public fields, getters (read-only without a setter) and methods, `static events` (including shorthand entries) with detail types, flags, `syncs` pairs, and JSDoc descriptions, slots and parts from `render()` templates plus `@slot`/`@csspart`, CSS custom properties from `var()` reads and `@cssprop`, custom states from `this.setState('…')` and `@cssstate`, `define()`/`customElements.define()` registrations, re-exports, `token('…')` and `var(--odd-…)` reads, `defineLayoutRecipe` and `defineModel` summaries, and Oddkin JSDoc tags (`@a11y`, `@keyboard`, `@category`, `@useFor`, `@notFor`, `@limitation`, `@related`) as `authored` facts with source locations.
- **Unknowns and dynamics:** non-literal defaults are omitted from CEM (unknown, never guessed) and reported as `analyzer.dynamic.value`; spreads, computed keys, non-`prop.*` definitions, computed tag names, and unresolvable registrations report `analyzer.dynamic.*` with file, line, and column.
- **Undeclared events:** a class that emits an event definition (`this.emit(def)` or `emit(this, def)`) missing from its own or inherited `static events` reports `analyzer.event.undeclared` at the call. The event is not added: CEM events stay equal to the events the element defines at runtime, which the contract tests check.
- **Explicit metadata:** `/** @oddkin-metadata ./file.json */` on a component class merges a JSON file (`description`, `properties`, `events`, `slots`, `parts`, `cssProperties`, `cssStates`; entries replace extracted ones by name) and records each merged member in `oddkin.metadata.json` `authored` with its source file. That class's `analyzer.dynamic.*` warnings become `info`. Unreadable or malformed files report `analyzer.metadata.missing`/`analyzer.metadata.invalid` as errors. The inline `static metadata = …` form sketched in §2 is not supported; JSON keeps explicit facts out of runtime bundles.
- **`compose()` definitions (M4, ADR 0036):** definitions are resolved by following imports through the type checker, not file names, including spreads of other definitions (`extends`), external templates (identifiers or inline functions), styles (identifiers, arrays, inline `css`), and named dependencies. `define(definition)` produces a registration with the define entry's export specifier. A definition's template and styles **replace** the slots, parts, CSS properties, and token reads its class derives from `render()` and `static styles` (JSDoc-declared names are kept). Metadata records `definition` (`ref`, `extends`, `template`, `styles`, `dependencies`). Members tagged `@internal` are excluded like `_`-prefixed ones. A `var(--odd-…)` read is a token read unless the component documents it as its own variable with `@cssprop` (e.g. `--odd-button-radius`), in which case it is a CEM CSS property. `@previewRole` tags are published as `previewRoles` (`role:<name>`). Unresolvable cases report `analyzer.dynamic.tagName`, `analyzer.dynamic.registration`, or `analyzer.dynamic.definition`. A folder-structured fixture (`tests/fixtures/analyzer-composed`) yields CEM declarations identical to the colocated `analyzer-library` apart from module paths.
- **Validation:** outputs validate against the pinned `custom-elements-manifest@2.1.0` schema and `docs/schemas/oddkin-metadata.v1.schema.json`; output is deterministic (stable ordering, two-space JSON, no timestamps).
- **Definitions derived from another package (M4, multi-product):** a product package can recompose a published definition (`compose({ ...buttonDefinition, name: 'studio-button', element: StudioButton, styles })`) and extend its published class. Nothing from that package is executed. The analyzer finds the publishing package from the declaration file's nearest `package.json` and reads its `custom-elements.json` (`"customElements"`) and `oddkin.metadata.json`.
  - **Class:** members, attributes, events, slots, parts, CSS properties, and states come from the publisher's CEM declaration; token reads and sync pairs come from its metadata. Inherited entries carry CEM `inheritedFrom` with `package` and `module`, and `superclass` names the package.
  - **Definition:** `extends` is the published `component:<tag>`. An inherited template and inherited styles are references with `package`. A recomposition that reuses the published class for another name reports `analyzer.dynamic.definition`, matching the runtime's `registry.constructorReused`.
  - **Per-source facts:** to replace what a template or style source provides without guessing, every package publishes two additive sections keyed by `module#name`. `templates` lists the slots and parts each exported template renders. `styles` lists the CSS custom properties and tokens each exported `css` source reads, whether a definition uses it or not, and its `css` text with token references written as `token(<name>)` (any other substitution as `unknown()`), so style mappings can be read through shared sheets. Styles imported from another package are recorded as `{ package, module, name }`, and what they read comes from that package's `styles` facts.
  - **Missing facts:** an element class whose package publishes no CEM declaration for it reports `analyzer.published.missing` (warning), and its subclasses are not documented. A publisher without per-source facts reports `analyzer.published.sources` (info), and the facts its template and styles provided are kept rather than guessed.
  - **Verified** in `packages/analyzer/test/products.test.ts` (fixtures `tests/fixtures/analyzer-product`, `analyzer-legacy`): a skin-only recomposition documents the same contract and token reads as `odd-button`; a new skin adds only its own reads; a replaced template provides only its own slots and parts.
## 9. Diagnostics (planned extension)

Analyzer diagnostics already carry `code`, `severity`, `message`, `source`, and `suggestion`. The shared envelope in [agent-tooling.md](./agent-tooling.md) §9.1 adds optional `kind` (error, recommendation, unresolved), `subject` (stable id), `expected`/`received`, `docs` references, and a `fix` only when it is sufficiently supported. Static analysis stays separate from executing trusted project examples in a preview.

## Open questions

- TypeScript compiler API vs a faster parser plus TS for types only (performance experiment in M3).
- Exact JSDoc tag vocabulary and whether to align with existing CEM analyzer tag conventions.
- Editor output targets beyond VS Code custom data.
