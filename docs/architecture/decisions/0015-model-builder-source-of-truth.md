# 0015. Model builder as source of truth

- **Status:** Proposed
- **Date:** 2026-10-17
- **Area:** Data
- **Detailed contract:** [data-composition.md §5](../data-composition.md)

## Context
Types, runtime validators, JSON Schemas, docs, Workbench editors, and agent inputs must agree. TypeScript types do not validate JSON at runtime.

## Decision
An original DOM-free `m`/`defineModel` builder in `@oddkin/core/model` is the single source; it produces `Infer<T>` types, `validate` with path-precise codes, `migrate`, metadata, and (through `./model/schema`, used by the analyzer) JSON Schema 2020-12 for the portable subset.

## Alternatives considered
- Author JSON Schema and generate types — weaker TS ergonomics.
- Third-party validator — violates zero runtime dependencies.

## Consequences
Production components import only types unless the app validates at runtime; validators live in separate entries.

## Evidence
Pending: M3 builder prototype; bundle-size check of validators vs types-only imports.

## Revisit when
The builder's API or size proves worse than hand-written validators in the M8 review.