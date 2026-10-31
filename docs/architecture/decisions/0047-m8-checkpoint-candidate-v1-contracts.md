# 0047. M8 checkpoint: candidate v1 contracts, assurance and comprehension reviews

- **Status:** Proposed (for the owner, with the v1 cut in IMPLEMENTATION_PLAN.md §11)
- **Date:** 2026-10-27
- **Area:** Process, contracts
- **Detailed contract:** [IMPLEMENTATION_PLAN.md](../../../IMPLEMENTATION_PLAN.md) M8 (closing items), [ADR 0029](./0029-versioning-checkpoints.md), [release-process.md](../../release-process.md)

## Context

ADR 0029 asks M8 to record candidate v1 contracts backed by tests and experiments; M8's closing items add an assurance review, a comprehension review, and the reconciliation of every §2.4–§5f contract with a test, a later owning milestone, or an explicit deferral. Round 9 finished the foundation work those reviews depend on: §3.1–§3.2 (core-contracts.md, `authoring-semantics.browser.test.ts`), the binding-value matrix (D5), the core real-browser tests, release hygiene, and D10. The owner deferred the per-element accessibility sweep, per-element guidance pairs, and a reliable full browser run (2026-10-27); this record does not count them as done.

## Decision

### 1. Candidate v1 contracts

Candidates are the contracts the proposed v1 cut ships (plan §11). Each is backed by the evidence named; after this checkpoint a breaking change needs an ADR, affected-consumer analysis, and a migration plan (ADR 0029). The final freeze is at M12, after release verification.

| Area | Candidate v1 contract | Evidence |
| --- | --- | --- |
| Authoring (`@oddkin/core`) | The 16 sections of `CONTRACTS.md` under stable ids: `core/binding-rule`, `composition`, `properties`, `events`, `lifecycle`, `scope`, `controllers`, `i18n`, `reactivity`, `external-store`, `copies`, `templates`, `rendering` (with the binding-value matrix, node ownership, template lifecycle, ordering, the directive extension contract), `update-complete`, `failure-ownership`, `roles`; the root and subpath entries in `package.json` | `packages/core/test` (277 browser tests in three engines, 131 node tests), `e2e/binding-rule.spec.ts`, size budgets |
| Tokens | `theme-config.v1`; token names (`@oddkin/tokens/refs`), `--odd-*` custom properties, the scope attributes (`data-odd-theme`, `-mode`, `-product`, `-density`, `-profile`, `-motion`), the `odd.*` layer order; the CLI and its outputs (CSS, refs, values, conditions, inspection, the contrast report `version: 1`, DTCG 2025.10 with its listed mappings) | `packages/tokens/test`, `e2e/tokens-css-only.spec.ts`, Terrazzo reader |
| Recipes | `@oddkin/core/layout` (`defineLayoutRecipe`, helpers) and `@oddkin/components/css/layout.css` classes with their override properties | layout-recipes.md, `layout*.test.ts`, Figma parity |
| Collections and models | `@oddkin/core/collections` and `@oddkin/core/model` (validators, JSON Schema emitter); no `props()` (dropped for v1, a66565e) | data-composition.md, `collections*.test.ts`, `model.test.ts` |
| Elements | Each published element's tag, attributes, properties, events (with `intent`), slots, parts, CSS properties, custom states, and `define/*` entry as `custom-elements.json` states them; customization levels 1–3 where declared | contract harness, `customization.test.ts`, framework fixtures |
| Metadata | CEM 2.1.0 plus `oddkin-metadata.v1`, `diagnostic.v1`, `examples.v1` (the `defineExamples` output), `agent-kit.v1` and the packaged kits, the composition schema (D3) | `verify-metadata`, `verify-packs`, schema tests |
| State and app | core-contracts.md §7–§9 | `packages/state/test`, `packages/app/test`, `e2e/router*.spec.ts` |

Not candidates (not frozen at 1.0.0; `@oddkin/analyzer` and `@oddkin/workbench`, whose completion follows v1, were proposed as 0.x, but the owner put all eight packages on `1.0.0-beta.0` on 2026-10-27, so these contracts are listed as unfrozen in their packages instead): `workbench-config.v1`, `page-registry.v1`, `docs-content.v1`, `share-payload.v1`, `theme-studio-composition.v1`, the frame protocol, `product.v1`, `project-context.v1`, and the assurance contracts below. The `defineExamples()` helper lives in Workbench; its output format, `examples.v1`, is the candidate.

### 2. Assurance review

