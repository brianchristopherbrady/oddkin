Extend Oddkin’s implementation and canonical implementation plan with a composable AI interaction package, `@oddkin/ai`.

Support conversation interfaces, inline assistance, research tools, and agent workflows. Use Oddkin’s existing components, state primitives, tokens, accessibility infrastructure, and engineering conventions.

Implement the complete component and behavior scope below. Work incrementally in dependency order, preserving a working repository between completed slices.

## AI-01. Establish repository context and traceability

Read the repository instructions, architecture, canonical implementation plan, package configuration, existing components, and relevant tests before editing.

Identify:
- Existing primitives and controllers that can be reused.
- Current registration, reactivity, event, form, lifecycle, styling, SSR, and metadata conventions.
- Supported browser and framework versions.
- Actual build, test, documentation, and generation commands.
- Existing dependencies suitable for parsing, validation, rendering, and testing.

Preserve existing work, detailed contracts, and implementation status. Update the canonical plan in place.

Create or extend the repository’s existing task/coverage mechanism so every requirement can be traced to:
- Implementation location.
- Relevant tests.
- Documentation or demonstration.
- Status: planned, implemented, verified, or blocked.
- Evidence supporting a verified status.

Use the section IDs and component IDs in this prompt. Subdivide them where useful. Keep one authoritative record rather than introducing competing checklists.

Resolve routine implementation choices using repository conventions. Record significant decisions and their rationale.

## AI-02. Package boundaries and state ownership

Create or complete `@oddkin/ai` as an optional package.

- Use `ok-` for custom-element names.
- Follow existing conventions for exports, registration, types, tokens, CSS parts, and lifecycle.
- Support selective consumption and registration.
- Keep general-purpose Oddkin packages independent of AI packages.
- Keep substantial optional dependencies, including syntax highlighting, specialized artifact viewers, and voice integrations, outside minimal entry points.
- Preserve existing SSR/import conventions. Headless types and state utilities must be usable without browser globals.

Separate four responsibilities:

1. Components render supplied state and collect user intent.
2. Headless controllers provide reusable interaction behavior.
3. Adapters translate application stores, transports, and SDKs.
4. Host applications/backends own authorization, model requests, tool execution, and durable persistence.

Each surface must have one authoritative data owner: an external application store or an Oddkin controller. Avoid competing copies of conversation state.

Keep local presentation state, such as expanded disclosures and scroll position, separate from authoritative run/message data.

Keep components independent of React and any particular provider or transport. Framework integrations may use adapters or wrappers without adding those frameworks to component runtime dependencies.

## AI-03. Complete component scope

These are proposed public names. Reconcile them with existing elements and naming conventions. Reuse existing primitives or documented compositions where they already provide the behavior.

### Foundation

| ID | Pattern | Suggested elements | Required behavior |
|---|---|---|---|
| C01 | Prompt composer | ok-prompt-input | Expanding input, attachment controls, paste/drop, toolbar slots, submission/cancellation states, draft preservation, and extension points for mentions or commands. |
| C02 | Conversation/messages | ok-conversation, ok-message | Roles, structured message parts, history loading, scroll anchoring, and navigation to the latest message. |
| C03 | Streaming response | ok-response | Incremental rich text and code, partial output, completion, interruption, and error states. |
| C04 | Citations/sources | ok-citation, ok-sources | Inline references, source lists, excerpts, accessible previews, and navigation. |
| C05 | Tool execution | ok-tool-call | Identity, purpose, streamed arguments, execution state, results, failures, and supported recovery actions. |
| C06 | Action approval | ok-action-approval | Review an action and its target/changes, submit a decision, and display authoritative outcomes. |

### Additional patterns

