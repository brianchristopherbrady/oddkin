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
TypeScript compiler API, CEM analyzer (§12.4). M3 finding (2026-10-17): TypeScript 7.0.2 (native `tsgo`) ships no in-process compiler API; `require('typescript')` exposes only the version. Its `typescript/unstable/sync` API (IPC to `tsgo`) provides `Program`, `Checker`, lazy AST views, `getTypeOfSymbol`, and `typeToString`. A probe on it extracts complete `with()` property metadata in ~0.5 s including startup, and never executes analyzed modules (fixture module throws on import). Risk: the API is explicitly unstable; the analyzer must isolate it behind an internal front-end interface and pin the TypeScript version. Pending: full vs incremental performance experiment; decide between the unstable API and a pinned TypeScript 5.x compiler API as the front end.

## Revisit when
Analysis of a 200-component library is too slow for watch mode.