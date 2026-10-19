# 0021. `defineExamples` format

- **Status:** Accepted
- **Date:** 2026-10-17 (accepted 2026-10-18)
- **Area:** Workbench
- **Detailed contract:** [workbench.md §7](../workbench.md)

## Context
Examples should be authored once and reused by Workbench, docs, tests, Theme Studio, and agents, without story-file boilerplate.

## Decision
Colocated `*.examples.ts` files using `defineExamples(tag, {...})` from the DOM-free `@oddkin/workbench/examples` entry (available from M3): a serializable description layer (props, slots, preview roles, guidance) plus explicit owned fixture hooks. Types come from the analyzed component contract.

## Alternatives considered
- Story files per framework — duplication.
- Separate tiny package — only if the build-order experiment requires it.

## Consequences
Build order: runtime components → analyzer metadata → example typechecks/tests → Workbench shell.

## Evidence
M3: `@oddkin/workbench/examples` implemented (DOM-free; `@oddkin/core` types only). TypeScript rejects unknown property keys, wrong value types, and methods for registered tags (`packages/workbench/test/examples.types.ts`); `checkExamples` gives plain-JavaScript authors the same checks against the analyzer's CEM; `toExamplesJSON` validates against `examples.v1`. Build order holds through project references: core → workbench entries; components never reference workbench (boundary rules). Pending: M4 build-order check with real components.

M4: the four `@oddkin/components` elements have colocated examples (`src/<name>/<name>.examples.ts`). They are **development-only sources**: the package `tsconfig.json` excludes them, so they are never built, exported, or shipped, and `@oddkin/workbench` is only a `devDependency` of `@oddkin/components` (no cycle in runtime dependencies). They are type-checked by the tests program, which imports them; `HTMLElementTagNameMap` types their props. The boundary tool's `devSources` rule (`scripts/architecture/boundaries.config.mjs`) allows them to import `@oddkin/workbench`, reports a shipped module that imports one (`boundary.import.devSource`), and reports an example file in `dist` (`boundary.artifact.devSource`). `mountExample` (`@oddkin/workbench/testing`) runs an example, fixture included, in the project's own browser tests. Evidence: `packages/components/test/examples.test.ts`, `examples.browser.test.ts`, and `tests/architecture/boundaries.test.ts`.

M4: an example may be an explained mistake (`incorrect: { explanation, diagnostic, correct }`). It is never a preset or recommendation, `validateUsage` must report its declared diagnostic from the published CEM, and its metadata entry carries the marker so consumers can leave it out. See [agent-tooling.md §7](../agent-tooling.md#7-executable-examples-as-shared-evidence).

## Revisit when
Tests need examples without any Workbench dependency.