| ID | Pattern | Suggested elements | Required behavior |
|---|---|---|---|
| C07 | Context selection | ok-context-picker | Select, inspect, and remove files, documents, URLs, or selected text. |
| C08 | Agent activity/plans | ok-activity, ok-task-plan | Steps, parallel tasks, blockers, progress, and requests for input. |
| C09 | Generated artifacts | ok-artifact | Stable identity, revisions, preview/source modes, application-provided renderers, and export actions. |
| C10 | Inline assistance | ok-inline-assist | Selection-based rewriting, explanation, summarization, translation, and expansion. |
| C11 | Change review | ok-change-review | Before/after views, text/code diffs, individual acceptance, rejection, and undo requests. |
| C12 | Alternative responses | ok-message-branch | Regenerated-answer and edited-prompt branches with preserved history. |
| C13 | Clarifying questions | ok-question | Choices, structured forms, custom answers, and submitted/skipped/expired states. |
| C14 | AI provenance | ok-ai-label | Application-provided generation/assistance labels and origin information. |
| C15 | Suggested follow-ups | ok-suggestions | Suggested prompts/actions with distinct selection and submission behavior. |
| C16 | Response feedback | ok-response-feedback | Feedback, optional reasons, pending submission, and confirmed outcomes. |
| C17 | Model selection | ok-model-select | Application-provided models, capabilities, availability, and selection. |
| C18 | Usage display | ok-usage-meter | Token/context/quota/cost information with measured, estimated, and unknown states. |
| C19 | Voice/transcription | ok-voice-input, ok-transcript | Recording, microphone states, interim/final transcription, editing, cancellation, and cleanup. |
| C20 | Checkpoints | ok-checkpoint | Restore-point descriptions, restoration requests, pending work, and actual outcomes. |

A composition can satisfy a pattern when existing elements provide the necessary semantics and behavior. Document the final mapping and reuse decisions.

Use existing Oddkin appearance, size, density, and theming conventions. Provide slots or renderers for meaningful customization.

## AI-04. Typed data contracts

Reuse existing repository contracts where suitable. Define the smallest provider-neutral types needed for:

- Conversations and messages.
- Stable message/content-part identities.
- Runs, attempts, and resume/branch relationships.
- Text, attachments, citation references, tool calls, and artifact references.
- Approval requests and decisions.
- Artifact revisions and content revisions.
- Capabilities, usage information, and public errors.

Use discriminated unions for structured content and state where appropriate.

Separate serializable records from runtime resources such as File objects, streams, AbortControllers, and DOM selections.

Preserve host-owned data. Define whether updates use immutable snapshots, observables, or another existing Oddkin mechanism.

Specify runtime validation at untrusted adapter and renderer boundaries. TypeScript declarations alone do not validate incoming data.

Provide a safe fallback for unsupported content parts. Keep diagnostic/provider metadata separate from ordinary user-visible content.

## AI-05. Independent lifecycle and capability contracts

Represent transport, run, tool, approval, and view state independently.

At minimum, distinguish:
- Transport connectivity from the underlying work’s status.
- Generating tool arguments from executing the tool.
- Approval requested, decision pending, approved, rejected, expired, and superseded.
- Tool execution success from approval success.
- Completed, cancelled, failed, and interrupted work.
- A request being submitted from a request being accepted.
- Reconnecting to an existing run from starting a new linked run.

Support multiple tools and outstanding requests without collapsing everything into one global `isLoading` boolean.

Use explicit capabilities to determine which actions are available:
- Send.
- Stop underlying work.
- Disconnect/reconnect.
- Resume.
- Retry.
- Edit/regenerate.
- Switch branches.
- Respond to or edit an approval.
- Restore checkpoints.
- Use voice features.

Capabilities must reflect actual adapter/application support. Define unavailable-state behavior and explain disabled actions where appropriate.

Provide state-transition tables for the important operations, including invalid transitions and stale responses.

### Cancellation

Disconnecting a client stream and cancelling underlying work are separate operations.

- A removed component releases its own listeners, observers, and subscriptions.
- Shared or application-owned generation continues according to its owner’s policy.
- An explicit stop request identifies the run/attempt it targets.
- Show pending cancellation while awaiting confirmation.
- Handle cancellation failure and completion racing with cancellation.
- Ignore a stale stop response belonging to an older run.
- Preserve partial output.
- Report an unknown remote state honestly when confirmation is unavailable.

### Approvals and mutations

Bind decisions to the approval ID, action/tool ID, run, and proposal revision.

- Changed proposals invalidate stale decisions.
- Repeated activation cannot create duplicate decision requests.
- Approval remains pending until acknowledged.
- Approval does not imply execution succeeded.
- Checkpoint restoration and change application require their own confirmed outcomes.

Keep authorization and execution enforcement in the host application/backend.

## AI-06. Streaming and adapter behavior

Normalize supported incoming streams into the established view/controller contracts. Keep wire-protocol details inside adapters.

