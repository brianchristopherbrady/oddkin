# 0012. Token categories, conditions, and profiles

- **Status:** Proposed
- **Date:** 2026-10-17
- **Area:** Tokens
- **Detailed contract:** [theming-and-styling.md §11](../theming-and-styling.md)

## Context
Responsive layout needs coordinated role changes without rewriting descendants or shrinking text and targets.

## Decision
Categories: foundation values → semantic layout roles → component roles; plus named conditions (literal thresholds) and profiles (explicit role-override sets, applied by `data-mote-profile` or recipe conditions, with alias-closure re-declaration). Profiles may not override foundation or colour values; no profile or density may reduce target-size roles below the documented minimum.

## Alternatives considered
- Generic "responsive scale" multipliers — ambiguous effects on nested components.

## Consequences
The validator enforces category reference rules and target-size minimums.

## Evidence
Pending: M2 validation tests; M4 side-nav profile fixture.

## Revisit when
Real components need profile overrides outside layout/component roles.