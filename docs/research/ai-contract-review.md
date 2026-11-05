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

**C1, first batch (2026-11-05).** The elements whose host only replaces a record. `odd-action-approval` records a decision made on the approval's current revision, with its reason; `odd-checkpoint` comes back restored, with its outcome, after the confirmed request; `odd-question` records the answer or the skip for its current revision; `odd-task-plan`'s Respond asks the step's question with an `odd-question` and moves focus to it, and the answer completes the step and unblocks the next; `odd-tool-call`'s failed example comes back with a result after Retry. The fixtures keep Agent 2's rules: listeners belong to the scope, outputs are fixed, nothing uses the network. Theme Studio used to leave out examples with a fixture, which would have cost `odd-action-approval` and `odd-task-plan` their screens; since Agent 2's `a55a52c` it shows a component whose examples all have one by their published values. A reference page's interactive example is its default example, so the tool call's Retry runs in Workbench (its Failed, retryable preset) and in the tests.

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

**Decisions and changes.** Agent 2 accepted all nine, with these choices. (2) In the rendering, for the word diff only: `diffWords` stays the exact word diff `@oddkin/ai/controllers` exports. (3) `DocumentSession.propose` fills `context` with the text on the range's lines, up to about 40 characters on each side, cut at a word boundary with an ellipsis; a host may give its own or none, and `label` still says what the edit is for. The review shows it muted in both views. (4) `undoable` is optional: `false` hides Undo, and absent offers it, as in beta.1. `DocumentSession` sets it on every applied proposal, `true` only on the change it can undo, and updates it as the document changes. (5) `strings.proposed` stays in the type, unused and deprecated, until the next major release. (7) Without a label, the group is named by the start of its new text (its old text for a deletion), which says which change it is better than "Change n". 1, 7, and 8 were made first (no API change); 2 to 6 and 9 after them. Agent 2's read of both (2026-11-05) asked for two fixes, made before they landed: a range that ends with its line break (a whole line of code) takes no context from the next line, and the name from the new text stops short of 60 characters rather than split a surrogate pair.

## `odd-action-approval` (2026-11-05)

**What a user sees today.** The reference page's interactive example, in Chromium at 1280 px: "Send email", its summary, "Affects: team@example.com", "Risk: medium", the change "Subject ~~Draft~~ Release 2.0", "Waiting for your decision", a "Reason (optional)" field, and Approve and Reject. Since C1's first batch the example's host records the decision, and the element shows "Approved. The action runs separately; its result appears with the action." or "Rejected. The action will not run."

**What it is for**, as the reference could say it: asking the user to allow one action an agent proposes (a tool call, a write, a purchase): what it does, what it affects, what it changes, how risky it is, and a decision with an optional reason. The element collects intent only. The host records the decision against the proposal's revision and runs the action or not; approving never means the action succeeded.

| # | Kind | Finding | Proposal |
| --- | --- | --- | --- |
| 1 | Decide | "Reason (optional)" sits above both buttons, but only Reject sends it (`reason` is `undefined` for Approve): a reason typed before Approve is dropped without a word. | Say what it is for: "Reason for rejecting (optional)" (`strings.reason`). Or send the reason with either decision. |
| 2 | Examples | Only `requested` has an example. `decision-failed` (the error, then the actions again), `expired`, and `superseded` are states a host sets, and Edit (`editApproval`, `odd-approval-edit`) is in no example, so a reader cannot tell what Edit leads to. | Examples for a failed decision, an expired request, and a superseded one; one with Edit, whose host passes back the next revision. |
| 3 | Examples | The reference does not say that `odd-tool-call` shows the approval bound to a call (its `approval` property), or what the host does with `toolCallId`. | Say it, and show it in the tool call's example (`odd-tool-call` 2). |

Not changed by this review: the events and their detail, the statuses, `capabilities`, `announce`, and the duplicate guard per revision. For the design pass: the Figma specimen shows the change's before and after on their own lines, labelled, in a shaded box, and a one-line reason field.

**Decisions and changes** (Agent 2, 2026-11-05). 1: the reason goes with either decision, and the label stays. 2 and 3: examples for a failed decision, an expired request, a superseded one, and Edit, whose host passes back the next revision; the tool call's Waiting for approval example shows the approval inside a call.

## `odd-checkpoint` (2026-11-05)

**What a user sees today.** "Before the rewrite", its description, "Restoring replaces:" with Document text and Open proposals, the status "Available", and Restore…. Restore… asks "Restore to “Before the rewrite”? The items listed above are replaced. Work after this point is not kept unless the application saves it." with Restore this checkpoint and Keep current state. Since C1, the example's host confirms, and the element shows "Restored. Restored the document to 09:30."

**What it is for.** A restore point: what restoring replaces, an explicit confirmation, and the outcome the application confirms; it shows success only when the record says `restored`.

