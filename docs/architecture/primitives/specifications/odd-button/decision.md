# odd-button — scoped architecture decision (v2)

- **Status:** Scoped Button v2 design and implementation. See the [runtime handoff](./handoff.json) for its verified status. Extends the v1 decision ([archived](../../runs/2026-11-18-button-redesign/v1-specification-archive.json)); no public property, event, tag or token is added.
- **Date / revision:** 2026-11-18; implementation tree `oddkin-a1-main` at `e84a08e3` (v1 implemented and verified there).
- **Scope:** `odd-button`, its native recipe (`.odd-button` / `@oddkin/components/css/button.css`), the two existing recipe consumers Calendar and Carousel, and the Figma button family on page `1398:2` plus the legacy `Oddkin/Common/iconButton` (`159:471`). No new global policy or accepted-ADR replacement.
- **Classification:** Foundational interaction primitive; ORCP level 0, intrinsic.
- **Canonical owners:** ADR0001, 0003, 0004, 0036, 0038, 0041, 0042, 0043, 0045 and 0046 keep their status; ADR0051 remains a Proposed design reference in the separate Primitive Architect checkout. Agent 1’s implementation follows the current lane’s responsiveness contract. The detailed contract is [contract.md](./contract.md); evidence is [research.md](./research.md).

## Problem

v1 settled the loading footprint and selected-loading paint. The owner then asked for the whole flow again without treating the Figma button as authoritative. Fresh research and a census of code and design found the gaps v1 left (research F1–F6):

- Icon-only actions have no concept. Four components hand-build the same 32 px square; `odd-button` with an icon alone is never square (42×40 at md); approved AI designs draw icon buttons with text glyphs ("›", "👍"), which are not accessible names (WCAG 2.5.3).
- Slotted icons default to 20 px in a 32 px button, while Figma draws 16 px beside text.
- `<a class="odd-button">` is used on the docs site, but the recipe's hover and active rules require `:enabled`, which links never match, and the page's underline shows.
- Figma splits sizes into three sets with one-option axes, and has no end-icon or icon-only component beyond a legacy 48 px frame.

## Research evidence

See [research.md](./research.md): S06 (Label in Name), B-S2 (APG), I04 Spectrum 2 source, I05 Primer source, I06 Fluent source, I07–I09 documentation, O01–O03 Oddkin source, bench and Figma census.

## Alternatives considered

| Alternative | Semantic and ownership consequences | Compatibility / implementation cost | Why selected or declined |
| --- | --- | --- | --- |
| A separate `odd-icon-button` element (Material I08) | A second action element with the same semantics, events and form behaviour | Duplicates the API and the form proxy; consumers choose between two | Declined: one responsibility, one element |
| An explicit `icon-only` attribute (Fluent I06) | Author states the shape | Can be forgotten, or contradict the content (an attribute on a button with text) | Declined for the element; **used for the native recipe** (`data-icon-only`), where CSS cannot see text nodes |
| **Infer icon-only from content** (Spectrum I04, Web Awesome I07) | The default slot holding exactly one icon (`odd-icon` or `svg`) and no text makes the button icon-only; exposed as `:state(icon-only)` | One `slotchange` handler and a custom state; Oddkin already inspects slots (card, dialog, disclosure) | **Selected** |
| Icon size fixed at 16 (Carbon I09, Primer I05) | Simple | Too small alone in 40–48 px squares; disagrees with Oddkin's four squares and the legacy iconButton (20) | Declined |
| **Icon size by context** (with text 16/16/20; alone 20/20/24) | The button owns its icons' size, like Spectrum's icon context | No new token; `odd-icon` reflects its default size, so the button's custom property wins and authors override with `--odd-icon-size` on the icon | **Selected** |
| `href` on `odd-button` (Web Awesome, Material) | Turns an action into navigation inside one element; changes semantics, events and the form proxy | Larger API; APG says the role must match the function | Declined (v1 decision stands) |
| **Make the native recipe work on `<a>`** | Links stay native links that look like buttons | Recipe selectors without `:enabled`; `text-decoration: none` | **Selected** |
| Merge the three Figma size sets into one | Better panel UX | Re-points 955 nested instances in approved AI pages; breaks Code Connect node IDs | Declined; add properties in place |
| **Rebuild `iconButton` (159:471) in place** as the icon-only family | Canonical icon-only design with appearance, size and state | Same node ID: its 35 instances and the Code Connect mapping stay valid | **Selected** |
| A controller | — | No shared draft, session or async invariant | Declined (no controller) |

## Decision

