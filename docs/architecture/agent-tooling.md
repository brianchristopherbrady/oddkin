# Agent tooling, generated agent kits, and shared metadata contracts

Status: **proposal**. `@oddkin/agent` is optional, development-only, and not implemented. A Node-script pilot of project context, kit generation, freshness, and the managed `AGENTS.md` section exists in `scripts/agent-kit/` (M5 items 859–862); it moves into `@oddkin/agent` in M11. Nothing here is a browser runtime feature. §3.2 separates what exists today from what needs extension and what remains proposed. Decision record: [ADR 0032](./decisions/0032-generated-agent-kits.md) (extends [ADR 0022](./decisions/0022-agent-boundaries.md)).

## 1. Purpose and central outcome

**A team adopting Oddkin can generate accurate, version-aware agent support for its own library from the same authoritative inputs used by its documentation and Workbench.**

Every library built with Oddkin can generate its own versioned **agent kit** from its component metadata, configuration, authored guidance, and examples. The kit describes the consuming team's own:

- package names and public exports;
- component names, prefixes, and APIs;
- tokens, themes, modes, density settings, and profiles;
- layout recipes and responsive conditions;
- examples, fixtures, composition patterns, and design guidance;
- repository conventions and available verification commands.

It must let an assistant work correctly even when it starts with no prior knowledge of Oddkin or of the consuming library.

Help developers use their **existing** IDE agent and model with accurate, project-specific knowledge of Oddkin: the installed versions, public metadata, theme configuration, custom tokens, recipes, and extensions. Generic documentation is a fallback, not the source of truth. Oddkin tooling supplies contracts, deterministic operations, and evidence; the developer's model does the reasoning.

AI support is optional developer tooling. Ordinary component consumers never need agent tooling, Workbench, Oddkin state, application services, or a hosted AI service.

## 2. Package boundaries

| Rule | Detail |
| --- | --- |
| Dev-only | Installed as a dev dependency. Browser packages and deployed apps never import it; the boundary check fails if any browser entry or the docs app's runtime graph reaches it. |
| Node-only | All entry points may use `node:*`. |
| Reads, never loads, browser code | Inspects metadata files (`custom-elements.json`, `oddkin.metadata.json`, token inspection JSON, recipe contracts) produced by `@oddkin/analyzer` (or calls its Node API), and calls DOM-free entries (`@oddkin/tokens/generate`, `@oddkin/core/layout/inspect`). It never imports element modules. |
| No bundled model | Uses whatever agent/model the developer's IDE provides. No network calls of its own. No mandatory hosted model, embedding service, or vector index; search is deterministic over local metadata. |
| Local first | Every lookup works offline from the workspace and installed packages. Remote documentation may supplement local context only when requested, and only when its version matches the installed package; it is labelled as remote. |
| Independent of Workbench | Agent-kit generation reads analyzer outputs, theme configuration, authored content, and example files. It never requires building, serving, or publishing the Workbench application. |
| No second analyzer | Uses `@oddkin/analyzer` outputs or its Node API; never re-parses component sources itself. |
| Dependencies | May depend on `@oddkin/tokens` (Node + DOM-free entries) and read other packages' published metadata files by path through their `exports`. The optional MCP adapter is isolated in its own entry; whether it uses a third-party protocol SDK (dev-only) or an original implementation is decided by ADR. |

## 3. Shared contracts (generated from authoritative definitions)

| Contract | Source of truth | File / format |
| --- | --- | --- |
| Components: tag, class, imports, registration entry, properties, attributes, events + detail, slots, parts, CSS custom properties | `OddkinElement.with()` definitions + component definition metadata | Custom Elements Manifest `custom-elements.json` (for everything CEM represents) |
| Tokens: names, categories, types, aliases, defaults, provenance, deprecations | Resolved token graph | `@oddkin/tokens/json/<theme>.inspect.json` |
| Recipes: regions, helpers, variants, conditions, profiles, parts, containers, layer order | Recipe definitions via `describeRecipe` | `oddkin.metadata.json` |
| Conditions and profiles | Theme configuration | `oddkin.metadata.json` + token inspection JSON |
| Accessibility and lifecycle requirements, keyboard behavior, form participation | Component definitions | `oddkin.metadata.json` (CEM extension fields where appropriate) |
| Executable examples and supported migration mappings | Docs examples and migration tests | `oddkin.metadata.json` references to example files |
| Data models: kinds, fields, rules, portable subset, versions, migrations, deprecations, region sources | `defineModel` definitions ([data-composition.md](./data-composition.md) §5) | `oddkin.metadata.json` + `@oddkin/components/schemas/*.json` |
| Registered project item kinds and composition types | Project registrations | Project-level `oddkin.metadata.json` generated by the same generator |
| Authored examples, preview roles, Theme Studio config schema and saved compositions | `defineExamples`, `oddkin.config.*`, theme config | `oddkin.metadata.json` + Workbench config schema ([workbench.md](./workbench.md)) |

