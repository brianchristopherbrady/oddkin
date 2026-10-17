# 0014. Shared collections and keyed invalidation

- **Status:** Proposed
- **Date:** 2026-10-17
- **Area:** Data
- **Detailed contract:** [data-composition.md §3](../data-composition.md)

## Context
Each collection component would otherwise implement its own keyed reconciliation, identity, and state models.

## Decision
`@mote/core/collections` provides key extraction, duplicate/missing-key diagnostics, keyed reconciliation feeding `repeat`, nesting, a child `Scope` per item, and optional selection/expansion/disabled/active models. Keyboard behavior stays in per-pattern controllers. Item output tracks external reactive reads; there is no cache keyed only by item identity.

## Alternatives considered
- Per-component reconciliation — duplicated bugs.
- Identity-only memoization — stale output when external signals change.

## Consequences
Collection overhead is measured against handwritten `repeat` at 10/100/1,000 items.

## Evidence
R24. Pending: M3 invalidation tests and measurements.

## Revisit when
Measured overhead exceeds handwritten `repeat` beyond the §8 review thresholds.