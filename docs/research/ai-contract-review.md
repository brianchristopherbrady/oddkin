# AI components: contract review (P1.8, AI-14)

The first part of the owner's contract and design pass of 2026-11-04 ([IMPLEMENTATION_PLAN.md](../../IMPLEMENTATION_PLAN.md) P1.8, [AI-14](../AI_COMPONENTS_IMPLEMENTATION_PLAN.md#ai-14-contracts-design-fidelity-and-the-oddkin-design-framework)). For each `@oddkin/ai` element, from a user's view: what it is for, whether its API (attributes, properties, slots, events, states) and its examples make that clear, and whether it does what its reference says. Agent 3 writes the findings; Agent 2, whose package it is, decides each change. An element whose contract changes is styled after the change.

Each finding is one of:

- **Fix**: the element does not do what its reference says. No API change.
- **Examples**: the API is right, but the examples or the reference do not show it. No API change.
- **Decide**: a change to the contract (behaviour, records, attributes, properties, parts, strings, or events), for Agent 2.

## Across the elements (2026-11-04)

What a reader sees: each AI element's reference page, in Chromium at 1280 px, its first example (`.tmp/ai-element-shots.mjs`, not kept).

| # | Kind | Finding | Proposal |
| --- | --- | --- | --- |
| C1 | Examples | No example of any AI element has a `fixture`, so nothing plays the host. Seventeen of the 24 elements only ask the host to act (events), so on their reference pages and in Workbench these controls show nothing happening, or a pending state that never ends: `odd-action-approval` (Approve, Reject), `odd-activity` (Stop, Resume, Retry), `odd-change-review` (Accept, Reject, Undo), `odd-checkpoint` (Restore), `odd-citation` (Show in sources), `odd-context-picker` (Add files, Add link, Remove), `odd-conversation` (Load earlier messages, Try again), `odd-inline-assist` (Rewrite, Explain, Summarize), `odd-message` (edit, regenerate), `odd-message-branch` (‹ ›), `odd-prompt-input` (Send), `odd-question` (Answer, Skip), `odd-response-feedback` (Send feedback), `odd-suggestions` (each suggestion and its ↑), `odd-task-plan` (Respond), `odd-tool-call` (Retry), and `odd-voice-input` (Start voice input: the example's scripted adapter has an empty script, so it hears nothing). The others act on their own (`odd-artifact`'s revisions, preview, copy, and download; `odd-model-select`'s choice; `odd-transcript`'s edits) or only show (`odd-ai-label`, `odd-response`, `odd-sources`, `odd-usage-meter`). | One example per element whose fixture plays the host with the package's own pieces, so the reader sees the request, the record change, and the new state: `DocumentSession` (change review, inline assist), `ConversationController` with the simulated transport (conversation, message, branch, activity, prompt input, suggestions, feedback), `createScriptedVoiceAdapter` with a script (voice input), and a few lines that replace the record for the rest (approval, checkpoint, question, tool call, task plan, context picker, citation). |
| C2 | Examples | `odd-conversation`'s first example puts the text "Composer goes here" in its `composer` slot. | An `odd-prompt-input` there, wired to the same host (C1). |
| C3 | Examples | Each item in `odd-context-picker`'s example has an inspect button (▾) that opens "No preview available." | One item with a preview, so the control shows what it is for. |

The glyph-only buttons (`odd-suggestions`' ↑, `odd-context-picker`'s ▾ and ✕) have accessible names ("Send {label}", "Inspect …", "Remove …"); what they show belongs to the design pass.

## `odd-change-review` (2026-11-04)

**What a user sees today.** The reference page's only example, in Chromium at 1280 px: a card titled "Make it specific", the line "~~The~~Builds ~~build~~take ~~is~~40% ~~very~~less ~~slow.~~time.", the word "Proposed", and Accept and Reject. Accept sends `odd-change-accept` and nothing changes, because the example has no host to apply the change. A screen reader hears "[deleted: The][inserted: Builds] [deleted: build][inserted: take]…".

**What it is for**, as the reference could say it: the edits an assistant proposes to a text the user owns, one by one: what each would change, and Accept, Reject, or, once applied, Undo. The element applies nothing. It asks (events), the host applies the edit to its document and passes back the updated proposals, and the element shows each proposal's status. `DocumentSession` is such a host for plain text.

| # | Kind | Finding | Proposal |
| --- | --- | --- | --- |
| 1 | Examples | The only example is static, so Accept and Reject look broken. | A `fixture` that wires a `DocumentSession`: the document's text above the review; Accept applies the edit and offers Undo, Reject marks the proposal rejected, and editing the text marks a pending proposal out of date. Static examples for each state a host shows: applied (with Undo), rejected, out of date, failed, applying, and the split view. |
| 2 | Decide | When most of a sentence changes, the inline diff alternates deleted and inserted words, which neither eyes nor screen readers can follow. | Group a run of changes that only spaces separate into one deletion followed by one insertion ("~~The build is very slow.~~ Builds take 40% less time."), as diff tools' semantic clean-up does: in the rendering, or in `diffWords` itself, which `@oddkin/ai/controllers` exports. The example then shows a small edit inline and a rewrite in the split view. |
| 3 | Decide | A proposal shows only the old and the new text, so with several proposals the user cannot tell where each one applies. | An optional `context` on `EditProposal` (`{ before, after }`: a few words on each side of the range), shown muted around the diff, which `DocumentSession.propose` fills from the document. Smaller: the reference asks hosts to say where in `label`. |
| 4 | Decide | Undo is offered on every applied proposal, but `DocumentSession.undo` only undoes the most recent change, and only while nothing changed since; Undo anywhere else does nothing, silently. | An `undoable` flag on the record, which the session sets on the proposal it can undo, and Undo only there. Or the session reports the refusal (`failed`, with a message) and the review shows it. |
| 5 | Decide | "Proposed" is printed under every pending proposal, beside its own Accept and Reject. | No status text for `proposed`; the other statuses keep theirs. |
| 6 | Decide | An out-of-date proposal offers "Reject", which reads like a judgement of its content; it can no longer apply, so the action only removes it. | "Dismiss" for an out-of-date proposal (a `dismiss` string), still sending `odd-change-reject`. |
| 7 | Fix | The reference says "Each proposal is a labelled group"; each proposal is a list item without a group role or a name. | `role="group"` on each proposal, named by its `label`, or "Change {n}" without one. |
| 8 | Examples | `accept-pending` and `undo-pending` exist for hosts that apply asynchronously; `DocumentSession` is synchronous and never sets them, and the reference does not say who does. | The reference says that an asynchronous host sets them while it applies, and an example shows "Applying…". |
| 9 | Decide | Only the list, each proposal, and the diff have parts; the label, the status, and the actions have none, so a library cannot restyle them (customization level 2). | Parts `label`, `status`, and `actions`. |

Not changed by this review: the element's name, `view` (`inline` or `split`), `granularity` (`words` or `lines`), `announce`, the events and their detail (`{ proposalId }`), the empty state, and the `<del>` and `<ins>` with their hidden words. The design pass for this element waits for the decisions on 2 to 6 and 9.
