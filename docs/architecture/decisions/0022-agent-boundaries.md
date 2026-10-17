# 0022. `@mote/agent` boundaries and MCP adapter

- **Status:** Proposed
- **Date:** 2026-10-17
- **Area:** Agent
- **Detailed contract:** [agent-tooling.md](../agent-tooling.md)

## Context
Agents should use exact installed contracts, not generic docs, without affecting browser code.

## Decision
Optional Node-only dev package over analyzer outputs; deterministic operations shared by CLI, instructions, and an optional MCP adapter. Never reachable from browser graphs. Uses the developer's IDE model. Reports provenance; schema validity is never presented as proof of behavior. MCP implementation choice (original vs dev-only SDK) is decided in M11.

## Alternatives considered
- Hosted service — unnecessary dependency and data exposure.

## Consequences
Boundary checks cover agent reachability.

## Evidence
MCP specification (§12.4). Pending: M11 evaluation.

Extended by [0032](./0032-generated-agent-kits.md): generated agent kits, project context and freshness, capability contracts, and preview feedback. The boundaries above are unchanged.

## Revisit when
The MCP specification revision we pin changes incompatibly.