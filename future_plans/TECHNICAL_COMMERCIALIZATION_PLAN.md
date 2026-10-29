# Technical commercialization plan

Status: proposed  
Planning horizon: first paid pilot through general availability  
Last reviewed: 2026-10-29

## 1. Objective

Convert Oddkin's existing runtime and verification assets into a product that an external design-system team can install, evaluate, and pay for without adopting the entire Oddkin application stack.

The commercial product should answer five questions for every proposed UI-system change:

1. What changed?
2. Is the change incompatible, review-worthy, or informational?
3. Which components, products, examples, recipes, tokens, and tests are affected?
4. Which checks ran, and what evidence did they produce?
5. What approved context should humans and coding agents use afterward?

## 2. Existing foundation

Implemented repository capabilities that should be reused rather than rebuilt:

- `@oddkin/analyzer`: static analysis without importing or executing component code; standard CEM and Oddkin enrichment metadata.
- `@oddkin/analyzer/impact`: comparison snapshots, change classification, reason paths, check selection, result merging, CLI output, and Markdown reports.
- `@oddkin/tokens`: deterministic generation in Node, browsers, and Workers; structured diagnostics; inspection data; DTCG output.
- `@oddkin/workbench`: config, page registry, examples, data generation, dev server, import maps, and testing helpers.
- package-generated agent kits with component, model, recipe, stylesheet, and token references.
- component and AI examples that can act as verification cases.
- conformance, accessibility, cross-browser, size, lifetime, and packed-consumer infrastructure.
- the docs application and Figma/Code Connect work as demonstration surfaces.

Known readiness gaps:

- packages remain private and versioned `0.0.0`;
- the top-level and package status documentation is inconsistent with the current catalog;
- a reliable fully parallel browser run is deferred; serial per-engine runs are the current reliable evidence;
- screen-reader and Safari-on-hardware verification remains incomplete;
- Workbench and Theme Studio contracts are still moving;
- there is no external installation telemetry, support process, release history, customer evidence, or compatibility history between releases;
- hosted identity, tenancy, persistence, billing, and security controls do not exist.

## 3. Product boundary

### Open local product

Keep the following useful without a hosted account:

- analysis and CEM generation;
- local snapshots and impact comparison;
- local Workbench and component examples;
- local agent-kit generation;
- local verification execution;
- human-readable and machine-readable report export;
- public schemas and documented artifact formats.

### Paid hosted product

The first hosted product should add coordination, history, scale, and assurance:

- pull-request status and review UI;
- persistent comparison snapshots and approved baselines;
- hosted reports and preview links;
- verification workers and result retention;
- team approvals and release evidence;
- private, versioned agent-context releases;
- multi-repository and multi-product dependency views;
- Figma/code drift reporting;
- RBAC, audit logs, SSO, private networking, and retention policies;
- support, migration help, and long-term supported releases.

Do not require a hosted account merely to compile or run customer applications.

## 4. Technical workstreams

### Workstream A — Release foundation

Goal: make the existing packages safe to evaluate outside the monorepo.

Tasks:

- Set preview versions and decide the public package set.
- Update every README and status statement from generated or verified facts where possible.
- Add changelogs and release notes.
- Verify `exports`, `files`, declarations, side effects, licenses, `customElements`, and packed installation.
- Publish a browser and Node support policy.
- Document tag-name collision and duplicate-version behavior.
- Add upgrade and deprecation policies.
- Run a clean packed-consumer matrix from published candidate tarballs.
- Produce a single release evidence bundle.

Recommended preview package set:

- `@oddkin/core`
- `@oddkin/tokens`
- `@oddkin/components`
- `@oddkin/ai`
- `@oddkin/analyzer`
- `@oddkin/workbench` as `0.x`

Keep `@oddkin/state` and `@oddkin/app` available only if documentation demonstrates a compelling independent adoption path. They should not dominate initial messaging.

Exit criteria:

- an unrelated repository can install packed or preview packages and complete the documented quick start;
- no workspace aliases or unpublished sources are required;
- the release report identifies every limitation and verification environment;
- documentation and generated agent kits match the published artifacts.

### Workstream B — Generalize assurance inputs

Goal: ensure the paid product works for a customer's component library, not only Oddkin.

Tasks:

- Define the minimum standard-CEM experience.
- Define optional Oddkin enrichment for examples, products, recipes, verification, and agent guidance.
- Add a documented adapter API for additional metadata sources.
- Evaluate a thin adapter for existing CEM analyzers rather than replacing them.
- Validate React, Vue, Angular, and plain custom-element inputs only where supported by static evidence.
- Define stable identifiers and migration records across releases.
- Make unresolved graph edges explicit and conservatively widen verification.
- Add fixtures representing at least three independent component-library shapes.

Exit criteria:

- one non-Oddkin custom-element library produces a useful catalog, impact report, and agent context;
- missing enrichment degrades honestly rather than fabricating facts;
- identity changes and renames require authoritative migration evidence.

### Workstream C — Assurance artifact protocol

Goal: make local and hosted execution communicate through stable, portable artifacts.

Add or stabilize versioned schemas for:

- project registration;
- source revision and build provenance;
- comparison snapshot;
- impact report;
- verification plan;
- individual check result;
- visual or accessibility artifact reference;
- approval decision;
- release evidence bundle;
- agent-context release.

Required properties:

- content-addressed hashes;
- explicit tool and schema versions;
- source revision and dirty-state provenance;
- deterministic serialization where applicable;
- no secrets or source contents unless explicitly included;
- exportability without the hosted service;
- clear compatibility and migration rules.

Proposed CLI surface, subject to usability testing:

```text
oddkin assurance capture
oddkin assurance compare --base <snapshot>
oddkin assurance run --report <impact-report>
oddkin assurance publish --report <impact-report> --results <directory>
oddkin assurance agent-context build
```

