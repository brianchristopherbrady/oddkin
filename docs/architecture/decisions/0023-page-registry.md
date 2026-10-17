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
DOM-free `@mote/workbench/pages` contracts land in M3.

## Evidence
Reference audit: consistent shell across routes. Pending: M3 registry generation tests.

## Revisit when
A section needs runtime-only pages not known at build time.