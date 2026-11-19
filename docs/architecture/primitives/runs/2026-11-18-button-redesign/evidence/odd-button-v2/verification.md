# Button v2 visual verification

### Refreshed independent review

The resumed review looked at both light and dark focus side and difference captures and both twelve-sample contact sheets. Both Design and live controls retain complete focus rings with clear top and bottom segments. The difference view shows minor edge rendering and the documented shared spinner difference. Text-row differences are consistent with the documented font metrics and accumulated row widths. The refreshed comparison verdict is **PASS** for the scoped specimens.

See [light focus](./comparison/icon-states-light-side.png), [dark focus](./comparison/icon-states-dark-side.png), [side overview](./comparison/_sheet-side.png) and [difference overview](./comparison/_sheet-diff.png). The build SHA-256 values match all 8 recorded modules. Readiness succeeded in all twelve captures. 730 token checks and 74 measured icons produced no mismatches in the capture script.

## Earlier independent review before the Figma fixture repair

The preserved report below describes the prior capture. References to scratch tools and older captures in that report are historical. Its findings on the clipped ring and the pending icon-stroke catalog record were addressed during continuation. Current images and measured rows are linked above.

**Reviewer:** `oddkin-fidelity-verifier` (subagent), independent of the author. I read the author's files and script; every result below comes from my own scripts, captures, and test runs. I edited no source, test, record, or Figma node. One reversible mutation probe was restored byte for byte (row V5).