All contracts are produced by `@oddkin/analyzer` ([metadata-and-analyzer.md](./metadata-and-analyzer.md)); every fact carries provenance (`extracted` / `authored` / `observed` / `verified`), which the agent reports when citing it.

- **Versioned Oddkin schema:** `oddkin.metadata.json` carries `"schema": "https://…/oddkin-metadata/v1.json"` and `"oddkinVersion"`. Breaking schema changes bump the major version; tools state which versions they read.
- Each package publishes its own metadata file through `exports` (e.g. `@oddkin/components/oddkin.metadata.json`). Application-level custom components can generate the same files with the shared generator.
- The docs app, Workbench (including its integrated component examples and Theme Studio), and `@oddkin/agent` all read these same files. Contract tests ensure implementation, metadata, and docs agree.

### 3.1 Agent-facing contract coverage

Agent-facing contracts are **views of the normalized metadata model** ([metadata-and-analyzer.md](./metadata-and-analyzer.md) §3), not a second catalog. They reference existing property, event, model, and composition declarations by stable id; no AI-specific configuration restates them.

| Fact (where known) | Source | Status |
| --- | --- | --- |
| Component identity, package and version | CEM declaration + `oddkin.metadata.json` `library` | Extracted today (M3) |
| Public imports and registration entries | `exports` → module map; `registration` specifier | Extracted today for `define(tag, Class)`; `compose()` / `define(definition)` recognition planned (M4) |
| Properties, attributes, types, defaults, conversion, reflection | `prop.*` definitions | Extracted today |
| Rich-object assignment and serialization requirements (property-only, no attribute, not reflected, JSON not parsed from attributes) | `prop.object`/`prop.array` kind + absent attribute | Kind extracted today; explicit "assign as a property" fact planned (M4) |
| Events, detail types, propagation, cancellation | `static events` | Extracted today |
| Event intent (user intent vs state notification; programmatic writes do not emit) | Event definitions ([core-contracts.md](./core-contracts.md) §2) + authored text | Planned (M4) |
| Slots, parts, methods, custom states | Templates, JSDoc, `setState` | Extracted today |
| Dependencies (components a definition registers) | `compose({ dependencies })` | Planned with the composition API (M4) |
| Rendering, lifecycle, readiness, ownership contracts | Library-level contract entries with stable ids (e.g. `contract:core/binding-rule`, `contract:core/scope`) that point at the published contract text | Implemented (M4): `@oddkin/core/CONTRACTS.md` and `contracts.json`, referenced per component in metadata and resolved offline with `resolveContract` |
| Token references, component variables, recipes, customization paths | `token()` / `var(--…)` reads, recipes, documented customization ladder | Token and variable reads extracted today; customization paths planned |
| Examples, source locations, deprecations, migration references | `defineExamples`, source positions, `@deprecated`, migration records | Examples and source positions today; deprecation and migration references planned |
| Usage constraints and accessibility responsibilities | `@useFor`, `@notFor`, `@limitation`, `@a11y`, `@keyboard`, authored content | Extracted as `authored` facts today |

Rules:

