# 0017. Standard CEM plus separate Oddkin enrichment

- **Status:** Accepted
- **Date:** 2026-10-17
- **Area:** Metadata
- **Detailed contract:** [metadata-and-analyzer.md §4](../metadata-and-analyzer.md)

## Context
Standard tooling understands Custom Elements Manifest; Oddkin needs more (tokens, recipes, models, foundations, preview roles, pages).

## Decision
Publish standard `custom-elements.json` validated against **`custom-elements-manifest@2.1.0`** and referenced from `package.json` `customElements`, plus a separately versioned `oddkin.metadata.json` that references CEM declarations by module path and name. Oddkin-specific data never goes into CEM beyond standard fields.

## Alternatives considered
- Extend CEM with custom fields — risks breaking standard consumers.

## Consequences
Standard-CEM-only libraries get a defined Workbench baseline.

## Evidence
npm `custom-elements-manifest` latest 2.1.0 (2024-05-06); repository HEAD `d2f79f0` (checked 2026-10-17). Pending: M4 independent CEM consumer fixture.

## Revisit when
A newer CEM schema release adds fields we need, or 2.1.0 is superseded.