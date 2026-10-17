# 0004. `Scope` ownership and reconnection

- **Status:** Accepted
- **Date:** 2026-10-17
- **Area:** Core
- **Detailed contract:** [core-contracts.md §3–§4](../core-contracts.md)

## Context
Leaked listeners, timers, observers, and requests are the most common custom-element bug. Connections, effect runs, and requests have different lifetimes.

## Decision
- One `Scope` primitive owns cleanup (`listen`, `timeout`, `interval`, `add`, `child`, `effect`, `use`, `dispose`, lazy `signal`).
- Each connection gets a fresh scope (`connected(scope)`, `mounted(scope)`); disconnect disposes it immediately; reconnect creates a new one. Aborted signals are never reused.
- Supported native moves (`moveBefore`) may preserve a connection when feature-detected; otherwise normal disconnect/reconnect.
- Cleanups run in reverse order, all of them, with errors reported by origin.

## Alternatives considered
- Manual `disconnectedCallback` cleanup — error-prone.
- Delayed cleanup heuristics to survive moves — hides bugs.

## Consequences
Controllers, resources, and Workbench previews share one ownership protocol.

## Evidence
R02, R14, R19, R21, R22, R23. BCD 8.1.6: `moveBefore` Chrome/Edge 133, Firefox 144, Safari no — feature detection required. Pending: M3 lifetime tests.

## Revisit when
Move-preserving DOM APIs reach all baseline browsers (then simplify the fallback path).