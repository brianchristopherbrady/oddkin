# 0018. Analyzer front end and no-execution rule

- **Status:** Proposed
- **Date:** 2026-10-17
- **Area:** Metadata
- **Detailed contract:** [metadata-and-analyzer.md §2](../metadata-and-analyzer.md)

## Context
Metadata must be extracted without running component code, with types available, for JS and TS libraries.

## Decision
Use the TypeScript compiler API (program + checker) as the front end. Never execute analyzed component modules, constructors, registrations, or arbitrary expressions. Unsupported dynamic definitions get `analyzer.dynamic.*` diagnostics and can supply explicit static metadata. Trusted Node configuration loading is separate and not described as a sandbox.

## Alternatives considered
- Hand-written parser or regex extraction — fragile.
- Runtime introspection — executes code; unsafe and order-dependent.
- Existing CEM analyzer as the primary front end — evaluated later as an optional adapter (plan §5c).

## Consequences
TypeScript is a dependency of the Node-only analyzer package (bundled or declared), never of browser code.

## Evidence
TypeScript compiler API, CEM analyzer (§12.4). Pending: M3 prototype with a test library whose modules throw on import; full vs incremental performance experiment.

## Revisit when
Analysis of a 200-component library is too slow for watch mode.