- Provenance stays explicit: *extracted* (static analysis), *authored* (guidance, JSDoc, explicit metadata, examples), *observed* (recorded runtime inspection), *verified* (a passing test). A `verified` fact names its conditions: test id, run, date, package version, browser engines and versions.
- Unresolved information is a value (`{ known: false }` or an `unresolved` diagnostic). Accessibility guarantees, intended usage, and complete behavior are never inferred from names or types.
- The analyzer's no-execution guarantee holds. Dynamic expressions produce `analyzer.dynamic.*` diagnostics or use the existing explicit-metadata mechanism (`@oddkin-metadata`).
- Standard CEM remains the interoperable output; Oddkin-specific facts stay in the separately versioned enrichment.

### 3.2 What exists, what needs extension, what is proposed

| Area | Exists and verified | Needs extension | Proposed |
| --- | --- | --- | --- |
| Metadata | `@oddkin/analyzer` (M3): CEM + `oddkin.metadata.json` v1, stable ids, provenance, unknowns, `analyzer.dynamic.*`, explicit JSON metadata, no execution. M4: `compose()` / `define(definition)` recognition, `definition.dependencies`, `propertyOnly`, event `intent` (unknown when undeclared), deprecations with replacement and migration ids, `since`, customization paths and levels, `verified` facts with conditions | Contract-reference fields | Agent contract bundles (analyzer output 5) |
| Examples | `@oddkin/workbench/examples`: `defineExamples` typed from `HTMLElementTagNameMap`, `examples.v1`, `checkExamples`, `validateUsage`; explained incorrect examples with expected diagnostics (M4); checks against workspace public exports | Incorrect examples for code-level mistakes (registration, events, bindings, reconnect, theme scopes); checks against packed packages | Kit references generated from examples |
| Pages and content | `@oddkin/workbench/pages`, `./config`, `defineDocs` | Validation of API references inside authored guidance | Clean Markdown pages and `llms.txt` in static docs builds |
| Diagnostics | Five shapes sharing `code`, `severity`, `message`, a location (`path` or `source`), and an optional `suggestion`: tokens `Diagnostic`, `AnalyzerDiagnostic`, `ModelDiagnostic`, `WorkbenchDiagnostic`, `CollectionDiagnostic`; core `OddkinError` codes | Optional envelope fields (§9.1) | `diagnostic.v1` schema |
| Agent tooling | Pilot scripts (M5, `scripts/agent-kit/`): `resolveProjectContext`, kit generation with entry guide, component/token/recipe/model references and `json/` bundles, fingerprints and `--check`, the managed `AGENTS.md` section | Task references, packaging adapters | `@oddkin/agent` package, operations, CLI, MCP adapter, preview feedback, evaluation |

## 4. Project context and freshness

`resolveProjectContext(root)` (Node) resolves the consuming workspace's **actual** installation and configuration:

- installed Oddkin and library package versions, and the compatibility ranges they declare;
- available public exports and registration entries;
- project-owned components and their dependencies;
- the active token configuration and supported theme axes (themes, modes, density, profiles);
- available recipes, conditions, examples, and fixtures;
- repository component conventions (folder structure per [IMPLEMENTATION_PLAN.md](../../IMPLEMENTATION_PLAN.md) §3.3, or colocated), detected from real files and imports rather than file names alone;
- relevant build, validation, browser, and test commands from `package.json` scripts and Oddkin config.

It also reports which **capability paths** are in use (core-only authoring, token-only consumption, components without Oddkin state, applications using optional services). Guidance and suggestions stay inside those paths; for example, a components-only consumer is never told to adopt `@oddkin/state`.

**Freshness.** Every generated artifact carries a fingerprint: generator name and version, schema version, installed package versions, and a content hash of its inputs (metadata files, theme config, authored content, example files). `oddkin-agent kit --check` recomputes it; a mismatch reports `agent.kit.stale` with the changed inputs and the refresh command, and exits non-zero in CI. Every operation result states its `source` (package, version, metadata path, fingerprint) and `freshness` (`current`, `stale`, or `unknown`). Current website documentation is never silently substituted for an older installed API.

*(Pilot, M5: `scripts/agent-kit/context.mjs` resolves the context from manifests, published metadata, the token inspection the foundations reference, source maps (component sources), example files, and `oddkin.docs.*`; nothing is executed. Theme axes come from the inspection's scopes; the component layout is `folders` when a definition's template is its own module beside the class. Capability paths follow the installed packages: `application-services` with `@oddkin/state` or `@oddkin/app`, otherwise `components-without-state` when a component library is present; `core-authoring` with project-owned components; `tokens-only` with `@oddkin/tokens` and neither. The generator version is a hash of the pilot's sources, and `inputs.json` beside `kit.json` records each input's hash so `--check` names what changed.)*

