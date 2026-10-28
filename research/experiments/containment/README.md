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

Measured in Chromium, Firefox, and WebKit, five rounds with the variant order rotated, medians of the rounds' medians:

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
| webkit 27.2 | `none` | 320 | 375 | 428.5 | 28,598 | 0 / 0 | true / — |
| webkit 27.2 | `contain` | 559 | 340.5 | 391 | 28,598 | 97,721 / 13,756 | true / — |
| webkit 27.2 | `visibility` | 199 | 318 | 20.5 | 27,677 | 97,721 / 13,756 | true / — |

**Conversation** (200 messages; times in ms):

| Engine | Variant | Theme change | Resize | Stream: snapshot / layout | Scroller height (px) | Follows the latest | Pixels changed |
| --- | --- | --- | --- | --- | --- | --- | --- |
| chromium 156.0.8078.4 | `none` | 28 | 16.6 | 14.5 / 2.1 | 34,736 | true | 0 |
| chromium 156.0.8078.4 | `contain` | 21.7 | 13.9 | 12.6 / 1.1 | 34,736 | true | 2 |
| chromium 156.0.8078.4 | `visibility` | 3.9 | 2 | 12.2 / 1.4 | 36,858 | true | 2 |
| firefox 157.0 | `none` | 22.5 | 35 | 30.5 / 5 | 34,736 | true | 0 |
| firefox 157.0 | `contain` | 23 | 32.5 | 29.5 / 2 | 34,736 | true | 0 |
| firefox 157.0 | `visibility` | 19 | 5 | 29.5 / 2 | 37,026 | true | 0 |
| webkit 27.2 | `none` | 104.5 | 169.5 | 109 / 28 | 35,336 | true | 0 |
| webkit 27.2 | `contain` | 89 | 173.5 | 81 / 8 | 35,336 | true | 37 |
| webkit 27.2 | `visibility` | 111 | 12 | 88.5 / 9 | 37,100 | true | 37 |

Results: [containment-2026-10-28.json](../../benchmarks/results/containment-2026-10-28.json) (dated in UTC). WebKit was measured separately, later the same night (`--engines webkit` merges into the day's file): with the machine at 97% CPU from other agents' test runs, one attempt timed out loading the page and another took over ten minutes a round and was stopped. Measured on a machine shared with other agents' test runs, so only large, repeated differences count: a first full run (its results file lost to a script error in WebKit; its Chromium and Firefox medians read from its console output) agreed with this one except for Firefox's theme change under `content-visibility`, 161 → 99 ms there and 150 → 221 ms here.

### Findings

1. **`contain: content` buys little.** Theme changes and resizing stay within the run-to-run noise in every engine (at best a fifth less, sometimes more). One exception: in WebKit it cut a streamed snapshot's layout from 28 to 8 ms (109 → 81 ms per snapshot), where Chromium and Firefox spend 1–5 ms on layout anyway. Its paint containment clips what an item draws outside its box: the elevated card's shadow, drawn by the `.card` element inside the shadow root, disappears (about 98,000–108,000 pixels of the first viewport change in each engine). The focus ring of a button inside the card stays visible: the pixels that change around the focused card are its shadow.
2. **`content-visibility: auto` saves the work off screen, unevenly.** Resizing drops three to twenty times in every engine for both pages (WebKit, cards: 429 → 21 ms); the cards' first layout drops too. Theme changes drop several times in Chromium only: WebKit's barely change, and Firefox's flipped between runs (above). Streaming does not change, because a snapshot's cost is the message's script update, not layout. Off-screen text is still found by `window.find()`, and in Chromium the last card stays in the accessibility tree. The same shadow is clipped (paint containment), and until items render, `contain-intrinsic-size` estimates change the scroll height (−3% for the cards at 260 px, +5–7% for the conversation at 160 px).
3. **Streaming is script-bound.** About 12–15 ms per snapshot for 200 messages in Chromium, 30 ms in Firefox, and 109 ms in WebKit, of which layout is 1–5 ms in Chromium and Firefox and 28 ms in WebKit.

### Decision

No component applies containment or `content-visibility` (css-architecture.md §13.2; registry entries `containment`, `content-visibility`):

- whether a list is long is the page's knowledge, not the item's;
- elevated cards draw their shadow outside the host box, and paint containment clips it;
- `odd-conversation` restores reading positions and follows the latest message from measured positions, which estimated sizes change until each message renders, and streaming gains nothing. `contain: content` on messages is the one candidate, for WebKit's streaming layout; it needs the messages' focus rings and menus checked first (Agent 2's element).

Page authors may apply `content-visibility: auto` with `contain-intrinsic-size: auto <typical size>` to the items of a long collection whose ink stays inside their box (filled or outlined cards, list rows), behind `@supports (content-visibility: auto)`. A component that adopts either rule later moves its outside ink onto the host or adds room for it, and repeats this measurement.
