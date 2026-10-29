# Product patterns and flow contracts

Status: proposed implementation plan  
Owner decision required before public API work  
Last reviewed: 2026-10-29. Checked against the repository (`main` at `0d08543`) the same day: §1a lists what exists, and corrections are inline.

## 1. Purpose

Oddkin currently models the pieces of a design system well: tokens, components, properties, slots, events, states, examples, recipes, products, metadata, agent guidance, and verification. It does not yet model the product-specific sequence that uses those pieces to help a user accomplish a goal.

This plan introduces a development-time **product pattern and flow contract** layer. It connects user intent to approved product patterns, component requirements, application-owned behavior, required states, and verification.

The intended result is:

```text
User goal
  → approved product pattern
  → steps, decisions, states and recovery
  → components, tokens and recipes
  → product implementation
  → examples and verification
  → documentation and agent guidance
```

The first product value is not autonomous product design. It is making a design engineer's decisions explicit, reusable, reviewable, and verifiable across products and coding agents.

## 1a. Repository starting point (checked 2026-10-29)

| Plan element | In the repository | Gap for this plan |
| --- | --- | --- |
| Components in the examples | `odd-dialog` returns focus to its opener when it closes. `odd-input`, `odd-textarea`, `odd-checkbox`, `odd-radio-group`, and `odd-select` take part in forms, and `odd-validation-summary` collects and announces field errors. `odd-button` has `primary`, `secondary`, and `ghost` appearances | `odd-button` has no danger style, so a destructive action cannot rely on one |
| Agent approval (pilot C) | `@oddkin/ai` has `odd-action-approval`, `odd-checkpoint`, `odd-tool-call`, and `odd-change-review`, and the `oddkin.ai.approval.v1` record schema | — |
| DOM-free types for `workbench/patterns` | `@oddkin/core/model`, `@oddkin/core/model/schema`, and `@oddkin/core/diagnostics`. Workbench's DOM-free entries are `./examples`, `./config`, `./pages`, `./data`, `./content`, and `./conformance` | No `patterns` entry |
| Examples and fixtures | `defineExamples`; the serializable `examples.v1` layer keeps a fixture as `hasFixture` | — |
| Products | `product.v1` manifests; Workbench's optional Products pages; impact treats each product as a context (`oddkin-impact snapshot --product`) | — |
| Recipes and models | `defineLayoutRecipe` and `defineModel` (`@oddkin/core`); both appear in `oddkin.metadata.json` and in the agent kits | Neither is an item in the impact graph |
| Metadata | `oddkin-metadata.v1`, with the sections components, categories, recipes, models, templates, styles, contracts, foundations, stylesheets, examples, docs, and diagnostics | Pattern sections change that schema |
| Impact graph | Items: component, class, property, attribute, event, method, slot, part, cssprop, state, registration, export, definition, template, style, token, theme, product, example, and suite. Checks: `example:<tag>/<name>` and `suite:<id>#<tag>`, per product | No recipe, model, route, or pattern items; scenarios would be a third kind of check |
| Routes | `@oddkin/app`'s router declares routes in application code | No artifact records a stable route identity |
| Agent kits | The package kits ship `GUIDE.md`, `kit.json`, `llms.txt`, and `references/` (components, tokens, recipes, stylesheets, models, `choosing-components.md`, `composition.md`). The generator can also write `json/` bundles | No query operations: the owner skipped `@oddkin/agent` and MCP (IMPLEMENTATION_PLAN.md P2.2). No consumer kit command yet (P0.5 step 5) |
| Agent evaluation | [agent-tooling.md](../docs/architecture/agent-tooling.md) §11 proposes one; P0.4 has a real agent build a page from a kit | No evaluation harness |
| Figma | Code Connect mappings are repository artifacts (`artifacts/code-connect/`); publishing them to Figma was refused because it needs an Organization or Enterprise plan | Figma references stay provenance only |
| Schemas | 16 in `docs/schemas`, named `https://oddkin.dev/schemas/<name>/v1.json` | The three pattern schemas in §12 follow this convention |
| Decisions | The highest ADR is 0047 | The Phase 0 ADR takes the next number |
| Accessibility evidence | axe checks in the e2e suite. Screen-reader and Safari-on-hardware evidence is parked until hardware is available (P3), and the owner's own accessibility review is pending (P1.4) | Phase 4's manual assistive-technology reviews depend on both |
| Priority | Not in IMPLEMENTATION_PLAN.md's tiers P0 to P3 | Starts only when the owner places it (§24) |

