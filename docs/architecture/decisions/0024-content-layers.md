# 0024. Content layers and precedence

- **Status:** Accepted
- **Date:** 2026-10-17
- **Area:** Workbench
- **Detailed contract:** [workbench-pages.md §10](../workbench-pages.md)

## Context
Pages need helpful prose without letting prose contradict generated facts.

## Decision
Three layers: built-in localizable copy (generic, never asserts library facts), generated facts (authoritative for values and contracts), authored overrides keyed by stable ids (`mote.docs.ts` or Markdown front matter). Authored overrides win for prose and presentation; generated facts always win for values. Regeneration never overwrites authored files; unknown ids are diagnosed.

## Alternatives considered
- Editable generated Markdown — second source of truth.

## Consequences
Content schema with migrations; fact interpolation tokens instead of copied literals.

## Evidence
Pending: M5 fixture libraries producing different correct pages.

## Revisit when
Authors need to override generated facts (handled through config, not prose).