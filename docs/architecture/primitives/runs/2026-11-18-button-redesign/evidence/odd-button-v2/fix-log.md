# odd-button v2: fix log (2026-11-18)

**Runtime evidence before the resumed Figma repair.** [diff.md](./diff.md) has no mismatch row: F1–F7 match, F8 and F9 are not compared (fonts, animation), F10 is deliberate (the icon system's stroke scaling), and F11 is a stale design snapshot with no visual change. No source, token, or style was edited after the captures.

## Corrections made during implementation, before the audit

These were found while implementing and testing v2, before the bench captures, and are part of the audited source:

| Change | Why at this source | Files | Covered by |
| --- | --- | --- | --- |
| Icon-only state also re-read when slotted text changes in place | `slotchange` fires for added and removed nodes, not for a text node's data; core's `html` (and Lit, React) update text bindings in place, which left a stale square | `packages/components/src/button/button.ts` | `button.browser.test.ts` "B-A9: the state follows the content on the same node, with focus kept" |
| Naming: `label` only (an icon's own label does not count) | odd-icon's published `@notFor` rules it out as the only name of a control, and v1 already required `label`; the records were reconciled | `button.ts`, the owner's `contract.md`, `decision.md`, `research.md`, `spec.md` | "B-A11: an icon-only button without label warns once; with label, or with text, never" |
| A link muted by `aria-disabled` takes opacity 0.5, as a disabled button | a link cannot be `:disabled`; decision 4's "muted" needed a visible state | `packages/components/src/button/button.native.styles.ts` | `styling.browser.test.ts` "B-A12: styles a link as the button…" |
| CSS comments moved out of the shipped `css` templates | comments inside `css` ship in every bundle (measure.mjs, 2026-11-07); saved 73 B gzip in ai-chat | `button.styles.ts`, `button.native.styles.ts` | `npm run size` |
| Test: native and element box widths compared within 0.05 px | Firefox rounds the same text width differently in the two trees (by 0.00002 px); heights and the square stay exact | `packages/components/test/styling.browser.test.ts` | the test itself, three engines |

## What the change reaches

- **Calendar and carousel** use the recipe's `data-icon-only` square; their local square overrides are gone, and their glyphs read `--odd-icon-size` (20 px). Measured: calendar `matches Figma calendar…` (32×32, 20 px glyph) and carousel `B-A13…`, three engines.
- **AI elements** draw native `.odd-button` recipe buttons with text: the link-safe selectors keep their hover and active feedback (`:not(:disabled, [aria-disabled='true'])` instead of `:enabled:not(…)`, the same specificity order). No AI template changed.
- **Size budgets**, the smallest 64 B steps: ai-response 29,056 (29,018), ai-chat 69,824 (69,805), components:button 1,472 (1,438), components:shared 3,648 (3,586), components:button.css 1,152 (1,093).

## Checks run (counts)

- `npm run build`, `npm run typecheck`: exit 0.
- `button`, `styling`, `carousel`, `calendar` browser tests: Chromium 78/78; Firefox 76 + 2 skipped after the tolerance fix (styling 14/14 rerun); WebKit 76 + 2 skipped.
- `figma-parity.browser.test.ts`: Chromium 179/179, Firefox 161 + 18 skipped (Pressed), WebKit 179/179.
- `figma-reuse`, `figma-icons`, `figma-component-export`, tokens `figma-parity`: 16/16.
- `npm run size`: exit 0 after the budget changes.

## Resumed Figma repair

The earlier independent review identified clipped top and bottom segments of the focus ring in both Figma reference rows. Add `space/xs` as 8 px of block padding to those rows, disable clipping and move the intersecting canvas boards apart. The control geometry and runtime focus styling are preserved. The updated comparison fixture applies the same `space.xs` spacing and records all twelve refreshed comparisons.