## 2. Problem

A component contract can establish that `odd-dialog` returns focus to its opener when it closes, and that `odd-button` offers `primary`, `secondary`, and `ghost` appearances. (It has no danger style; `appearance="danger"` is reported and the default is used.) It cannot answer product questions such as:

- who may initiate workspace deletion;
- whether deletion is reversible;
- what consequences must be explained;
- how the destructive choice stands out when the button has no danger style;
- whether typed confirmation is required;
- what happens during partial failure;
- where focus and navigation go after completion;
- what analytics or audit events the product must record.

Without a flow contract, this knowledge remains in mockups, tickets, code, or individual judgment. Documentation and coding agents can select valid components while still assembling an invalid product experience.

## 3. Goals

1. Represent approved product patterns as versioned, JSON-compatible, DOM-free contracts.
2. Describe goals, applicability, steps, decisions, states, recovery, content, accessibility, instrumentation, and verification without executing business logic.
3. Reference existing Oddkin components, tokens, recipes, models, examples, products, and suites by stable identity.
4. Let products declare how they implement a pattern without moving product logic into Oddkin.
5. Generate human documentation and agent guidance from the same contract.
6. Add pattern and flow edges to change-impact analysis.
7. Verify structural requirements and observed behavior while representing missing evidence honestly.
8. Support correct and incorrect examples and scenario-based review.
9. Keep the model useful for non-Oddkin component libraries where standard or mapped metadata is available.

## 4. Non-goals

The first implementation will not:

- replace product research, product strategy, visual judgment, or design critique;
- generate complete production applications from a prompt;
- execute business workflows or become a BPMN/state-machine runtime;
- own permissions, persistence, routing, network requests, audit storage, or analytics delivery;
- infer product intent from screenshots;
- certify accessibility automatically;
- replace authored component contracts;
- import arbitrary Figma flows as authoritative contracts;
- create a general rules language or execute expressions from pattern files;
- automatically approve deviations or semantic-version changes.

## 5. Terminology

### Product pattern

A reusable, domain-aware interaction approach with stated intent and constraints, such as destructive action, account recovery, filtered search, multi-step onboarding, or agent action approval.

### Flow

A directed graph of steps, states, decisions, transitions, completion outcomes, and recovery paths that realizes a product pattern.

### Pattern definition

The authored, reusable contract. It describes what a conforming experience must communicate and do without containing product implementation code.

### Pattern implementation

A product-owned declaration mapping a pattern to routes, components, source modules, verification, and deliberate deviations.

### Scenario

An example path through a flow with an initial state, user or system actions, expected states, and expected observable outcomes.

### Requirement

A stable, testable expectation attached to the pattern, a step, a state, or a transition.

### Deviation

A documented difference between the reusable pattern and one product implementation. A deviation requires an owner, rationale, scope, and verification effect.

## 6. Package and ownership boundary

### Initial location

Prototype the authoring and validation API as a DOM-free entry in `@oddkin/workbench`:

```text
@oddkin/workbench/patterns
```

Reasons:

- patterns are development and assurance inputs rather than browser runtime dependencies;
- Workbench already owns examples, page data, documentation projections, and testing helpers;
- the contract can stabilize before creating another public package;
- Workbench's contracts are not frozen at 1.0.0 (ADR 0047), so a prototype entry there freezes nothing;
- production components must never depend on product-pattern definitions.

### Extraction decision