| # | Kind | Finding | Proposal |
| --- | --- | --- | --- |
| 1 | Decide | "Available" is printed under every checkpoint that can be restored, as "Proposed" was in the change review: it says nothing that Restore… does not. | No status text for `available`; `strings.available` stays, unused, as `strings.proposed` did. |
| 2 | Examples | Both examples spread a shared constant, so the analyzer records no values for them: the metadata, the agent kits, and Theme Studio have none for this element. | Literal values in both examples. |
| 3 | Examples | `restore-failed` and `unavailable` have no example, and `createdAt` ("Created {time}") is in none. | A failed restore (its error, and Restore… again) and an unavailable checkpoint; `createdAt` in one. |

Not changed by this review: the confirmation step, the events, the statuses, and focus moving to the confirmation and back.

**Decisions and changes** (Agent 2, 2026-11-05). 1: no status text while a checkpoint can be restored; `strings.available` stays, unused and deprecated, and when no status shows, focus goes back to Restore…. 2: both examples have literal values, so the metadata carries them. 3: examples for a failed restore and an unavailable checkpoint, the latter with `createdAt`.

## `odd-question` (2026-11-05)

**What a user sees today.** "Which audience is this summary for?", the choices Executives, Engineers ("Keeps technical detail."), and Other, an unlabelled text field, and Answer and Skip. Since C1, the example's host records the answer or the skip, and the element shows "Answered." or "Skipped."

**What it is for.** A question an assistant asks before it continues: one choice, several, a short form, or free text, with an answer of the user's own when the host allows it. Each answer is bound to the question's revision.

| # | Kind | Finding | Proposal |
| --- | --- | --- | --- |
| 1 | Fix | With `allowCustom`, the text field shows below Other whether Other is chosen or not, and its label ("Your answer") is only for screen readers. A user who picks Engineers and types in the field sends `{ choice: 'eng' }`: what they typed is dropped. | Typing in the field chooses Other, and the field has a visible label; or the field shows only while Other is chosen. |
| 2 | Examples | `multi-choice` and `text` have no example, nor do `expired` and `failed`, which a host sets. | Examples for both kinds and for a failed answer (its message, and Answer again). |

Not changed by this review: the kinds, the answer shapes (`{ choice }`, `{ choices }`, `{ custom }`, `{ text }`, `{ fields }`), the events, and the revision binding. For the design pass: the Figma specimen's primary action reads "Submit".

**Decisions and changes** (Agent 2, 2026-11-05). 1: the field's label ("Your answer") shows, and typing in the field chooses Other, so what was typed is sent. 2: examples for several choices, free text, and an answer that was not sent.

## `odd-task-plan` (2026-11-05)

**What a user sees today.** "Prepare the release", a progress bar with "1 of 4 steps done", then each step with a symbol, its title, and its status below it: Collect changes, Done; Run checks, In progress, "Running in parallel" with Unit tests (Done) and Browser tests (In progress); Choose a version, Needs input, "Needs your input: Major or minor?" and Respond; Publish, "Blocked: Waiting for the version." Since C1, Respond shows the step's question, and the answer completes the step.

**What it is for.** An agent's plan as it runs: ordered steps, work running in parallel within a step, what blocks a step, and what the agent needs from the user.

| # | Kind | Finding | Proposal |
| --- | --- | --- | --- |
| 1 | Decide | A step that needs input says so twice: its status "Needs input", then "Needs your input: Major or minor?" with Respond. | The request with Respond only; the status text stays for a step without an `inputRequest`. |
| 2 | Examples | `failed` and `skipped` are in no example. | A plan with a failed step and the steps after it. |

Not changed by this review: the record, the event, progress (done and skipped steps of all steps), and the status read after each title. For the design pass: the Figma specimen has no progress bar ("1 of 2 complete"), and each step's status sits at the end of its row.

**Decisions and changes** (Agent 2, 2026-11-05). 1: a step that asks for input shows its request with Respond only. 2: a plan with a failed step, a skipped one, and a pending one.

## `odd-tool-call` (2026-11-05)

**What a user sees today.** "Web search", the status "Finished", and "Find current browser support data." The arguments and the result are in a native disclosure, but its summary shows no marker, so nothing says they are there; activating the summary opens Arguments and Result, each as formatted JSON.

**What it is for.** One call an agent makes to a tool: its name and purpose, its arguments as they stream and once complete, where it stands (preparing, ready, awaiting approval, running, finished, failed, denied, cancelled), its result or error, and Retry when the host supports it. Complete arguments never read as success.

| # | Kind | Finding | Proposal |
| --- | --- | --- | --- |
| 1 | Fix | The summary has no disclosure marker (`display: flex` on `summary` removes it), so the arguments and the result are hidden with nothing showing they exist. The Figma specimen has one. | A visible marker that turns with the open state. |
| 2 | Examples | `awaiting-approval` with its bound `approval` (an `odd-action-approval` inside the call) has no example, though it is where approval and tool call meet; nor do `input-streaming`, `executing`, `denied`, and `cancelled`. | An example of a call awaiting approval whose host moves it to running and finished on Approve, or to denied on Reject; and the other states. |

