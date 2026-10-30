# Technical commercialization plan

Status: proposed. Rewritten on 2026-10-29 from the owner's commercialization documents (the originals are in commit `cdad50c`) and checked against the repository (`main` at `0d08543`).

This plan holds the technical work of the commercialization path. The owner keeps the business planning (business model, pricing, go-to-market, customer discovery, and sales) outside the repository. Where that planning sets a technical requirement, §7 states it.

[IMPLEMENTATION_PLAN.md](../IMPLEMENTATION_PLAN.md) remains the single source of truth for scope and order. Only what the owner places in that plan's priority tiers is scheduled. On 2026-10-29 the owner placed tier CF there, after P0 (§2, §11).

| Document | Contents |
| --- | --- |
| This plan | Objective, principles, current foundation, local and hosted boundary, workstreams A–G, milestones, requirements from the business planning, deferrals, metrics, owner decisions, next actions |
| [COMMERCIAL_READINESS_SCORECARD.md](./COMMERCIAL_READINESS_SCORECARD.md) | The technical lines of readiness gates A–D, with their status |
| [PRODUCT_PATTERNS_AND_FLOW_CONTRACTS_IMPLEMENTATION_PLAN.md](./PRODUCT_PATTERNS_AND_FLOW_CONTRACTS_IMPLEMENTATION_PLAN.md) | The proposed product pattern and flow contract layer |
| [implementation/RELEASE_FOUNDATION_IMPLEMENTATION_PLAN.md](./implementation/RELEASE_FOUNDATION_IMPLEMENTATION_PLAN.md) | Workstream A, Milestone T0's release items, and Gate A, as tasks RF-01 to RF-19 with owner decisions D-1 to D-11 |

Classes, as in the release plan: **Verified** (implemented and currently verified), **Verify** (implemented, verification remaining), **Partial**, **Prototype** (implemented as a prototype, as its architecture document says), **Planned** (not started), **Owner** (blocked by an owner decision), **Unknown** (requires investigation).

## 1. Objective and principles

An external design-system team can install the published packages, run them on its own component library, and get answers it can trust, without adopting the whole Oddkin application stack. For every proposed UI-system change, the tooling answers:

1. What changed?
2. Is the change incompatible, review-worthy, or informational?
3. Which components, products, examples, recipes, tokens, and tests are affected, and why?
4. Which checks ran, and what evidence did they produce?
5. What approved context should humans and coding agents use afterward?

This plan calls the capability "assurance". "Oddkin Assurance" is a placeholder name (O-6).

Principles:

- Local evaluation works without an account or a hosted service.
- No performance, accessibility, compatibility, or savings claim goes beyond recorded evidence.
- Missing evidence is never reported as a pass.
- Contracts and artifacts stay portable: a team can export its metadata, reports, and verification evidence.
- Hosted features are built only after the same need appears repeatedly in the owner's discovery evidence.
- The component catalog does not grow during the first commercialization window unless a pilot requires it (owner decision O-4, 2026-10-29; §8).

## 2. Place in the current priority plan

IMPLEMENTATION_PLAN.md (round 10, from 2026-10-28; reordered by the owner on 2026-10-29) orders the work:

- P0: people can install Oddkin and build with it;
- CF: the commercialization foundations (CF.1 release trust basics, CF.2 the change-impact demonstration, CF.3 libraries not built with Oddkin);
- P1: finish the foundations, starting with the items tier CF needs;
- P2: new capability (products; the SVG icons and Workbench completion are parked, and the agent package stays skipped);
- P3: the v1 freeze; then parked items.

The workstreams in §5 relate to it as follows.

| Workstream | In the priority plan | Not in it yet |
| --- | --- | --- |
| A. Release foundation | P0.1, P0.2, P0.5, P0.6, and P0.8 (Agent 1); CF.1: RF-01 to RF-04 and RF-09, with RF-10 (evidence in CI) done beside RF-09 | The other release-plan tasks: the external fixture repository, trusted publishing, the security policy |
| B. Generalize assurance inputs | P0.3's standard-CEM fixture library (Agent 2); CF.3; P1.6, analyzer and metadata | Framework inputs (task 5); identities across releases (task 6) |
| C. Assurance artifact protocol | The impact prototype (M5), which CF.2 uses | Provenance, verification plan, approval, evidence, and context-release formats |
| D. Pull-request integration | CF.2: the impact report in CI (step 1) | The hosted GitHub App (step 2) |
| E. Verification workers | P1.7: conformance suites and visual baselines, run locally | Hosted workers |
| F. Approved agent context | P0.4's kit checks and P0.5 step 5's kit command (Agent 2). P2.2, `@oddkin/agent` and MCP, stays skipped (O-5) | Context approval and context diff |
| G. Enterprise controls | — | All |
| Product patterns | — | All |

