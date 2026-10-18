# 0023. Page registry as single navigation source

- **Status:** Accepted
- **Date:** 2026-10-17
- **Area:** Workbench
- **Detailed contract:** [workbench-pages.md §2](../workbench-pages.md)

## Context
Navigation, sidebars, overview cards, search, routes, and visibility drift when maintained separately.

## Decision
One build-time page registry (stable page and section ids, routes, sections, visibility, availability, legacy routes) drives every navigation surface. Visibility is computed from data availability and config.

## Alternatives considered
- Hand-maintained route tables and nav config — drift.

## Consequences
DOM-free `@oddkin/workbench/pages` contracts land in M3.

## Evidence
Reference audit: consistent shell across routes. M3: `buildPageRegistry` (`packages/workbench/test/pages.test.ts`) generates schema-valid registries from the analyzer's core-counter output and an independent fixture library; navigation, sidebars, cards, search, and redirects are projections of the same entries; ids stay stable across base-path and route changes; output is deterministic and carries no build-time dates.

## Revisit when
A section needs runtime-only pages not known at build time.