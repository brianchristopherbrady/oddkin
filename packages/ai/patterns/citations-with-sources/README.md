# Citations with sources

## The problem

An answer that rests on sources should say which claim comes from where, and let the reader check. Numbered markers in the text, and the numbered list they lead to, do both without leaving the conversation.

## Elements and recipes

- `odd-response` (`@oddkin/ai`): renders `[^sourceId]` in its Markdown as an `odd-citation` resolved against its `sources`.
- `odd-citation` (`@oddkin/ai`): the inline marker; it opens a named anchored popover by default and offers "Show in sources". Direct compositions can choose `presentation="inline"` when the parent allocates a growing details region.
- `odd-sources` (`@oddkin/ai`): the numbered list, with `reveal(sourceId)`.

`odd-message` connects the three itself; use the pattern when you place a response and its sources yourself.

## Example

[example.html](example.html): a response citing two sources, the list below it, and one listener that reveals a source when a citation asks to. No composition document yet: version 1 of the composition catalog does not name the AI elements.

## Interaction and accessibility

- Each marker is a button named after its source ("Source 1: Annual report"), with `aria-expanded` for its preview; Escape closes the preview and returns focus to the marker.
- The default preview composes `odd-popover`, a named non-modal dialog available by keyboard and touch without hover. Tab reaches its controls; Escape or the close control restores the marker's logical focus. Pressing an outside control keeps focus at that destination.
- In the explicit inline presentation, the preview is a named group after the marker. A presentation change while it is open waits until close, preserving the active view and marker.
- "Show in sources" sends cancelable `odd-citation-open` with `{ sourceId, resolved }`; its uncancelled, resolved default sends `odd-source-reveal` for the same captured identity. The listener calls `reveal()`, which scrolls the list item into view, highlights it, and focuses it. The preview closes without taking focus from that source destination.
- Source links are checked by the URL policy; unsafe ones render as text.

## Responsive behaviour

Markers flow with the text as superscripts. The default source popover wraps within its available viewport space without moving following content. An explicitly allocated inline preview grows in its parent. Width changes do not switch between presentations, and the list's titles wrap. Generated `odd-response` citations use the component default; the response has no presentation option of its own.

## States

- **Unresolved:** a marker whose source is not listed shows its key and is named "Unresolved source reference" with it.
- **Streaming:** markers appear as their text arrives; the list can update at any time.

## When to use it

Use it for answers grounded in documents or search results. For a reading list without claims in the text, use `odd-sources` alone.

## Evidence

`packages/ai/test/patterns.browser.test.ts` exercises the markers' names and numbers, opening, Escape focus return, and "Show in sources" revealing and focusing the list item. `elements.browser.test.ts` adds the production presentation, layout, focus-continuity, identity, and cleanup regressions. These describe test coverage; current run results and remaining limits are recorded in `docs/verification.md`. The presentation change and its migration are recorded in [ADR 0050](../../../../docs/architecture/decisions/0050-citation-preview-presentation.md).
