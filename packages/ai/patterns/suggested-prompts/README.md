# Suggested prompts

**Replaces** `odd-suggestions`, which is deprecated.

## The problem

People facing an empty composer often do not know what they can ask. A few suggested prompts give them a start. Each suggestion fills the composer, so the person can read and change the prompt before sending it; nothing is sent on their behalf.

## Elements and recipes

- `odd-button` (`@oddkin/components`): one small button per suggestion.
- `odd-prompt-input` (`@oddkin/ai`): the composer, just below the group.
- `.odd-cluster` (`@oddkin/components/css/layout.css`): the buttons wrap as space allows.

## Example

[example.html](example.html): the group just above the composer, and five lines that fill the composer and move focus to it. The group stays outside the composer: `focus()` on the composer then reaches its text area, where slotted buttons would take it first. No composition document yet: version 1 of the composition catalog names neither the AI elements nor a labelled group.

## Interaction and accessibility

- The group is a `role="group"` named "Suggested prompts", so a screen reader announces the buttons as one set.
- Each button is named by its visible text, and Tab reaches each in turn.
- Activating a suggestion fills the composer and focuses it, so the person continues typing or presses Enter to send. A suggestion never sends by itself.
- Hide the group (the `hidden` attribute) once the conversation has messages; removing focused content moves focus to the page, so hide it after the composer has focus.

## Responsive behaviour

`.odd-cluster` wraps the buttons onto as many lines as the composer's width needs; labels stay whole words.

## States

- **Empty:** no suggestions, no group: leave it out rather than showing an empty group.
- **Disabled:** while the composer is disabled (`disabled`), set `disabled` on the buttons too.

## When to use it

Use it at the start of a conversation, or after an answer, to offer likely next questions. For a list the person picks from to change a setting, use `odd-select` or `odd-listbox`; for commands, use `odd-menu`.

## Evidence

`packages/ai/test/patterns.browser.test.ts` renders the example and the composition in Chromium, Firefox, and WebKit, and checks the group's name, the buttons' names and order, and that a suggestion fills and focuses the composer without sending.
