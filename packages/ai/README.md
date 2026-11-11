# @oddkin/ai

Optional AI interaction package: typed records, DOM-free controllers, stream adapters, and `odd-*` elements for conversation interfaces, inline assistance, research tools, and agent workflows. No model calls, no storage, no third-party runtime dependencies. The AI demos are audited with axe-core in Chromium, Firefox, and WebKit; screen readers are not yet verified ([support policy](../../docs/support.md#accessibility)).

**Status:** implemented and verified (IMPLEMENTATION_PLAN.md §5j). Contract: [ai-interaction.md](../../docs/architecture/ai-interaction.md). Decision: [ADR 0040](../../docs/architecture/decisions/0040-ai-interaction-package.md). Demos: [research assistant](../../examples/ai-research/), [inline writing assistant](../../examples/ai-writing/), [agent task panel](../../examples/ai-agent/).

## Install and register

`@oddkin/core` and `@oddkin/components` are peer dependencies, which npm installs with it; with Yarn, add them yourself (`yarn add @oddkin/components @oddkin/core`). `@oddkin/tokens` is a dependency. Load a theme stylesheet (e.g. `@oddkin/tokens/css/default.css`). Register only what you use:

```js
import '@oddkin/ai/define/conversation'; // also registers odd-message, odd-response, odd-tool-call, …
import '@oddkin/ai/define/prompt-input';
```

Importing `@oddkin/ai/<element>` gives the class, template, styles, definition, and default strings without registering anything. The root entry and `./contracts`, `./controllers`, `./events`, and `./stream` import without a DOM.

## Controller-backed conversation (plain JavaScript)

```html
<odd-conversation label="Assistant">
  <odd-prompt-input slot="composer" label="Ask a question"></odd-prompt-input>
</odd-conversation>
```

```js
import { ComposerController, ConversationController, bindIntents, controllerIntents, isActive } from '@oddkin/ai/controllers';
import { createUiMessageStreamTransport } from '@oddkin/ai/stream';

const transport = createUiMessageStreamTransport({
  api: '/api/chat',                                   // your endpoint (AI SDK UI message stream v1)
  stopApi: (t) => `/api/chat/${t.attemptId}/stop`,   // optional: enables Stop
  resumeApi: (t) => `/api/chat/${t.attemptId}/stream`, // optional: enables Resume
});
const controller = new ConversationController({ transport, conversationId: 'c1' });
const draft = new ComposerController({ accept: ['image/*', '.pdf'], maxFileSize: 5_000_000 });

const conversation = document.querySelector('odd-conversation');
const composer = document.querySelector('odd-prompt-input');
conversation.store = controller;
composer.controller = draft;
bindIntents(conversation, controllerIntents(controller, draft));
controller.subscribe(() => {
  const state = controller.getSnapshot();
  const attempt = state.activeAttemptId ? state.attempts[state.activeAttemptId] : undefined;
  composer.loading = !!attempt && isActive(attempt.status);
  composer.attemptId = attempt?.attemptId ?? '';
  composer.capabilities = state.capabilities;
});
```

`createSimulatedTransport` (`@oddkin/ai/stream`) replaces the network for tests and demos.

## Application-owned state (controlled)

```js
import { createConversationView, selectSource, bindIntents } from '@oddkin/ai/controllers';

conversation.store = selectSource(store, (s) =>
  createConversationView({ conversationId: s.id, messages: s.messages, tools: s.tools, approvals: s.approvals, capabilities: s.capabilities }),
);
bindIntents(conversation, {
  'odd-approval-decide': (d) => api.decide(d.approvalId, d.revision, d.decision), // your store updates the record
  'odd-prompt-stop': (d) => api.stop(d.attemptId),
});
```

Or assign a validated snapshot directly: `conversation.state = createConversationView(…)`.

## Frameworks

Elements use properties for records and typed, bubbling, composed events for intents.

- React 19: `<odd-action-approval approval={record} capabilities={caps} onodd-approval-decide={(e) => decide(e.detail)} />`
- Vue 3: `<odd-action-approval :approval="record" :capabilities="caps" @odd-approval-decide="decide($event.detail)" />` (configure `compilerOptions.isCustomElement` for `odd-` tags)

## Elements

| Element | Purpose |
| --- | --- |
| `odd-conversation`, `odd-message` | Feed of messages, history, follow-latest scrolling, announcements, run status, composer slot; a message's versions |
| `odd-prompt-input` | Composer: multiline input, IME-safe Enter, attachments (paste, drop, picker), Send/Stop |
| `odd-response` | Streaming Markdown with citations, code, tables; canonical copy |
| `odd-citation`, `odd-sources` | Inline references with anchored popover previews or explicitly allocated inline details; source list |
| `odd-tool-call` | Tool identity, purpose, streamed arguments, execution state, result, retry |
| `odd-action-approval` | Approve/reject one revision of a proposed action |
| `odd-context-picker` | Files, documents, URLs, selections with statuses |
| `odd-activity`, `odd-task-plan` | Run status and recovery actions; plans with parallel tasks, blockers, input requests |
| `odd-artifact` | Revisions, preview/source, copy, export, host renderers |
| `odd-inline-assist`, `odd-change-review` | Selection actions; before/after review with accept, reject, undo |
| `odd-question` | Clarifying questions: choices, forms, custom answers |
| `odd-ai-label` | Provenance supplied by the application |
| `odd-response-feedback` | Ratings with reasons and comments |
| `odd-model-select` | Application-provided models with availability |
| `odd-usage-meter` | Measured, estimated, and unknown usage |
| `odd-voice-input`, `odd-transcript` | Dictation with replaceable adapters; editable transcripts |
| `odd-checkpoint` | Restore points with confirmed outcomes |

Full API (properties, attributes, events, slots, parts, CSS properties) is in `custom-elements.json` and `oddkin.metadata.json`; record schemas in `schemas/`.

## Citation previews

`odd-citation` defaults to `presentation="popover"`, composing the existing `odd-popover` so source details can open without moving the following work. Enter or Space opens it; Tab reaches its controls; Escape or Close source preview closes it and restores the marker's logical focus. An outside control keeps the focus the user moved there.

For a directly composed citation whose parent deliberately allocates a growing source-details region, choose the inline presentation:

```html
<odd-citation source-id="report" index="1" presentation="inline"></odd-citation>
```

Assign its source record through the `source` property as usual. The equivalent choice is `citation.presentation = 'inline'`. A presentation change while the preview is open takes effect after close; resizing never switches it automatically. Generated Markdown markers use the component default; no response-wide presentation property or global adaptive context is introduced.

**Show in sources** retains the existing cancelable `odd-citation-open` event with `{ sourceId, resolved }`. Its uncancelled, resolved default emits `odd-source-reveal` for the same captured source identity. The `trigger` and `preview` parts remain, and `strings.close` localizes the composed close control. This changes the previous inline default; [ADR 0050](../../docs/architecture/decisions/0050-citation-preview-presentation.md) records the rationale, migration, and owner-preference confirmation boundary. Read the shared [responsiveness guide](RESPONSIVENESS.md) for parent ownership and evidence limits.

## Patterns

Arrangements of these elements for common needs, with no element of their own, each with a page and a working example in plain HTML: [patterns/](patterns/index.json) (shipped in the package, and listed in its agent kit). Suggested prompts, branch navigation, reasoning disclosure, copy action, empty conversation, chat layout, citations with sources, approval outside a tool call, and agent asks, then acts.

## States you must report

Elements show what records say. Report loading, empty, interrupted, denied, stale, failed, and recovered states through records (`AttemptRecord.status`, tool/approval/question/checkpoint `status`, `PublicError`) and capabilities (`{ available: false, reason }`). An event is a request: the element stays pending until the record changes.

## Host responsibilities

Transport, persistence, authorization and execution of approved actions, uploads, transcription, telemetry, sanitizer choice for raw HTML, `data`/artifact renderers, localization (`strings` on every element), and truthful usage precision and provenance. See [ai-interaction.md §12](../../docs/architecture/ai-interaction.md#12-host-application-responsibilities).