After two external implementations, evaluate extracting the stable DOM-free contract to:

```text
@oddkin/patterns
```

Extraction is justified only if products or independent tools need the contract without Workbench. The extracted package must remain DOM-free and must not import `@oddkin/components` at runtime.

### Dependencies

Initial rules:

- `workbench/patterns` may use DOM-free Oddkin model and diagnostic types (`@oddkin/core/model`, `@oddkin/core/model/schema`, `@oddkin/core/diagnostics`).
- Components, tokens, core, state, app, and AI never depend on patterns.
- Pattern files reference component, token, recipe, model, product, route, and suite identities as data.
- Product applications own implementations, permissions, effects, routes, persistence, and analytics.
- Analyzer and Workbench tooling consume pattern artifacts; browser runtime bundles do not.
- The boundary check (`npm run lint:boundaries`, `scripts/architecture/boundaries.config.mjs`) already keeps the runtime packages from importing Workbench outside colocated `.examples` files. A `./patterns` entry joins Workbench's `domFree` list there.

## 7. Authoring model

Provide a typed helper for TypeScript authors and a JSON Schema for other producers:

```ts
import { definePattern } from '@oddkin/workbench/patterns';

export default definePattern({
  schema: 'https://oddkin.dev/schemas/product-pattern/v1.json',
  id: 'workspace.delete',
  version: '1.0.0',
  title: 'Delete a workspace',
  summary: 'Explain and confirm permanent workspace deletion.',
  status: 'approved',
  goal: 'Permanently remove a workspace without concealing consequences or recovery limits.',
  applicability: {
    useWhen: ['A workspace owner permanently deletes a workspace.'],
    avoidWhen: ['The action is reversible through ordinary archive behavior.'],
  },
  actors: [{ id: 'owner', title: 'Workspace owner' }],
  entry: {
    requirements: ['permission.workspace.delete', 'workspace.exists'],
  },
  steps: [
    {
      id: 'explain',
      kind: 'surface',
      purpose: 'Explain the scope and permanence of deletion.',
      components: [{ tag: 'odd-dialog', role: 'confirmation' }],
      requirements: ['content.consequences', 'a11y.initial-focus'],
    },
    {
      id: 'confirm',
      kind: 'input',
      purpose: 'Require deliberate confirmation.',
      components: [{ tag: 'odd-input', role: 'name-confirmation' }],
      requirements: ['validation.workspace-name-match'],
    },
    {
      id: 'submit',
      kind: 'action',
      purpose: 'Request deletion exactly once.',
      components: [{ tag: 'odd-button', role: 'destructive-submit' }],
      requirements: ['action.no-duplicate-submit'],
    },
  ],
  states: [
    { id: 'ready', kind: 'ready' },
    { id: 'pending', kind: 'pending', requirements: ['status.pending-visible'] },
    { id: 'failed', kind: 'failed', requirements: ['recovery.preserve-confirmation'] },
    { id: 'complete', kind: 'complete', requirements: ['a11y.completion-announced'] },
  ],
  transitions: [
    { from: 'ready', action: 'submit', to: 'pending' },
    { from: 'pending', outcome: 'failure', to: 'failed' },
    { from: 'failed', action: 'retry', to: 'pending' },
    { from: 'pending', outcome: 'success', to: 'complete' },
  ],
  verification: ['scenario.workspace-delete.keyboard', 'scenario.workspace-delete.failure'],
});
```

The example is illustrative. Final names must follow the repository vocabulary review and must be tested against at least three patterns before acceptance. The three components exist. `odd-button` has no danger appearance, so `destructive-submit` names a role, and the product decides how that role is marked.

## 8. Data model

### 8.1 Pattern identity and provenance

Required:

- schema URI;
- stable pattern id;
- contract version;
- title, summary, and goal;
- lifecycle status: `draft`, `approved`, `deprecated`, or `retired`;
- source module;
- owner or ownership group when authored;
- updated date only from authored or source-history evidence;
- replacement or migration identity when deprecated;
- optional Figma page or node reference as provenance, never as executable truth.