Do not freeze these commands before observing at least two external pilot workflows.

### Workstream D — Pull-request integration

Goal: deliver the smallest hosted loop that a team will pay to use.

Capabilities:

- GitHub App first; GitLab after validated demand.
- Receive pull-request and check-suite events.
- Build or receive base and head snapshots.
- Render contract and token differences.
- Show affected products, examples, and checks with reason paths.
- Launch selected verification jobs.
- Report pending, passed, failed, reused, not-executed, and unresolved states.
- Publish one concise pull-request summary with a link to the detailed report.
- Require explicit approval for visual-baseline changes.

Exit criteria:

- a pilot repository receives a useful report on every relevant pull request;
- reruns are idempotent;
- unchanged checks can be reused only with recorded evidence;
- a failed or unavailable service never falsely reports a pass.

### Workstream E — Verification workers

Goal: run selected checks reproducibly without turning Oddkin into a general CI platform.

Initial worker types:

- contract and metadata verification;
- token generation and contrast report;
- component examples in supported browsers;
- accessibility automation;
- visual screenshots and comparisons;
- package installation and import checks.

Architecture recommendation:

- Node/TypeScript API service;
- PostgreSQL for organizations, projects, revisions, runs, and approvals;
- object storage for snapshots, screenshots, logs, and evidence bundles;
- queue-backed isolated workers;
- short-lived credentials and least-privilege repository access;
- Workbench-based report UI;
- OpenTelemetry-compatible logs and traces;
- configurable data retention.

Avoid building an arbitrary user-code runner before pilots establish the required isolation model. The first alpha may accept results from customer CI while the hosted service stores and renders them.

### Workstream F — Approved agent context

Goal: make agent context a governed release artifact rather than an unreviewed dump of documentation.

Tasks:

- Build context only from a specific source revision and artifact set.
- Include exact component APIs, examples, tokens, recipes, models, limitations, and verification state.
- Mark stale or unresolved context.
- Require human approval before organization-wide publication.
- Provide downloadable Agent Skills-compatible references, JSON indexes, and optional MCP access.
- Record which context release an agent or generated change used when available.
- Add context-diff review between releases.

Exit criteria:

- an agent can select and use supported components without inventing APIs in a controlled evaluation;
- a changed or removed API produces an obvious context diff;
- unverified guidance is labeled rather than presented as fact.

### Workstream G — Enterprise controls

Build only after paid-pilot demand:

- SAML/OIDC SSO;
- role and project permissions;
- immutable audit log;
- IP allowlists and private networking;
- customer-managed encryption keys;
- regional or self-hosted execution;
- custom retention and deletion;
- security review materials and subprocessors list;
- support SLA and long-term maintenance.

## 5. Milestones

### T0 — Commercialization baseline, 2–3 weeks

- settle public package cut and preview versions;
- repair stale documentation;
- create one end-to-end assurance demonstration;
- produce release evidence from a clean checkout;
- recruit design partners.

### T1 — External local preview, 4–6 weeks

- external repository installation;
- generalized CEM baseline;
- portable snapshot and impact artifacts;
- customer-CI result ingestion prototype;
- two observed onboarding sessions.

### T2 — Hosted pilot, 6–10 weeks

- GitHub App;
- organization/project model;
- persistent reports and artifacts;
- pull-request check integration;
- manual billing and support;
- first paid pilot active.

### T3 — Repeatable paid beta

- three paying customers;
- reusable onboarding process;
- workspace pricing;
- baseline approvals and agent-context releases;
- documented support and incident process;
- evidence that at least one risk or meaningful review cost was avoided.

### T4 — General availability

- security and privacy review;
- service reliability objectives;
- customer-controlled retention;
- stable billing;
- migration policy;
- support coverage;
- at least five referenceable customers or a deliberate private-enterprise strategy.

## 6. Work to defer

Unless a paying customer requires it, defer:

- more standard components;
- the data grid;
- a complete hosted code editor;
- arbitrary application hosting;
- a general-purpose CI replacement;
- every Theme Studio feature;
- AG-UI or A2UI adapters without a concrete integration;
- self-hosting before the service architecture stabilizes;
- performance claims before comparative evidence;
- automatic semantic-version decisions from token-value changes.

## 7. Technical success metrics

- Time from repository installation to first useful impact report.
- Percentage of changed pull requests with a resolved impact graph.
- Selected checks versus full-suite checks.
- False-negative count: target zero.
- False-positive or unresolved selection rate.
- Median verification duration and queue time.
- Reused-check rate with valid provenance.
- Agent unsupported-API rate in controlled tasks.
- Documentation/context freshness at release.
- Pilot incidents caught before merge.
- Support hours per active workspace.

## 8. Immediate next actions

1. Update README status from the generated catalog and release facts.
2. Decide the first public package cut and versioning.
3. Package the existing impact demonstration into a five-minute reproducible demo.
4. Create one independent fixture repository that is not an Oddkin package.
5. Define the smallest artifact-upload API for customer CI.
6. Recruit five interviews before building hosted execution.

## 9. Design-engineering expansion

Oddkin's current contracts are strongest at the component and design-system infrastructure layer. The proposed [product patterns and flow contracts](./PRODUCT_PATTERNS_AND_FLOW_CONTRACTS_IMPLEMENTATION_PLAN.md) plan adds a development-time layer for user goals, applicability, steps, decisions, states, recovery, product implementations, scenarios, and verification.

Treat that work as a separate validated workstream. Do not let it delay the first assurance pilot unless customer discovery shows that component-level impact is insufficient. Begin with authored pattern reviews, then schemas and impact integration; constrained generation comes only after external evidence.

