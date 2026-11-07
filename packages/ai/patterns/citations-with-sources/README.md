# Citations with sources

## The problem

An answer that rests on sources should say which claim comes from where, and let the reader check. Numbered markers in the text, and the numbered list they lead to, do both without leaving the conversation.

## Elements and recipes

- `odd-response` (`@oddkin/ai`): renders `[^sourceId]` in its Markdown as an `odd-citation` resolved against its `sources`.
- `odd-citation` (`@oddkin/ai`): the marker; it opens a preview after itself and offers "Show in sources".
- `odd-sources` (`@oddkin/ai`): the numbered list, with `reveal(sourceId)`.

`odd-message` connects the three itself; use the pattern when you place a response and its sources yourself.

## Example

[example.html](example.html): a response citing two sources, the list below it, and one listener that reveals a source when a citation asks to. No composition document yet: version 1 of the composition catalog does not name the AI elements.

## Interaction and accessibility

- Each marker is a button named after its source ("Source 1: Annual report"), with `aria-expanded` for its preview; Escape closes the preview and returns focus to the marker.
- The preview is ordinary content after the marker, not a popup, so screen reader and touch users reach it in reading order.
- "Show in sources" sends `odd-source-reveal`; the listener calls `reveal()`, which scrolls the list item into view, highlights it, and focuses it.
- Source links are checked by the URL policy; unsafe ones render as text.

## Responsive behaviour

Markers flow with the text as superscripts; the preview wraps to the response's width; the list's titles wrap.

## States

- **Unresolved:** a marker whose source is not listed shows its key and is named "Unresolved source reference" with it.
- **Streaming:** markers appear as their text arrives; the list can update at any time.

## When to use it

Use it for answers grounded in documents or search results. For a reading list without claims in the text, use `odd-sources` alone.

## Evidence

`packages/ai/test/patterns.browser.test.ts` checks, in Chromium, Firefox, and WebKit, the markers' names and numbers, that the preview opens and Escape returns focus, and that "Show in sources" reveals and focuses the list item.
