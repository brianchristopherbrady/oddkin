# Context for a request

## The problem

A person adds documents, pages, or records from the sources the application has connected, so the next request uses them. They need to find each resource quickly, see what is attached before sending, remove one without reopening anything, and still read the list when many are attached. The application owns the sources, the search, and what is attached; nothing may attach itself.

## Elements and recipes

- `odd-context-picker` (`@oddkin/ai`): the Add context button and its surface, which searches the host's sources, browses them, and proposes each change (`odd-context-change`, applied unless the host cancels it).
- `odd-chip` (`@oddkin/components`): one removable chip per attached resource, outside the picker, as Figma's C07 design composes them (`SelectedChip`, `SelectedOverflow`).
- `.odd-button` (`@oddkin/components/css/button.css`): a native ghost button, "+N more" or "Show fewer", when more than three are attached.
- `.odd-cluster` (`@oddkin/components/css/layout.css`): the chips and the picker wrap together.

## Example

[example.html](example.html): the composer's context row. The host answers each `odd-context-query` from its library (a request it has replaced is dropped: its `signal` is aborted), draws a chip for each resource the picker's change will apply, and removes one when its chip's button is pressed, by setting the picker's `value`. Past three chips the row collapses behind "+N more", which expands to every chip.

## Interaction and accessibility

- Add context opens a non-modal dialog with the search focused; Down Arrow moves into the results, Space or Enter chooses, Escape or Done closes and returns focus to the button. Focus never chooses.
- Each chip is named by its resource, and its button "Remove {label}" removes it; after a removal, focus moves to the chips' group ("Context for the request"), from which Tab reaches the next chip.
- "+N more" says how many chips it hides and is a disclosure (`aria-expanded`) for the rest of them; the chips it shows keep their order.
- Announcements come from the picker ("Launch brief, document, Drive, selected. 2 selected."); the host announces only what it changes itself.

## Responsive behaviour

The chips and the picker's button wrap onto more lines as the row narrows; the picker's surface stays beside its button, within the room its placement leaves. Resizing changes neither what is attached, nor an open surface, nor the focus.

## States

- **Nothing attached:** no chips; Add context alone.
- **Many attached:** three chips and "+N more"; expanded, every chip and "Show fewer".
- **A resource that became unavailable:** its chip stays, and its row in the picker says why (`unavailable`); the person removes or replaces it.
- **Refused:** a host that cancels `odd-context-change` (for example, over a limit it enforces) leaves the value and the chips as they were.

## When to use it

Use it in a composer that sends context with a request. For files from the person's device, use the prompt input's attachments; for showing what an answer used, use `odd-sources`.

## Evidence

`packages/ai/test/patterns.browser.test.ts` checks, in Chromium, Firefox, and WebKit, that choosing in the picker adds a chip, that a chip's button removes its resource from the picker and moves the focus to the chips' group, that the fourth resource collapses the row behind "+1 more", which expands and collapses, and that the controls are named.
