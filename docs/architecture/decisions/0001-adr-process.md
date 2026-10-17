# 0001. ADR process and change control

- **Status:** Accepted
- **Date:** 2026-10-17
- **Area:** Process
- **Detailed contract:** [README.md](./README.md), [IMPLEMENTATION_PLAN.md §0, §9, §12.5](../../../IMPLEMENTATION_PLAN.md)

## Context
The plan contains many design decisions whose rationale would otherwise live only in long documents. Decisions need a stable record of why they were made and what evidence would reopen them.

## Decision
- Every material decision gets a numbered ADR using [0000-template.md](./0000-template.md). Numbers are never reused.
- The implementation plan owns scope and sequencing; architecture documents own detailed contracts; ADRs own rationale and revisit conditions; [synthesis.md](../../research/synthesis.md) owns source identities.
- Research-backed ADRs follow the plan's §12.5 completion format: question → sources and versions → reproduction → observed result → decision or deferral → owning milestone.
- Status changes and supersessions are recorded in the README log.

## Alternatives considered
- Decisions only inside architecture documents — rationale and revisit conditions get lost in edits.

## Consequences
Each new contract change touches an ADR. Small reversible implementation choices do not need one.

## Evidence
n/a (process).

## Revisit when
The ADR count makes the log hard to navigate (split by area).