- **Conformance (`conformance.v1`, `conformance-result.v1`).** One suite exists (`oddkin.button`, M4): 11 cases pass for the default, a recomposed, and an alternative-template button in three engines, and six targeted mutants are rejected on their cases; no false positive was observed, but one suite is not a population. Not frozen: it stays an unfrozen Workbench contract until M10's conformance suites per component.
- **Impact (`comparison-snapshot.v1`, `impact-report.v1`).** 46 known-answer cases with hand-written expected selections (no missed and no extra dependency), real snapshots of both component packages (945 items, 0 unresolved), selected checks run in three engines, and git-revision bases (verification.md, 2026-10-19). 9 of 9 mutants killed. Not covered: visual baselines and real product contexts. Not frozen: an unfrozen analyzer contract.
- **Explanations and reproductions (`explanation.v1`, `reproduction.v1`).** Not implemented: M11, after v1.
- **Inspection overhead.** `@oddkin/core/inspect` is not built, so production builds carry no inspector; they carry `scopeStats()` (live counts, both builds) and nothing that records history. Graph inspection belongs to M11's runtime explanations (core-contracts.md §6.2 "Inspection").

### 3. Comprehension review

No novice study has run (plan §8.3: after v1), so this review records where each topic is explained and what evidence exists, not what newcomers understood:

| Topic | Where it is explained | Evidence and gaps |
| --- | --- | --- |
| Render-tracked reads, direct bindings, untracked snapshots | core-contracts.md §1, `@oddkin/core` README, the docs app's concepts page | `e2e/binding-rule.spec.ts` (plain JS and TS tables); no reader evidence |
| Production errors and debug stripping | core-contracts.md §6.1–§6.2, README | `production.test.ts`, failure paths in the production build |
| Duplicate core and versions | core-contracts.md §5.1, release-process.md §1–§2 | `e2e/duplicate-core.spec.ts`, also with the published 1.0.0-beta.0 beside the current packages (2026-10-29) |
| Host, slot, and container boundaries | core-contracts.md §6.1, layout-recipes.md §5, css-architecture.md §5.4 | `container-contract.browser.test.ts`, `authoring-semantics.browser.test.ts` |
| Form limitations | component-contracts.md, element `@limitation`s | `text-entry.browser.test.ts`, form-association tests; screen readers unverified |
| Localization | core-contracts.md §4.2 | `i18n` tests; no translated product |
| Shell accessibility | workbench.md §5d.1 items, the docs app | Workbench's own accessibility is a v1 item (Agent 2); not reviewed here |
| Actual import graphs | packed consumers, `check-size.mjs` | `e2e/packed-consumers.spec.ts`, `components-only.spec.ts` |

API changes this checkpoint made from evidence: unsupported template values are reported instead of written as text (D5); the autoloader reports a failed import and retries; no API was simplified, because no novice evidence shows avoidable ceremony.

### 4. Reconciliation of §2.4–§5f

Every open or partial contract in plan §2.4–§5f has an owner:

| Plan item | Status |
| --- | --- |
| §2.5 browser/AT baseline | Browser part done; assistive-technology pairs and Safari runtime evidence deferred by the owner (hardware), recorded as limitations |
| §2.5 independent consumers and duplicates | Done for copies at one version; different released versions: M12, after a release |
| §2.5 version ranges | Set: caret ranges of `1.0.0-beta.0` (release-process.md §1, §5); share payloads and the frame protocol: unfrozen Workbench contracts (M11) |
| §3.2 bounded inspection | Lifetime and store inspection done; graph inspection: M11 |
| §5.1 adopted sheet ownership | Constructed sheets are per document (`element.browser.test.ts`, `foundation.browser.test.ts` adoption), preview-owned sheets never replace shared ones (`preview.browser.test.ts`); a written rule for sheets a consumer supplies: M9 (Theme Studio) |
| §5.1 DTCG Resolver | M9 |
| §5.1 colour contracts | Done for the base theme and products (contrast report); colour roles overridden by profiles: M9 |
| §5a page-author recipes | Classes and override properties shipped (`layout.css`, M10); handwritten comparison exists (`examples/side-nav/hand.css`); authoring-time comparison: §8.3, after v1 |
| §5c analyzer (5 items) | After v1 (unfrozen analyzer contracts), except that browser-safe declarations are checked at M12 (`verify-packs` type-checks every declaration with `skipLibCheck: false`) |
| §5d.1 Workbench correctness (6 items) | Handshake validation, lazy loading, and Workbench's own accessibility: v1 (Agent 2, round 9); the rest M11 |
| §5d.2 Workbench pages (9 items) | M11, after v1, except what the docs app embeds |
| §5f docs (8 items) | Starting points, static readable pages, and loading and failure presentation: the docs app's v1 core (Agent 2); case studies, `oddkin doctor`, agent assets: after v1; localization contracts: core-contracts.md §4.2 now, product guidance M11; scope review: this checkpoint, and every milestone |

## Consequences

- Architecture documents call the contracts in §1 candidate v1; M9–M11 may add to them compatibly.
- The owner settles the v1 cut and versions (plan §11, release-process.md); this record follows that decision.
- The deferred items (accessibility sweep, guidance pairs, a reliable full browser run) stay open and are recommended as gates before the M12 freeze.

## Evidence

verification.md entries of 2026-10-27 (D5, §3.1–§3.2 reconciliation, core real-browser tests, release readiness, the contrast report, D10) and the M3–M5 entries cited above.

## Revisit when

The owner settles the v1 cut differently, a novice or agent evaluation shows avoidable ceremony in a candidate, or M12's release verification fails a candidate.
