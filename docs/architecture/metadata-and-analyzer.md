# Metadata model and `@mote/analyzer`

Status: the analyzer core is **implemented** in `@mote/analyzer` (M3): extraction (§2) except theme/foundation/docs enrichment, outputs 1–2 (§4), API and one-shot CLI (§6). §8 lists settled behaviors. Workbench indexes, editor/agent outputs, watch mode, `--compare`, and contract tests against runtime behavior are later work. Agent-facing extensions (§3.1, output 5 in §4, §9) are **planned** ([ADR 0032](./decisions/0032-generated-agent-kits.md)). `@mote/analyzer` is optional, Node-only development tooling and is never part of a browser or component-consumer graph. Related: [workbench.md](./workbench.md), [agent-tooling.md](./agent-tooling.md), [data-composition.md](./data-composition.md), [layout-recipes.md](./layout-recipes.md).

## 1. Responsibilities

| Unit | Does | Does not |
| --- | --- | --- |
| `@mote/analyzer` | Statically analyze a component library's source and declarations; build one normalized metadata model; validate it; emit standard CEM, the Mote enrichment manifest, Workbench indexes, editor/schema outputs, and agent-facing outputs | Execute component modules, constructors, registration calls, or arbitrary expressions; render anything |
| `@mote/workbench` | Render docs, controls, previews, Theme Studio from analyzer outputs | Re-derive metadata |
| The documented library | Supplies the real component implementations, entry points, theme config, and optional authored examples/guidance | Maintain story files for basic API exploration |
| `@mote/agent` | Reads the same outputs (or calls the analyzer API) | Keep its own copy of contracts |

There is **one** metadata generator, used by Mote's own packages and by any team pointing the tooling at its library.

## 2. Supported authoring patterns

Analysis uses an established compiler front end — **proposed: the TypeScript compiler API** (program + type checker), so JS (with JSDoc) and TS libraries share one path and declaration types are available. No hand-written JavaScript parser; regular expressions are never the primary analysis strategy.

Recognized statically:
- `MoteElement` subclasses, `MoteElement.with({...})` factories, `prop.*` definitions, inheritance chains, mixins written as typed factories, imports and re-exports across files and packages (via declaration files).
- Public properties (type, default when statically known, allowed values, nullable/optional/read-only, reflection, attribute name, converter kind), attributes, public methods (signature only), events (from typed event definitions: name, detail type, `bubbles`/`composed`/`cancelable`), slots and parts (from templates and/or explicit declarations), CSS custom properties, custom states (`ElementInternals.states`).
- Registration: `define('tag', Class)` calls in registration entries, `HTMLElementTagNameMap` augmentations, and package `exports` → browser module entry points.
- Recognition follows actual imports, definitions, and registrations through the type checker, not file names. The planned composition API (`compose()` definitions that reference external template and style modules, and `define(definition)` registrations; [core-contracts.md](./core-contracts.md) §1.1) is resolved by following the imported symbols. The repository folder convention ([IMPLEMENTATION_PLAN.md](../../IMPLEMENTATION_PLAN.md) §3.3) is a layout the analyzer understands, never a requirement; colocated components analyze identically. *(Planned, M4.)*
- Token contracts used by component styles (`token('…')` references, `var(--mote-…)` in CSS files), recipes (`defineLayoutRecipe` — analyzed statically), variants, conditions, profiles, data models (`defineModel`).
- JSDoc/TSDoc: descriptions, `@example`, `@deprecated`, `@since`, and Mote tags (`@a11y`, `@keyboard`, `@behavior`, `@previewRole`, `@related`, `@category`, `@useFor`, `@notFor`, `@limitation`).
- Theme Studio preview capabilities, composition presets, adapter references from `mote.config.*` and colocated example files.
- Foundation and documentation enrichment: foundation categories/sections from the theme config and token inspection output, component categories, authored page content (`mote.docs.ts`, Markdown front matter), and explicitly configured product sources (validated against the product schema; remote manifests fetched by Workbench build tooling, not by the analyzer at analysis time).

Unsupported dynamic definitions (computed tag names, properties built in loops, conditional `define` calls, spread of runtime objects) produce `analyzer.dynamic.*` diagnostics with the source location and a suggested explicit declaration:

```ts
/** @mote-metadata ./button.metadata.json */  // or an inline `static metadata = defineMetadata({...})` literal
```

Explicit metadata must be a static literal or JSON file; it is merged with extracted facts and recorded with `authored` provenance.

Recipe CSS extraction (layout-recipes.md §9) is a **separate, opt-in build step** that evaluates DOM-free recipe modules; it is not part of analysis.

## 3. Normalized metadata model

One model, versioned (`mote-metadata` schema v1), with stable identifiers and provenance for every fact.

