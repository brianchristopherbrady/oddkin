# Branch navigation

**Replaces** the public `odd-message-branch`: `odd-message` now draws its versions itself (ADR 0049).

## The problem

When a person regenerates or edits a message, the conversation keeps every version. A host that lays out its own messages needs a way to move between those versions that says where the reader is: "Version 2 of 3", with previous and next.

## Elements and recipes

- `odd-button` (`@oddkin/components`): previous and next, small and ghost, named by their `label`.
- `.odd-row` (`@oddkin/components/css/layout.css`): the buttons and the position on one line.
- The `branch` record of `@oddkin/ai/contracts` (`BranchPosition`: `index`, `count`, `previousId`, `nextId`).

## Example

[example.html](example.html): a labelled group with the two buttons and the position text, and a function that draws it from a `branch` record and asks the host to switch. No composition document yet: version 1 of the composition catalog cannot name the group.

## Interaction and accessibility

- The group is a `role="group"` named "Versions"; the buttons are named "Previous version" and "Next version", since their arrows are not words.
- The position is plain text, not a live region: the person moved it, so announcing it again would repeat what they just did. The new version's content is the result.
- At the first and last version the matching button is `disabled`, so it leaves the Tab order.
- The host switches versions: the example sends `odd-branch-switch`, the event `odd-message` sends, so the same handler serves both.

## Responsive behaviour

The row is short and stays on one line; in a narrow message footer it wraps with the other actions.

## States

- **One version:** hide the group (`count` below 2).
- **Disabled:** while a response streams, disable both buttons.

## When to use it

Use it when you lay out a message yourself. Inside `odd-message`, the message draws the same control from its `branch` record.

## Evidence

`packages/ai/test/patterns.browser.test.ts` checks, in Chromium, Firefox, and WebKit, the group's and the buttons' names, the position text, the disabled ends, and the `odd-branch-switch` request.