## 3. Current foundation (checked 2026-10-29)

| Capability | Class | Evidence |
| --- | --- | --- |
| Published packages | Verified | All eight `@oddkin/*` packages are public on npm at `1.0.0-beta.0` (dist-tags `beta` and `latest`) since 2026-10-28. Notes for `1.0.0-beta.1` are drafted in [docs/releases/1.0.0-beta.1.md](../docs/releases/1.0.0-beta.1.md) |
| Static analysis: `@oddkin/analyzer`, `oddkin-analyze` | Verified | Uses the TypeScript compiler API and never imports or executes the analyzed modules ([packages/analyzer/README.md](../packages/analyzer/README.md)). Writes a standard Custom Elements Manifest (schema 2.1.0) and `oddkin.metadata.json`, whose sections are components, categories, recipes, models, templates, styles, contracts, foundations, stylesheets, examples, docs, and diagnostics. It recognizes Oddkin-authored components only: `OddkinElement` subclasses and `compose()` definitions ([metadata-and-analyzer.md](../docs/architecture/metadata-and-analyzer.md) §2) |
| Change impact: `@oddkin/analyzer/impact`, `oddkin-impact` | Prototype | [change-impact-and-verification.md](../docs/architecture/change-impact-and-verification.md) §1 and §2.7. `snapshot` hashes each package's artifacts and named sources (it never stores them) and records tool versions. `compare` classifies changes as `incompatible`, `review`, or `informational`, follows dependency edges with reason paths, selects examples and suites per product, and widens the selection on unresolved edges. It reuses a baseline result only when that result passed. It merges CI results (`--results`) into six states: `selected`, `passed`, `failed`, `reused`, `not-executed`, and `unresolved`. It writes JSON and Markdown. Renames need authoritative migration records (`--migrations`). Not run in CI. No visual baselines |
| Impact demonstration | Prototype | In this repository only: `node scripts/impact.mjs compare --base-ref <ref> --run` builds the base revision in a temporary worktree, snapshots both revisions, runs the selected checks in Chromium, Firefox, and WebKit (`tests/impact/selected.browser.test.ts`), and merges the results. There is no packaged demonstration |
| Tokens: `@oddkin/tokens`, `oddkin-tokens` | Verified | The generator uses no Node APIs, and Node, a browser, and a module Worker produce byte-identical output (`packages/tokens/test/generate.browser.test.ts`). Structured diagnostics with JSON-pointer paths, inspection and contrast JSON, and DTCG output (format 2025.10, extension `dev.oddkin`, with lossless, lossy, and unsupported mappings). A check of the DTCG output by an independent reader is open (P1.1) |
| Workbench: `@oddkin/workbench`, `oddkin` | Partial | Configuration (`defineWorkbenchConfig`), the page registry, examples (`defineExamples`; the serializable `examples.v1` layer keeps fixtures as `hasFixture`), site data, a dev server with watch mode, import maps from package `exports`, testing helpers (`mountExample`, `runConformance`), Theme Studio, share links (version 1), the frame protocol (version 1), and optional Products pages. It reads standard CEM for libraries without Oddkin enrichment (`library.cem`, or the package's `customElements` field). Its contracts are not frozen at 1.0.0 ([ADR 0047](../docs/architecture/decisions/0047-m8-checkpoint-candidate-v1-contracts.md)). The consumer path, live previews, and Theme Studio's baseline flow are P0.3 (Agent 2, in progress) |
| Agent kits | Partial | Generated by the pilot scripts in `scripts/agent-kit/` and shipped in `@oddkin/components` and `@oddkin/ai` only: `GUIDE.md`, `kit.json` (a fingerprint of the generator version, the package versions, the input hashes, and the metadata's sha-256), `llms.txt`, and references for components, tokens, recipes, stylesheets, and models. `--check` reports a stale kit. There is no consumer command (P0.5 step 5), context diff, approval step, MCP server, or agent evaluation harness ([agent-tooling.md](../docs/architecture/agent-tooling.md) is a proposal) |
| Portable conformance | Prototype | `conformance.v1`, `conformance-result.v1`, `@oddkin/workbench/conformance`, `./conformance/button`, and `runConformance` (change-impact-and-verification.md §1). Suites for the rest of the catalog are P1.7 |
| Verification infrastructure | Verify | `.github/workflows/ci.yml` runs the build, lint, typecheck, the node project, the browser project in each engine serially, e2e, size budgets, packs, and metadata. The e2e step covers packed consumers (plain HTML, Vite, React, Vue, Svelte, and Angular), the golden path, two versions of core on one page, and axe checks in several specs. At `6486921` every step passed except one Workbench browser test (`coverage.browser.test.ts`, Agent 2). `registry-smoke.yml` installs the published packages weekly; its first scheduled run is pending |
| Schemas | Verified | 16 schemas in `docs/schemas` under `https://oddkin.dev/schemas/<name>/v1.json`, including `comparison-snapshot`, `impact-report`, `conformance`, `conformance-result`, `diagnostic`, `examples`, `product`, `project-context`, and `agent-kit`. `@oddkin/ai` and `@oddkin/components` ship their record and navigation schemas |
| Docs site and Figma | Partial | The docs site is deployed to www.oddkin.dev by `docs.yml`. Code Connect mappings exist as repository artifacts (`artifacts/code-connect/`); publishing them to Figma was refused because it needs an Organization or Enterprise plan |

Known gaps:

- Fully parallel browser runs are not reliable; serial per-engine runs are the evidence ([release-process.md](../docs/release-process.md) §3).
- Screen-reader and Safari-on-hardware evidence is parked until hardware is available (P3), and the owner's own accessibility review is pending (P1.4).
- Several package READMEs state old statuses (release plan §7).
- There is no support process, security policy (`SECURITY.md`), or trusted publishing (RF-12, RF-13).
- There is no fixture library that is not built with Oddkin, and the analyzer reads Oddkin-authored components only.
- Impact reports record tool versions, not the source revision or whether the working tree was dirty.
- There is no hosted service of any kind: no identity, tenancy, persistence, billing, or service security controls.
- Nothing measures product usage. `@oddkin/ai` leaves telemetry to the host by design.

## 4. Local and hosted boundary

Local and open, working without an account:

- analysis and CEM generation (Verified);
- snapshots and impact comparison (Prototype);
- Workbench and component examples (Partial; P0.3);
- agent-kit generation (repository scripts; the consumer command is P0.5 step 5);
- verification runs (this repository's runners; generalizing them is Workstreams B and E);
- reports in JSON and Markdown (Prototype);
- public schemas and documented artifact formats (Verified for the current artifacts).

Hosted, proposed, none of it built:

- pull-request status and review UI;
- persistent snapshots and approved baselines;
- hosted reports and preview links;
- verification workers and result retention;
- team approvals and release evidence;
- private, versioned agent-context releases;
- multi-repository and multi-product dependency views;
- Figma and code drift reporting;
- role-based access, audit logs, SSO, private networking, and retention policies;
- long-term supported releases.

Rules:

- No hosted account is needed to compile or run a customer's application.
- Everything a hosted service stores can be exported in the documented formats.
- Which capabilities are proprietary, and where their code lives, is an owner decision (O-2).

## 5. Workstreams

### A. Release foundation

Goal: the published packages are safe and honest to evaluate outside this repository. The detailed plan is [implementation/RELEASE_FOUNDATION_IMPLEMENTATION_PLAN.md](./implementation/RELEASE_FOUNDATION_IMPLEMENTATION_PLAN.md).

Done:

- preview versions: all eight at `1.0.0-beta.0`;
- export, declaration, files, side-effect, and `customElements` checks from tarballs (`npm run verify:packs`);
- the packed-consumer matrix and the golden path;
- tag-collision and duplicate-version behavior (release-process.md §1, core-contracts.md §5.1, `e2e/duplicate-core.spec.ts`);
- version, compatibility, and deprecation policies (release-process.md);
- metadata and kit checks, size budgets, and the compatibility matrix.

Remaining:

- support tiers and messaging (D-1). `@oddkin/state` and `@oddkin/app` stay published but are not featured until an independent adoption path is documented;
- Workbench's version line (D-2). The original plan's `0.x` would sort below the published beta;
- README and status accuracy (RF-01 to RF-03);
- release notes at each cut (RF-08);
- the browser and Node support policy (RF-04, RF-05);
- the release evidence bundle (RF-09, RF-10);
- an external fixture repository (RF-11);
- trusted publishing (RF-12) and a security policy (RF-13).

Exit criteria:

- an unrelated repository installs the published packages and completes the documented quick start (RF-11);
- no workspace aliases or unpublished sources are needed (the packed consumers check this today);
- the release evidence lists every limitation and verification environment (RF-09, RF-10);
- documentation and agent kits match the published artifacts (RF-14).

### B. Generalize assurance inputs

Goal: the tooling works on a team's own component library, not only on Oddkin's.

Today:

- Workbench documents a library from standard CEM alone (Partial: P0.3 adds a standard-CEM fixture library and runs the consumer path against it).
- The analyzer recognizes Oddkin-authored components only, and there is no adapter API.
- Whether `oddkin-impact snapshot` works on a package with a CEM but no `oddkin.metadata.json` is Unknown.
- Migration records and authoritative renames exist in the impact prototype (`--migrations`).
- Unresolved edges are explicit and widen the selection (Prototype).
- There is no fixture library that is not built with Oddkin.

Tasks:

1. Define the minimum standard-CEM experience for Workbench, impact, and kits: what works from a CEM alone, and what each part of the Oddkin enrichment adds.
2. Document the optional enrichment (examples, products, recipes, verification, agent guidance) as a layer another library can add.
3. Design an adapter API for other metadata sources, as an ADR.
4. Evaluate a thin adapter over existing CEM analyzers rather than replacing them.
5. Accept React, Vue, Angular, or plain custom-element inputs only where static evidence supports them.
6. Carry stable identities and migration records from impact into kits and reports across releases.
7. Add fixtures for at least three independent library shapes, for example plain custom elements, a library built with another authoring library, and a CEM-only package.

Exit criteria:

- a library not built with Oddkin produces a useful catalog, impact report, and agent context;
- missing enrichment degrades honestly, without invented facts;
- identity changes and renames require authoritative migration evidence (already the rule in impact).

### C. Assurance artifact protocol

Goal: local runs, CI, and a future hosted service exchange stable, portable artifacts.

Existing formats: `comparison-snapshot.v1`, `impact-report.v1` (with check states and merged results), `conformance.v1`, `conformance-result.v1`, `diagnostic.v1`, `examples.v1`, `product.v1`, `project-context.v1`, and `agent-kit.v1`.

Missing formats:

- project registration;
- source revision and build provenance;
- a verification plan as its own artifact;
- a standalone check-result format (results enter as `CheckResult` records through `mergeResults`);
- references to visual and accessibility artifacts;
- an approval decision;
- the release evidence bundle as a published format (RF-09 and RF-10 write an internal `release-evidence.v0`, locally and in each CI run);
- an agent-context release.

Required properties:

| Property | Today |
| --- | --- |
| Content hashes | Snapshots hash artifacts and sources; kits fingerprint their inputs |
| Explicit tool and schema versions | Snapshots record the analyzer, generator, core, and schema versions; `--tool` adds others |
| Source revision and dirty-state provenance | Missing |
| Deterministic serialization | Identical builds give identical snapshots (change-impact-and-verification.md §2.7); not specified for every artifact |
| No secrets or source contents by default | Snapshots store hashes, not sources; nothing scans for secrets |
| Exportable without the hosted service | Every artifact is a local file today |
| Compatibility and migration rules | Schemas carry a version (`v1`); no written policy for artifact compatibility |

Proposed commands. They are not frozen until two external pilot workflows have been observed.

| Proposed | Today |
| --- | --- |
| `oddkin assurance capture` | `oddkin-impact snapshot` |
| `oddkin assurance compare --base <snapshot>` | `oddkin-impact compare <base> <head>` |
| `oddkin assurance run --report <impact-report>` | In this repository only: `node scripts/impact.mjs compare --base-ref <ref> --run` |
| `oddkin assurance publish --report <impact-report> --results <directory>` | None; `compare --results` merges results locally |
| `oddkin assurance agent-context build` | In this repository only: `node scripts/agent-kit/kit.mjs` |

The `oddkin` binary belongs to `@oddkin/workbench` today (`oddkin workbench dev` and `build`). Which package would own an `assurance` command is open, and so is its name (O-6).

### D. Pull-request integration

Goal: the smallest loop a team would rely on in review.

Today: nothing. This repository's CI does not run impact, and there is no GitHub App, webhook, server, or database.

Steps:

1. **Customer CI first, with no hosted service.** Document a workflow that snapshots the base and head revisions, runs `oddkin-impact compare --markdown`, merges the team's check results, and publishes the report as a job summary and an artifact. Prove it in this repository's CI.
2. **Then a hosted GitHub App** (O-7):
   - receive pull-request and check-suite events;
   - build or receive snapshots;
   - render contract and token differences;
   - show affected products, examples, and checks with reason paths;
   - launch the selected checks;
   - report the six states;
   - post one concise summary that links to the full report;
   - require explicit approval for visual-baseline changes.

   GitLab follows only after demand is shown.

Exit criteria:

- a pilot repository gets a useful report on every relevant pull request;
- reruns are idempotent;
- unchanged checks are reused only with recorded evidence (already the rule in impact);
- a failed or unavailable service never reports a pass.

### E. Verification workers

Goal: run the selected checks reproducibly without becoming a general CI platform.

Today: local runners exist. They cover Vitest in three browsers, Playwright, `runConformance`, packed-consumer installs, token generation with a contrast report, and metadata verification. Visual baselines are not implemented (P1.7). change-impact-and-verification.md §2.6 defines them: files keyed by example, configuration hash, browser, and browser version, updated only by an explicit accept command. No hosted workers exist.

Initial worker types:

- contract and metadata verification;
- token generation and contrast;
- component examples in supported browsers;
- accessibility automation;
- visual screenshots and comparison;
- package installation and import checks.

Recommended architecture (not built):

- a Node and TypeScript API service;
- PostgreSQL for organizations, projects, revisions, runs, and approvals;
- object storage for snapshots, screenshots, logs, and evidence;
- isolated workers behind a queue, with short-lived credentials and least-privilege repository access;
- a report UI built on Workbench;
- logs and traces compatible with OpenTelemetry;
- configurable retention;
- limits on browser execution until real usage is known.

Do not build a runner for arbitrary user code before pilots establish the isolation model. The first alpha accepts results from customer CI (`mergeResults` already does this locally).

### F. Approved agent context

Goal: agent context is a governed release artifact, not an unreviewed dump of documentation.

Today:

- Kits are generated from one package version's metadata, with a fingerprint and a staleness check.
- A component reference covers import and registration, properties, methods, events, slots, parts, CSS custom properties, custom states, authored guidance, examples, and customization.
- Kits carry no verification state and no source revision.
- There is no approval step, context diff, or consumer command (P0.5 step 5).
- There is no MCP access: the owner skipped `@oddkin/agent` and its MCP adapter (P2.2), and confirmed it on 2026-10-29 (O-5).
- P0.4 has a real coding agent build a page from a kit (Agent 2).

Tasks:

1. Build context from a recorded source revision and artifact set; the fingerprint has versions and input hashes, but no revision yet.
2. Include APIs, examples, tokens, recipes, and models (all included today), plus limitations and verification state (missing).
3. Mark stale or unresolved context per entry, not only per kit.
4. Require human approval before organization-wide publication.
5. Offer downloadable references and JSON indexes. The generator can write `json/` bundles; the shipped kits omit them. MCP stays paused (O-5): revisit it once the consumer kit command (P0.5 step 5) and the context diff (task 7) exist, as a thin read-only adapter over the kit files.
6. Record which context release an agent or a generated change used.
7. Review context diffs between releases.

Exit criteria:

- in a controlled evaluation, an agent selects and uses supported components without inventing APIs. This needs an evaluation harness; P0.4 is the first manual check;
- a changed or removed API produces an obvious context diff;
- unverified guidance is labeled rather than presented as fact.

### G. Enterprise controls

Built only after pilot demand is recorded:

- SAML or OIDC SSO;
- role and project permissions;
- an immutable audit log;
- IP allowlists and private networking;
- customer-managed encryption keys;
- regional or self-hosted execution;
- custom retention and deletion;
- security review materials and a list of subprocessors;
- long-term maintenance releases.

None of it exists.

## 6. Milestones (technical items)

| Milestone | Technical items | Today |
| --- | --- | --- |
| T0, baseline | Package tiers and versions (versions done; tiers are D-1); repair stale documentation (RF-01 to RF-03; CF.1); one end-to-end assurance demonstration from a clean checkout (§7; CF.2); release evidence from a clean checkout (RF-09 in CF.1; RF-10) | Partial |
| T1, external local preview | Installation in an external repository (RF-11); the standard-CEM baseline (B; CF.3); portable snapshots and reports with provenance (C); a prototype that ingests customer-CI results (D, step 1; CF.2); two observed onboarding sessions (RF-18) | Planned, except Workbench's CEM input |
| T2, hosted pilot | GitHub App; an organization and project model; persistent reports and artifacts; pull-request checks | Planned |
| T3, repeatable beta | Onboarding that needs no help from the repository author; baseline approvals; agent-context releases; a support and incident process for the service | Planned |
| T4, general availability | Security and privacy review; service reliability objectives; customer-controlled retention; billing, cancellation, and export paths; an artifact migration policy | Planned |

The original milestones also hold business items (design partners, pilots, customers, pricing), which the owner tracks outside the repository. Their durations (T0 two to three weeks, T1 four to six, T2 six to ten) predate this audit.

## 7. Technical requirements from the business planning

The owner's go-to-market and pilot planning (outside the repository) needs these technical deliverables. The state of each on 2026-10-29 is in brackets.

**The first demonstration** uses a real change and shows:

1. exact contract and token differences [impact: yes];
2. the affected components, products, examples, and checks [yes];
3. the reason path for each selected check [yes];
4. browser, accessibility, visual, and package evidence [browser results through `--run`, in this repository only; accessibility and visual evidence are not in reports; package checks run separately in `verify:packs`];
5. the resulting reviewed agent-context change [no context diff].

**Launch material that needs engineering:**

- a recorded five-minute demonstration of the change above [Planned];
- a public sample impact report [Planned; `--markdown` output exists];
- a sample release evidence bundle [RF-09, RF-10];
- a before-and-after agent task that shows fewer unsupported API uses [needs an evaluation harness; Planned];
- a security and data-flow overview, and an architecture page on local versus hosted data [Planned; RF-17 for the docs site];
- a limitations page [RF-04, RF-08];
- an installation guide that takes under 15 minutes in observation [RF-18].

**Historical-change assessment.** Before a pilot, the tools run on a team's base and changed revisions. They report what resolved, what stayed unknown, the selected checks with reason paths, and how this differs from the team's own process. [`scripts/impact.mjs --base-ref` does this inside this repository only; another repository depends on B.] False positives and possible false negatives are recorded by hand. A historical analysis is never presented as proof of future prevention.

**Pilot deliverables:**

- a baseline contract snapshot;
- an impact graph and report;
- a mapping from the team's existing verification commands to checks;
- CI integration, customer CI first;
- generated agent context;
- an export of every artifact at the end;
- a statement of what data leaves the team's environment;
- unresolved and unverified results labeled as such.

**Data handling.** Local analysis and customer-CI execution come first. Only agreed metadata, hashes, reports, and selected artifacts leave the team's environment. Source code is not uploaded by default; snapshots already store hashes, not sources. Private workers and on-premises deployment wait for validated enterprise demand (G).

**Interoperability.** The tools ingest or complement a team's existing examples and visual tests, for example Storybook stories or Chromatic results [nothing in the repository reads them today]. Teams outside Web Components go through the standard-CEM and adapter path (B). If the tools cannot model a team's components honestly, that setup is not supported.

**Measurement:**

- time to the first snapshot and to the first useful report;
- the share of relevant graph edges resolved (pilot target: 80%);
- known false negatives (target: zero);
- the selected checks against the full suite;
- reused checks with valid provenance;
- unsupported API uses by agents in controlled tasks.

Nothing measures usage today. When measurement is built, it is opt-in and collects no source code (Gate B).

## 8. Work to defer

The original plan deferred the items below unless a paying pilot needs them. Each is checked against the priority plan.

| Deferred item | Priority plan today | Conflict |
| --- | --- | --- |
| More standard components | P1.2's remaining Figma families and collections | Resolved (O-4, 2026-10-29): parked; P1.2 keeps its quality items |
| The data grid | Parked (P3) | No |
| A complete hosted code editor | Not planned | No |
| Arbitrary application hosting | Not planned | No |
| A general-purpose CI replacement | Not planned | No |
| Every Theme Studio feature | P1.5 | Resolved (O-4): P1.5 polishes the baseline flow; the rest is parked |
| AG-UI or A2UI adapters without a concrete integration | [docs/AI_COMPONENTS_IMPLEMENTATION_PLAN.md](../docs/AI_COMPONENTS_IMPLEMENTATION_PLAN.md) asks only for evaluation notes | No |
| Self-hosting before the service architecture settles | Not planned | No |
| Performance claims before comparative evidence | Comparative benchmarks are parked (P3); no performance claim is made | No |
| Automatic semantic-version decisions from token value changes | The impact prototype never maps a token value change to a version increment | No |

The SVG icon packages (P2.1) and Workbench completion (P2.3) were not in the original list. The owner parked both on 2026-10-29 (O-4).

## 9. Technical success metrics

- Time from installation to the first useful impact report.
- The share of changed pull requests with a resolved impact graph.
- Selected checks against the full suite.
- False negatives: target zero.
- The false-positive and unresolved selection rate.
- Median verification duration and queue time.
- Reused checks with valid provenance.
- The unsupported-API rate of agents in controlled tasks.
- Documentation and context freshness at release.
- Issues caught before merge in pilots.
- Support hours per active workspace.

None of these is measured automatically today. The impact report's JSON already holds the counts the selection metrics need.

## 10. Owner decisions

| Id | Decision | Blocks |
| --- | --- | --- |
| O-1 | The runtime stays MIT | Gate A's license line (release plan D-9) |
| O-2 | Which new capabilities are proprietary, and where their code lives: this public repository or a private one | D, E, G, and any closed part of C or F |
| O-3 | Package tiers and Workbench's version line | Workstream A (release plan D-1, D-2) |
| O-4 | Order against the priority plan. **Decided 2026-10-29:** tier CF follows P0. P1.2's new component families and collections, Theme Studio beyond its baseline flow (P1.5), the SVG icons (P2.1), and Workbench completion (P2.3) are parked | §8 |
| O-5 | Whether to reopen P2.2 (`@oddkin/agent` and MCP) for Workstream F. **Decided 2026-10-29:** it stays paused. Revisit it once the consumer kit command and a context diff exist, as a thin read-only adapter over the kit files | F task 5; the pattern retrieval operations |
| O-6 | The product name ("Oddkin Assurance" is a placeholder) | Command and package names in C |
| O-7 | When hosted work starts (D step 2, E, G), based on the owner's discovery evidence | T2 onward |
| O-8 | The product-patterns decisions (that plan's §24) | That plan |

## 11. Next technical actions

The owner set this order on 2026-10-29 (O-4), and IMPLEMENTATION_PLAN.md holds it.

1. Close P0: a green CI, P0.3, P0.4, and P0.5 step 5. Then cut `1.0.0-beta.1` (P0.8).
2. CF.1, the release trust basics: RF-01 to RF-04 and RF-09.
3. CF.2, the change-impact demonstration:
   - a scripted, reproducible change between two commits;
   - its report produced in CI and published as a job summary and an artifact. This is D's step 1, and it defines the smallest artifact set a CI uploads (C);
   - a docs page that presents the sample report.
4. CF.3, libraries not built with Oddkin (B).
5. The P1 items tier CF needs: P1.6 (analyzer), P1.7 (conformance and visual baselines), and P1.1 (theming).

Not placed yet: the external fixture repository (RF-11, D-6) and the other release tasks; product patterns Phase 0 (O-8).

## 12. Product patterns

The [product patterns and flow contracts plan](./PRODUCT_PATTERNS_AND_FLOW_CONTRACTS_IMPLEMENTATION_PLAN.md) adds a development-time layer for user goals, applicability, steps, decisions, states, recovery, product implementations, scenarios, and verification. It is a separate workstream. It should not delay the first assurance pilot unless discovery shows that component-level impact is not enough. It starts with reviewed Markdown patterns, then schemas and impact integration; constrained generation comes only after external evidence.
