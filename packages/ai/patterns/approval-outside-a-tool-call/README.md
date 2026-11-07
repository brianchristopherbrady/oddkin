# Approval outside a tool call

## The problem

Not every consequential action is a tool call: the application may be about to send an email, delete files, or spend money on the assistant's suggestion. Each needs the person's decision first, with what will happen spelled out, and the decision must apply to exactly what they saw.

## Elements and recipes

- `odd-action-approval` (`@oddkin/ai`): the action's title, summary, target, changes, and risk, with Approve and Reject (and Edit when the host allows it), bound to the approval's `revision`.

Inside `odd-tool-call` the same element appears for tool calls that need approval; use the pattern for anything else.

## Example

[example.html](example.html): an approval record shown on its own, an announcer for its surface, and the host's handler, which applies a decision only to the revision it was made on and moves the record to `approved` or `rejected`. No composition document yet: version 1 of the composition catalog does not name the AI elements.

## Interaction and accessibility

- The approval is a labelled group; the changes are a list whose values carry visually hidden "Before" and "After" labels.
- Approve and Reject are native buttons; while the host decides they are disabled, the status says why, and a second click asks nothing.
- When the outcome arrives the buttons go and focus moves to the outcome text, never to the page.
- With `announce="important"` the element sends its outcome as `odd-announce`; outside a conversation, `createAnnouncer(container)` from `@oddkin/ai/announce` gives the surface its one polite and one assertive live region.

## Responsive behaviour

The summary and the changes wrap; the actions wrap below them on narrow screens.

## States

- **Requested:** the actions are available.
- **Pending:** after a decision, until the host answers.
- **Approved, rejected, expired, superseded:** the outcome in words, no actions.
- **Revised:** a new `revision` resets the decision; one made on the old revision is ignored.

## When to use it

Use it before any action with consequences outside the conversation. For a question with answers to choose from, use `odd-question`; for an edit to accept or reject, use `odd-change-review`.

## Evidence

`packages/ai/test/patterns.browser.test.ts` checks, in Chromium, Firefox, and WebKit, the group's name, that Approve sends one decision bound to the revision, and that the outcome replaces the actions and takes focus.
