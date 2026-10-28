# Containment and `content-visibility` (M8 CSS review, F08)

The plan's M8 CSS review asks for measurements of containment and `content-visibility` on representative collections, theme changes, resizing, and streaming transcripts before any adoption ([css-architecture.md](../../../docs/architecture/css-architecture.md) §13.2, regression scenario F08). No component ships either rule; this experiment applies them from outside.

```sh
npm run build
node research/experiments/containment/run.mjs [--engines chromium,firefox,webkit] [--rounds 5]
```

## Method

[page.js](./page.js) builds one of two pages, with one of three rules on every item host:

| Variant | Rule |
| --- | --- |
| `none` | none |
| `contain` | `contain: content` (layout, paint, and style containment) |
| `visibility` | `content-visibility: auto; contain-intrinsic-size: auto <estimate>` (260 px per card, 160 px per message) |

- **Cards:** 400 elevated `odd-card`s in an `.odd-auto-grid` (heading, paragraph, `odd-badge`, `odd-button`), 1,200 px wide, the rule in page CSS on `odd-card`.
- **Transcript:** an `odd-conversation` 720 × 600 px holding 200 messages (a controlled `state` snapshot), the rule in a sheet adopted into the conversation's shadow root on `odd-message` (page CSS cannot reach the messages). Streaming: 60 snapshots, each adding a few words to the last message.

Measured in Chromium and Firefox (WebKit below), five rounds with the variant order rotated, medians of the rounds' medians:

- **render:** insertion until every element reports `updateComplete` (script-dominated);
- **first layout:** the style and layout forced right after (`offsetHeight`);
- **theme:** style and layout forced after switching `data-odd-mode` between light and dark (10 switches);
- **resize:** the same after changing the collection's inline size (1,200 ↔ 760 px; conversation 720 ↔ 480 px);
- **stream:** a snapshot until the message is updated, plus the forced layout; **stream layout** is the layout part alone.

Paint is not measured. Correctness, compared with `none` in the same engine: the first viewport's pixels; the first card's pixels with its button focused from the keyboard (focus ring); `window.find()` for text in the last, off-screen card; Chromium's accessibility tree (DevTools protocol) for the last card; the document or scroller height; and whether the conversation still follows the latest message.

## Results

**Cards** (400 elevated cards; times in ms):

| Engine | Variant | First layout | Theme change | Resize | Document height (px) | Pixels changed: viewport / focused card | Last card found / in accessibility tree |
| --- | --- | --- | --- | --- | --- | --- | --- |
| chromium 156.0.8078.4 | `none` | 165.7 | 144.4 | 29.3 | 28,598 | 0 / 0 | true / true |
| chromium 156.0.8078.4 | `contain` | 217.4 | 135.1 | 23.6 | 28,598 | 108,499 / 12,416 | true / true |
| chromium 156.0.8078.4 | `visibility` | 17.6 | 15.4 | 4.3 | 27,724 | 108,499 / 12,416 | true / true |
| firefox 157.0 | `none` | 296 | 149.5 | 50 | 28,598 | 0 / 0 | true / — |
| firefox 157.0 | `contain` | 267 | 178.5 | 65.5 | 28,598 | 106,508 / 15,726 | true / — |
| firefox 157.0 | `visibility` | 94 | 221 | 15 | 27,696 | 106,508 / 15,726 | true / — |

**Conversation** (200 messages; times in ms):

| Engine | Variant | Theme change | Resize | Stream: snapshot / layout | Scroller height (px) | Follows the latest | Pixels changed |
| --- | --- | --- | --- | --- | --- | --- | --- |
| chromium 156.0.8078.4 | `none` | 28 | 16.6 | 14.5 / 2.1 | 34,736 | true | 0 |
| chromium 156.0.8078.4 | `contain` | 21.7 | 13.9 | 12.6 / 1.1 | 34,736 | true | 2 |
| chromium 156.0.8078.4 | `visibility` | 3.9 | 2 | 12.2 / 1.4 | 36,858 | true | 2 |
| firefox 157.0 | `none` | 22.5 | 35 | 30.5 / 5 | 34,736 | true | 0 |
| firefox 157.0 | `contain` | 23 | 32.5 | 29.5 / 2 | 34,736 | true | 0 |
| firefox 157.0 | `visibility` | 19 | 5 | 29.5 / 2 | 37,026 | true | 0 |

Results: [containment-2026-10-28.json](../../benchmarks/results/containment-2026-10-28.json) (dated in UTC), Chromium and Firefox. **WebKit is not measured yet:** on a machine at 97% CPU from other agents' test runs, one attempt timed out loading the page and a rerun took over ten minutes a round, so it was stopped; `--engines webkit --rounds 5` adds it to the same day's file. Measured on a machine shared with other agents' test runs, so only large, repeated differences count: a first full run (its results file lost to a script error in WebKit; its Chromium and Firefox medians read from its console output) agreed with this one except for Firefox's theme change under `content-visibility`, 161 → 99 ms there and 150 → 221 ms here.

### Findings

1. **`contain: content` buys nothing consistent.** Theme changes and resizing stay within the run-to-run noise in both engines (at best a fifth less, sometimes more). Its paint containment clips what an item draws outside its box: the elevated card's shadow, drawn by the `.card` element inside the shadow root, disappears (about 108,000 pixels of the first viewport change in Chromium). The focus ring of a button inside the card stays visible: the pixels that change around the focused card are its shadow.
2. **`content-visibility: auto` saves the work off screen, unevenly.** Resizing drops three to eight times in Chromium and Firefox for both pages; the cards' first layout drops several times too. Theme changes drop several times in Chromium (cards and conversation), but not in Firefox (the conversation barely changes; the cards' result flipped between runs, above). Streaming does not change, because a snapshot's cost is the message's script update, not layout. Off-screen text is still found by `window.find()`, and in Chromium the last card stays in the accessibility tree. The same shadow is clipped (paint containment), and until items render, `contain-intrinsic-size` estimates change the scroll height (−3% for the cards at 260 px, +6% for the conversation at 160 px).
3. **Streaming is script-bound.** About 12–15 ms per snapshot for 200 messages in Chromium, 30 ms in Firefox, of which layout is 1–5 ms.

### Decision

No component applies containment or `content-visibility` (css-architecture.md §13.2; registry entries `containment`, `content-visibility`):

- whether a list is long is the page's knowledge, not the item's;
- elevated cards draw their shadow outside the host box, and paint containment clips it;
- `odd-conversation` restores reading positions and follows the latest message from measured positions, which estimated sizes change until each message renders, and streaming gains nothing.

Page authors may apply `content-visibility: auto` with `contain-intrinsic-size: auto <typical size>` to the items of a long collection whose ink stays inside their box (filled or outlined cards, list rows), behind `@supports (content-visibility: auto)`. A component that adopts either rule later moves its outside ink onto the host or adds room for it, and repeats this measurement.
