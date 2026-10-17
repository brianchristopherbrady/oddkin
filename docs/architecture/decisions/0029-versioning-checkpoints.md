# 0029. M8 compatibility checkpoint and M12 final freeze

- **Status:** Accepted
- **Date:** 2026-10-17
- **Area:** Process
- **Detailed contract:** [IMPLEMENTATION_PLAN.md §6, M8, M12](../../../IMPLEMENTATION_PLAN.md)

## Context
Foundations must be stable before catalog expansion, but M9–M11 work will reveal needed changes.

## Decision
- M8: record candidate v1 contracts backed by tests and experiments. Breaking changes afterward need an ADR, affected-consumer analysis, a migration plan, and renewed verification.
- M9–M11: exercise the contracts; compatible additions proceed.
- M12: freeze the contracts actually shipping, after release verification. Later evolution follows versioning and deprecation policy.
- M10 catalog expansion remains gated on passing M8 foundation criteria.

## Consequences
Architecture documents describe APIs as reaching candidate v1 at M8 and freezing at M12.

## Evidence
n/a (process).

## Revisit when
Release planning changes milestone order.