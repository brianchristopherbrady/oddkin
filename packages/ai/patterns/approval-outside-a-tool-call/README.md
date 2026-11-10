# Approval outside a tool call

## The problem

Not every consequential action is a tool call: the application may be about to send an email, delete files, or spend money on the assistant's suggestion. Each needs the person's decision first, with what will happen spelled out, and the decision must apply to exactly what they saw. When the host can let one decision cover more than this action, the person chooses how far it goes, and the outcome says what the host accepted.

## Elements and recipes

- `odd-action-approval` (`@oddkin/ai`): the action's title, summary, and target; its risk and expiry as badges; its changes, each a Before block over an After block; what the approval covers (the scopes the host offers); an optional reason; and Approve and Reject (and Edit when the host allows it), all bound to the approval's `revision`.

Inside `odd-tool-call` the same element appears for tool calls that need approval; use the pattern for anything else.

## Example

[example.html](example.html): an approval record with two scopes, the narrower one chosen by the host (`defaultScopeId`), shown on its own with an announcer for its surface, and the host's handler, which applies a decision only to the revision it was made on and moves the record to `approved` or `rejected` with the scope it accepted and the person's reason. No composition document yet: version 1 of the composition catalog does not name the AI elements.

## Interaction and accessibility

- The approval is a group named by its title. The changes are a group named "Proposed changes": each change's label over its Before and After blocks, whose deleted and inserted text carries visually hidden "deleted" and "inserted" labels; a change of more than ten lines waits behind a disclosure that says how many lines changed.
- Two to four scopes are native radio buttons in a fieldset whose legend says what they choose; more are a native select with the chosen scope's description below it. Nothing is chosen because it comes first, and Approve stays disabled until a scope is chosen; a host default is chosen and says so.
- The reason is a native textarea in a disclosure: collapsed while empty, open once written.
- Tab goes through a long change, the scope (arrow keys choose), and the reason to Approve, Reject, and Edit. Enter or Space activates the focused control; Enter in the reason adds a line, and no shortcut approves.
- Approve and Reject are `odd-button`s; while the host decides, the chosen one shows it is loading, the others are disabled, the pending line says why, and a second activation asks nothing.
- When the outcome arrives the buttons go, and focus moves to the outcome text if it was on one of them, never elsewhere.
- With `announce="important"` the element sends its outcome as `odd-announce`; outside a conversation, `createAnnouncer(container)` from `@oddkin/ai/announce` gives the surface its one polite and one assertive live region.

## Responsive behaviour

The approval's container sets its width and density: 640 px wide by default and 720 px at most, the rest of the space its parent's. Below 480 px it sits 16 px in, its controls are 48 px tall, and its buttons stack. Text wraps; the parent scrolls.

## States

- **Requested:** the scope, the reason, and the actions are available.
- **Submitting:** after a decision, until the host answers; a record restored while submitting shows the pending line with nothing to press.
- **Failed:** the error above the actions, with the scope and the reason kept for another try.
- **Approved:** the outcome, what the host says the approval covers ("Approved scope: Release emails today", or "Scope details were not supplied." when the record names none), and the reason.
- **Rejected:** the outcome and the reason; a rejection covers nothing.
- **Expired, superseded, cancelled:** the outcome in words, no actions.
- **Revised:** a new `revision` resets the decision, the scope, and the reason; one made on the old revision is ignored.

## When to use it

Use it before any action with consequences outside the conversation. For a question with answers to choose from, use `odd-question`; for an edit to accept or reject, use `odd-change-review`.

## Evidence

`packages/ai/test/patterns.browser.test.ts` checks, in Chromium, Firefox, and WebKit, the group's name, the host's default scope, that choosing another scope and approving sends one decision bound to the revision with that scope, and that the outcome replaces the actions, takes focus, and says what the host accepted.
