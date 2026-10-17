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
Pending: M3/M4 build-order experiment.

## Revisit when
Tests need examples without any Workbench dependency.