# 0026. Products and modes sources and discovery

- **Status:** Accepted
- **Date:** 2026-10-17
- **Area:** Workbench
- **Detailed contract:** [workbench-pages.md §9](../workbench-pages.md)

## Context
Multi-product libraries need comparison; single-product libraries must not look incomplete; products may live in other repositories.

## Decision
Disabled and absent by default. When enabled, products come from the local theme config, installed packages, or versioned manifests (local path or URL) fetched and snapshotted at build time. Workspace discovery only suggests products with reasons and excludes tooling, docs, tests, examples, and internal packages. Product identity stays distinct from mode, theme, density, and profiles.

## Alternatives considered
- Treat each workspace package as a product — false products.
- Runtime cross-origin fetches — breaks static hosting and privacy.

## Consequences
A versioned product schema and diagnostics for unavailable sources.

## Evidence
Reference audit (Products and modes page). Pending: M9 cross-repository fixture.

Extended by [0033](./0033-multi-product-foundations.md): any number of products, product identity independent of design language and component family, shared foundations with product-specific implementations, and product-scoped Workbench and agent tooling. The rules above are unchanged.

## Revisit when
Products need runtime switching from live remote sources.