```ts
interface MoteMetadata {
  schema: 'https://…/mote-metadata/v1.json';
  library: { name: string; version: string; prefix?: string; packages: PackageInfo[] };
  components: Record<ComponentId, ComponentMeta>;   // 'component:acme-button'
  recipes: Record<RecipeId, RecipeMeta>;            // 'recipe:side-nav'
  models: Record<ModelId, ModelMeta>;               // 'model:mote.navigation-item'
  tokens?: TokenIndexRef;                           // pointer to @mote/tokens inspection output
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

- **Stable ids**: `component:<tag>`, `property:<tag>#<name>`, `event:<tag>#<name>`, `slot:<tag>#<name|default>`, `part:<tag>#<name>`, `cssprop:<tag>#<name>`, `token:<name>`, `recipe:<name>`, `model:<name>`, `example:<tag>/<name>`, `role:<name>`. Ids survive file moves; renames are reported as remove + add.
- **Provenance labels**: *extracted* (static analysis), *authored* (JSDoc, explicit metadata, examples, guidance), *observed* (recorded by Workbench/runtime inspection, e.g. computed values), *verified* (linked to a passing test run). Workbench and agents display these labels; unverified behavior is never shown as verified.
- **Unknown is a value**: defaults that cannot be determined statically are `{ known: false }`, never guessed.
- **Foundation enrichment** references token data; it does not recompute it. Token values, aliases, provenance, and variations come from `@mote/tokens` inspection output produced by the canonical generator. The analyzer only records which foundations, sections, vocabularies, contracts, and relationships exist, so Workbench has no second token engine or foundation parser.
- **Style mappings** for "From property to token" traces (`property/state → CSS property → token`) are extracted from component styles, recipes, and role metadata where statically determinable; otherwise absent.
- **Updated dates** (`docs[*].updated`) come only from authored metadata (`authored`) or source history (`extracted`, last commit touching the declared source files, when history is available in the build). The analyzer never uses build time. Absent dates are omitted.
- **Page ids** (`foundations/spacing`, `components/<tag>`, `theme-studio`) and section ids are stable and shared with the Workbench page registry and authored content ([workbench-pages.md §2, §10](./workbench-pages.md)).

### 3.1 Agent-facing extensions (planned, M4; reviewed at M8)

These extend the same model; there is no separate agent catalog ([agent-tooling.md](./agent-tooling.md) §3.1).

- **Rich-object assignment:** for `prop.object`/`prop.array` (and any property without an attribute), an explicit fact that values must be assigned as properties, are not parsed from attributes, and are not reflected.
- **Event intent:** whether an event reports user intent or a state notification, and that programmatic property writes do not emit it, taken from event definitions or authored text; unknown otherwise.
- **Dependencies:** the elements a `compose()` definition registers.
- **Contract references:** stable ids such as `contract:core/binding-rule`, `contract:core/scope`, `contract:core/lifecycle`, `contract:core/update-complete`, pointing at the published contract text a component relies on, so references can be explained without restating them.
- **Deprecations and migrations:** `@deprecated` with replacement ids, `@since`, and references to migration records.
- **Customization paths:** documented component variables, parts, and slots grouped as the supported customization ladder.
- **Verified conditions:** a `verified` fact's source adds `conditions` (browser engines and versions, package version, configuration), so evidence is never generalized beyond what ran.

Absent information remains unknown; nothing here is inferred from names or types.

## 4. Outputs

| # | Output | Location | Consumers |
| --- | --- | --- | --- |
| 1 | `custom-elements.json` (standard CEM) | package root; referenced from `package.json` `"customElements"` | Any CEM tool, IDEs, Workbench baseline, agents |
| 2 | `mote.metadata.json` (Mote enrichment, separately versioned) | package root; exported via `exports` | Workbench full mode, docs, agents |
| 3 | Workbench indexes: page registry, search index, module/registration map, import-map data, asset list, legacy redirects | generated dir (`.mote/` in dev; inside the static build) | Workbench |
| 4 | Editor and schema outputs: VS Code `html.customData` / `css.customData`, JSON Schemas for models and example files, TS declaration checks | generated dir / package | IDEs, validators |
| 5 | Agent outputs: compact contract bundles keyed by stable id, each with a freshness fingerprint (generator version, schema version, package versions, input hash) | generated dir; `json/` in the agent kit | `@mote/agent` (`./kit` renders the Markdown references, packaging, and discovery files from these bundles) |

- CEM output is validated against the **pinned CEM schema: `custom-elements-manifest@2.1.0`** (npm `latest`, released 2024-05-06; repository HEAD `d2f79f0` on 2026-10-17; includes `readonly` on properties, clarified reflected attributes, and `CSSCustomState`). Re-check for newer releases at each Mote release. Mote-specific data never goes into CEM except standard-allowed fields; the enrichment manifest references CEM declarations by module path + name, so standard consumers stay interoperable.
- Generation is deterministic: stable key ordering, normalized paths, no timestamps (the run date appears only in verification provenance).

## 5. Validation

