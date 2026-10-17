# 0020. Theme Studio specimen roles and adapters

- **Status:** Accepted
- **Date:** 2026-10-17
- **Area:** Workbench
- **Detailed contract:** [workbench.md §6.5](../workbench.md)

## Context
Theme Studio must preview a library's own components without guessing compatibility from tag names.

## Decision
A replaceable specimen recipe defines roles (surface, heading, text, link, badge, text input, checkbox, switch, primary/secondary action, navigation). Components fill roles only via declared `@previewRole`, explicit config, examples, or adapters over public props/slots/events/fixtures and `Scope`. Ambiguity → picker with compatibility diagnostics; unavailable → labelled generic fallback.

## Alternatives considered
- Tag-name heuristics — wrong mappings and false confidence.

## Consequences
Components declare preview roles in metadata; adapters are part of the public Workbench config.

## Evidence
Reference audit (paired light/dark specimens). Pending: M5/M9 mapping tests.

## Revisit when
Adopters consistently need roles not in the default specimen.