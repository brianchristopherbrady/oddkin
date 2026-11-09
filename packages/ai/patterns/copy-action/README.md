# Copy action

## The problem

People copy what an assistant wrote: an answer, a command, a snippet. The copy must be the canonical text, not what the page happens to show, and the person must learn whether it worked, also when the browser refuses.

## Elements and recipes

- `odd-copy-button` (`@oddkin/components`): copies `value`, or the text of the element named by `from`, and says the outcome.

## Example

[example.html](example.html): a copy button for an answer's canonical Markdown (`value`, set from the record), and one for a command shown on the page (`from`). [composition.json](composition.json): the second as data.

## Interaction and accessibility

- The button is named by its text ("Copy", or its `label`), and Enter or Space copies.
- The outcome is announced, and shown without moving anything on the page: "Copied to clipboard." in a small popover by the button, or, when the browser refuses, "Could not copy. Select the text." beside it, with the text selected for a manual copy.
- Copy the record's text, never the rendered DOM: Markdown repairs and citation markers are presentation.

## Responsive behaviour

The button and its outcome sit on one line and wrap with the actions around them.

## States

- **Disabled:** `disabled` while there is nothing final to copy, such as during streaming.
- **Failed:** the button says so and selects the text; nothing else is needed from the host.

## When to use it

Use it wherever an output can be reused elsewhere. `odd-response` (`copyable`) and `odd-message` offer copy of their own text; use the pattern for other outputs, such as an artifact's command or a tool's result.

## Evidence

`packages/ai/test/patterns.browser.test.ts` checks, in Chromium, Firefox, and WebKit, the buttons' names, that each copies its canonical text (with a stubbed clipboard), and that the composition renders the same button as the markup.
