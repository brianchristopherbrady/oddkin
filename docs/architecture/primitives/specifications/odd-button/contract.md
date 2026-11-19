# odd-button — design and implementation contract (v2)

Design-and-implement assignment, 2026-11-18. Source: the implementation tree at `e84a08e3` (see [context](./context.md)). v1's contract is archived in [the v2 run](../../runs/2026-11-18-button-redesign/v1-specification-archive.json); everything v1 specified and verified stays in force unless marked **v2** below. Figma, source and browser evidence stay separate.

## 1. Purpose, classification and owners

Foundational interaction primitive, ORCP **intrinsic**. The button owns a named action surface, the native control and its focus, local hover/active/focus, the optional binary `pressed` state, and (**v2**) the derived icon-only presentation. The host owns the label and icons it supplies, `loading`, permission and `disabled`, the operation and its record, progress and result messages, retries, navigation and focus after a context change. The form owns validation, submitted data and reset. Button needs no headless controller because its interaction and presentation state live with one native control. Drafts, request identifiers, retry and concurrent operations belong to the host when present. No Button state has a database owner.

## 2. Public API (unchanged)

| Property / attribute | Type and default | Reflection / responsibility |
| --- | --- | --- |
| `appearance` | `'primary' \| 'secondary' \| 'ghost'`, secondary | Reflected; visual emphasis. |
| `size` | `'sm' \| 'md' \| 'lg'`, md | Reflected; token-backed height, padding, type and (**v2**) icon size. |
| `type` | `'button' \| 'submit' \| 'reset'`, button | Not reflected; form behaviour (differs from a native button's submit default). |
| `disabled` | boolean false | Reflected; no activation, no focus; a disabled fieldset also disables. |
| `loading` | boolean false | Reflected; spinner centred over retained content, activation suppressed, still focusable (`aria-disabled`). Not an outcome. |
| `fullWidth` / `full-width` | boolean false | Reflected; fills the parent's inline allocation. |
| `toggle` | boolean false | Reflected; binary pressed behaviour and `aria-pressed`. |
| `pressed` | boolean false | Reflected; canonical state when `toggle`; programmatic changes emit no events. |
| `label` | string `''` | Not reflected; accessible name override. **Required when the button is icon-only** (v2 warning, §4). |
| `name`, `value` | strings `''` | Not reflected; passed to the temporary submitter on activation. |
| `formAction`/`formaction`, `formMethod`/`formmethod`, `formEnctype`/`formenctype`, `formTarget`/`formtarget` | optional strings | Reflected; raw attribute text, passed to the proxy unchanged. |
| `formNoValidate` / `formnovalidate` | boolean false | Reflected. |
| `form` | readonly `HTMLFormElement \| null` | From ElementInternals. |

No property, attribute, event, slot, part or custom property is added or removed in v2. **v2 adds one custom state** (read-only, derived): `icon-only`, selectable as `odd-button:state(icon-only)`, documented with `@cssstate`.

## 3. Anatomy, icon-only and icon size (v2)

| Hook | Contract |
| --- | --- |
| Default slot | Action text, or **one icon alone** (an `odd-icon` or an `svg` element). Text and icons only: no links or controls. |
| `start`, `end` slots | Non-interactive adornments before and after the label; mirrored by direction. |
| `part="control"` | The native button: the only focus and activation target. |
| `part="spinner"` | Decorative busy ring centred over the content (`aria-hidden`). |
| Custom properties | `--odd-button-radius`, `--odd-button-background`, `--odd-button-color`, `--odd-button-border-color`, `--odd-button-height`, `--odd-button-padding-inline` (unchanged). |

**Icon-only (v2).** The button is icon-only when its default slot's assigned nodes (flattened) contain exactly one element, that element is an `odd-icon` or an `svg`, and the other assigned nodes are whitespace-only text. The state is derived after first render and on `slotchange`. A scoped MutationObserver also handles in-place text edits, which do not fire `slotchange`. The result is exposed as a custom state. Intrinsic icon-only geometry: inline size = block size = `max(var(--odd-button-height, control.height.<size>), target.min)`, inline padding zero. `full-width` still fills its parent (the icon centres). `start` and `end` content does not count: put the icon in the default slot.

**Icon size (v2).** The control sets `--odd-icon-size`, which slotted content inherits: beside text `icon.size.sm` at sm and md, `icon.size.md` at lg; icon-only `icon.size.md` at sm and md, `icon.size.lg` at lg. A slotted `svg` is drawn at that size; an `odd-icon` reads the property (it overrides the icon's own `size` attribute, whose default is reflected and therefore indistinguishable from a choice). An author changes one icon with `--odd-icon-size` on that icon.

**Native recipe (v2).** `.odd-button` provides the same `--odd-icon-size` to its children by `data-size`. `.odd-button[data-icon-only]` draws the icon-only geometry; the author sets the attribute because CSS cannot see text nodes. `<a class="odd-button" href>` is styled like the button: hover and active backgrounds without `:enabled`, `text-decoration: none`, `aria-disabled="true"` muting and `cursor: not-allowed`.

## 4. Events, diagnostics and outcome boundary

Events are unchanged from v1: native `click`, and on a toggle `input` (bubbles, composed) then `change` (bubbles) after an accepted user activation; programmatic changes emit nothing; a cancelled click rolls the pressed flip back.

**v2 diagnostic.** When the button is icon-only and its own `label` is empty, the element logs once per element:

`[button.label.missing] <odd-button> shows only an icon and has no label: set label to name it.`

The check runs again when assigned content or the Button’s `label` changes. An icon’s own label does not satisfy the Button naming contract. The warning is in the shipped implementation and logs at most once per element.

## 5. State matrix for editable design

| Dimension | Required specimens |
| --- | --- |
| Appearance × size baseline | Primary, secondary, ghost × sm, md, lg, light and dark (unchanged). |
| Interaction | Rest, hover, active, focus-visible, disabled, loading (unchanged). |
| Content | Text; start icon + text; text + end icon (in Figma, optional chevron swap defaults to hidden; in code, author-supplied slot content); both icons; icon-only (**v2 family**) in every appearance and size; long and unbroken labels; RTL. |
| Toggle | Off, on, focus on, disabled on, loading on; **v2**: an icon-only toggle (pressed paint, same name). |
| Link | **v2**: `<a class="odd-button">` rest and hover (native recipe) — documented as a recipe specimen, not an `odd-button` state. |
| Allocation | Intrinsic, full width, narrow row, multiline full width, bounded parent (unchanged); icon-only buttons in a toolbar row. |

## 6. Deltas (v2 over `e84a08e3`)

| ID | Current source | v2 requirement |
| --- | --- | --- |
| B-D4 icon-only | No concept; an icon alone gets text padding (md 42×40) | Derived `icon-only` state; square geometry at every size; `@cssstate icon-only` |
| B-D5 icon size | Slotted icons keep their own size (`odd-icon` default 20) | Context size through `--odd-icon-size` (16/16/20 beside text; 20/20/24 alone) |
| B-D6 naming check | None | `[button.label.missing]` once per element |
| B-D7 native recipe | `:enabled` hover/active; no `data-icon-only`; no icon size | Link-safe selectors, `text-decoration: none`, `data-icon-only`, `--odd-icon-size` by size |
| B-D8 consumers | Calendar and carousel hand-build squares from the recipe | Use `data-icon-only`; local overrides removed; same measured geometry. File-input remove and overlay close are plain buttons with their own look: unchanged |
| B-D1–B-D3 | v1 deltas (loading footprint, selected-loading paint, host outcomes) | Implemented at `e84a08e3`; unchanged |

## 7. Interaction transitions and focus

v1's table stands (activation, toggle flip and rollback, loading, settle, disabled, removal). **v2 additions:**

| Current + trigger + guard | Result | Focus |
| --- | --- | --- |
| Text button + host replaces content with one icon | `slotchange` → `icon-only` set; geometry becomes square; warning if unnamed | Same native control keeps focus |
| Icon-only + host adds text | `slotchange` → `icon-only` cleared; text geometry | Same control, focus kept |
| Icon-only toggle + activation | Same as any toggle; name unchanged | Same control |
| Icon-only + loading | Spinner centred, icon retained undrawn, square kept | Same control |

## 8. Conditional allocation contract

v1's B-L1–B-L8 stand. **v2 rules:**

| ID | Input | Condition | Response | Invariants | Owner | Mechanism | Fallback | Evidence |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| B-L9 | Icon-only content | Intrinsic sizing with a parent grant at least the square | Square at the size's height; centred icon | Name, target ≥ `target.min`, node identity | Child CSS | `:state(icon-only)` / `[data-icon-only]` sizes | Parent narrower than the square: the square overflows like any minimum-size control, never shrinks below the target. An explicit `full-width` or native `data-full-width` fills the parent's inline grant instead of using the natural square. | Browser probe B-A9 |
| B-L10 | Compact density | `data-odd-density="compact"` | Heights 24/30/36; icons keep 16/20/24 | Square stays ≥ `target.min`; icon never larger than the square | Token scopes | Token inheritance | — | Probe B-A9 compact case |
| B-L11 | Icon size by context | Text present or not | Icon 16/16/20 beside text; 20/20/24 alone | Icons never exceed the control height | Child CSS | Inherited `--odd-icon-size` | Author overrides per icon | Probe B-A10 |

## 9. Acceptance (v2 additions; B-A1–B-A8 from v1 remain)

9. `B-A9` — icon-only `odd-button` and `.odd-button[data-icon-only]` are square at sm, md and lg (32/40/48; compact 24/30/36), never below `target.min`; `:state(icon-only)` set and cleared by content changes on the same node with focus kept.
10. `B-A10` — slotted icons measure 16/16/20 beside text and 20/20/24 alone, in the element and the native recipe; `--odd-icon-size` on an icon overrides.
11. `B-A11` — an icon-only button without `label` warns `[button.label.missing]` exactly once per element (reconnecting or relabelling stays silent); one with `label`, or with text, never warns. An icon's own `label` does not name the button (odd-icon `@notFor`: the only name of a control).
12. `B-A12` — `<a class="odd-button" href>` draws as the matching `<button class="odd-button">` at rest (no underline) and on hover, and with `aria-disabled="true"` is muted as a disabled button is (opacity 0.5, `not-allowed`) without hover feedback; a native `<button class="odd-button">` keeps v1 parity with the element.
13. `B-A13` — calendar and carousel icon buttons keep their measured geometry (32×32, 20 px glyph) after moving to the shared recipe.