## 5. Generated agent kit

`oddkin-agent kit` (and the `./kit` API) writes a versioned kit from the library's own inputs. It works without Workbench.

```text
agent-kit/
  kit.json                      manifest: schema, library, versions, fingerprint, entries, packaging targets
  GUIDE.md                      concise entry guide (small, budgeted; links to references)
  references/
    components/<tag>.md         exact API generated from metadata
    choosing-components.md      from authored use-for/not-for guidance and categories; "not authored" when absent
    tokens/<category>.md        roles, aliases, scopes, axes, from token inspection output
    recipes/<name>.md           regions, variants, conditions, configuration
    models/<name>.md            fields, rules, portable subset, versions
    tasks/                      install-and-consume, choose-components, author-components, theming,
                                layout-and-responsive, data-models, lifecycle-and-scope, frameworks,
                                debugging, migration
  json/                         the same contracts keyed by stable id (analyzer output 5)
```

- **Generated vs authored.** Exact API references are generated from normalized metadata. Design and architectural guidance is authored content keyed by stable ids (the content layers of [workbench-pages.md](./workbench-pages.md)). Every tag, property, event, slot, part, token, recipe, and import that authored guidance mentions is validated during the build (`agent.guidance.unknownReference`), the same way checked design guidance works in [Web Awesome's agent skills](https://webawesome.com/docs/ai/agent-skills).
- **Formats.** Plain Markdown plus structured JSON, useful without any particular IDE.
- **Optional packaging adapters:**
  - an [Agent Skills](https://agentskills.io/specification) directory (`SKILL.md` front matter `name`/`description`, `references/` loaded on demand);
  - a concise [AGENTS.md](https://agents.md/) section (setup commands, conventions, verification) written between managed markers. Text outside the markers is never changed, and every update is shown as a diff first;
  - thin IDE-specific instruction adapters generated from the same kit.
- **Discovery.** Docs static builds may publish clean Markdown pages and an [`llms.txt`](https://llmstxt.org/) index built from the kit. Loading behavior depends on the client: publishing a file does not mean every assistant reads it. The docs list which clients were tested and how each loads the kit.
- **Small entry guide.** The entry guide has a recorded size budget. Operations return targeted references instead of requiring the whole library documentation in every context window. *(Pilot: 8,192 bytes of UTF-8 `GUIDE.md`; `@oddkin/components` 2,533 B, `@oddkin/ai` 7,353 B, a fixture library 1,811 B on 2026-10-21. The pilot writes component, choosing, token, recipe, and model references and `json/` bundles; task references and packaging adapters remain.)*
- **Oddkin uses its own kit.** `@oddkin/components` publishes a kit, and the Oddkin repository's own agent guidance comes from the same generator.
- **Products (planned, [multi-product.md](./multi-product.md) §10).** Lookups and references take an optional `product`. Results cover only that product's family, tokens, styles, templates, and dependencies, and state which foundation each component uses, which customization level fits a request, and which contracts and checks must be preserved. Per-product references are produced on demand, never for every product × mode × density combination.

## 6. Operations

One set of deterministic operations, used by both human CLI commands and agent tools.

| Operation | Purpose |
| --- | --- |
| `inspectProject()` | Installed Oddkin package versions, entry points in use, theme config location, custom metadata sources |
| `getComponent(tag)` / `getRecipe(name)` / `getToken(name)` / `getProfile(name)` | Exact contracts from the installed metadata |
| `searchContracts(query)` | Find components, tokens, recipes by name/category; never invents names |
| `explainConfig(path)` | Explain a theme configuration option, defaults, precedence, current value and provenance |
| `validateConfig(change)` | Apply a proposed config change in memory and return the token pipeline's diagnostics |
| `scaffold(kind, options)` | Generate a component, recipe, or composition from supported APIs only. Repository components follow the folder convention (IMPLEMENTATION_PLAN.md §3.3: class, template, styles, `compose()` definition, explicit `*.define.ts`, side-effect-free `index.ts`, examples); colocated output on request |
| `planMigration(source)` | Produce a targeted diff for supported mappings (e.g. Lit/FAST authoring, hard-coded CSS → tokens) and list unsupported cases explicitly |
| `runChecks(scope)` | Run the project's typecheck, lint, tests, and contract checks relevant to changed files; return concrete results |
| `getModel(name)` / `listModels()` | Installed component models, project kinds, supported schema versions |
| `validateData(model, data)` | Run the model validator (and migrations if versioned) before anything is rendered; returns diagnostics |
| `adviseComposition(context)` | Recommend data model, template, or hybrid using the documented criteria (data-composition.md §9), with reasons |
| `planMigration(source)` (extended) | Also: repetitive markup → supported model + data; or the reverse (model → plain template) when a schema would be harder to maintain |
| `mapPreviewRoles(library)` | Identify components compatible with Theme Studio specimen roles from declared capabilities/adapters, with diagnostics |
| `verifyExport(config)` | Regenerate outputs with the canonical generator and run the independent-consumer check |
| `suggestProducts()` | Run the same workspace product discovery as `oddkin workbench products --discover`; returns suggestions with reasons, never enables products |
| `explainPage(id)` | Explain which generated facts, built-in copy, and authored content produce a Workbench page/section, and which content key would fill a "Not documented" gap |

Schema validity reported by these tools is never presented as proof of accessibility, application behavior, or design quality; `runChecks` and browser fixtures supply that evidence.

Results are structured JSON with source references (file, metadata path, version) so an agent can cite them.

### 6.1 Agent-facing capabilities (proposed names, not existing exports)

| Capability | Operation(s) | Required result |
| --- | --- | --- |
| Inspect project | `inspectProject()`, `resolveProjectContext()` | Installed versions, configuration, exports, conventions, capability paths, available checks |
| Find components | `findComponents(purpose)` (extends `searchContracts`) | Candidates by purpose from authored use-for/not-for guidance, categories, and names, with documented constraints and availability; says so when no guidance is authored |
| Inspect component | `getComponent(tag)` | Exact API, imports, registration, dependencies, examples, source references |
| Find or explain tokens | `getToken(name)`, `findTokens(role)`, `explainConfig(path)` | Existing tokens, semantic roles, values, scopes, alias paths, provenance |
| Inspect recipes | `getRecipe(name)`, `getProfile(name)` | Regions, variants, conditions, configuration, supported composition |
| Scaffold component | `scaffold('component', …)` | Files following the project's verified conventions (§4) |
| Validate usage | `validateUsage(files \| snippet)` | Static checks with precise diagnostics: unknown tags, properties, attributes, events, slots, tokens, imports; rich values passed as attributes; `="false"` on boolean attributes; missing registration; private imports. Unresolved cases are listed separately |
| Plan migration | `planMigration(source)` | Version-specific changes, affected locations, proposed edits |
| Inspect preview | `inspectPreview(example, settings)` | Runtime errors, events, relevant state, verification evidence (§9.2) |
| Explain impact | `explainImpact(base, head)` (planned) | `impact-report.v1`: changed contracts and values, affected products/definitions/examples with reasons, coverage gaps, selected checks and their states |
| Explain element | `explainElement(preview, target)` (planned) | `explanation.v1` styling and runtime records with provenance and limitations — the same record Workbench shows |
| Run conformance | `runConformance(suite, implementation, config)` (planned) | `conformance-result.v1` with suite version, implementation, configuration, browser |
| Export reproduction | `exportReproduction(example, outDir)` (planned) | `reproduction.v1` directory plus the list of undeclared inputs that need adapters; dry run by default |

- **Bounded responses:** limits and cursors, stable ids, and links to expanded detail; never the whole catalog by default.
- **One implementation:** the CLI (`--json` for machine-readable output, readable terminal output by default) and the MCP adapter call the same operations.
- **MCP:** each tool declares an `inputSchema` and an `outputSchema` (JSON Schema 2020-12) and returns `structuredContent`. Invalid input or business-rule failures are tool execution errors (`isError: true`) carrying Oddkin diagnostics, so the model can correct itself ([MCP tools](https://github.com/modelcontextprotocol/modelcontextprotocol/blob/main/docs/specification/2026-07-28/server/tools.mdx)). The protocol revision is pinned in the M11 adapter ADR.
- **Reviewable changes:** scaffolding and migrations return a patch and file list, default to dry run, and re-check their preconditions (expected file content hashes, installed versions) before applying. Nothing is applied silently.

## 7. Executable examples as shared evidence

- The same `defineExamples` files drive documentation, Workbench, scaffolding templates, kit references, and browser tests where practical.
- Published examples are checked against real public exports in the workspace (M4) and against packed packages (M12). *(Workspace check implemented: `tests/examples/public-imports.test.ts`; authored examples import package internals for types only.)*
- Common mistakes get focused coverage, each with a correct example and a clearly explained incorrect one:
  - attributes vs properties, including rich objects;
  - boolean presence and removal semantics;
  - explicit registration and dependency registration;
  - event names and detail payloads;
  - direct readable bindings vs tracked scalar reads;
  - connection-owned work, cancellation, and reconnect;
  - slots and supported content relationships;
  - theme scopes and customization boundaries;
  - framework integration differences.
- Incorrect examples are never shown as recommendations. Each declares the diagnostic it should produce, and `validateUsage` tests assert it.
  - *(Implemented for usage expressible as an example's props, attributes, and slots.)* An example's `incorrect: { explanation, diagnostic, correct }` names the mistake, the code, and the correct example in the same set. `checkExamples` rejects an incorrect example that is a preset, a recommendation, or a preview role, or that points at a missing or incorrect example. `validateUsage(set, contract)` reads the published CEM (field types and attribute links) and reports `usage.attribute.propertyOnly` (rich data such as `items` written as an attribute), `usage.boolean.false`, `usage.attribute.value` (outside an enum), `usage.attribute.unknown` (naming the reflected attribute of a camelCase property), and `usage.slot.unknown`. Correct examples must produce none.
  - The analyzer records `incorrect: { diagnostic, correct }` on the example in `oddkin.metadata.json` and leaves out an incorrect example it cannot read literally. Workbench pages do not count incorrect examples as coverage, and neither the example mount tests nor the contract harness render from them.
  - The slice components pair five mistakes with correct examples: side-nav `items` as an attribute, button `disabled="false"` and `appearance="danger"`, input `required="false"`, and card content in a `body` slot. Browser tests show each mistake doing what its explanation says (no entries; still disabled; default appearance with `element.attribute.invalid`; still required; content not shown), unlike its correct example.
  - Remaining: registration, event names and details, direct vs tracked bindings, reconnect-owned work, theme scopes, and framework differences are code, not props/attributes/slots. They need code examples and a source-level checker (the kit's authored-reference checks, M11).
- Evidence levels stay distinct: compiles (typecheck), statically valid (`checkExamples`, `validateUsage`), browser-verified (`runExample` in three engines). A compiling snippet is not evidence that its interactions work.
- DOM-free example and config helper entries and package boundaries are preserved; production component entries never import documentation or agent helpers.

## 8. Design intent and composition guidance

Authored enrichment may supply, and the kit then exposes:

- when a component is appropriate and its important constraints;
- required labelling and documented accessibility responsibilities;
- supported content relationships and companion components;
- semantic token roles and approved customization paths;
- layout regions and responsive expectations;
- recommended recipes and composition patterns;
- working examples of common screens and interactions.

References are generated from the consuming project's actual inventory and configuration. Every referenced tag, property, event, slot, part, token, recipe, and public import is validated during the build. Authored judgment stays labelled `authored` and distinct from extracted API facts; missing guidance is shown as unavailable, never fabricated. Ordinary templates and optional data-driven composition both stay first-class; AI support never makes a JSON page-building schema mandatory ([data-composition.md](./data-composition.md) §8).

## 9. Repairable diagnostics and preview feedback

### 9.1 Diagnostic envelope (drafted as `diagnostic.v1`; extends the existing shapes)

```ts
interface OddkinDiagnostic {
  code: string;                                   // stable, e.g. 'analyzer.dynamic.tagName'
  severity: 'error' | 'warning' | 'info';
  kind?: 'error' | 'recommendation' | 'unresolved';
  message: string;                                // concise explanation
  path?: string;                                  // configuration path (JSON pointer), as today
  source?: { file: string; line: number; column: number };  // as in analyzer diagnostics today
  subject?: { kind: 'component' | 'property' | 'event' | 'slot' | 'part' | 'token' | 'recipe' | 'model' | 'example' | 'operation'; id: string };
  expected?: string;                              // contract
  received?: string;                              // value found
  docs?: { id?: string; href?: string }[];        // documentation or example references
  suggestion?: string;                            // existing field
  fix?: { description: string; edits: { file: string; range: [number, number]; text: string }[] }; // only when sufficiently supported
}
```

- Existing fields keep their names and every new field is optional, so the token, analyzer, model, and Workbench shapes already conform; `CollectionDiagnostic` now has `severity` (`error`: the item is not rendered). Verified in `tests/schemas/diagnostics.test.ts` against [diagnostic.v1](../schemas/diagnostic.v1.schema.json). Core `OddkinError` codes map onto `code`.
- Errors, recommendations, and unresolved analysis are distinguished; stylistic preferences are recommendations, never invalid code.
- Production diagnostics stay lightweight (codes only, [ADR 0031](./decisions/0031-dev-prod-builds-and-size-budget.md)); detailed inspection is development tooling.

### 9.2 Preview feedback

`inspectPreview` reuses Workbench's isolated preview frames, frame protocol, and `Scope` ownership ([workbench.md](./workbench.md) §5) to:

- render known examples and supported compositions;
- set documented properties and slots and run the interactions an example declares;
- change viewport, container size, direction, and theme values;
- collect runtime errors, event output, and relevant state;
- run applicable accessibility and browser checks;
- return structured, bounded results.

Rules:

- The remount policy is preserved: theme-value changes keep instances; structural and registration replacements follow their explicit rules.
- Static analysis never executes code. Preview feedback deliberately executes **trusted project examples** only, under the same trust model as Workbench (frame isolation is not a security sandbox).
- Results state the browser engine and version, configuration, and verification conditions. Passing automated checks is never presented as complete accessibility or correctness.

## 10. Layers and entry points (proposed)

```text
@oddkin/agent
  ./operations    deterministic Node functions above (the only place logic lives)
  ./context       project context, capability paths, fingerprints and freshness (§4)
  ./kit           agent-kit generator: entry guide, references, JSON, Agent Skills packaging,
                  managed AGENTS.md section, llms.txt index (§5)
  ./cli           `oddkin-agent` bin; human-readable and --json output of the same operations
  ./instructions  thin IDE-specific instruction adapters generated from ./kit
  ./mcp           optional MCP server adapter exposing operations as tools
```

Instructions, tools, and transport adapters are separate: changing the MCP adapter never changes operation behavior; instruction files point agents to the tools rather than restating contracts that may drift.

## 11. Evaluation

Representative tasks, run against the side-navigation fixture and the theming slice:

| Task type | Example |
| --- | --- |
| Implementation | Build a responsive side navigation using the installed recipe API and components |
| Theme configuration | Add a product theme with a compact navigation profile |
| Explanation | Explain why a nested scope's action colour did not change |
| Migration | Convert a Lit element with a decorator property and a task to Oddkin |
| Data composition | Generate valid `NavigationItem[]` with a project-registered kind; convert repetitive nav markup to the model; decide data vs template for a one-off layout |

Additional reproducible tasks, run against Oddkin itself **and** against at least one consuming fixture library with a different prefix, packages, and theme configuration:

- consume a component from public package exports;
- author a component in the repository's file structure;
- build responsive navigation or a settings form;
- configure a theme and choose semantic tokens;
- pass rich data through properties;
- handle lifecycle-owned asynchronous work;
- migrate a supported API change;
- diagnose registration and binding failures;
- work with a different library configuration;
- handle missing components or unresolved metadata accurately.

Conditions, compared with the same model:

1. Documentation alone.
2. Documentation plus generated project-specific references.
3. Generated references plus deterministic tools.
4. The complete workflow with preview feedback where available.

Each run records the model and version, starting repository and commit, package versions, task, available context, and verification conditions.

Measures:

- functional correctness (same typecheck, unit, and Playwright checks as handwritten fixtures);
- invented APIs, imports, tokens, and unsupported claims;
- appropriate component and token selection;
- repair attempts and completion time;
- context and tool-output volume;
- unnecessary edits, regressions, and unintended dependencies;
- correct handling of unknowns.

Tasks and fixture configurations are held out from kit authoring. Example validity checks run independently of agent performance. Report raw results and sample sizes without statistical superiority claims; improved AI usability is a hypothesis until this evidence exists.

## 12. M8 agent-kit review (2026-10-27)

With `@oddkin/agent` skipped for now (ADR 0046 D7, owner 2026-10-27), the packaged kits, the published metadata, and the composition schema are the whole agent surface. Evidence in [verification.md](../verification.md), 2026-10-27.

- **Agent-facing metadata fields.** Every element of both packages publishes `useFor`, `notFor`, `a11y`, `registration`, `category`, `contracts`, and its customization paths; 61 of 77 publish `keyboard`, 30 `limitations`, 20 `syncPairs`, and the event intents (§3.1). Gap: the usage pairs (correct/incorrect examples) are deferred by the owner (M10).
- **Diagnostic envelope.** `diagnostic.v1` is published (`docs/schemas/diagnostic.v1.schema.json`), and the token, analyzer, model, collection, and Workbench shapes validate against it (`tests/schemas/diagnostics.test.ts`).
- **Kit and context schemas.** `kit.json` validates against `agent-kit.v1` and the project context against `project-context.v1` (`tests/agent-kit/kit.test.ts`, `context.test.ts`), including the fingerprint of every input.
- **Size.** `GUIDE.md` is 6,355 B for `@oddkin/components` and 6,637 B for `@oddkin/ai`, within the 8,192 B budget.
- **Freshness.** The package kits (`packages/*/agent/`) are build outputs, written by the last step of `npm run build` (`scripts/agent-kit/package-kits.mjs`). A partial build (`tsc -b`, `build-metadata.mjs`) leaves them behind the metadata, and `package-kits.mjs --check` says so (`agent.kit.stale`, 40 of 68 files after the AI recipe changes); after a full build both kits are current. The repository's own kits under `.oddkin/agent-kit/` exist only after `node scripts/agent-kit/kit.mjs` (`agent.kit.missing` otherwise). `npm run verify:packs` packs what the build wrote, so a release that runs the full build ships current kits.
- **Candidate v1 contracts:** `oddkin-metadata.v1`, `agent-kit.v1`, `project-context.v1`, `diagnostic.v1`, `examples.v1`, and the composition schema (data-composition.md §8). Changes after v1 are additive under ADR 0029.

## Open questions

- MCP adapter implementation: original protocol code vs dev-only SDK dependency; pinned protocol revision (candidate: the 2026-07-28 tools specification).
- Packaging targets generated by default (Agent Skills directory, managed AGENTS.md section, which IDE adapters).
- Entry-guide size budget and how it is measured. *(Pilot: 8,192 bytes of UTF-8; revisit with the §11 evaluation.)*
- Preview driver for `inspectPreview` (Workbench dev server frames vs a project browser-automation tool).
- Deterministic ranking for `findComponents` without embeddings.
- ~~Where the metadata generator lives~~ — **resolved:** `@oddkin/analyzer` is the single generator; `@oddkin/agent` only reads or calls its API.

Research: [CEM schema](https://github.com/webcomponents/custom-elements-manifest), [CEM analyzer](https://custom-elements-manifest.open-wc.org/analyzer/getting-started/), [Agent Skills](https://agentskills.io/specification), [AGENTS.md](https://agents.md/), [llms.txt](https://llmstxt.org/), [MCP tools (2026-07-28)](https://github.com/modelcontextprotocol/modelcontextprotocol/blob/main/docs/specification/2026-07-28/server/tools.mdx), [Web Awesome agent skills](https://webawesome.com/docs/ai/agent-skills), [Angular CLI MCP](https://angular.dev/ai/mcp), [shadcn registry MCP](https://ui.shadcn.com/docs/registry/mcp) — register entries R33–R41 in [synthesis.md](../research/synthesis.md). These are implementation references; comparative claims require the §11 evidence.