Not changed by this review: the statuses, the event, `renderOutput`, and results rendered as text unless a host renders them.

**Decisions and changes** (Agent 2, 2026-11-05). 1: the summary shows ▸, and ▾ once open; the marker's alternative text is empty, so a screen reader does not read it before the tool's name (Agent 2's review). 2: examples for a call waiting for its approval, whose host runs it on Approve (Running…, then Finished) and denies it on Reject; arguments as they stream; and a cancelled call.

## The elements that act on their own or only show (2026-11-05)

`odd-ai-label`, `odd-artifact`, `odd-model-select`, `odd-response`, `odd-sources`, `odd-transcript`, and `odd-usage-meter`: none needs a host to see what it does (C1), so each was read from its reference page's interactive example and its Figma specimen.

### `odd-ai-label`

**What a user sees.** A small pill, "✦ AI generated". Activating it opens the origin details the example supplies and "Information supplied by the application; not independently verified."

**What it is for.** Marking content as generated or assisted by AI, or edited or written by a person, with the origin details the application supplies; it never asserts accuracy.

| # | Kind | Finding | Proposal |
| --- | --- | --- | --- |
| 1 | Fix | The ✦ stands where the disclosure marker would, so nothing shows that the label opens. The Figma specimen has ▸. | The disclosure marker, turning with the open state. |
| 2 | Examples | `assisted` and `human` have no example. | One each, beside generated and edited. |

### `odd-artifact`

**What a user sees.** "Release notes", the revision picker ("Revision 2 of 2 (latest)"), Preview (pressed) and Source, Copy and Download, the revision's summary "Added highlights", then the rendered document.

**What it is for.** An output the user keeps: its revisions, a preview and the source, copy and download of the canonical content, and export formats the host produces.

| # | Kind | Finding | Proposal |
| --- | --- | --- | --- |
| 1 | Examples | `exports` (formats the host produces, requested with `odd-artifact-export`) is in no example, so a reader cannot tell what an export adds to Download. It is the one request-only control C1 did not list. | An example with one export format whose host answers the request. |
| 2 | Decide | The revision's summary ("Added highlights") shows without saying what it is. | Say it ("Revision 2: Added highlights"), or show it with the picker. |

### `odd-model-select`

**What a user sees.** "Model", a native select with Fast, Thorough, and "Vision (unavailable)" disabled, and the selected model's description, "Quick answers for short tasks."

**What it is for.** Choosing the model for the next request among those the application offers, with what each can do and why one is unavailable.

| # | Kind | Finding | Proposal |
| --- | --- | --- | --- |
| 1 | Decide | An unavailable model's reason ("Not enabled for this workspace.") shows only in the selected model's details, and a disabled option cannot be selected, so the user never sees why. | The reason in the option's text, or under the select for each unavailable model. |

### `odd-response`

**What a user sees.** "Container queries respond to the **component**, not the viewport", a citation [1], a code block with Copy code, and Copy response.

**What it is for.** Assistant output that may stream, rendered from Markdown that stays inert; copy uses the source text.

| # | Kind | Finding | Proposal |
| --- | --- | --- | --- |
| 1 | Examples | `interrupted` (the stream ended early) and `cancelled` (the user stopped it), which a host sets, have no example. | One each, with the partial text they keep. |

### `odd-sources`

**What a user sees.** "Sources", then each source: a linked title with its host ("W3C"), or a title alone with an excerpt.

**What it is for.** The list a response's citations point to, in citation order.

| # | Kind | Finding | Proposal |
| --- | --- | --- | --- |
| 1 | Fix | The entries are numbered for screen readers only: a citation shows [1], but no entry shows 1, so a reader cannot match the two. The Figma specimen numbers them ("1."). | Visible numbers. |

### `odd-transcript`

**What a user sees.** Two final segments, then the interim text in italics, "Hearing: and add the".

**What it is for.** Speech-to-text as it arrives: final segments, which the user may correct, and interim text that may still change.

| # | Kind | Finding | Proposal |
| --- | --- | --- | --- |
| 1 | Decide | "Hearing:" before the interim text; the Figma specimen says "Listening:", which says what is going on. | `strings.listening` "Listening". |
| 2 | Examples | `editable` (correcting a final segment, `odd-transcript-change`) has no example. | An editable transcript whose host keeps each correction. |

### `odd-usage-meter`

**What a user sees.** Context window, "48,000 tokens of 128,000 tokens (measured)" with a meter; Output, "1,200 tokens (estimated)"; Cost, "Unknown".

**What it is for.** Usage figures exactly as the host supplies them, each marked measured, estimated, or unknown; it never computes one.

No contract finding. For the design pass: the Figma specimen puts each value at the end of its row ("240 / 1,000", "Estimated: 120") and has no meter; which wording stays is the design pass's question.
