# 0032. Generated agent kits and project context

- **Status:** Proposed
- **Date:** 2026-10-17
- **Area:** Agent
- **Detailed contract:** [agent-tooling.md](../agent-tooling.md) §1, §3.1–§11
- **Extends:** [0022](./0022-agent-boundaries.md)

## Context
AI coding assistants start with no knowledge of Oddkin or of a library built with it. They invent tag names, properties, tokens, and imports, or apply documentation for a different version. Teams adopting Oddkin need assistance for **their own** library — prefix, packages, tokens, recipes, conventions — not only for Oddkin's components. Oddkin already generates normalized metadata, examples, and page content for documentation and Workbench.

## Decision
- Every library built with Oddkin can generate a versioned **agent kit** from the same inputs used by its documentation and Workbench: analyzer metadata, theme configuration, authored guidance, and `defineExamples`. There is no second, hand-maintained API catalog.
- The kit contains a small entry guide, targeted references loaded on demand, and the same contracts as JSON keyed by stable ids. Exact API references are generated; authored guidance is checked for valid API references at build time.
- Optional adapters package the kit as an Agent Skills directory, a managed `AGENTS.md` section that preserves existing text, IDE-specific instructions, and an `llms.txt` index for static docs. Publishing a file is not claimed to make every client load it.
- `resolveProjectContext` reports installed versions, exports, conventions, capability paths, and commands. Every artifact and operation result carries a fingerprint and a freshness state. Stale artifacts are detected, never silently replaced by newer website content.
- CLI and optional MCP adapter share one implementation of deterministic operations, with JSON Schema input and output contracts, bounded responses, dry-run patches, and Oddkin diagnostics.
- Kit generation is independent of the Workbench application. Preview feedback reuses Workbench frames and executes only trusted project examples.
- The developer's IDE model does the reasoning; no hosted model, embedding service, or separate analyzer is required.

## Alternatives considered
- **Hand-written agent instructions per release** — drift from the API; does not serve consuming libraries.
- **One large documentation dump** — exceeds context windows and hides the relevant contract.
- **Hosted retrieval service with embeddings** — adds a runtime service, data exposure, and a dependency ordinary consumers do not need.
- **MCP-only delivery** — excludes clients without MCP; Markdown and JSON remain the baseline.

## Consequences
- The metadata model gains agent-facing facts: rich-property assignment, event intent, dependencies, contract references, deprecations, migration references, and `verified` conditions. These additions follow the M8 compatibility checkpoint and M12 freeze rules (ADR 0029).
- Examples gain explained incorrect variants with expected diagnostics.
- Existing diagnostic shapes gain optional envelope fields.
- `@oddkin/agent` gains `./context` and `./kit` entries. Kit size and freshness become release checks.

## Evidence
Pending. Planned tasks are in M4 (contracts), M5 (local context and generated reference pilot), M8 (compatibility review), M11 (operations, packaging, MCP, evaluation), and M12 (packed verification). Research references R33–R41 ([synthesis.md](../../research/synthesis.md)) are implementation references, not evidence that this approach improves results; that requires the evaluation in agent-tooling.md §11.

## Revisit when
The evaluation shows generated references or tools do not improve correctness over documentation alone, or the Agent Skills, AGENTS.md, llms.txt, or pinned MCP revision changes incompatibly.
