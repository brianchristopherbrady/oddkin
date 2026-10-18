# AI interaction architecture (`@oddkin/ai`)

Status: implemented and verified for the scope in [IMPLEMENTATION_PLAN.md §5j](../../IMPLEMENTATION_PLAN.md#5j-ai-interaction-package-oddkinai-summary); evidence in [verification.md](../verification.md). Decision record: [ADR 0040](./decisions/0040-ai-interaction-package.md). Package guide: [packages/ai/README.md](../../packages/ai/README.md).

`@oddkin/ai` is an optional package of composable custom elements, DOM-free controllers, typed records, and stream adapters for conversation interfaces, inline assistance, research tools, and agent workflows. It never calls a model, stores conversations, or enforces authorization: the application (the *host*) owns data, transport, persistence, policy, and telemetry.

## 1. Package boundaries and state ownership

| Layer | Entry | DOM | Owns |
| --- | --- | --- | --- |
| Records | `@oddkin/ai/contracts`, `schemas/*.json` | free | Serializable shapes, validation (`@oddkin/core/model`), JSON Schema |
| Controllers | `@oddkin/ai/controllers` | free at import | Conversation, composer, document, voice state machines; intent bindings; external-store views |
| Adapters | `@oddkin/ai/stream` | free (uses `fetch`/streams when called) | Wire protocols → normalized `AiEvent`s; simulation |
| Rendering | `@oddkin/ai/markdown`, `@oddkin/ai/highlight` | renders into a given node | Streaming Markdown, URL policy, highlighting |
| Voice | `@oddkin/ai/voice/web-speech`, `@oddkin/ai/voice/recorder` | browser APIs when called | Optional capture/transcription adapters |
| Elements | `@oddkin/ai/<name>`, `@oddkin/ai/define/<name>` | browser | Presentation state only (focus, open/closed, scroll position, local drafts) |

Dependencies: `@oddkin/core`, `@oddkin/tokens` (refs only), `@oddkin/components` (`odd-button`). Forbidden: state, app, analyzer, workbench, agent, any third-party runtime package, any framework. Enforced by `scripts/architecture/boundaries.config.mjs` (`npm run lint:boundaries`) and by the import-graph checks in `npm run size`.

**One authoritative source per surface.** A conversation element reads either `source` (an `ExternalSource<ConversationState>`: `ConversationController` or an application store adapted with `selectSource`/`createConversationView`) or a controlled `state` snapshot. Elements never copy records into their own state, never mutate records, and never echo programmatic assignments as user-intent events. Every user action is a typed event that *requests* an operation; outcomes arrive as changed records. The controller is one possible owner; an application store is another (agent demo).

Element-owned resources (timers, listeners, object URLs created for previews, owned voice sessions, `ResizeObserver`s) belong to the element's `Scope` and are released on disconnect (A18).

## 2. Mapping: specification patterns → elements, controllers, adapters

| ID | Pattern | Element(s) | Controller / helper | Reuses |
| --- | --- | --- | --- | --- |
| C01 | Prompt composer | `odd-prompt-input` | `ComposerController` | native `textarea`/file input, `odd-button`, `live()` |
| C02 | Conversation/messages | `odd-conversation`, `odd-message` | `ConversationController`, `createConversationView` | `repeat()`, `Scope`, signals |
| C03 | Streaming response | `odd-response` | `MarkdownView` | DOM-only rendering, `@oddkin/ai/highlight` |
| C04 | Citations/sources | `odd-citation`, `odd-sources` | — | native `button`/links |
| C05 | Tool execution | `odd-tool-call` | `TOOL_TRANSITIONS` | native `details` |
| C06 | Action approval | `odd-action-approval` | `ConversationController.decide` | `odd-button` |
| C07 | Context selection | `odd-context-picker` | host records (`ContextItemModel`) | native file/URL inputs |
| C08 | Agent activity/plans | `odd-activity`, `odd-task-plan` | `isActive`, attempt records | native lists |
| C09 | Generated artifacts | `odd-artifact` | `ArtifactModel` | `MarkdownView`, host renderers |
| C10 | Inline assistance | `odd-inline-assist` | `captureSelection`, `DocumentSession` | APG toolbar pattern |
| C11 | Change review | `odd-change-review` | `DocumentSession`, `diffWords`/`diffLines` | `ins`/`del` |
| C12 | Alternative responses | `odd-message-branch` | `regenerate`, `edit`, `switchBranch` | — |
| C13 | Clarifying questions | `odd-question` | `QuestionModel` | native form controls |
| C14 | AI provenance | `odd-ai-label` | `provenanceSchema` | native `details` |
| C15 | Suggested follow-ups | `odd-suggestions` | `controllerIntents` (`suggestion-select`/`-submit`) | — |
| C16 | Response feedback | `odd-response-feedback` | `submitFeedback` | `aria-pressed` buttons |
| C17 | Model selection | `odd-model-select` | `ModelOptionModel` | native `select` |
| C18 | Usage display | `odd-usage-meter` | `UsageModel` | native `meter` (only when `used` and `limit` are known) |
| C19 | Voice/transcription | `odd-voice-input`, `odd-transcript` | `VoiceController`, `VoiceAdapter` | — |
| C20 | Checkpoints | `odd-checkpoint` | `CheckpointModel` | — |

Element names use the `odd-` prefix (ADR 0037); the specification's `ok-` names map one to one. Additional internal-but-public building blocks: `createAnnouncer` (`@oddkin/ai/announce`), `bindIntents`/`controllerIntents`, `describeConversationChange`.

Existing primitives reused: `OddkinElement.with()` and `prop.*` (typed properties, pre-upgrade replay), `event()` (typed events published in the CEM), `compose()`/`define()` (component folders, explicit registration entries), `Scope` (ownership and cleanup), signals/`computed`/`effect`, `html`/`repeat`/`live` templates (no `innerHTML`; Trusted Types policy), `css` with `token()` references, `@oddkin/core/model` (`defineModel`, validation, JSON Schema, the new `m.json()` node), `odd-button`, the analyzer (CEM + `oddkin.metadata.json`), the dev/prod build split, size and CSS budgets, and the CSS compatibility lint.

## 3. Data contracts

All records are defined once with `@oddkin/core/model` in `packages/ai/src/contracts/models.ts`; TypeScript types are inferred, untrusted input is validated with the same definitions, and `scripts/build-ai-schemas.mjs` writes JSON Schema to `packages/ai/schemas/` (14 files, `--check` mode in CI).

| Record | Model | Key | Notes |
| --- | --- | --- | --- |
| Message | `oddkin.ai.message` | `id` | `role`, `parentId` (branch tree), ordered `parts`, `attemptId`, `provenance` |
| Part | union on `type` | `id` | `text`, `reasoning`, `file`, `source`, `tool-call`, `approval`, `artifact`, `data` (`m.json`, renderer key), `unsupported` |
| Tool call | `oddkin.ai.tool-call` | `toolCallId` | streamed `inputText` vs complete `input`; `status` separate from approval |
| Approval | `oddkin.ai.approval` | `approvalId` + `revision` | target, changes, risk, expiry, decision, error |
| Artifact | `oddkin.ai.artifact` | `artifactId` | revisions with stable identity; `currentRevisionId` |
| Usage | `oddkin.ai.usage` | — | `precision`: measured / estimated / unknown, supplied by the host |
| Checkpoint | `oddkin.ai.checkpoint` | `checkpointId` | `restores` lists every replaced state; `outcome` host-confirmed |
| Plan | `oddkin.ai.plan` | `planId` | steps with `tasks` (parallel), `blocker`, `inputRequest` |
| Question | `oddkin.ai.question` | `questionId` + `revision` | choice, multi-choice, form, text; custom answers |
| Context item, model option, feedback, suggestion, transcript segment, conversation snapshot | `oddkin.ai.*` | `id` | see schemas |

`AttemptRecord`, `ConversationState`, `Capabilities`, `PublicError`, and `AiEvent` are TypeScript contracts (runtime state, not persisted). `PublicError` carries `code`, user-presentable `message`, and `retryable`; diagnostic details stay in host logs. Runtime resources (File, streams, AbortControllers, DOM selections) never appear in records.

Ingestion (`normalizeMessage`, `normalizeSnapshot`, …): only declared fields are kept (`pickDeclared`); unknown or invalid parts become explicit `unsupported` parts; invalid records are dropped and reported as diagnostics; provider metadata never reaches rendered content (A15).

**Capabilities.** Every action (`send`, `stop`, `disconnect`, `reconnect`, `resume`, `retry`, `edit`, `regenerate`, `switchBranch`, `respondToApproval`, `editApproval`, `restoreCheckpoint`, `voice`, `attachments`, `history`, `feedback`) is `{ available, reason? }`; absent means unavailable. The controller intersects what the transport implements with the host policy (`intersectCapabilities` only narrows). Elements hide or disable unavailable controls and show the reason; controller methods return `{ ok: false, reason: 'unavailable' }` instead of throwing.

## 4. Lifecycle

Transport connection, attempt, tool, approval, and stop are **separate state machines** (`packages/ai/src/controllers/transitions.ts`); one never implies another. Transitions outside these tables are ignored by the controller and reported as diagnostics; equal-state updates are no-ops.

### 4.1 Attempt

| From | Allowed to |
| --- | --- |
| `submitted` | accepted, streaming, awaiting-input, completed, cancelled, failed, interrupted |
| `accepted` | streaming, awaiting-input, completed, cancelled, failed, interrupted |
| `streaming` | awaiting-input, completed, cancelled, failed, interrupted |
| `awaiting-input` | streaming, completed, cancelled, failed, interrupted |
| `interrupted` | streaming, awaiting-input, completed, cancelled, failed (a resumed stream continues or ends it) |
| `completed`, `cancelled`, `failed` | — (terminal) |

`interrupted` = the stream ended without a terminal event: the client lost track of the work; it is never shown as completion (A06). `relation` (`new`, `retry`, `regenerate`, `edit`) and `parentAttemptId` link attempts. A request that is never accepted removes its optimistic messages (A02).

### 4.2 Connection

`idle → connecting/open/closed`; `connecting → open/closed/disconnected`; `open → closed/disconnected`; `disconnected/closed → reconnecting`; `reconnecting → open/closed/disconnected`. **Disconnect** closes the client stream only; the work continues per the backend's policy, and the attempt status is unchanged. **Resume** reattaches to the same attempt and never starts new work (A06).

### 4.3 Stop (cancellation)

Stop is a request for exactly one attempt, distinct from disconnect. `stop` state: `none → requested → confirmed | too-late | unknown | failed`.

| Stop outcome | Attempt still active | Attempt already terminal |
| --- | --- | --- |
| `cancelled` | status → cancelled; stop → confirmed | status kept; stop → confirmed if cancelled, else too-late |
| `already-finished` | status kept (the terminal event decides); stop → too-late | status kept; stop → too-late |
| `not-found` / `unknown` | status kept; stop → unknown | status kept; stop → unknown |
| request rejected | status kept; stop → failed | status kept; stop → failed |

A terminal event arriving while stop is `requested` sets stop to `confirmed` (if cancelled) or `too-late` (A07). Partial output is kept. A stop response for a stale generation (after a conversation switch) is ignored.

### 4.4 Tools

`input-streaming → input-available | output-error | cancelled`; `input-available → awaiting-approval | executing | output-available | output-error | denied | cancelled`; `awaiting-approval → executing | output-available | output-error | denied | cancelled`; `executing → output-available | output-error | cancelled`; `output-error → executing` (host retry). Complete arguments are shown as "Arguments ready; not run yet", never as success (A08). Each tool keeps its own identity and state (A09).

### 4.5 Approvals

`requested → decision-pending | approved | rejected | expired | superseded`; `decision-pending → approved | rejected | decision-failed | expired | superseded`; `decision-failed → decision-pending | approved | rejected | expired | superseded`. Decisions target one `approvalId` **and revision**. The element sends one decision per revision (double activation is ignored) and shows it as pending until the record changes; a new revision resets the guard and marks the old one `superseded`; the controller refuses decisions for stale, expired, or already decided revisions and maps transport outcomes `stale`/`expired`. **Approval is never shown as success of the action**: the tool's own status reports execution (A10).

### 4.6 Other mutations

Checkpoint restore: `available → restore-pending → restored | restore-failed`; success text appears only when the host's record says `restored` (A20). Questions: `requested → submitting → submitted | failed`, `skipped`, `expired`, per revision. Feedback: `idle → pending → submitted | failed`. Document proposals: §8.3.

## 5. Streams and adapters

### 5.1 Normalized event stream

Adapters translate a wire protocol into `AiEvent`s and push them into an `EventSink` bound to one attempt (`conversationId`, `runId`, `attemptId`). Event types: `attempt-accepted`, `message-start`, `message-reset`, `step-start`, `step-reset`, `text-start/-delta/-end` (`kind: text | reasoning`), `part`, `tool-input-start/-delta/-available`, `tool-executing`, `tool-output`, `tool-error`, `tool-denied`, `approval-request`, `approval-resolved`, `artifact`, `usage`, `snapshot`, `finish`, `abort`, `error`, `metadata`.

Controller guarantees:

- **Routing** by attempt, message, part id, and tool call id. Text accumulates in arrival order; adapters decode bytes with streaming `TextDecoder` so split multi-byte characters are reconstructed (A03).
- **Isolation.** Each send/resume gets a sink with a generation number; loading another conversation, `reset()`, or `dispose()` invalidates every sink, pending stop, and pending decision. Late events are dropped (A05).
- **Deduplication only by identity.** Events with `seq` (strictly increasing offset per attempt) or `eventId` (unique per attempt) are dropped when already applied. Content is never compared: repeated text stays (A04). Without identity, replays must use `message-reset` (rebuild) or `snapshot` (replace the message wholesale) — reconciliation against a known scope.
- **Terminal handling.** `finish`, `abort`, and `error` are terminal; events after a terminal event are ignored; closing a stream without one makes the attempt `interrupted`.
- **Batching.** Ingestion commits immutable snapshots synchronously; rendering is coalesced per animation frame in `odd-response`; committed Markdown blocks keep their DOM.

### 5.2 Simulation adapter (`createSimulatedTransport`)

Deterministic, clearly simulated (`simulated: true`), no network. Scripts are timed steps (`event`, `drop`, `awaitDecision` with approve/reject branches). The simulated server keeps producing while disconnected and numbers every event so a resume replays an overlap (`replayOverlap`) that the controller deduplicates. Controls: `failNextSend`, `acceptDelay`, `stopBehavior` (`cancel`, `already-finished`, `unknown`, `fail`), `stopDelay`, `decisionOutcome`, `decisionDelay`, `feedbackDelay`, `failFeedback`, `historyDelay`; `inject()` pushes a late event; `pendingTimers` proves cleanup. Used by tests and demos.

### 5.3 External store (`selectSource`, `createConversationView`)

For applications that own conversation state: `createConversationView(input)` validates and normalizes application records into a `ConversationState` (invalid records dropped and reported, unknown parts explicit); `selectSource(store, select)` memoizes on the store snapshot's identity and notifies only when the derived view changes. Intents go to the application's handlers (`bindIntents`). The agent demo and `conversation.browser.test.ts` (A16) use this path.

### 5.4 AI SDK UI message stream, protocol v1 (`createUiMessageStreamTransport`)

Inspected at <https://ai-sdk.dev/docs/ai-sdk-ui/stream-protocol>, <https://ai-sdk.dev/docs/ai-sdk-ui/chatbot-resume-streams>, and <https://ai-sdk.dev/docs/ai-sdk-ui/chatbot-tool-usage> on 2026-10-17. Header `x-vercel-ai-ui-message-stream: v1`; SSE `data:` lines with JSON chunks; `data: [DONE]` ends the stream. SSE framing follows the WHATWG algorithm (`SseParser`: BOM, CR/LF/CRLF, multi-line data, comments, `id`, `retry`, field without colon).

| Chunk | Normalized |
| --- | --- |
| `start` | `message-start` (on a resumed replay: `message-reset`) |
| `text-*`, `reasoning-*` | `text-start/-delta/-end` (`kind`) |
| `source-url`, `source-document`, `file` | `part` (`source`, `file`) |
| `tool-input-start/-delta/-available`, `tool-input-error` | tool input events / `tool-error` |
| `tool-approval-request`, `tool-approval-response` | `approval-request`, `approval-resolved` |
| `tool-output-available`, `tool-output-error`, `tool-output-denied` | `tool-output`, `tool-error`, `tool-denied` |
| `start-step`, `reset-step` | `step-start`, `step-reset` |
| `finish`, `abort`, `error` | terminal events |
| `data-*` (persistent) | `part` (`data`, renderer key = suffix) |
| `message-metadata`, `custom`, unknown | `metadata` or a diagnostic; never rendered |

Guarantees and limits: arrival order; **no event ids or offsets in the protocol, so nothing is deduplicated by identity**; resumed streams are full replays (SDK default), rebuilt through `message-reset`. Information loss: `providerMetadata`, `messageMetadata`, `custom` parts, `finish-step`, `finishReason`, preliminary tool outputs, and transient data parts are not rendered. Optional endpoints: `resumeApi` (GET, `resume` capability), `stopApi` (POST, `stop`), `decideApi` (POST approvals). Without `stopApi`, stop is unavailable (aborting the fetch is a disconnect, not a stop). Recorded fixtures: `packages/ai/test/fixtures/ui-message-stream/*.sse`, replayed at every byte split point (A03).

### 5.5 AG-UI (design note)

AG-UI events (<https://docs.ag-ui.com/concepts/events>, read 2026-10-17) map closely onto `AiEvent`: `RUN_STARTED/FINISHED/ERROR` → attempt lifecycle; `TEXT_MESSAGE_START/CONTENT/END` → text events; `TOOL_CALL_START/ARGS/END/RESULT` → tool events; `STATE_SNAPSHOT`/`MESSAGES_SNAPSHOT` → `snapshot`/`load`; `STATE_DELTA` (JSON Patch) → application store, not the conversation; `STEP_STARTED/FINISHED` → plan updates; `RAW`/`CUSTOM` → `metadata`. Supported baseline for a future adapter: the stable lifecycle, text, tool, and snapshot events. Draft or optional extensions (reasoning events, meta events, interrupt/resume flows for human approval) are treated separately: they would map to `reasoning` parts and approvals only once stable, behind explicit capability flags. AG-UI's `messageId`/`toolCallId` identities route events but are not replay offsets, so the same reset/snapshot reconciliation applies. Not implemented: no fixtures exist yet; the AI SDK adapter is the delivered real protocol.

### 5.6 A2UI (evaluation)

A2UI (<https://a2ui.org/>, v0.9 era drafts with a v1.0 candidate, read 2026-10-17) describes UI declaratively for an agent to request from a client catalog; it is a *UI description* format, whereas AG-UI and the AI SDK stream are *event* protocols. Oddkin's role would be a catalog provider: a renderer for `data` parts that validates an A2UI surface description against a catalog of Oddkin elements and renders only registered, validated components. Decision: out of scope for this package version; the `data` part with registered renderers (§9.4) is the extension point, so no change to the records is needed later.

## 6. Element API (Web Components)

- **Properties** carry records, arrays, controllers, adapters, renderer hooks, and `strings`. **Attributes** carry scalar configuration (`label`, `placeholder`, `enter-behavior`, `allow-urls`, `insert-only`, `announce`, `view`, …). Transcripts, attachments, and records are never reflected.
- Properties assigned before upgrade are replayed through `OddkinElement`'s mechanism (tested in React and Vue fixtures, A16).
- **Replacement, not mutation.** Assign a new array or object to update; elements never mutate what they receive. Array properties are typed as mutable arrays (`prop.array`); in TypeScript copy readonly snapshots (`[...state.proposals]`) or keep application arrays mutable.
- Registration through `@oddkin/ai/define/<name>` only; importing a class or the root entry defines nothing. Dependencies (`odd-button`, nested AI elements) register first.

### 6.1 Events

All events bubble and are composed (they cross nested shadow roots). Dispatch *requests* an operation; the outcome arrives through records or controller results. A cancelable event's `preventDefault()` vetoes only the element's local default action, synchronously; it is not application approval.

| Event | Detail (ids) | Cancelable | Meaning |
| --- | --- | --- | --- |
| `prompt-submit` | `submissionId`, `revision`, `text`, `attachments` | yes (veto keeps the draft editable) | Request; host calls `acknowledge(submissionId)` or `fail(submissionId, error)` |
| `prompt-stop` | `attemptId` | no | Request to stop that attempt's work |
| `attachment-add` / `-remove` | attachments / `attachmentId` | no | Completed locally (validation); uploading is host-owned |
| `history-request` | `conversationId`, `beforeMessageId` | no | Request |
| `message-edit` | `messageId`, `text` | no | Request a new branch |
| `message-regenerate` | `messageId`, `attemptId` | no | Request an alternative |
| `attempt-retry` / `attempt-resume` | `attemptId` | no | Request (resume never starts new work) |
| `branch-switch` | `messageId`, `targetMessageId` | no | Request |
| `approval-decide` | `approvalId`, `revision`, `toolCallId`, `decision`, `reason` | no | Request; pending until the record changes |
| `approval-edit` | `approvalId`, `revision` | no | Request |
| `tool-retry` | `toolCallId` | no | Request |
| `citation-open` | `sourceId`, `resolved` | yes (default reveals the source) | Local |
| `artifact-export` | `artifactId`, `revisionId`, `format` | yes (default downloads canonical source) | Local default |
| `artifact-revision-change` | `artifactId`, `revisionId` | no | Presentation state changed |
| `suggestion-select` / `-submit` | `suggestionId`, `prompt` | no | Insert into composer / send |
| `feedback-submit` | `messageId`, `rating`, `reasons`, `comment` | no | Request; confirmed by the feedback record |
| `model-change` | `modelId`, `previousModelId` | yes (veto keeps the previous model) | Selection |
| `checkpoint-restore` | `checkpointId` | no | Request |
| `question-answer` / `-skip` | `questionId`, `revision`, `answer` | no | Request |
| `change-accept` / `-reject` / `-undo` | `proposalId` | no | Request |
| `assist-request` | `action`, `selection` (with `revision`), `language` | no | Request |
| `context-add` / `-remove` | `{kind:'file', files}` or `{kind:'url', url}` / `itemId` | no | Request; items appear when the host adds records |
| `plan-input` | `planId`, `stepId` | no | Request |
| `voice-transcript` | `text` | no | Completed locally (final transcript chosen) |
| `transcript-change` | `segmentId`, `text` | no | User edit |
| `ai-announce` | `text`, `priority`, `key` | yes (the nearest announcer cancels it) | Status message routing |

Framework bindings: React 19 sets properties for custom elements and listens with lowercase `on<event-name>` props (`onapproval-decide`); Vue uses `.prop` binding or property detection and `@approval-decide` / `onApprovalDecide`. Verified in `frameworks.browser.test.ts` in three engines.

## 7. Composer, selection, scrolling, resources

### 7.1 Composer (`odd-prompt-input`, `ComposerController`)

Enter sends; Shift+Enter inserts a newline; `enter-behavior="newline"` makes Enter a newline and Ctrl/Cmd+Enter sends. IME: no submission while composing, including the Enter that ends composition (`isComposing` and `keyCode 229`, A01). Each edit increments the draft `revision`; acknowledging a submission clears the draft only if the revision is unchanged, so newer edits survive (A02). A failed submission restores the draft and attachments. Attachment validation (`ai.attachment.type|size|count|unavailable`) is shown inline; statuses: selected, uploading (progress), uploaded, processing, ready, failed, removed. Object URLs are revoked only when created by the controller; previews are released on disconnect and restored on reconnect. Slots `above`, `toolbar-start`, `toolbar-end` compose mentions, commands, and model selection.

### 7.2 Conversation scrolling

Follow-latest policy: while within 48 px of the end the view follows new content; scrolling away stops following and shows "Jump to latest (N new)"; activating it scrolls to the end, resumes following, and moves focus to the newest message. Prepending history or content above changing size (images, fonts, Markdown reflow) keeps the visible anchor: the first visible message and its offset are captured before a change and restored afterwards by one idempotent correction (`ResizeObserver`); native `overflow-anchor` is not used so the two never fight (A11). Per-conversation positions are restored when switching back. Streaming never moves focus or replaces committed DOM, so selection and focus survive (A12). No virtualization: all messages stay in the DOM for find-in-page, selection, and assistive technology; the performance fixture (§11) records the cost.

### 7.3 Text ranges, selections, and proposals

Offsets are **UTF-16 code units** (JavaScript string indices, `selectionStart`), `start` inclusive, `end` exclusive; ranges must not split surrogate pairs (`isValidRange`); `toCodePointOffset`/`fromCodePointOffset` convert for hosts that use code points. `captureSelection(control, revision)` binds a selection to a content revision; `odd-inline-assist` shows a selection whose revision differs from `documentRevision` as stale and disables actions. `DocumentSession` applies a proposal only at its `baseRevision` when the original text still matches; otherwise it is `stale` or `failed` and newer content is never overwritten. Acceptance, application (`applied` with `appliedRevision`), rejection, and undo (only the latest change, only if nothing changed since) are distinct (A17).

### 7.4 Artifacts and checkpoints

Artifacts keep `artifactId` across revisions; the viewer shows preview or source, a revision selector, copy, and export of the canonical source; hosts register `artifactRenderers` by kind. Checkpoints list what restoring replaces, require an explicit confirmation, and show success only after the host's record says `restored`.

### 7.5 Voice

`VoiceController` runs a replaceable `VoiceAdapter` (states: unsupported, idle, requesting-permission, recording, processing, denied, unavailable, interrupted, error; interim and final segments). Adapters: `@oddkin/ai/voice/web-speech` (feature-detected Web Speech API), `@oddkin/ai/voice/recorder` (`MediaRecorder` capture + host `transcribe(blob)`), and `createScriptedVoiceAdapter` for tests and demos. Browser speech recognition is never the only path. An element-owned session is cancelled on disconnect; microphones, tracks, timers, and listeners are released (A19).

## 8. Rendering and content boundaries

### 8.1 Markdown dialect

CommonMark-inspired subset: ATX headings (`#`–`######`, rendered from `h3` by default via `headingOffset`), paragraphs, hard breaks, emphasis/strong/strikethrough, code spans, fenced code (``` and ~~~, info string = language), block quotes, ordered/unordered lists with nesting, thematic breaks, GFM tables with alignment, inline links and autolinks, bare `https://` URLs, images (links unless `images: 'load'`), and citation markers `[^source-id]`. Not supported: setext headings, reference-style links, indented code blocks, HTML entities beyond the source text, footnote definitions. Lazy paragraph continuation may re-render the previous block when a list or quote continues.

### 8.2 Incremental rendering

Canonical source text is kept separately from presentation repairs. While streaming, `splitBlocks` cuts the source into top-level blocks; blocks followed by more content are final and keep their DOM; only the last block is rebuilt, and an open code block grows by appending text. Repairs (closing an unfinished `**`, link, or fence) change only the AST. Copy and export use the canonical source (A13). Highlighting and renderers load independently (`markdown.highlight`, `renderers`, `artifactRenderers`, `toolRenderer`).

### 8.3 Security

All model output, tool output, URLs, file names, and metadata are untrusted. Rendering uses `createElement` and text nodes only — no HTML parsing of untrusted strings, no `innerHTML` — so every incremental path is inert by construction (A14). URL policy (`safeUrl`): allow-list `https:`, `http:`, `mailto:`; relative references only when enabled; control characters rejected; links get `rel="noopener noreferrer nofollow"`. Raw HTML is shown as text unless `html: 'sanitize'` with a host sanitizer, whose output is cleaned again (dangerous elements, event handlers, and URL attributes failing the policy are removed). Highlighters must return tokens whose texts concatenate exactly to the code, or highlighting is skipped. Code is content; executable previews are an application integration in an isolated frame. Structured UI goes through registered renderers that validate their `data` first. Missing citation records render as "Unresolved source reference" — sources are never invented (A15). Provenance and usage are displayed as supplied, never verified.

## 9. Accessibility and localization

### 9.1 Semantics

Conversation: `role="feed"` of `article` messages with `aria-posinset`/`aria-setsize`, `aria-busy` while loading or streaming, roving `tabindex`, Page Up/Down between messages, Ctrl+Home/End out of the feed. Approval, checkpoint, question, tool call, artifact: labelled groups with native buttons and form controls. Inline assist: APG toolbar (roving tabindex, arrow keys, Home/End). Citations: buttons with `aria-expanded` controlling a preview usable by keyboard and touch. Focus recovery: when a control disappears (e.g. Stop after completion, a confirmation step), focus moves to the element's status text rather than to `body`. Labels and descriptions stay inside the shadow root that owns the control; host-provided labels (`label` property) are forwarded.

### 9.2 Announcement policy

`describeConversationChange` decides which transitions are announced: sent, responding (`all` only), completed, stopped, stop too-late/unknown, failed (assertive), interrupted, disconnected, waiting for input, approval requested/approved/rejected/expired/superseded, tool failed, history loaded. **Never streamed text** and never per-token. Levels: `important` (default), `all`, `none` (`announcements` property). Each message has a key; a surface's `LiveAnnouncer` drops repeated keys. One polite and one assertive region per surface; standalone elements emit `ai-announce`, which the nearest announcer (a conversation or `createAnnouncer(container)`) handles and cancels so overlapping regions stay silent; elements with an `announce` property only announce when enabled. Arriving content never moves focus (A21).

### 9.3 Localization

Every visible and announced string is in a `*_STRINGS` table and overridable per element through the `strings` property (`{placeholder}` formatting); numbers, times, and currencies use `Intl` with the element's `lang`. The helpers are `@oddkin/core/i18n` (core-contracts.md §4.2), so formatters are cached per locale and options rather than constructed on every render. Layout uses logical properties, so right-to-left pages mirror; the inline-assist toolbar swaps arrow-key direction in RTL; content inherits the page's direction.

### 9.4 Visual

Styles use Oddkin tokens only (`token()` references), visible focus rings (`color.focus.ring`, `focus.width/offset`), minimum targets (`target.min`), forced-colors fallbacks, reduced motion (no motion is required for understanding), and reflow to 320 px. Verified with axe-core (WCAG 2.0/2.1/2.2 A/AA rules) on all three demos in three engines; screen-reader output has not been verified with real assistive technology (§12).

## 10. Documentation and metadata

The analyzer publishes `packages/ai/custom-elements.json` (CEM 2.1.0) and `oddkin.metadata.json` from source: properties with types, attributes, events with detail types and flags, slots, parts, CSS properties, registrations, models, and authored guidance (`@useFor`, `@notFor`, `@limitation`, `@a11y`, `@keyboard`, `@category`). Record schemas are generated into `schemas/`. No separate registry is maintained. Minimal usage examples live in the package README and are exercised by the browser tests and demos; a machine-readable example set will follow the Workbench `defineExamples` decision for components (M4/M5).

## 11. Performance

Fixture: `research/benchmarks/ai/` (`node research/benchmarks/ai/run.mjs [--samples 5] [--messages 1000] [--chars 20000]`); results in `research/benchmarks/results/ai-<date>-<platform>.json` with workload, method, browser versions, and hardware. Workload: 1,000-message history (Markdown, lists, code, citations, tool calls) mounted into `odd-conversation`, then a ~20,000-character Markdown answer streamed in 3–13 character chunks, three per frame; the same stream into an empty conversation for comparison; DOM node counts; Chromium heap before/after mount, stream, and teardown. Size budgets for `ai-headless`, `ai-response`, `ai-chat`, and the AI styles are enforced by `npm run size`, with import-graph checks that minimal entries do not load frameworks, state/app, the highlighter, voice, or stream adapters. Measured values: [verification.md](../verification.md).

## 12. Host-application responsibilities

Authentication, authorization, and execution of approved actions; transport, persistence, history paging, and telemetry; upload of attachments and context; transcription services; sanitizer choice when raw HTML is enabled; renderers for `data` parts and artifacts; localization strings; confirming restores and decisions; deciding retry policy; isolating executable previews; providing truthful usage precision and provenance. Elements request; the host decides and reports outcomes through records.
