# 0030. Workbench preview remount policy

- **Status:** Accepted
- **Date:** 2026-10-17
- **Area:** Workbench
- **Detailed contract:** [workbench.md §5](../workbench.md)

## Context
Theme edits must not reset component state, but some changes require new instances or frames.

## Decision
Theme-value edits (colours, spacing, radius, typography, borders, elevation, motion, mode, density, profiles, thresholds, presets, undo/redo, Reset theme, invalid drafts) preserve instances. Component/example/composition/role-component changes and adapter/fixture/provider changes may remount the smallest affected region; implementation/registration replacement uses a fresh frame; CSS/token/doc/compatible-metadata HMR updates in place; explicit Reset preview may recreate the instance. Keys and frame identity are never derived from a theme configuration hash.

## Consequences
State, focus, and selection are preserved where elements remain present.

## Evidence
Pending: M5 instrumentation tests.

## Revisit when
A theme dimension cannot be applied without re-instantiation.