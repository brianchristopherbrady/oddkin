# 0002. One reactive graph, scheduling, and the binding rule

- **Status:** Accepted
- **Date:** 2026-10-17
- **Area:** Core
- **Detailed contract:** [core-contracts.md §1, §5](../core-contracts.md)

## Context
Components, stores, resources, and context all need reactivity. Separate engines would duplicate scheduling and break consistency guarantees. Developers also need a predictable rule for when templates update.

## Decision
- One DOM-free signal graph in `@oddkin/core/reactive` (`signal`, `computed`, `effect`, `batch`, `untracked`, `Readable`) shared by components, stores, context, and resources.
- Synchronous reads/writes; lazy, memoized, glitch-free `computed`; `Object.is` default equality; microtask-deduplicated commits; order derivation → DOM commits → post-commit effects.
- **Binding rule:** `render()` runs in a tracking context, so `.value` reads (including synchronous helpers) register render-level dependencies and schedule a deduplicated render. Readables interpolated directly bind at part level without re-running `render()`. `.value` outside tracked contexts, in event handlers, and in async callbacks is an untracked snapshot. Binding-initialization reads register no render dependency. A dependency used both ways coalesces with no duplicate DOM writes.

## Alternatives considered
- Separate store engine (Redux-style) — second scheduler, inconsistent derived reads.
- Proxy-based deep reactivity — hidden costs and identity surprises; not v1.
- Render-only (no direct bindings) — loses targeted updates.

## Consequences
Store and component behavior compose; tests must cover dual-path coalescing and reentrancy.

## Evidence
R01, R10, R11, R13, R17, R18, R20 (synthesis). Pending: M3 reactivity tests and measurements (§8.2).

## Revisit when
Measurements show direct-binding subscriptions cost more than they save in the M3/M8 benchmarks.