Document:
- Supported protocol and version.
- Event ordering and identity guarantees.
- Snapshot and delta semantics.
- Resume/cancel capabilities.
- Unsupported event handling.
- Known information loss during normalization.

Implement:
- Correct text accumulation across arbitrary transport boundaries.
- Streaming UTF-8 decoding where byte streams are consumed.
- Standards-compliant framing when parsing SSE.
- Per-run, per-message, per-part, and per-tool routing.
- Isolation from late events belonging to previous conversations or attempts.
- Explicit terminal and reset/replacement handling.
- Snapshot reconciliation against the correct scope/revision.

Deduplicate only using trustworthy event IDs, offsets, revisions, or protocol guarantees. Repeated text is not evidence of a duplicate event.

When reliable replay identity is unavailable, document the limitation and use supported snapshot/reconciliation behavior.

Do not infer successful completion merely because a network connection closed.

Batch DOM work independently from state ingestion. Preserve all valid content while limiting unnecessary rendering.

Deliver:
1. A deterministic fixture/simulation adapter.
2. An external-store/application integration.
3. At least one real, framework-independent protocol adapter, preferably matching the repository’s existing integrations. Otherwise evaluate the current AI SDK UI-message stream protocol.

The real adapter must have recorded contract fixtures and tests. Live credentials are unnecessary for its fixture-based verification.

Evaluate AG-UI compatibility in a short design note. Treat its draft/optional extensions separately from the supported baseline.

Evaluate A2UI as a possible future consumer of Oddkin’s component catalog. Its declarative UI descriptions and streaming agent-event protocols serve different purposes. Keep full protocol implementations bounded by the agreed scope.

## AI-07. Web Component API contracts

Use properties for structured data, controller references, and renderer hooks. Use attributes for suitable scalar configuration.

- Keep transcripts, attachments, and structured records out of reflected attributes.
- Support properties assigned before custom-element upgrade through Oddkin’s existing mechanism.
- Ensure public properties are discoverable through the runtime mechanisms required by supported frameworks.
- Document replacement/update behavior for arrays and objects.
- Follow existing registration and scoped-registry conventions.

Define typed user-intent events with:
- Exact name.
- Detail type.
- Relevant stable IDs.
- bubbles/composed/cancelable behavior.
- Whether the operation is only requested or already completed.
- How asynchronous acceptance or failure is communicated.

Programmatic state assignment must not echo user-intent events and create feedback loops.

Cancelable DOM events provide synchronous veto behavior. A successful dispatch is not asynchronous application approval.

Verify property and event bindings in plain JavaScript and supported framework fixtures, including React and Vue or an equivalent existing integration matrix.

## AI-08. Input, selection, scrolling, and resource ownership

### Composer/context

- Follow existing native form and validation conventions.
- Document Enter-to-send and multiline behavior.
- Respect IME composition.
- Preserve drafts and attachments through recoverable failures.
- Track draft revisions so accepting an older submission cannot clear newer input.
- Validate attachment constraints for user feedback.
- Distinguish selected, uploading, uploaded, processing, ready, failed, and removed attachments as applicable.
- Revoke only object URLs owned by the component/controller.
- Keep mention, command, and toolbar integrations composable.

### Conversation scrolling

Define an explicit follow-latest policy:
- Following the latest content.
- User reading earlier content.
- Explicit jump to latest.
- Restoring conversation/branch position.

Preserve the visible anchor when history is prepended. Account for late layout changes such as images and fonts.

Avoid fighting native scroll anchoring with duplicate adjustments.

Keep focus and selection stable during ordinary streaming updates. Virtualization must preserve focused/selected content and provide an accessible reading strategy.

### Editing/artifacts/checkpoints

Capture selections against an identifiable content revision.

Define the offset convention for serializable text ranges. Handle stale selections and Unicode correctly.

Apply proposed edits only to the intended revision. Keep acceptance, application, and undo outcomes distinct.

Preserve artifact identity across revisions and let applications supply specialized viewers/editors.

Checkpoint descriptions must explain which state is restored. Display application-confirmed restoration results.

### Voice

Feature-detect capabilities. Make capture and transcription adapters replaceable.

Cover permission denied, unavailable hardware, interruption, interim/final results, and user cancellation.

Release view-owned microphones, audio resources, timers, and listeners. Browser speech recognition must not be the only integration path.

## AI-09. Incremental rendering and content boundaries

Keep canonical source text separate from rendering repairs or presentation transformations.

