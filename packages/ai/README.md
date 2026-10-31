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
| `odd-conversation`, `odd-message` | Feed of messages, history, follow-latest scrolling, announcements, run status, composer slot |
| `odd-prompt-input` | Composer: multiline input, IME-safe Enter, attachments (paste, drop, picker), Send/Stop |
| `odd-response` | Streaming Markdown with citations, code, tables; canonical copy |
| `odd-citation`, `odd-sources` | Inline references with previews; source list |
| `odd-tool-call` | Tool identity, purpose, streamed arguments, execution state, result, retry |
| `odd-action-approval` | Approve/reject one revision of a proposed action |
| `odd-context-picker` | Files, documents, URLs, selections with statuses |
| `odd-activity`, `odd-task-plan` | Run status and recovery actions; plans with parallel tasks, blockers, input requests |
| `odd-artifact` | Revisions, preview/source, copy, export, host renderers |
| `odd-inline-assist`, `odd-change-review` | Selection actions; before/after review with accept, reject, undo |
| `odd-message-branch` | Alternative responses and edited prompts |
| `odd-question` | Clarifying questions: choices, forms, custom answers |
| `odd-ai-label` | Provenance supplied by the application |
| `odd-suggestions` | Insert or send suggested prompts |
| `odd-response-feedback` | Ratings with reasons and comments |
| `odd-model-select` | Application-provided models with availability |
| `odd-usage-meter` | Measured, estimated, and unknown usage |
| `odd-voice-input`, `odd-transcript` | Dictation with replaceable adapters; editable transcripts |
| `odd-checkpoint` | Restore points with confirmed outcomes |

Full API (properties, attributes, events, slots, parts, CSS properties) is in `custom-elements.json` and `oddkin.metadata.json`; record schemas in `schemas/`.

## States you must report

Elements show what records say. Report loading, empty, interrupted, denied, stale, failed, and recovered states through records (`AttemptRecord.status`, tool/approval/question/checkpoint `status`, `PublicError`) and capabilities (`{ available: false, reason }`). An event is a request: the element stays pending until the record changes.

## Host responsibilities

Transport, persistence, authorization and execution of approved actions, uploads, transcription, telemetry, sanitizer choice for raw HTML, `data`/artifact renderers, localization (`strings` on every element), and truthful usage precision and provenance. See [ai-interaction.md §12](../../docs/architecture/ai-interaction.md#12-host-application-responsibilities).
