# Chat layout

## The problem

A conversation often needs a second surface beside it: the sources behind an answer, or the artifact being written. On a wide screen the two sit side by side and the reader adjusts the split; on a narrow one they stack, the conversation first.

## Elements and recipes

- `odd-conversation` (`@oddkin/ai`) with `odd-prompt-input` in its `composer` slot.
- `odd-split-panel` (`@oddkin/components`): two panes and a separator the reader drags or moves with the arrow keys.
- Or, without resizing, `.odd-split` (`@oddkin/components/css/layout.css`): side by side, stacking below its threshold.
- `odd-sources` or `odd-artifact` (`@oddkin/ai`) in the side pane.

## Example

[example.html](example.html): a split panel with the conversation in its `start` pane and the sources in its `end` pane, stacked by a container query on narrow screens. No composition document yet: version 1 of the composition catalog does not name the AI elements.

## Interaction and accessibility

- The separator is a focusable `separator` named "Resize conversation"; the arrow keys move it, Home and End go to the limits, and Enter collapses the conversation pane or restores it.
- Reading order follows the panes: the conversation, its composer, then the side pane.
- The side pane is a labelled region (`aria-label`), so landmarks list it.

## Responsive behaviour

Below 48rem of the layout's own width the panes stack (`orientation="vertical"`), the conversation on top; above it they sit side by side. The example switches `orientation` from a `ResizeObserver` on the layout, so the split follows its container, not the window.

## States

- **No side content:** leave the split out and show the conversation alone.
- **Loading:** the side pane shows its element's own loading state.

## When to use it

Use it for a conversation with sources, artifacts, or a plan beside it. For a conversation alone, place `odd-conversation` directly; for a side panel that overlays the page, use `odd-drawer`.

## Evidence

`packages/ai/test/patterns.browser.test.ts` checks, in Chromium, Firefox, and WebKit, the panes' order, the separator's name and keyboard resizing, the side pane's region name, and the stacked orientation at a narrow width.