- Define the supported Markdown dialect.
- Handle incomplete links, formatting, lists, tables, and fenced code.
- Preserve committed DOM where possible.
- Keep copy/export faithful to canonical content.
- Reconcile final output without fabricating source text.
- Allow syntax highlighting and specialized renderers to load independently.

Evaluate appropriate framework-independent parsing/rendering options using fixtures. Keep React-specific renderers outside native component dependencies.

Treat model output, tool output, URLs, filenames, and metadata as untrusted content.

- Use a defined safe rendering and URL policy.
- Keep raw HTML disabled by default or routed through an explicit sanitization policy.
- Cover every incremental insertion path.
- Ensure later highlighting/rendering transformations cannot invalidate sanitization.
- Render code as content.
- Make executable previews an explicit, isolated application integration.
- Route structured UI through registered, validated renderers.
- Render missing citation records as unresolved references instead of inventing sources.
- Display provenance and estimates as supplied information rather than guarantees.

Keep transcript persistence and telemetry application-controlled.

## AI-10. Accessibility and localization

Use existing Oddkin accessibility primitives and the appropriate semantics for each interaction.

Document the conversation’s reading structure. Use ARIA feed/log patterns only where their interaction and announcement contracts are implemented.

Define an announcement policy:
- Meaningful submission, generation, approval, completion, and error updates.
- No per-token announcement stream.
- No duplicate announcements from overlapping live regions.
- No unsolicited focus movement as content arrives.
- User control over verbose announcements where appropriate.

Verify:
- Keyboard access and visible focus.
- Citation previews usable by keyboard and touch.
- Focus preservation and recovery when controls disappear.
- Reduced motion, high contrast, zoom/reflow, and mobile layouts.
- Localization, bidirectional text, and localized status/error messages.
- Labels and relationships across Shadow DOM boundaries.

Automated accessibility checks supplement manual keyboard and screen-reader verification. Record the browser/assistive-technology combinations actually exercised.

## AI-11. Documentation, AI-consumable contracts, and demonstrations

Document every completed public surface:
- Installation/import/registration.
- Properties, methods, events, slots, parts, and tokens.
- Data schemas and ownership.
- States, capabilities, and lifecycle.
- Controlled and controller-backed usage.
- Plain JavaScript and framework examples.
- Supported adapters and application responsibilities.
- Loading, empty, interrupted, denied, stale, failed, and recovery states.

Extend the established metadata pipeline.

Generate standard Custom Elements Manifest data and any additional AI-oriented usage contracts from authoritative sources. Keep schema extensions explicit.

Expose machine-readable:
- Component purpose and selection guidance.
- Typed properties and structured input schemas.
- Event payloads and operation semantics.
- Required capabilities and state preconditions.
- Composition guidance.
- Tested minimal examples.
- Common invalid usages and correction guidance.

Keep examples and metadata consistent with actual exports. Avoid independently maintained component registries that can drift.

Build three complete static-hosting demonstrations:

1. Research assistant:
   Composer, context, streaming, citations, tools, and artifacts.

2. Inline writing assistant:
   Selection, generated proposals, review, stale-content handling, and undo.

3. Agent task panel:
   Plans, parallel tools, approvals, interruption, failure, and checkpoints.

Use deterministic fixtures and simulated transports. Clearly label simulation.

Provide working controls to reproduce significant states and race conditions. Publish examples without live credentials or required backend services.

## AI-12. Acceptance scenarios

Map these scenarios to meaningful automated or manual verification. Extend the list where component-specific contracts require it.

