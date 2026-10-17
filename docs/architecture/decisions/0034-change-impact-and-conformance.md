# 0034. Change impact, portable conformance, explanations, and reproductions

- **Status:** Proposed
- **Date:** 2026-10-17
- **Area:** Tooling / Verification
- **Detailed contract:** [change-impact-and-verification.md](../change-impact-and-verification.md)
- **Builds on:** 0016 (metadata model), 0021 (`defineExamples`), 0030 (remount policy), 0031 (dev/prod builds), 0032 (agent kits), 0033 (multi-product foundations)

## Context
Shared foundations and multiple products make two questions central: which products and examples a change affects, and whether a customized implementation still behaves like its foundation. Developers also need to know why a component looks or updates as it does, and to hand a failing case to someone else. Mote already has stable metadata ids, a token graph with provenance, examples, browser runners, and stable error codes. It has no comparison snapshots, portable suites, per-instance runtime records, or reproduction format.

## Decision
- **Comparison snapshots** reference existing artifacts by hash. Items match by stable id; a rename is recognized only from an authoritative identity or migration record. Changes are classified as incompatible, review, or informational, with no automatic semver mapping for token values. Impact traversal keeps edge provenance, widens selection for unknown dependencies, and reports six verification states (`selected`, `passed`, `failed`, `reused`, `not-executed`, `unresolved`). Owner: `@mote/analyzer`.
- **Portable conformance suites** (`conformance.v1`) use public-capability adapters, author-written assertions, invariants bound to declared change kinds, mutants that must be rejected, and legitimate customizations that must be accepted. Evidence is recorded per implementation, configuration, browser, and suite version. Owner: `@mote/workbench/conformance` (DOM-free) and `./testing`.
- **One explanation model** (`explanation.v1`) serves Workbench, CLI, and agents. Styling explanations come from token provenance and observed computed values, with limitations stated. Runtime explanations come from a development-only, opt-in, bounded core inspection entry that never ships in production graphs.
- **Runnable reproductions** (`reproduction.v1`) are distinct from share links. Only declared inputs are captured, and exports are verified in clean directories from packed packages. Owner: Workbench Node command and agent operation.
- **Priority:** conformance and impact prototypes on `mote-button` first; explanation and reproduction follow. No new test runner, browser automation, screenshot engine, or hosted service.

## Alternatives considered
- **File-diff plus bundler-graph selection only** (as in TurboSnap) — misses token, product, and configuration edges that are not module imports. Mote's graph adds those edges and keeps git/module changes as one input.
- **A state-machine DSL for conformance** — a second behavior model to maintain; adapters over public capabilities suffice.
- **Inferring assertions from metadata** — metadata cannot establish correct interaction or accessibility.
- **Always-on runtime tracing** — production cost and unbounded memory.

## Consequences
- Five new schemas: `comparison-snapshot.v1`, `impact-report.v1`, `conformance.v1` and `conformance-result.v1`, `explanation.v1`, and `reproduction.v1`.
- Visual baselines need an explicit accept workflow.
- The development core build gains instrumentation, guarded by size and import-graph checks.

## Evidence
Pending: the M4 conformance prototype (default + `studio-button` + mutants, three engines) and the M5 impact prototype (known-answer fixtures with 1/2/3/10 products). Research R47–R52 and R55 ([synthesis.md](../../research/synthesis.md)) are prior art, not evidence.

## Revisit when
Known-answer fixtures show missed dependencies, legitimate variants fail suites, or instrumentation overhead or size checks fail.