**Worktree:** `C:\SLT_Backup_10-21-2026\oddkin-a1-main`, branch a1-main at e84a08e3 plus 18 uncommitted v2 files. **Bench:** 127.0.0.1:4190 (already running, serving this worktree's `dist`).

**Overall verdict, implementation-visual audit: PASS.** F1–F7 and F11 are verified. F8 (fonts) and F9 (spinner phase) are correctly marked not compared. F10 is correctly marked deliberate, and its numbers are confirmed. No row is reopened. Two record changes are needed before landing (code is not affected):
1. Record F10 in `docs/architecture/component-catalog.md` §7, as decision rule 7 requires. For now its reason is only in this git-ignored folder.
2. Change F9's wording so it also covers the shared ring's weight (see the F9 row).

## How I measured

All scripts and outputs are in `.tmp/pa-verify/`.

- **Build is current.** The bench's only warning (`dist is older than src (2026-11-18T21:40:10.612Z)`) points to `packages/components/src/composition/catalog.ts`. Its mtime is 13:40:10 local, and git lists it as unchanged, so this is the build rewriting the file with the same content. Every changed src file is older than its `dist` output (`freshness.mjs`). The 8 dist modules the author hashed are byte-identical now, and the bench serves those same bytes. `dist` contains the v2 rules: `:state(icon-only)`, `--odd-icon-size`, `a.odd-button[aria-disabled]`, `data-icon-only`, `text-decoration: none`, the warning, and the observer (`served.mjs`).
- **Bench measurements** (`verify-bench.mjs` writes `measure.json` and `verify-bench.out.txt`):
  - Setup: headless Chromium 156.0.8078.4 at devicePixelRatio 2. Each expected value is the token resolved by a probe inside the element's own pane and density group.
  - Interaction: hover and press used the real pointer (`(hover: hover)` matched). Focus used the real keyboard (Tab). Disabled, Loading, and On are attributes.
  - Results: **1,514 checks, 0 differences**. By section: A squares 972, B states 192, C icon sizes 174, D toolbar 64, E loading 40, F link recipe 58, G content changes 14.
- **Captures** (`verify-captures.mjs`):
  - Markup is rebuilt from the `design-spec.json` instances.
  - Hover, Pressed, and Focus are forced (CSS.forcePseudoState) only so all states appear in one picture. Section B checked the same states with real interaction.
  - Pixel analysis: `analyze-captures.mjs` writes `captures/analysis.json`. It searches for the best alignment; my light-mode element captures sit 2 device px low because of how the element screenshot is clipped. The bench's own diff view is not affected.
  - Contact sheets: `sheet-side-icons.png`, `sheet-side-text.png`, `sheet-diff.png`.
- **Strokes:** the plus icon's bar thickness and each icon's total ink, from pixels (`analyze-captures.mjs`). Live geometry is stroke-width × `getScreenCTM()` (section C). Figma was read read-only with use_figma (session 71644cb7…, exact node ids only, no searches).
- **Other scripts:**
  - `text-insets.mjs`: F8.
  - `spinner.mjs`: F9.
  - `engines-width.mjs`: odd-button vs the native recipe, and the squares, in Chromium, Firefox, and WebKit. Port 4190 is a Fetch bad port, so the page loads from a made-up origin whose requests node forwards to the bench; no second server.
  - `a11y.mjs`: names and roles. `forced.mjs`: forced colours. `literals.mjs`: hard-coded values. `probe.mjs`: the mutation.

## Rows

| Row | Verdict | Evidence |
| --- | --- | --- |
| F1 icon-only squares | verified | Section A, 36 buttons (3 appearances × 3 sizes × 2 densities × 2 modes): each control equals max(control.height, target.min) resolved in its pane: 32×32, 40×40, 48×48. Pixels per button against Figma after alignment: mean absolute difference 0.12–1.51, strong differences ≤ 1.26% (`captures/icon-sizes-*`). Parity, icon-only cases: Chromium 63/63, Firefox 54 plus 9 Pressed skipped, WebKit 63/63. |
| F2 bound tokens | verified | **A, each appearance, size, and density:** background, all 4 border colours and widths, all 4 paddings (`--odd-space-none`), all 4 radii (`--odd-control-radius`), colour, min-height, and min-width. **B, md secondary, both modes, real interaction:** light Hover rgb(240, 239, 245) = `surface-hover`, Pressed rgb(240, 239, 243) = `surface-sunken`; dark Hover rgb(48, 50, 63), Pressed rgb(17, 18, 25). On uses the selection background, border, and foreground. Disabled has opacity 0.5 (Figma's unbound literal). 0 differences. |
| F3 focus ring | verified | **B Focus**, reached with Tab, `:focus-visible` true: the outline is solid 2px (`--odd-focus-width`), offset 2px (`--odd-focus-offset`), in `--odd-color-focus-ring` (light rgb(98, 80, 232), dark rgb(180, 168, 255)). A button pressed with the pointer draws no ring. **Figma render:** the 40 px row frame clips the ring at top and bottom (presentation only); the left and right segments line up (`captures/icon-states-*-diff.png`). The parity ring targets pass in 3 engines. |
| F4 icon sizes | verified | **C:** beside text, 16/16/20 px at sm/md/lg; alone, 20/20/24 px, both for `odd-icon` and for a raw slotted `svg` (the svg box equals the icon box). **A:** compact density keeps 20/20/24. All 72 icons equal their `--odd-icon-size-*` token. |
| F5 icon colour | verified | Every icon I measured (A, B, C, both modes, primary and On included): the path's computed `stroke` equals the control's colour. |
| F6 loading footprint | verified | **E**, Default vs Loading, same box: text button 95.890625×40, icon-only 40×40, lg 143.078125×48. While loading: icons and label have opacity 0; the spinner is shown and centred (\|dx\| ≤ 0.008 px, dy 0); `aria-disabled="true"`, and the button stays focusable. Turning `loading` on and off on one node keeps 95.890625 throughout. |
| F7 240 px toolbar | verified | **D:** 240×106 with rows at 17 and 57 px (5 + 4 buttons). No overflow: scrollWidth 238 = clientWidth, scrollHeight 104 = clientHeight. Every 32×32 square sits inside the content box, with a 20×20 icon. Pixels per button against Figma 1462:2074/2104: mean difference 0.13–1.01. |
| F8 fonts | not compared, correctly described | **Widths match the author's:** live 127.22, 107.72, 108.63, 74.61, 143.08 and 95.89, against Figma 125, 105, 105, 74, 140 and 94. Heights are equal. **The difference is the text:** from the button edge to the first and last ink, live and Figma agree within 1 px (start icons begin at 13 px in both; Figma counts the stroke in its layout), while the label ink runs differ by 1–2 px. |
| F9 spinner | not compared; wording incomplete | **Phase:** not comparable (my paused frame differs from the author's). **Ring:** also differs. Live ink is 59–72 px² vs Figma's 41.7, extent 14×13.5 vs 13×13 px: the shared 1em ring with a 0.15em border vs Figma's busy-icon arc. This is an existing recorded decision, not a v2 change: the component-catalog rows for button and iconButton read "icon spinner × 3, style: the busy glyph is the shared spinner module". F9 should name it. v2's own claims (centred, footprint kept, icon not drawn) are verified in F6. |
| F10 stroke weight | deliberate; numbers confirmed; record pending | **Figma** (read-only, by node): the plus vectors have strokeWeight 1.5, scaleFactor 1, in 1456:2061 (16 px), 1456:1915 and 1456:1936 (20 px), and 1456:1957 (24 px). In Figma's renders the plus bar measures 1.500 px at all three sizes. **Code:** 1.5 × CTM = 1.2 / 1.5 / 1.8 px (C). Drawn bar from pixels: 1.25 / 1.50 / 1.75 px. Live/Figma ink ratio: 0.80 at 16 px (12 icons), 1.02 at 20 px (52), 1.24 at 24 px (6). In `sheet-diff.png` it is visible only on the 24 px icons. **History:** the 24 px case is new with v2's lg icon-only buttons; 16 px predates v2. **Record:** no parity test compares icon strokes, so `deliberate()` does not apply, and §7 does not record it yet. Record it before landing, with the icon owner's follow-up. |
| F11 icon-layouts snapshot | verified (snapshot out of date, no visual change) | **Figma, by node id:** 159:586 and 257:1341 exist. Their strokes are bound to VariableID:1460:3 (`content/current`, "Oddkin · Content colour") and resolve to #23252b on the node, the same colour `color/text/primary` (VariableID:158:30) resolves to there. `icon-layouts.json` still records 158:30. 159:593 and 159:608 keep 158:42 and 158:32, as recorded. 159:552, 159:559, 159:566, and 159:573 no longer exist (`getNodeByIdAsync` returns null). **Node tests:** figma-icons, figma-reuse, figma-component-export, and the tokens figma-parity test pass 16/16. They check the snapshot's internal consistency, not live Figma. |
| V1 compact density | verified | **A, compact, every appearance, both modes:** squares are 24×24, 30×30, and 36×36; icons are 20/20/24. At sm the square is the target size (24): never smaller. **Other engines** (`engines-width.mjs`): the same squares in Firefox 157 and WebKit 27.2. |
| V2 native link recipe (`css=@oddkin/components/css/button.css`) | verified | **F, `<a class="odd-button" href>` vs `<button class="odd-button">`:** secondary, primary, ghost, lg, and sm icon-only have equal values for all 42 computed properties and equal boxes (44.125×40, 54.71875×48, 32×32), with `text-decoration-line: none`. Hover and pressed backgrounds equal the button's in both modes (light primary rgb(81, 64, 204) / rgb(67, 51, 173)). Tab focus draws the focus-token ring. **`aria-disabled="true"` link:** opacity 0.5, cursor `not-allowed`, the same colours as the disabled button, and no hover change. In forced colours (Chromium emulation): opacity 1, GrayText text and border, like the disabled button. |
| V3 icon-only state on content changes | verified | **G**, with one element and one control node throughout. Each change settled within 34 ms. Not icon-only after each of: appending a text node (76.19×40); changing an empty text node's data to "Close" in place; moving the icon to `slot="start"` (50×40); appending a second element; replacing the content with text. Icon-only (40×40) again after each was undone; whitespace only keeps it. |
| V4 `[button.label.missing]` | verified | **G:** about 115 labelled or text buttons across sections A–G logged 0 warnings. One unlabelled icon-only button logged exactly one: `[button.label.missing] <odd-button> shows only an icon and has no label: set label to name it.` It stayed at one through text added and removed, `label` set and cleared, and reconnecting. A labelled svg-only button logged none. |
| V5 mutation probe | verified: the change was caught | **Mutation:** in `button.styles.ts`, the `:host(:state(icon-only)) button` rule's `padding-inline: ${token('space.none')}` became `space.xs`. Icon-only parity in Chromium: 63 failed (116 skipped by `-t`), each with `paddingLeft (--odd-space-none): padding-inline-start 8px, token 0px`. **Restored from `.tmp/pa-verify/button.styles.ts.bak`:** SHA-256 `511A608C…ABE705` before and after, `fc /b` reports no differences, mtime 13:39:09 as before, and `git diff --stat` identical (32 lines, 31 added and 1 removed). The stat alone cannot show this: the mutant had the same stat, so the hash is the proof. Rerun: 63 passed. |
| V6 hard-coded values | verified | The only literal added is `opacity: 0.5` on `a.odd-button[aria-disabled='true']`. It equals the existing disabled rules (in the element and the recipe) and Figma's unbound Disabled opacity, and the theme has no opacity token. Everything else is `token()` or `--odd-icon-size`. |
| V7 tests not weakened | verified, one note | **Removed lines:** only the vitest import (now adds `vi`) and the Loading parity mount (which now adds icons). **New skip:** Firefox Pressed in the icon-only parity, the same rule and reason as the existing text-button parity. **New tolerance:** `toBeCloseTo(a.width, 1)` (±0.05 px) in the new styling test, in all engines. Measured element vs native widths: Chromium 0, WebKit 0, Firefox at most 0.0000153 px, in text cases only. Heights and squares stay exact, and computed styles are compared exactly. The tolerance is justified; it could be 3 digits and Firefox-only. |
| V8 size | verified | `node scripts/check-size.mjs` exit 0, measured / budget: ai-response 29,018 / 29,056; ai-chat 69,805 / 69,824 (100.0%); components:button 1,438 / 1,472; components:shared 3,586 / 3,648; button.css 1,093 / 1,152. All five budgets were raised in this change, in `measure.mjs`, with reasons (Agent 1). |
| V9 names | verified (accessibility tree only) | Chromium ARIA snapshot: button "Close"; button "Bold" [pressed]; button "More" [disabled] (loading); button "Save"; link "Go"; link "Gone" [disabled]; native button "Add". Inside the named buttons, the icons appear as unnamed img children; a button's children are presentational. |

## Tests (my runs, one command at a time)

Command: `npx vitest run --project browser --browser.name=<engine>` on figma-parity, button, styling, carousel, and calendar. Firefox and WebKit also wrote JSON reports.

| Engine | Result |
| --- | --- |
| Chromium | 257 passed (5 files): figma-parity 179 (63 icon-only), button 31, styling 14, carousel 11, calendar 22. Run twice: 15:07, and again after the probe was restored. |
| Firefox | 237 passed, 20 skipped: 18 Pressed parity cases (9 text, 9 icon-only) and 2 forced-colours tests (the button toggle, the calendar). |
| WebKit | 255 passed, 2 skipped (forced colours). |

No failure, so no rerun. The B-A9, B-A10, B-A11, B-A12, and B-A13 tests passed in all 3 engines. Node: the 4 snapshot test files pass 16/16.

## Captures I looked at

- My `sheet-side-icons.png`, `sheet-side-text.png`, and `sheet-diff.png`, and the author's `_sheet-side.png` and `_sheet-overlay.png`.
- **Icon-only rows (sizes, states, toggles, toolbar):** squares, fills, borders, icons, and positions match Figma. In the difference view they are black except for:
  - the 24 px icons (F10),
  - the spinner (F9),
  - the focus ring's top and bottom, which Figma clips (F3).
- **Text rows:** only the labels differ (fonts, F8), plus the right edges after each wider label.
- **Icon mapping:** the author's icons match the catalog (`settings` is `gear.svg`, `chevronRight` is `direction-chevron-right.svg`; `design/icons/catalog.json`).

## Coverage and limits

- No real assistive technology (NVDA, JAWS, VoiceOver): names come from Chromium's accessibility tree only.
- No zoom, text-spacing, reflow, or right-to-left checks.
- Captures and bench measurements are Chromium only. Firefox and WebKit evidence comes from the three-engine tests and `engines-width.mjs` (widths and squares). No real Safari or iOS device was used.
- Forced colours were emulated in Chromium only.
- Hover, Pressed, and Focus in the captures are forced pseudo-states; section B confirmed their values with real interaction.
- Spinner phase is not compared.
- The probe's failing run wrote 63 failure screenshots to `.vitest/attachments/failure-screenshots/` (git-ignored, vitest's own folder). I left them in place.
