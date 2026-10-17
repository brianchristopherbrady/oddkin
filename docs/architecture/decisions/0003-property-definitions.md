# 0003. Typed property definitions via `MoteElement.with()`

- **Status:** Proposed
- **Date:** 2026-10-17
- **Area:** Core
- **Detailed contract:** [core-contracts.md §2](../core-contracts.md)

## Context
Public properties need types, attribute conversion, reflection, defaults, and metadata, without mandatory decorators or a compiler, and must be statically analyzable.

## Decision
Prototype `class X extends MoteElement.with({ name: prop.string({...}) })` as the single primary property API. One definition infers instance types, installs DOM accessors, validates conversion, and feeds metadata.

## Alternatives considered
- Decorators — require a transform or the newest decorator semantics; analyzability varies.
- `static properties = {...}` — weaker type inference; kept only as fallback if the prototype fails.

## Consequences
The prototype must prove declaration emit, subclassing, per-instance object defaults, pre-upgrade replay, reserved-name diagnostics, class-field compatibility, and analyzability before M4.

## Evidence
R04, R08 (synthesis). Pending: M3 prototype.

## Revisit when
Any of the listed prototype checks fails; then record the failure and accept the static-definition fallback in a superseding ADR.