| ID | Scenario and expected outcome |
|---|---|
| A01 | Composition keystrokes and their terminating Enter do not accidentally submit a prompt. |
| A02 | A failed submission preserves recoverable content; acknowledging an older submission preserves newer draft edits. |
| A03 | Arbitrarily split UTF-8/SSE input reconstructs the same content and lifecycle as unsplit input. |
| A04 | Duplicate identified events are handled according to protocol guarantees; legitimate repeated text remains intact. |
| A05 | Switching conversations or attempts isolates late events and pending decisions from the new surface. |
| A06 | Disconnect/reconnect neither reports cancellation nor starts duplicate generation. |
| A07 | Explicit stop remains pending until its outcome is known; completion racing with stop produces a truthful final state. |
| A08 | Finishing tool arguments does not display successful tool execution. |
| A09 | Multiple tools and approvals retain independent identities and states. |
| A10 | Double activation sends one pending approval decision; changed/expired proposals reject stale decisions. |
| A11 | Prepending history preserves the visible anchor; streaming respects manual scrolling away. |
| A12 | Streaming preserves ordinary focus and selection; jump-to-latest explicitly resumes following. |
| A13 | Markdown split across awkward boundaries remains safe and usable; final copy/export matches canonical source. |
| A14 | Adversarial content remains inert through Markdown, URL handling, highlighting, and incremental updates. |
| A15 | Missing citation records, unknown parts, unavailable capabilities, and unknown usage values have explicit fallbacks. |
| A16 | Complex properties and typed events work through Shadow DOM boundaries and tested framework bindings. |
| A17 | Branch switching preserves history; stale edit proposals cannot overwrite newer content. |
| A18 | Repeated mount/disconnect/reconnect leaves no duplicate subscriptions or leaked view-owned resources. |
| A19 | Voice denial/interruption and interim/final transcripts follow the documented capability and cleanup contracts. |
| A20 | A checkpoint displays restoration success only after the application confirms the intended state was restored. |
| A21 | Keyboard/screen-reader flows remain usable without per-token chatter or automatic focus theft. |
| A22 | All three demonstrations run from a production static build and exercise their documented interactions. |

Run existing relevant type checks, builds, linting, browser tests, package tests, and documentation checks.

Add a reproducible performance fixture covering long history and sustained streaming. Record workload, browser, hardware or CI environment, update timings, and relevant memory/DOM measurements.

Use existing performance/bundle budgets. Where absent, establish and document measured budgets before claiming performance improvements.

Verify minimal imports do not pull in unrelated frameworks or optional heavy integrations.

## AI-13. Execution sequence and completion criteria

Implement in coherent vertical slices:

1. Contracts, capability model, controllers, and fixture infrastructure.
2. Foundation components C01–C06.
3. Remaining component/composition scope C07–C20.
4. Real adapter integration and framework verification.
5. Complete demonstrations, generated metadata, documentation, and final regression checks.

For each slice:
- Implement real behavior and its public contract.
- Exercise representative success, unavailable, failure, and recovery states.
- Add appropriate tests and documentation.
- Run focused checks.
- Update the canonical progress record with evidence.
- Continue to the next dependency-ready slice.

Keep progress recoverable across context limits. Record the last completed slice, current failures, and the next concrete action.

Do not remove requirements, weaken assertions, or replace working behavior with placeholders to obtain passing checks.

A pattern is complete when its documented behavior works through its public API, required integration checks pass, and its documentation/metadata agree with the implementation.

Continue through the full scope. Record genuine blockers with their exact dependency and impact.

Finish with:
1. Package and architectural changes.
2. Final component/controller/adapter mapping.
3. Existing primitives reused.
4. Implemented and verified requirements.
5. Test, browser, accessibility, and performance evidence.
6. Remaining blockers and host-application integration responsibilities.

## Primary references

Use the relevant sections of these sources to validate decisions. Record the versions inspected for any protocol or dependency adopted.

- [AI SDK stream protocol](https://ai-sdk.dev/docs/ai-sdk-ui/stream-protocol)
- [AI SDK resumption and cancellation](https://ai-sdk.dev/docs/ai-sdk-ui/chatbot-resume-streams)
- [AI SDK tool usage](https://ai-sdk.dev/docs/ai-sdk-ui/chatbot-tool-usage)
- [AG-UI events](https://docs.ag-ui.com/concepts/events)
- [A2UI](https://a2ui.org/)
- [React custom-element bindings](https://react.dev/reference/react-dom/components#custom-html-elements)
- [Vue and Web Components](https://vuejs.org/guide/extras/web-components.html)
- [Lit event design guidance](https://lit.dev/docs/components/events/)
- [WHATWG server-sent events](https://html.spec.whatwg.org/multipage/server-sent-events.html)
- [W3C status messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html)
- [WAI-ARIA feed pattern](https://www.w3.org/WAI/ARIA/apg/patterns/feed/)
- [DOMPurify documentation](https://github.com/cure53/DOMPurify)
- [Custom Elements Manifest](https://custom-elements-manifest.open-wc.org/analyzer/getting-started/)

Treat external libraries as references and optional integrations. Preserve Oddkin’s native architecture and existing canonical infrastructure.