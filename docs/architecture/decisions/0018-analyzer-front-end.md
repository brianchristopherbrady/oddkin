# 0018. Analyzer front end and no-execution rule

- **Status:** Accepted
- **Date:** 2026-10-17
- **Area:** Metadata
- **Detailed contract:** [metadata-and-analyzer.md §2](../metadata-and-analyzer.md)

## Context
Metadata must be extracted without running component code, with types available, for JS and TS libraries.

## Decision
Use the TypeScript 5.9 compiler API (program + checker, in-process; pinned `typescript@5.9.3` as a dependency of `@oddkin/analyzer` only) as the front end. The TypeScript 7 `unstable/*` IPC API is not used until it is stable. Never execute analyzed component modules, constructors, registrations, or arbitrary expressions. Unsupported dynamic definitions get `analyzer.dynamic.*` diagnostics and can supply explicit static metadata. Trusted Node configuration loading is separate and not described as a sandbox.

## Alternatives considered
- Hand-written parser or regex extraction — fragile.
- Runtime introspection — executes code; unsafe and order-dependent.
- Existing CEM analyzer as the primary front end — evaluated later as an optional adapter (plan §5c).

## Consequences
TypeScript is a dependency of the Node-only analyzer package (bundled or declared), never of browser code.

## Evidence
TypeScript compiler API, CEM analyzer (§12.4). M3 finding (2026-10-17): TypeScript 7.0.2 (native `tsgo`) ships no in-process compiler API; `require('typescript')` exposes only the version. Its `typescript/unstable/sync` API (IPC to `tsgo`) provides `Program`, `Checker`, lazy AST views, `getTypeOfSymbol`, and `typeToString`. A probe on it extracts complete `with()` property metadata in ~0.5 s including startup, and never executes analyzed modules (fixture module throws on import). Risk: the API is explicitly unstable; the analyzer must isolate it behind an internal front-end interface and pin the TypeScript version. Decision evidence (M3, `scripts/experiments/analyzer-performance.mjs`, 50-component synthetic library, Node 24.19, two runs): TypeScript 5.9 full analysis 0.9–1.2 s in-process (1.6–1.7 s in a fresh process including TypeScript load), 0.8 s after a one-file edit reusing the previous program; the TypeScript 7 probe took 0.5–0.6 s in a fresh process but extracts properties only. TypeScript 5.9 is fast enough for one-shot and watch use at this size, in-process, and stable. The packed analyzer installs and runs from its tarball, and its TypeScript dependency stays out of browser packages (`verify-packs`).

## Revisit when
Analysis of a 200-component library is too slow for watch mode (then: per-file extraction caching keyed by source version, or the TypeScript 7 API once stable).