Build time is not an authored updated date.

### 8.2 Applicability

Record:

- situations where the pattern should be used;
- situations where it should not be used;
- prerequisites;
- supported actors;
- required permissions or capabilities as stable named requirements;
- product or jurisdiction restrictions where explicitly authored.

The contract does not evaluate authorization. It records what the host must prove.

### 8.3 Steps

Each step has:

- stable id;
- kind: `surface`, `input`, `action`, `decision`, `system`, or `completion`;
- purpose;
- required information or content;
- component roles and allowed alternatives;
- token or recipe references where semantically required;
- entry and exit requirements;
- accessibility requirements;
- optional instrumentation requirements;
- related examples and verification.

Component references express roles and constraints, not hard-coded markup. A product may map an approved equivalent component through metadata.

### 8.4 States

The model must distinguish at least:

- ready;
- pending;
- empty;
- unavailable;
- denied;
- stale;
- failed;
- recovered;
- complete.

Patterns include only states relevant to their goal. The schema must not require meaningless boilerplate states.

Each state may declare:

- information that must remain visible;
- actions available or unavailable;
- focus and announcement expectations;
- preservation or reset requirements;
- recovery paths;
- telemetry or audit requirements;
- verification references.

### 8.5 Transitions

Transitions are descriptive data:

- source state;
- user action or system outcome;
- destination state;
- named guard requirements;
- named effect requirements;
- requirements and verification references.

No transition contains executable JavaScript or an expression language. The application owns the implementation.

### 8.6 Content requirements

Patterns may require content roles such as:

- title;
- consequence summary;
- recovery explanation;
- primary action label;
- destructive-action warning;
- progress status;
- completion announcement.

The contract may include example copy, but product content remains authored and localizable. Avoid freezing English prose into behavioral schemas.

### 8.7 Verification requirements

Requirements have stable ids and a verification classification:

- structural: statically inspectable;
- example: demonstrated by an authored example;
- behavioral: requires execution;
- accessibility-automated;
- accessibility-manual;
- visual;
- product-policy;
- instrumentation;
- unresolved.

The system must never claim behavioral or manual evidence from a structural declaration alone.

## 9. Product implementation declaration

Products map the reusable pattern to their implementation:

```ts
import { definePatternImplementation } from '@oddkin/workbench/patterns';

export default definePatternImplementation({
  pattern: 'workspace.delete@1',
  product: 'admin-console',
  routes: ['settings/workspace/danger-zone'],
  source: ['src/workspaces/delete-workspace.ts'],
  componentRoles: {
    confirmation: 'odd-dialog',
    'name-confirmation': 'odd-input',
    'destructive-submit': 'odd-button',
  },
  suites: ['suite:admin.workspace-delete'],
  deviations: [],
});
```

Implementation declarations are evidence supplied by the product, not proof that the source behaves as declared. Analyzer adapters may verify supported static relationships. Browser suites verify behavior.

### Deviations

A deviation requires:

- stable id;
- affected pattern requirement;
- product and scope;
- rationale;
- owner;
- status and review date;
- replacement verification;
- expiry or permanent decision where applicable.

Undocumented absence is not a deviation; it is unresolved or nonconforming.

## 10. Scenarios and examples

Add a DOM-free authoring entry:

```text
definePatternScenarios(pattern, scenarios)
```

A scenario records:

- stable scenario id;
- initial state and relevant inputs;
- actor;
- ordered actions and system outcomes;
- expected states;
- expected observable events, announcements, focus, route, or records;
- fixture and verification references;
- whether it is a correct, incorrect, edge, or recovery example.

Scenarios must be serializable after fixtures are reduced to `hasFixture`, following the existing example split. Browser testing helpers may mount a product-owned fixture, but the pattern package does not execute applications.

Initial scenarios should include:

- happy path;
- permission denied or unavailable;
- pending and duplicate-action prevention;
- failure with recovery;
- cancellation or exit;
- stale data where the domain requires it;
- keyboard path;
- narrow viewport or reflow where presentation matters.

## 11. Validation and diagnostics

The validator reports stable diagnostic codes and JSON-pointer paths. It must detect:

- duplicate pattern, step, state, transition, requirement, scenario, or deviation ids;
- transitions to unknown states;
- unreachable states;
- states with no legal exit where none is declared terminal;
- missing completion or explicit non-completion outcomes;
- component, token, recipe, product, suite, or route references that cannot resolve;
- a requirement represented as verified without compatible evidence;
- an approved pattern without ownership or verification policy;
- a deprecated pattern without replacement or explicit no-replacement reason;
- product implementations that omit required roles or states;
- expired deviations;
- non-JSON data, functions, class instances, cycles, and non-finite numbers;
- executable-looking guard or effect content where only stable names are allowed.

Warnings, not unconditional errors:

- no incorrect example;
- no recovery scenario where failure exists;
- missing manual accessibility evidence;
- missing instrumentation mapping;
- a product mapping that cannot be statically verified;
- an authored Figma reference that cannot be resolved by the current environment.

## 12. Metadata and schemas

Add versioned schemas:

```text
https://oddkin.dev/schemas/product-pattern/v1.json
https://oddkin.dev/schemas/pattern-implementation/v1.json
https://oddkin.dev/schemas/pattern-scenarios/v1.json
```

Generated package metadata may add:

```text
patterns[]
patternImplementations[]
patternScenarios[]
```

Rules:

- standard CEM remains unchanged;
- the sections extend `oddkin-metadata.v1` (§1a); the Phase 0 ADR decides between an additive change and a new major version;
- enrichment uses stable ids and content hashes;
- documentation prose may override presentation, not generated facts;
- private source paths are excluded unless configured for local or private output;
- schemas are JSON-compatible and portable;
- migrations are explicit and tested.

## 13. Analyzer integration

Add static discovery for explicitly configured pattern modules. Do not scan arbitrary application code and infer flows.

The analyzer should:

- load or statically extract supported pattern definitions without executing application code where possible;
- otherwise accept a generated JSON input from a trusted build step;
- resolve component, token, recipe, model, route, product, example, and suite references;
- publish provenance and unresolved references;
- hash each stable item for comparison snapshots;
- preserve authored requirement and deviation identities;
- generate diagnostics rather than guessing dynamic definitions.

Configuration decides which modules or JSON files are pattern inputs. Ordinary component consumers do not acquire analyzer dependencies.

## 14. Change-impact integration

Add graph items and edges:

```text
pattern
pattern-step
pattern-state
pattern-requirement
pattern-scenario
pattern-implementation
pattern-deviation
```

Representative edges:

```text
component → pattern step
token → pattern requirement
recipe → pattern step
pattern → implementation
implementation → product
pattern → scenario
scenario → example
scenario → suite
route → implementation
deviation → requirement
```

Prerequisites: the impact graph has no recipe, model, or route items today (§1a). Edges from recipes need recipe items first, and `route → implementation` needs a route identity that no artifact records yet. Pattern scenarios would become a third kind of check, beside `example:<tag>/<name>` and `suite:<id>#<tag>`.

Expected behavior:

- a changed component contract selects pattern scenarios and product suites that depend on its role;
- a changed required token selects affected patterns and product implementations;
- a pattern requirement change selects every implementation unless an authoritative mapping proves otherwise;
- an unresolved implementation edge widens verification rather than selecting nothing;
- an expired deviation becomes a review or incompatible finding according to its contract;
- reason paths appear in CLI, Markdown, Workbench, and agent output.

No automatic semantic-version classification is inferred solely from product-flow meaning in v1.

## 15. Workbench experience

Add a **Patterns** destination only when pattern data exists. Do not show an empty catalog.

### Patterns index

Show:

