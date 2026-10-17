# 0013. Component data models and region sources

- **Status:** Proposed
- **Date:** 2026-10-17
- **Area:** Data
- **Detailed contract:** [data-composition.md §2, §4](../data-composition.md)

## Context
Structured components (navigation, menus, tabs, tables) benefit from typed data, but must not become a universal DOM-as-JSON renderer.

## Decision
- Typed discriminated models via JS properties (e.g. `.items`); never mutated; immutable replacement; typed intent events; native links.
- Interaction state is controlled **or** uncontrolled, never both (`model.state.conflict`).
- Each region has exactly one authoritative source; `items` wins over slotted list children with `collection.source.conflict`; no merging.
- Customization ladder: options → slots/parts → local render functions (inside the semantic wrapper) → per-instance registered kinds.

## Alternatives considered
- Light-DOM children only — verbose for large data sets.
- Universal JSON page renderer — deferred (composition schema, M8 go/no-go).

## Consequences
Every collection component documents region sources in metadata.

## Evidence
Pending: M4 navigation and editable-list slices.

## Revisit when
The slices show region-source rules confuse authors or break framework integration.