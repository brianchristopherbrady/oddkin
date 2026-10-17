# 0016. Normalized metadata model, stable ids, provenance

- **Status:** Accepted
- **Date:** 2026-10-17
- **Area:** Metadata
- **Detailed contract:** [metadata-and-analyzer.md §3](../metadata-and-analyzer.md)

## Context
Docs, Workbench, tests, and agents need one consistent description of components, tokens, recipes, models, foundations, and pages, with honest uncertainty.

## Decision
One versioned `mote-metadata` model with stable ids (`component:<tag>`, `property:<tag>#<name>`, `foundation:<id>`, page ids, …) and per-fact provenance (`extracted`, `authored`, `observed`, `verified`). Unknown values are explicit (`{ known: false }`), never guessed. Foundation enrichment references token inspection output rather than recomputing values.

## Alternatives considered
- Separate ad-hoc JSON per consumer — drift.

## Consequences
Every consumer displays provenance; contract tests can attach `verified` provenance.

## Evidence
Pending: M3 schema draft and analyzer prototype.

## Revisit when
Schema v1 cannot express a needed contract without breaking changes (version bump with migration).