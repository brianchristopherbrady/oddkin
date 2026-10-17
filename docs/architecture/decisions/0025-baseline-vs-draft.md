# 0025. Baseline vs draft on foundation pages

- **Status:** Accepted
- **Date:** 2026-10-17
- **Area:** Workbench
- **Detailed contract:** [workbench-pages.md §5.1](../workbench-pages.md)

## Context
Theme Studio drafts and saved themes could be confused on foundation pages.

## Decision
Foundation pages show the saved/generated baseline by default. A draft appears only through an explicit "View draft" toggle, with a persistent banner and draft labels on every value. Baseline and draft values are never mixed on one page.

## Alternatives considered
- Always show the current draft — misleading documentation.

## Consequences
Every value-bearing section carries a context label.

## Evidence
Pending: M5 tests.

## Revisit when
Users need side-by-side comparison on foundation pages (route to Theme Studio comparison instead).