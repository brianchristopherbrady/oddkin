# 0040. AI interaction package: records, controllers, adapters, and elements

- **Status:** Accepted
- **Date:** 2026-10-18
- **Area:** Components / AI
- **Detailed contract:** [ai-interaction.md](../ai-interaction.md)
- **Related:** 0003 (properties), 0005 (template security), 0008 (CSP), 0013/0015 (models), 0017 (CEM and enrichment), 0031 (dev/prod builds and budgets), 0036 (composition API), 0037 (naming)

## Context

Applications need conversation interfaces, inline assistance, research tools, and agent workflows. These surfaces stream untrusted content, run several independent lifecycles at once (connection, attempt, tools, approvals, stop), and must stay correct under races: late events from a previous conversation, a stop racing completion, duplicate replays, a decision on a proposal that changed. Existing libraries in this space are framework-bound and typically conflate those lifecycles (a closed stream treated as completion, approval treated as success). Oddkin already provides elements, reactive state, ownership (`Scope`), safe templates, models with JSON Schema, and an analyzer.

## Decision

Add an optional browser package, `@oddkin/ai`, depending only on `@oddkin/core`, `@oddkin/tokens` (refs), and `@oddkin/components` (`odd-button`), with four layers:

1. **Records** defined once with `@oddkin/core/model` (types, validation, generated JSON Schema). Core gains one node, `m.json()`, for bounded JSON values.
2. **DOM-free controllers**: conversation (attempts, branches, capabilities, isolation, identity-only deduplication, stop/approval semantics), composer (draft revisions, attachments), document (UTF-16 ranges bound to revisions), voice (replaceable adapters), announcement policy, intent bindings, external-store views.
3. **Adapters** that normalize wire protocols into one event stream: a deterministic simulation, an external-store integration, and the AI SDK UI message stream v1 (with recorded fixtures). AG-UI and A2UI are documented evaluations, not implementations.
4. **Elements** (`odd-*`, 24 tags) that render records, keep only presentation state, and emit typed request events; registration only through `define/<name>` entries.

Elements never own conversation data. One authoritative source per surface: a controller or the application's store. Rendering of untrusted Markdown uses DOM construction only (no HTML parsing), with a URL allow-list and an optional host sanitizer for raw HTML. All messages stay in the DOM (no virtualization).

## Alternatives considered

- **Wrapping a framework chat kit**: ties consumers to one framework and its state model; contradicts the no-runtime-dependency rule.
- **Elements owning state** (fetching and storing messages): hides authority and makes races untestable; hosts lose control of persistence and policy.
- **A third-party Markdown parser and sanitizer**: adds runtime dependencies and HTML-string paths; streaming requires block-stable incremental rendering that general parsers do not provide.
- **Virtualized conversation list**: breaks find-in-page, selection, and screen-reader reading; deferred until the performance fixture shows a need.
- **Content-based deduplication**: corrupts legitimate repeated text; rejected in favor of protocol identity or reset/snapshot reconciliation.

## Consequences

- Hosts implement transport, persistence, authorization, uploads, transcription, telemetry, and confirmation of decisions and restores; the package documents these responsibilities.
- The AI SDK adapter cannot deduplicate (the protocol has no offsets); resumption relies on full replays rebuilt through `message-reset`.
- A new `@oddkin/ai` row in the boundary rules, size budgets (headless, response, chat, styles), compatibility lint, metadata build, and packed-consumer checks.
- Array properties are typed as mutable arrays (`prop.array`); TypeScript hosts copy readonly snapshots.
- Analyzer: compose() dependencies imported from other packages' declarations now resolve to their tag names.

## Evidence

Node tests for contracts, controllers, SSE/UTF-8 framing at every byte split, the UI message stream fixtures, Markdown and URL policy; browser tests for every element and for React 19 and Vue 3.5 bindings in Chromium, Firefox, and WebKit; three static demos exercised end to end under strict CSP and Trusted Types with axe-core in three engines; performance fixture with 1,000 messages and sustained streaming. Results: [verification.md](../../verification.md).

## Revisit when

A real protocol with replay offsets (or AG-UI stable events) is requested; the performance fixture's limits are reached by a real application (consider virtualization with an accessible reading strategy); A2UI reaches 1.0 and a catalog renderer is requested; screen-reader verification finds announcement or reading-order problems.
