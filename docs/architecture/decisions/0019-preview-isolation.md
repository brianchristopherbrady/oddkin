# 0019. Workbench preview isolation and frame protocol

- **Status:** Proposed
- **Date:** 2026-10-17
- **Area:** Workbench
- **Detailed contract:** [workbench.md §5](../workbench.md)

## Context
Previews register custom elements, load styles and themes, and may throw; the shell must stay unaffected, and incompatible registrations cannot be undefined in place.

## Decision
One iframe realm per preview (own registry, import map, styles, theme scopes), owned by host and frame `Scope`s, communicating via a typed, versioned `postMessage` protocol with origin/source/generation validation. Iframes isolate registries and styles; they are not a security sandbox for untrusted code.

## Alternatives considered
- Shadow-root previews in the shell document — shared global registry and HMR conflicts.
- Scoped registries — not in the baseline (ADR 0009).

## Consequences
Bounded frame counts; no iframe per catalog card.

## Evidence
HTML cross-document messaging (§12.3). Pending: M5 pooled-vs-per-preview frame experiment.

## Revisit when
Scoped registries reach the baseline, or frame cost is unacceptable.