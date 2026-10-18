# UI message stream contract fixtures

Server-sent event bodies in the AI SDK UI message stream protocol v1 (`x-vercel-ai-ui-message-stream: v1`), written chunk by chunk from the protocol reference at <https://ai-sdk.dev/docs/ai-sdk-ui/stream-protocol> (inspected 2026-10-17). They were not captured from a live server; the adapter tests replay them through `fetch`-shaped responses, byte by byte and at arbitrary split points.

| Fixture | Covers |
| --- | --- |
| `research.sse` | start, steps, reasoning, streamed tool input (multi-byte UTF-8 inside a JSON string), tool output, `source-url`, `source-document`, text with citations and legitimately repeated text, a `data-*` part, `message-metadata`, a comment line, `finish`, `[DONE]` |
| `agent-abort.sse` | approval request and response, denied tool, failed tool, unknown chunk, `custom` part, non-JSON data, `abort` |
| `reset-error.sse` | `reset-step` discarding a partial step, then `error` |