1. **Icon-only.** `odd-button` is icon-only when its default slot's assigned content is exactly one `odd-icon` or `svg` element with no non-whitespace text. It then sets the custom state `icon-only`. An intrinsically sized icon-only button is square at every size: inline size = block size = `control.height.<size>`, never below `target.min`, with no inline padding. The native recipe draws the same geometry for `.odd-button[data-icon-only]`. Explicit full-width controls still fill the parent.
2. **Naming.** An icon-only button takes its name from `label`; the icon stays decorative. Without `label`, the element warns once in the console: `[button.label.missing]`. No other behaviour changes. (Reconciled during implementation: an icon's own `label` is not accepted as the button's name, because odd-icon's published guidance says `@notFor` the only name of a control, and v1 already required `label`.)
3. **Icon size.** Icons directly in the button's slots take their size from the button: beside text `icon.size.sm` at sm and md, `icon.size.md` at lg; alone `icon.size.md` at sm and md, `icon.size.lg` at lg. The element provides `--odd-icon-size` to slotted content (and sizes a slotted `svg`); the native recipe provides `--odd-icon-size` to its children. An author overrides one icon with `--odd-icon-size` on that icon.
4. **Links.** The native recipe styles `<a class="odd-button" href>` as a button: the same hover and active feedback (selectors no longer require `:enabled`), no underline, and `aria-disabled="true"` muting as a disabled button is (a link cannot be `:disabled`; the muting does not stop navigation, so the author removes `href` too). `odd-button` stays an action and gains no `href`.
5. **Consumers.** Calendar and carousel, which build their square from the native recipe by hand, use the recipe's icon-only geometry instead, with their measured geometry unchanged (32×32, 20 px glyph). The overlay close and file-input remove buttons are plain native buttons with their own transparent, secondary-text look (not the recipe), so they stay as they are. The AI Message version arrows and the feedback buttons are recorded for Agent 2's lane (they are AI components; text glyphs become icons there).
6. **Figma.** Keep the four set IDs. Add `End icon` (instance swap) and `Show end icon` (boolean) to the three size sets. The chevron is the default swap, hidden on an unmodified instance. Code renders author-supplied end content; bind the leading icon to the size rule (16/16/20). Rebuild `Oddkin/Common/iconButton` (`159:471`) in place as the canonical icon-only family: Appearance × Size × State, with `On` for a pressed toggle, real `Oddkin/Icon` instances, and `label` documented. Move it to page `1398:2`. Add icon-only, end-icon, link and toggle-icon specimens to the states and allocation reviews in light and dark.
7. **Unchanged.** Every public property, event, slot, part and custom property; v1's loading, selected-loading paint, disabled opacity, wrapping and form limitations.

## Rationale

Inference matches what authors already write, so there is nothing to forget, and it is the model of two of the three source-read systems. The square geometry comes from Oddkin's own controls (the four hand-built squares) and every inspected system. The icon sizes are the ones Oddkin already uses in each context (Figma's 16 px leading icon, the legacy 20 px iconButton, the consumers' 20 px glyphs). Links keep their native semantics, and the recipe simply stops ignoring them.

## Tradeoffs and consequences

- Visible changes: icon-only `odd-button`s become square (md 42×40 → 40×40); slotted icons resize (20 → 16 beside text at sm/md; 16 → 20 alone at md); `<a class="odd-button">` gains hover feedback and loses its underline. Each is a correction toward the design, recorded in the progress log.
- The button's bundle grows by the slot inspection and the warning (measured against the size budget).
- `odd-icon size="lg"` inside a button is overridden by the context size; authors use `--odd-icon-size`.
- The warning cannot see a name given by `aria-labelledby` on the host (the element has no such API); it checks `label` only.

## Invariants

- The native button stays the only focus and activation target; the name comes from text or `label`.
- Icon-only is derived from content, never stored or reflected as an attribute; it changes geometry only.
- Toggle labels stay stable; pressed paint and v1 loading behaviour are unchanged.
- No new public property, event, slot, part, custom property, token or dependency.

## Implementation requirements

`button.ts` (slot inspection, custom state, warning), `button.template.ts` (default-slot `slotchange`), `button.structural.styles.ts` and `button.styles.ts` (icon-only square, icon sizing), `button.native.styles.ts` (link selectors, `data-icon-only`, icon sizing), the calendar and carousel styles and templates, examples, tests (`button.browser.test.ts`, `styling.browser.test.ts` parity, consumers' tests), regenerated metadata, diagnostics list and compatibility checks. Figma: the in-place edits above, the specification page reviews, the snapshot refresh and parity tests. During the resumed review, move intersecting canvas boards apart and bind vertical review-row padding to `space/xs` so keyboard focus outlines render in full.

## Affected primitives and consumers

| Primitive / consumer / token | Dependency path and evidence | Required change | Compatibility / migration |
| --- | --- | --- | --- |
| `odd-calendar`, `odd-carousel` | Native recipe class with a hand-built square (O01) | Use `data-icon-only`; drop the local square overrides | Same 32×32 geometry and 20 px glyph (measured before and after) |
| File-input remove, overlay close | Plain native buttons with their own styles (not the recipe) | None | Unchanged; their own transparent look is deliberate |
| AI components with `<odd-button>` (prompt input, response feedback) | Text-only content (O01 scan) | None | No icon content, so no change |
| AI Message version arrows, feedback buttons | Native recipe with text glyphs (O01, O03) | Recorded for Agent 2: replace glyph text with icons and `data-icon-only` | Outside this lane |
| Docs-site `<a class="odd-button">` (3) | O01 | None in source; they gain hover feedback | Visual correction |
| Figma: 2,385 button instances, 35 iconButton instances | O03 | In-place property additions; iconButton rebuilt in place | Set and variant node IDs kept; Code Connect unchanged |
| `odd-icon` | Inherits `--odd-icon-size` | None | Its `size` is overridden inside buttons, documented |
