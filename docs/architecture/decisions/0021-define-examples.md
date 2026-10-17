# 0021. `defineExamples` format

- **Status:** Proposed
- **Date:** 2026-10-17
- **Area:** Workbench
- **Detailed contract:** [workbench.md §7](../workbench.md)

## Context
Examples should be authored once and reused by Workbench, docs, tests, Theme Studio, and agents, without story-file boilerplate.

## Decision
Colocated `*.examples.ts` files using `defineExamples(tag, {...})` from the DOM-free `@mote/workbench/examples` entry (available from M3): a serializable description layer (props, slots, preview roles, guidance) plus explicit owned fixture hooks. Types come from the analyzed component contract.

## Alternatives considered
- Story files per framework — duplication.
- Separate tiny package — only if the build-order experiment requires it.

## Consequences
Build order: runtime components → analyzer metadata → example typechecks/tests → Workbench shell.

## Evidence
M3: `@mote/workbench/examples` implemented (DOM-free; `@mote/core` types only). TypeScript rejects unknown property keys, wrong value types, and methods for registered tags (`packages/workbench/test/examples.types.ts`); `checkExamples` gives plain-JavaScript authors the same checks against the analyzer's CEM; `toExamplesJSON` validates against `examples.v1`. Build order holds through project references: core → workbench entries; components never reference workbench (boundary rules). Pending: M4 build-order check with real components.

## Revisit when
Tests need examples without any Workbench dependency.