- Every module path and registration entry in outputs resolves against the package's `exports` and exists in built output (and in the packed tarball during M12).
- Metadata vs implementation contract tests: defaults, allowed values, reflection, events, and slots in metadata match runtime behavior in browser tests (results attach `verified` provenance).
- Token references in component metadata exist in the token inspection output; recipe regions referenced by parts exist; model ids resolve.
- **Public API comparison**: `mote analyze --compare <baseline-dir|package@version>` reports added/removed/changed contracts with a suggested semver impact; used in release checks.
- **Authored references** (planned): every tag, property, event, slot, part, token, recipe, and public import named in authored guidance or examples resolves against the metadata (`agent.guidance.unknownReference`); incorrect examples declare the diagnostic they should produce.

## 6. Operation modes

| Mode | Behavior |
| --- | --- |
| One-shot | `mote analyze` writes outputs and a diagnostics report; non-zero exit on errors |
| Watch | Incremental analysis via the compiler's incremental program; re-emits only changed artifacts; pushes updates to the Workbench dev server |
| API | `analyze(config) → { metadata, diagnostics }` for tooling and `@mote/agent` (Node only) |

Stale generated artifacts are removed only inside directories that carry a Mote "generated" marker file; authored files (config, examples, guidance, explicit metadata) are never touched.

## 7. Packaging

- `@mote/analyzer`: Node-only; may depend on build-time third-party tooling (the TypeScript compiler) because it is development tooling, not shipped browser code. Optional peer-style dependency on `@mote/tokens/node` to resolve token contracts and `@mote/core/model` (DOM-free) types.
- Mote's own packages run the analyzer at build time (dev dependency) and publish outputs 1–2.
- Boundary check: no browser entry of any package and no published Workbench bundle reaches `@mote/analyzer`.

## 8. Behaviors settled in the M3 implementation

- **Front end:** TypeScript 5.9 compiler API, in-process (ADR 0018). `analyze({ project, root?, library?, oldProgram? })` returns `{ manifest, metadata, diagnostics, extraction, program }`; `writeOutputs(result, dir)` writes `custom-elements.json` and `mote.metadata.json`; `mote-analyze <tsconfig> [--out] [--name --version] [--strict] [--json]` exits 1 on errors (or warnings with `--strict`).
- **No execution:** the analyzed library is never imported; a fixture module that throws on import is analyzed normally.
- **Paths:** module paths are the published output paths, derived from the tsconfig `rootDir`/`outDir` relative to the package root (default: the tsconfig directory); `registration` is the package export specifier for the registering module when `package.json` `exports` maps to it.
- **Extracted:** `MoteElement` subclasses and `with()` factories (including inheritance across files with CEM `inheritedFrom`), `prop.*` kind/type/attribute/reflection/literal default/description/enum values, public fields, getters (read-only without a setter) and methods, `static events` (including shorthand entries) with detail types, flags, `syncs` pairs, and JSDoc descriptions, slots and parts from `render()` templates plus `@slot`/`@csspart`, CSS custom properties from `var()` reads and `@cssprop`, custom states from `this.setState('…')` and `@cssstate`, `define()`/`customElements.define()` registrations, re-exports, `token('…')` and `var(--mote-…)` reads, `defineLayoutRecipe` and `defineModel` summaries, and Mote JSDoc tags (`@a11y`, `@keyboard`, `@category`, `@useFor`, `@notFor`, `@limitation`, `@related`) as `authored` facts with source locations.
- **Unknowns and dynamics:** non-literal defaults are omitted from CEM (unknown, never guessed) and reported as `analyzer.dynamic.value`; spreads, computed keys, non-`prop.*` definitions, computed tag names, and unresolvable registrations report `analyzer.dynamic.*` with file, line, and column.
- **Explicit metadata:** `/** @mote-metadata ./file.json */` on a component class merges a JSON file (`description`, `properties`, `events`, `slots`, `parts`, `cssProperties`, `cssStates`; entries replace extracted ones by name) and records each merged member in `mote.metadata.json` `authored` with its source file. That class's `analyzer.dynamic.*` warnings become `info`. Unreadable or malformed files report `analyzer.metadata.missing`/`analyzer.metadata.invalid` as errors. The inline `static metadata = …` form sketched in §2 is not supported; JSON keeps explicit facts out of runtime bundles.
- **Validation:** outputs validate against the pinned `custom-elements-manifest@2.1.0` schema and `docs/schemas/mote-metadata.v1.schema.json`; output is deterministic (stable ordering, two-space JSON, no timestamps).
## 9. Diagnostics (planned extension)

Analyzer diagnostics already carry `code`, `severity`, `message`, `source`, and `suggestion`. The shared envelope in [agent-tooling.md](./agent-tooling.md) §9.1 adds optional `kind` (error, recommendation, unresolved), `subject` (stable id), `expected`/`received`, `docs` references, and a `fix` only when it is sufficiently supported. Static analysis stays separate from executing trusted project examples in a preview.

## Open questions

- TypeScript compiler API vs a faster parser plus TS for types only (performance experiment in M3).
- Exact JSDoc tag vocabulary and whether to align with existing CEM analyzer tag conventions.
- Editor output targets beyond VS Code custom data.