- title and summary;
- lifecycle status;
- category or user goal;
- products implementing it;
- verification state;
- unresolved requirements;
- owner and authored update date where available.

### Pattern detail

Sections:

1. Goal and applicability.
2. When to use and when not to use.
3. Actors and entry requirements.
4. Flow diagram.
5. Steps and component roles.
6. States, transitions, and recovery.
7. Content and accessibility requirements.
8. Correct, incorrect, edge, and recovery scenarios.
9. Product implementations and deviations.
10. Verification evidence.
11. Related components, tokens, recipes, and patterns.
12. Source and provenance.

The diagram is a projection of the contract, never a separate editable source of truth in the first implementation.

### Product view

On a product page (Workbench's optional Products pages exist today), show:

- implemented patterns;
- missing required implementations where configured;
- active deviations;
- affected patterns in a change report;
- verification status by pattern.

## 16. Agent tooling

Extend generated package or project kits with:

```text
references/patterns/<id>.md
references/choosing-patterns.md
json/patterns.json
json/pattern-implementations.json
json/pattern-scenarios.json
```

The package kits hold `GUIDE.md`, `kit.json`, `llms.txt`, and `references/` today. The generator can write `json/` bundles, but the shipped kits omit them. A kit for a product, or for a library outside this repository, needs the consumer kit command (IMPLEMENTATION_PLAN.md P0.5 step 5).

Agent guidance must instruct the agent to:

1. identify the user goal;
2. search for an approved applicable pattern;
3. read when-to-use and avoid conditions;
4. use declared component roles and product mappings;
5. implement required states and recovery;
6. preserve application ownership of policy and effects;
7. run the selected scenarios and suites;
8. report deviations instead of silently inventing behavior.

Potential deterministic operations after the contract stabilizes:

- `findPatterns({ goal, product })`;
- `showPattern({ id, version })`;
- `showPatternImplementation({ id, product })`;
- `validatePatternImplementation({ id, product, sourceRevision })`;
- `explainPatternImpact({ report, id })`.

These need an operations layer. The owner skipped `@oddkin/agent` and its MCP adapter until further notice (IMPLEMENTATION_PLAN.md P2.2), so Phase 5 starts with references only.

Do not add generative page-building operations until retrieval and validation demonstrate value.

## 17. Figma relationship

The first version supports authored references to:

- Figma file;
- page;
- section or flow node;
- component-set mappings from the Code Connect work (repository artifacts in `artifacts/code-connect/`; publishing them to Figma needs an Organization or Enterprise plan);
- optional review status.

Figma remains a design source and review surface, not the executable pattern contract. A later experiment may compare Figma flow connections, component instances, and variables with the authored pattern. It must report differences without automatically rewriting either side.

## 18. Verification strategy

### Unit and schema tests

- valid definitions and implementations;
- every diagnostic path;
- deterministic serialization;
- schema and TypeScript model parity;
- migration fixtures;
- no DOM or Node APIs in browser-neutral entries.

### Analyzer tests

- static and JSON inputs;
- real component and token references;
- dynamic or unsupported input diagnostics;
- provenance and content hashes;
- private-path behavior.

### Impact tests

- component, token, recipe, pattern, scenario, suite, and product changes;
- transitive reason paths;
- unresolved-edge widening;
- deviation expiry;
- unchanged artifacts remain byte-identical.

### Workbench tests

- navigation only when data exists;
- pattern index and detail projections;
- narrow layout, keyboard navigation, zoom, dark mode, and forced colors;
- flow diagram readable without color alone;
- source and verification links;
- unavailable evidence represented honestly.

### Agent evaluations

For controlled tasks, measure whether an agent:

- selects the applicable pattern;
- avoids a pattern marked inappropriate;
- uses supported component roles;
- includes pending, failure, recovery, and completion states where required;
- uses properties, attributes, slots, events, tokens, and recipes correctly;
- avoids one-off alternatives forbidden by the product mapping;
- runs and responds to verification;
- reports a required deviation.

Compare against component-only context. Record unfavorable results.

### Manual review

- design-engineer comprehension of the contract;
- product-designer review of applicability and flow projection;
- developer ability to implement from the contract;
- assistive-technology testing for selected pilot patterns, once the hardware and the owner's accessibility review allow it (§1a);
- whether the contract preserves rather than obscures product judgment.

## 19. Initial pilot patterns

Use three patterns with different structures.

### A. Destructive action

Tests consequences, permissions, deliberate confirmation, pending behavior, failure recovery, completion, focus, and audit requirements.

Components: `odd-dialog`, `odd-input`, and `odd-button`, which has no danger appearance.

### B. Validated submission

Tests field and form errors, server rejection, pending state, preservation of user input, summary and field association, retry, success, and navigation.

Components: the form controls and `odd-validation-summary`. `examples/forms` is an existing fixture (`e2e/forms-example.spec.ts`).

### C. Agent action approval

Tests proposal revision, stale approval, authorization, grouped information, approve/reject, execution state, failure, recovery, checkpoint, and audit history.

Components: `odd-action-approval`, `odd-checkpoint`, `odd-tool-call`, and `odd-change-review` from `@oddkin/ai`, with the `oddkin.ai.approval.v1` record. `examples/ai-agent` already uses `odd-action-approval`.

Each pilot must have:

- one approved definition;
- correct, incorrect, edge, and recovery scenarios;
- at least two product implementations or deliberately different configurations;
- automated and manual verification distinctions;
- one impact demonstration;
- one agent evaluation.

Do not start with onboarding, checkout, or another broad flow whose domain decisions overwhelm the contract experiment.

## 20. Delivery phases

### Phase 0 — Contract research and vocabulary, 1–2 weeks

- audit existing examples, recipes, product metadata, AI records, and change-impact identities;
- review pattern approaches in established design systems without copying proprietary content;
- author the three pilot patterns in plain Markdown;
- identify repeated fields and meaningful differences;
- decide whether a directed graph is sufficient;
- write an ADR (the next number after 0047) for package location, authority, and non-executable boundaries.

Exit: the three patterns can be reviewed by design and engineering without an API.

### Phase 1 — Schema and DOM-free authoring, 2–3 weeks

- implement types, `definePattern`, implementation declarations, scenarios, validators, diagnostics, schemas, and deterministic JSON;
- add invalid and valid fixtures;
- enforce JSON-compatible inputs;
- build the three pilot definitions.

Exit: definitions round-trip through TypeScript and JSON Schema with stable output.

### Phase 2 — Metadata, analyzer, and impact, 3–5 weeks

- configure pattern inputs;
- add metadata outputs and provenance;
- resolve existing identities;
- add comparison items and dependency edges;
- render CLI and Markdown impact reasons;
- prove changes select the expected scenarios and suites.

Exit: a changed component or pattern requirement produces an explainable product verification plan.

### Phase 3 — Workbench documentation, 3–4 weeks

- add conditional Patterns navigation;
- implement index, detail, diagram, product projection, evidence, and source sections;
- add accessibility and responsive tests;
- keep page data split and serializable.

Exit: a developer can understand and compare the three patterns without reading source files.

### Phase 4 — Scenarios and verification, 3–6 weeks

- implement scenario testing helpers;
- connect examples and suites;
- run browser and accessibility automation;
- conduct selected manual assistive-technology reviews;
- define evidence states and limitations.

Exit: each pilot pattern has verified happy, failure, recovery, and keyboard paths with explicit manual gaps.

### Phase 5 — Agent kit and evaluations, 2–4 weeks

- generate pattern references and JSON indexes;
- add retrieval operations where justified, if the owner reopens `@oddkin/agent` (P2.2);
- create controlled implementation tasks;
- compare pattern context with component-only context;
- measure unsupported API, missing state, and deviation behavior.

Exit: evidence shows whether pattern context materially improves agent output.

### Phase 6 — External product pilot, 4–8 weeks

- model one real customer or independent product flow;
- integrate its components and verification;
- observe authoring, implementation, review, and maintenance;
- record custom needs separately from generalizable contract needs;
- decide whether to extract `@oddkin/patterns`.

Exit: external users find the contract useful enough to maintain, and its impact report changes a real review decision.

### Phase 7 — Constrained generation experiment, optional

Only after retrieval, validation, and external maintenance succeed:

- generate a starting implementation from an approved pattern and product mapping;
- require review rather than direct merge;
- run scenarios and verification;
- compare with an agent given component-only context;
- record every unsupported assumption.

Do not make generation part of the stable contract unless it improves results without concealing product decisions.

## 21. Acceptance criteria

The first stable pattern contract is complete when:

1. Three structurally different patterns validate through TypeScript and JSON Schema.
2. Two products can implement one pattern differently with explicit, reviewable deviations.
3. No pattern definition executes code or moves application policy into Oddkin.
4. Components, tokens, recipes, products, examples, routes, and suites resolve by stable identity.
5. A component, token, or requirement change produces correct impact reason paths and conservative verification selection.
6. Workbench renders goal, applicability, flow, states, recovery, scenarios, implementations, deviations, evidence, and source.
7. Agent kits include the exact approved pattern version and product mapping.
8. Agent evaluation records whether pattern context improves component selection, required-state coverage, and supported API use.
9. Missing behavioral or manual evidence is never represented as a pass.
10. An external product team can author or maintain a pattern without the original Oddkin author.
11. The repository records verification commands and observed results.
12. Package extraction is decided from external evidence rather than architectural preference.

## 22. Risks and mitigations

### Risk: becoming a workflow engine

Mitigation: descriptive, non-executable contracts; applications own state and effects.

### Risk: a schema too generic to help

Mitigation: derive the first model from three concrete patterns and reject fields without a demonstrated consumer.

### Risk: freezing product judgment into bureaucracy

Mitigation: support draft status, deliberate deviations, rationale, ownership, review dates, and lightweight authoring.

### Risk: false assurance

Mitigation: evidence classification, unresolved states, conservative impact, and explicit manual verification.

### Risk: stale pattern documentation

Mitigation: source hashes, impact edges, ownership, context diffs, and release checks.

### Risk: duplicating component examples

Mitigation: pattern scenarios reference component examples and product fixtures; they do not restate component APIs.

### Risk: proprietary product logic in published artifacts

Mitigation: configurable public/private projections, source-path policy, and export review.

### Risk: agent generation becomes the product before the contracts work

Mitigation: generation is Phase 7 and optional. Retrieval, validation, verification, and human usefulness come first.

## 23. Success measures

Track:

- time to author and review a pattern;
- percentage of implementation references resolved;
- unresolved impact edges;
- pattern adoption by product;
- active and expired deviations;
- scenarios and requirements with compatible evidence;
- review findings caught before release;
- agent missing-state and unsupported-API rates;
- time required to update a pattern after a component or policy change;
- whether an external team continues maintaining the pattern after the pilot.

Do not use raw pattern count as a success metric.

## 24. Owner decisions before implementation

1. Approve the development-time, non-executable scope.
2. Approve the initial `@oddkin/workbench/patterns` location.
3. Select the three pilot patterns and product fixtures.
4. Decide which pattern data may enter public package metadata.
5. Decide whether authored Figma references are public, private, or omitted.
6. Choose the design and engineering reviewers for the first contracts.
7. Decide whether this work precedes or follows the first assurance pilot (the technical plan's Workstreams B to D).
8. Place this work in IMPLEMENTATION_PLAN.md's priority tiers; it is in none today.

## 25. Recommended next step

Do not begin with TypeScript. Write the destructive-action, validated-submission, and agent-approval patterns as reviewable Markdown using this plan's vocabulary. Compare them, remove fields without a real consumer, and record the package and authority decision in an ADR. That review is Phase 0 and the gate for implementation.

