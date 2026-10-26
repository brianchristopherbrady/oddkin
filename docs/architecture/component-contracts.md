# Component contracts (M10 catalog)

Status: **decided (2026-10-22)**. The owner asked for every component in the Figma file to be built, with Figma as a
reference (not a source of code or assets) and naming chosen by a standard. This document is the API contract for
each family on page 158:22 except the data grid (deferred by the owner). Names follow
[ADR 0045](./decisions/0045-api-vocabulary.md); where a concept is new, the name is the HTML one, then the WAI-ARIA
Authoring Practices one, then the most common one across established libraries, and it joins the vocabulary
(`scripts/vocabulary.mjs`) in the commit that ships it. A contract changes only by editing this document in the same
commit as the element.

The Figma mapping, the reuse classes, and the shared style homes stay in [component-catalog.md](./component-catalog.md)
(§3, §6); the composite-widget rule is [css-architecture.md](./css-architecture.md) §12.1; overlays follow
[ADR 0044](./decisions/0044-overlay-positioning-and-top-layer.md); composites follow
[ADR 0043](./decisions/0043-composite-dependency-mechanism.md).

## 1. Where each Figma family lands

| Kind | Figma families → Oddkin |
| --- | --- |
| Existing element | `button`, `button/sm`, `button/lg`, `iconButton` → `odd-button` (`size`, `label`); `toggleButton` → `odd-button toggle`; `input`, `search`, `number`, `dateTime` → `odd-input` (`type`); `card` → `odd-card`; `SideNavigation`, `NavigationItem` → `odd-side-nav` |
| New element (`@oddkin/components`) | `badge` → `odd-badge`; `icon` → `odd-icon`; `spinner` → `odd-spinner`; `progress` → `odd-progress`; `skeleton` → `odd-skeleton`; `avatar` → `odd-avatar`; `chip` → `odd-chip`; `alert` → `odd-alert`; `emptyState` → `odd-empty-state`; `textarea` → `odd-textarea`; `checkbox` → `odd-checkbox`; `switch` → `odd-switch`; `CheckboxGroup` → `odd-checkbox-group`; `radioGroup`, `radio` → `odd-radio-group`; `segmented` → `odd-segmented-control`; `slider` → `odd-slider`; `rating`, `rating/Item` → `odd-rating`; `oneTimeCode`, `oneTimeCode/Cell` → `odd-one-time-code`; `select` → `odd-select`; `fileUpload` → `odd-file-input`; `calendar`, `calendar/Day` → `odd-calendar`; `datePicker` → `odd-date-picker`; `colorPicker`, `color/Swatch` → `odd-color-picker`; `ValidationSummary` → `odd-validation-summary`; `Disclosure`, `Accordion` → `odd-disclosure` (`name`); `Tabs` → `odd-tabs`, `odd-tab-panel`; `Breadcrumbs` → `odd-breadcrumbs`; `Pagination` → `odd-pagination`; `Toolbar` → `odd-toolbar`; `popover` → `odd-popover`; `tooltip` → `odd-tooltip`; `dialog`, `alertDialog` → `odd-dialog` (`alert`); `drawer` → `odd-drawer`; `toast` → `odd-toast`; `listbox` → `odd-listbox`; `Menu`, `MenuItem` → `odd-menu`; `splitAction` → `odd-split-button`; `combobox`, `multiselect` → `odd-combobox` (`multiple`); `Picker` → `odd-picker`; `CommandPalette`, `CommandItem` → `odd-command-palette`; `Tree` → `odd-tree`; `SplitPanels`, `Splitter/*` → `odd-split-panel`; `relativeTime` → `odd-relative-time`; `copyButton` → `odd-copy-button`; `stat` → `odd-stat` |
| Part of an element | `ListboxSurface`, `ListboxOption` (listbox, select's enhanced picker, combobox, picker); `MenuItem` (menu, split button); `CommandItem` (command palette); `radio` (radio group); `rating/Item` (rating); `calendar/Day` (calendar); `oneTimeCode/Cell` (one-time code); `CheckboxOption` (combobox `multiple`, drawn with the shared control-indicator module, never a nested interactive checkbox); `AvatarItem` (avatar); `Splitter/*` (split panel); timeline `Event marker` and stepper `Step status` → `odd-status-marker` (an element the `.odd-timeline` and `.odd-stepper` recipes hold: §2.7 keeps the check and warning glyphs in shadow roots) |
| Layout (`layout.css` classes and elements, §3.7, §4) | `Stack`, `Row`, `Cluster`, `Grid`, `AutoGrid`, `Split` → the existing `.odd-stack`, `.odd-row`, `.odd-cluster`, `.odd-grid`, `.odd-auto-grid`, `.odd-split` with Figma's variants; `Box` → `.odd-box`; `Center` → `.odd-center`; `AspectRatio` → `.odd-aspect-ratio`; `ScrollRegion` → `odd-scroll-region`; `Container` → `odd-container`; `SpecimenItem` is a Figma specimen, not built |
| Recipe (document CSS, no element) | `typography` → `.odd-type-<role>`; `link` → `a` in `base.css` and `.odd-link`; `divider` → `hr` and `.odd-divider`; `keyboardKey` → `kbd` and `.odd-kbd`; `List` → `.odd-list`; `Table` → `.odd-table`; `field` → `.odd-field` (for native and third-party controls; Oddkin controls carry the field anatomy themselves); avatar `Group` → `.odd-avatar-group`; `descriptionList` → `dl.odd-description-list`; `timeline` → `ol.odd-timeline` (markers: `odd-status-marker`); `stepper` → `ol.odd-stepper` (markers: `odd-status-marker`) |
| Example (composition) | `Form` → `examples/forms`: `odd-input`, `odd-checkbox-group`, `odd-validation-summary`, `odd-button`, layout classes |
| Not built | `multiselect/*` display strategies other than the recommended one, `multiselect/SelectionPanel`, `multiselect/InteractionExamples` (design exploration; `odd-combobox multiple` builds the recommended default: chips that collapse to "+N"); the data grid (deferred); Figma's icon assets (§2.7) |

## 2. Rules every element follows

### 2.1 Element or recipe

An element when there is something the platform cannot express from markup alone: behaviour, keyboard handling,
form association, ARIA wiring, a built-in glyph, or observed children. A recipe when native elements already carry
the semantics (`a`, `kbd`, `hr`, `table`, `ul`/`ol`, `h1`–`h6`, `p`, `form`): no registration, shadow root, or
upgrade per instance. Recipes live in `@oddkin/components/css/<name>.css` in the `odd.components` cascade layer
(ADR 0039). The published metadata lists every document stylesheet (`stylesheets["stylesheet:<name>"]`: its
import, layer, description, the classes it defines, the tokens it reads, and the `--odd-*` variables an author may
set), and the agent kit writes a reference for each, so an agent finds a recipe without reading CSS.

### 2.2 Authoring collections

Every related role stays in one shadow root (css-architecture.md §12.1, pattern 1). Authors write items in one of two
forms, normalized to one model inside the element:

| Collection | Declarative children (read as data, never rendered) | Property |
| --- | --- | --- |
| Values (`odd-select`, `odd-listbox`, `odd-combobox`, `odd-picker`, `odd-radio-group`, `odd-segmented-control`) | `<option value disabled selected title>`, `<optgroup label disabled>`; `title` is the option's description, as in accessible-description computation; a disabled group disables its options | `options: readonly OptionRecord[]` with `{ value, label, description?, disabled?, group?, icon? }` (`icon`: a URL, drawn by `odd-segmented-control` only) |
| Actions (`odd-menu`, `odd-split-button`) | `<option value disabled title>` (value = item id), `<optgroup label>`, `<hr>` (separator) | `items: readonly MenuItemRecord[]`, by `kind`: an action `{ kind?: 'item', id, label, description?, icon?, shortcut?, disabled?, tone?: 'danger', items? }` (`items`: a submenu), a group `{ kind: 'group', label, items }`, a separator `{ kind: 'separator' }` |
| Commands (`odd-command-palette`), hierarchies (`odd-tree`, `odd-picker` with `items`) | — (data-driven) | `items` (`{ id, label, … }`, tree items nest `children`) |
| Links (`odd-breadcrumbs`) | `<a href>` descendants (text = label), so a server-rendered `<ol><li><a href>` list works as written | `items: readonly LinkRecord[]` with `{ label, href }` |

When both are present the property wins (even an empty array) and `collection.source.conflict` is reported once per
element (a console warning; `@oddkin/components` has one build, as for `odd-side-nav`). Children are observed
(`MutationObserver` owned by the element's scope), so server-rendered or framework-rendered children work without a
property; the source is connected in `connected(scope)`, so children present at upgrade are in the first render. The
source also reports the values of `<option selected>` children, which a value element uses as its default value when
the host has no `value` attribute. One internal module (`packages/components/src/collection/collection.ts`: the
record types, `readOptions`, `readMenuItems`, `readLinks`, `CollectionSource`) serves every element in the table.
The `items` and `options` names already mean these records in `odd-side-nav` and the AI package.
A chosen item is reported as `odd-action`, detail `{ id, action }`, and an expanded or collapsed item as
`odd-toggle`, detail `{ id, expanded }` (odd-side-nav's types), because one event name has one detail type in
`GlobalEventHandlersEventMap` (owner decision, 2026-10-23).

### 2.3 Content children

Panels the author writes with rich content (`odd-tab-panel`) are assigned to slots inside the element's own
role wrappers (`slotAssignment: 'manual'`, at the floor in every engine), so a tab and its panel reference each other
inside one shadow root while the content stays in the light DOM.

### 2.4 Fields and forms

Every form control is form-associated as ADR 0045 §7 specifies (`name`, `value` attribute = default value, `disabled`
including a disabled fieldset, `required`, `readonly` where native has it, `form`, `validity`, `validationMessage`,
`willValidate`, `checkValidity()`, `reportValidity()`, `setCustomValidity()`, reset, state restore, `input`/`change`
for user edits only, `:state(user-invalid)`), and carries the field anatomy: `label`, `description`, `error` (string;
non-empty sets custom validity and shows the message), parts `field`, `label`, `description`, `control`, `error`. The
look comes from one control style module (§2.9), whose variables (`--odd-field-height`, `-radius`, `-border-color`,
`-background`) every form control and the field recipe share, so one declaration restyles every field in a form. Load
failures in a form control are not `error`: the element shows a `loading` row and the author's `status` slot (retry
actions are author content). There is no `odd-field` element: a wrapper's label in its shadow root cannot name a
slotted control (`<label for>` and `aria-labelledby` do not cross shadow roots), so Oddkin controls render their own
anatomy and native controls use the field recipe. The shared members (`name`, `disabled`, `description`, `error`, the
validity API, reset, `:state(user-invalid)`) live in one internal base class, `OddkinFormControl`, over the core form
controller; each control describes only its value, inner control, reset, and restore. Another element describes a
control (`odd-tooltip`) through an internal hook, `_describe(source, text | null)` on `odd-button` and every form
control: the control renders the texts hidden in its shadow root and lists them in its inner control's
`aria-describedby` after its own description and error, since `aria-describedby` cannot cross the shadow boundary.
Text-entry hints are the HTML global attributes, never new props (their names are `HTMLElement` members): a control
with an inner text field (`odd-input`, `odd-textarea`, `odd-combobox`, `odd-command-palette`) forwards the host's
`inputmode`, `enterkeyhint`, `autocapitalize`, `autocorrect`, and `spellcheck` to it (`TextHints`,
`src/form-control/text-hints.ts`), with the element's default where the host has none (`spellcheck="false"` for a
query, `enterkeyhint="search"` for a search field). A value the widget depends on stays fixed (`autocomplete="off"` on
a combobox, whose popup the browser's autofill list would cover).

### 2.5 Collection states

`loading` (boolean: a busy row drawn by the shared spinner module, `aria-busy` on the collection), slot `empty`
(shown when there are no items; default text from `strings`), slot `status` (author content such as an error and a
retry button). Keyboard focus and selection are separate states, as Figma draws them.

### 2.6 Overlays

Top layer through `popover` or `<dialog>`, placement through `@oddkin/core/controllers/position` (ADR 0044). `open`
reflects; `show()` and `close()` (`close(returnValue?)` on dialogs) open and close it; the element's own open state
reports `beforetoggle` and `toggle` (dialogs: `close` and `cancel`), re-dispatched at the host only when the native
event does not reach it. An overlay attached to another element names it with `anchor` (an ID in the same tree, or the
`anchorElement` property). Placement uses the controller's logical vocabulary: `side`
(`block-start | block-end | inline-start | inline-end`) and `align` (`start | center | end`). Explicit close buttons
exist on every dismissible surface (iOS floor exception, css-architecture.md §9).

### 2.7 Glyphs

Built-in affordance and tone glyphs (chevrons, check, minus, close, search, more, arrows, external, upload, file, info,
warning, check-circle) are drawn by Oddkin from simple geometry in one module (`@oddkin/components/styles` glyphs),
inline SVG in shadow roots (no image requests, so strict CSP needs no `img-src`). Figma's original Oddkin artwork and SVG provenance are documented in
component-catalog.md §5 and design/icons. Optional content icons are slot content or `odd-icon`; built-in glyphs
remain in the shared module.

### 2.8 Tone

`tone` (`neutral | info | success | warning | danger`, default `neutral`) sets the tone colours
(`color.<tone>.{foreground,surface,border}`) and a glyph, so meaning never depends on colour alone. One tone style
module serves `odd-badge`, `odd-alert`, `odd-toast`, and the AI status labels.

### 2.9 Shared style modules

As listed in component-catalog.md §6 (shared homes): tokens, focus ring, control, button, tone, spinner, glyphs,
control indicator, option row, navigation row, chip, avatar, overlay surface. A module whose markup repeats ships it
beside its styles (glyph templates; `spinnerTemplate`, the busy ring of loading rows), and an element draws such a
decorative piece as a part from the module rather than nesting the element (`odd-spinner` is a named `status`, so
nesting it in a busy row would announce twice). The control module follows the Common
page (158:22), which is the contract page for primitives: `border.strong`, `control.radius`, `control.height.md`.
`odd-model-select` moves to it (the page 0:1 drawing with `border.default` and `control.height.sm` is the outlier).

### 2.10 Definition of done

Each element meets the M10 per-component definition of done (IMPLEMENTATION_PLAN.md): typed definition and
generated metadata, examples (default, key variants, incorrect usages), Workbench and docs pages, browser tests in
Chromium, Firefox, and WebKit driven by the examples, axe in light and dark mode, keyboard and Tab-order comparison
with native markup where one exists, Figma parity of bound tokens, mutants, a lifetime scenario, framework typings,
the vocabulary check, and a size budget.

## 3. Element contracts

Notation: `name: type = default`. Attributes are kebab-case; records, arrays, functions are properties. Every
element also takes `strings` (partial record of its built-in text) when it shows built-in text.

### 3.1 Existing elements (additions)

**`odd-button`** — adds `toggle: boolean` (the button keeps a pressed state) and `pressed: boolean` (both reflected;
`aria-pressed` when `toggle` is set). Activating a toggle button flips `pressed` before the page's `click` listeners
run, as a checkbox's checkedness, then dispatches `input` and `change`; a cancelled `click` restores it and dispatches
nothing. Figma `toggleButton` Value On → `pressed`: the selection colours in every appearance. Unchanged otherwise.

**`odd-input`** — `type` adds `number`, `date`, `time`, `datetime-local`, `month`, `week` (an engine without
one falls back to text, as the native input does); adds `min`, `max`, `step` (strings, as on `<input>`: number and
date types), `minlength`, `maxlength`, `pattern` (text types). The global `inputmode` attribute on the host is
forwarded to the native input (a property of that name would shadow `HTMLElement.inputMode`). `type="number"` is the
WAI-ARIA spinbutton, drawn by the element (owner decision B, 2026-10-25; Figma `number`): only engine-prefixed
pseudo-elements hide the engine's spin buttons, and the CSS policy allows no prefixed-only feature. A text input with
`role="spinbutton"`, `inputmode="decimal"` (unless the host sets one), `aria-valuenow`, `aria-valuemin`,
`aria-valuemax`, and `aria-valuetext` when the text is not the plain number; part `stepper` (Figma's sunken segment
inside the border) holds parts `decrement` and `increment` (buttons, `tabindex="-1"`, named by `strings.decrement`
and `strings.increment`; a press keeps focus in the field; each is disabled where its step cannot move the value, and
both while disabled or read-only). Up and Down step by `step`, Page Up and Page Down by ten steps, Home and End go to
the lowest and highest values on the grid when `min` and `max` are set; each step that moves the value dispatches
`input` and `change`, as a native number field's arrow keys do. Stepping is HTML's `stepUp()` algorithm, the same in
every engine (the engines differ at its edges: on `stepUp`, Chromium and WebKit move a value at a maximum off the grid
down onto it; WebKit leaves an empty field empty on `stepDown`); `step="any"` steps by one. `value` is sanitized as a native number field's
(a valid floating-point number, else empty); typed text that is not one stays in the field, the value and the
submission are empty, and validity is `badInput` with `strings.badInput` ("Enter a number."; a trailing full stop
reads as the number, as the engines read it). `rangeUnderflow`, `rangeOverflow`, `stepMismatch`, and `valueMissing`
and their messages come from a detached native number input. Adds `valueAsNumber`, `stepUp(n)`, and `stepDown(n)`
as on `<input>` (other types answer through a detached native input of their type). `type="search"` is a text input
with `role="searchbox"` and `enterkeyhint="search"`, for
the same reason (the native cancel button cannot be hidden otherwise): part `icon` (the search glyph) and part
`clear` (a button, `tabindex="-1"`, named by `strings.clear`, shown while there is a value and the field is enabled
and editable; it clears, dispatches `input` and `change`, and keeps focus). Escape clears too. Date and time types
keep the native picker indicator.

### 3.2 Display

**`odd-badge`** (Figma `badge`) — passive status or count. `tone`, `no-marker: boolean` (hides the glyph: the Count
variant). Default slot: the text. Parts `base`, `marker` (tone glyph: info for `neutral` and `info`, check-circle for
`success`, warning for `warning` and `danger`, as Figma draws them). No role; the text is read in place.

**`odd-icon`** (`icon`) — `src: string` (an SVG URL drawn as a mask in `currentColor`; governed by the page's
`img-src`), `label: string` (non-empty: `role="img"` named by it; empty: hidden from assistive technology),
`size: sm | md | lg = md` (16, 20, 24 px from the icon size tokens). Default slot: inline `<svg>` used when `src` is
empty.

**`odd-spinner`** (`spinner`) — indeterminate busy indicator. `label: string` (accessible name; default
`strings.loading`), `size: sm | md | lg = md`. Default slot: visible status text (Figma Inline), which then names it.
`role="progressbar"` without a value. Reduced motion: the shared spinner turns slowly (3 s per turn), as `odd-button`'s.

**`odd-progress`** (`progress`) — an ARIA progress bar (`role="progressbar"` with `aria-valuenow`, `-min`, `-max`,
`-valuetext`), not a native `<progress>`, whose bar and indicator can only be styled through engine-prefixed
pseudo-elements (the CSS policy allows no prefixed-only feature). `value: number | undefined` (absent: indeterminate,
never a percentage, as Figma requires), `max: number = 1` (as native; a non-positive `max` is 1), `label: string`
(visible and naming; default `strings.label`, "Progress"), `description: string` (described by). Parts `label`,
`value-text` (the formatted percentage when determinate; `renderValue?: (value, max) => string`), `track`,
`indicator`, `description`. `value` is a number here because `<progress>` defines it so (ADR 0045 §2 over §3; the
vocabulary records the per-element type).

**`odd-skeleton`** (`skeleton`) — `shape: text | rect | circle = text`, `lines: number = 1` (text lines; the last
is shorter). Hidden from assistive technology; the region that loads sets `aria-busy`. No animation under reduced
motion.

**`odd-avatar`** (`avatar`, `AvatarItem`) — `label: string` (the person's name; `role="img"` named by it; empty:
hidden from assistive technology), `src: string` (picture; on error or when empty, initials from `label`),
`size: sm | md | lg = md` (32, 40, 48 px). Default slot: replaces the initials ("+3"). Groups: `.odd-avatar-group`
recipe.

**`odd-chip`** (`chip`) — compact token. Default slot: label. `removable: boolean` (part `remove`, a button named
"Remove {label}"; dispatches `odd-chip-remove`, detail `{}`, not cancelable), `selected: boolean` (selection look,
reflected), `disabled: boolean`. Backspace or Delete on the remove button removes too.

**`odd-alert`** (`alert`) — persistent inline status. `tone`, `label: string` (title, shown), default slot: message,
slot `end`: actions. Part `marker` (tone glyph). `announce: none | important = none` (bare: `important`): important
gives the host `role="alert"` so a dynamically inserted alert is announced; otherwise no live role.

**`odd-status-marker`** (timeline `Event marker`, stepper `Step status`) — the circle of a timeline event or a step. `status: idle | pending |
complete | failed = idle` (ADR 0045's lifecycle values): complete draws the check and failed the warning glyph (§2.7),
pending the shared busy ring, idle its default slot (a step number) or, when empty, a dot. Hidden from assistive
technology (`ElementInternals.ariaHidden`): the list and the words beside it carry the status. Part `base` (the circle,
`radius.full`); `--odd-status-marker-size` (default `control.height.sm`). Alone it has Figma's Step status look (a
ring, the action colour when complete, the danger colours when failed); recipes size and colour it through `::part(base)`.

**`odd-relative-time`** (`relativeTime`) — a date and time said relative to now ("3 hours ago", "in 2 days",
"now") in the page's language (`lang`), through `Intl.RelativeTimeFormat` with `numeric: 'auto'`: under 45 s
"now", then minutes, hours, days, weeks, months, years, rounded. `datetime: string` (ISO 8601, as on `<time>`),
`detail: boolean` (also shows the absolute date and time, Figma's Absolute detail). Renders a `<time datetime>` (part
`time`) whose native tooltip is the absolute date and time (`Intl.DateTimeFormat`: date, time, and time zone), after the
clock glyph; part `detail`. An empty or unparseable `datetime` says "Time unavailable" (`strings.unavailable`) and
renders no `<time>`. It does not update itself (Figma: not a live clock): set `datetime` again to refresh it.

**`odd-copy-button`** (`copyButton`) — copies text to the clipboard: `value`, or the text of the element whose id
is `from` (an input or textarea: its value), in the same document or shadow root. A native button (part `button`) with
the small secondary `odd-button` look from the shared button module and the copy glyph (the check while copied);
`label` (default `strings.copy`, "Copy"), `disabled`. On success it writes `navigator.clipboard.writeText`, shows
and politely announces "Copied to clipboard." for two seconds (part `status`), and dispatches `odd-copy` (detail
`{ value }`, not cancelable). When the browser refuses (permission denied, an insecure page without the Clipboard API)
it shows and assertively announces "Could not copy. Select the text." in the danger colour and offers a manual copy: it
selects the `from` element's text, or shows `value` selected in a read-only field (part `fallback`) and moves focus
there. `copy(): Promise<boolean>` copies from script.

**`odd-stat`** (`stat`) — one metric on the card surface (`card.padding`, `card.radius`, a `color.border.default`
border): `label` (secondary UI role), `value: string` (formatted by the author; the display role), and the context in
the default slot (small, secondary: the signed change and its period, "+8.2% this month", or a comparison). `trend:
none | increase | decrease = none` adds an arrow (the shared glyph, rotated for a decrease) and no colour: the
direction says nothing about good or bad, and the signed value says it in words. `loading` shows a placeholder (a
nested `odd-skeleton` on the sunken surface, one value line tall; part `placeholder`) and `strings.loading`
("Loading…"), and makes the element busy (`ElementInternals.ariaBusy`); an empty `value` shows "—" (hidden from
assistive technology) and `strings.unavailable` ("Data not available"). Parts `base`, `label`, `value`, `context`.

**`odd-empty-state`** (`emptyState`) — `label: string` (title), default slot: explanation, slot `media`
(illustration, on a sunken circle), slot `footer` (next steps). No role: a live region would not reliably announce
its insertion, so the page announces a search outcome itself.

### 3.3 Form controls

**`odd-textarea`** (`textarea`) — field anatomy (§2.4) over a native `<textarea>`, on the text-control base it shares
with `odd-input` (`value`, `label`, `placeholder`, `autocomplete`, `minlength`, `maxlength`, `required`, `readonly`).
`rows: number = 4` (Figma's field shows about four lines), `resize: vertical | none | auto = vertical` (`auto` grows
with content from `rows` lines up to `--odd-textarea-max-height`, 40vh, then scrolls: `field-sizing: content` behind
`@supports`, a height the element measures otherwise, never both, F12). With `maxlength`, part `count` under the field
("44 / 500 characters" from `strings.count`, `{count}` and `{max}` in the page language; in `aria-describedby`, not
live); an error takes its place, as Figma draws one line there.

**`odd-checkbox`** (`checkbox`) — native `<input type="checkbox">` in the shadow root, drawn by the control-indicator
module (part `control` is the box). Default slot: label (names it through the native `<label>`). `checked` (attribute =
default checkedness, as native; the property detaches once set or toggled), `indeterminate` (reflected; exposed as
mixed and cleared when the user toggles, as native), `value = "on"`, `name`, `required`, `disabled`, `description`,
`error`. Submits `value` when checked. `input` and `change` at the host for user toggles only.

**`odd-switch`** (`switch`) — as `odd-checkbox` without `indeterminate` (both extend one internal checkable base): a
native checkbox with `role="switch"` drawn as a track (part `control`) whose `thumb` moves to the inline end when on.
Part `state` shows `strings.on`/`strings.off` after the label (hidden from assistive technology; the role states it).

**`odd-checkbox-group`** (`CheckboxGroup`) — named group of slotted `odd-checkbox` children, each keeping its own
`name`, `value`, and checkedness. `label` (legend), `description`, `error`, `required` (at least one checked: the group
is form-associated with no value, and a hidden radio in its shadow root supplies the browser's own "select one of
these options" flag and message, pointed at the first enabled choice), `disabled` (disables the enabled choices and
later restores only those), `orientation: vertical | horizontal = vertical`. A `role="group"` in the shadow root,
named by the legend and described by description and error, holds the slot (the host cannot reference its shadow
parts); choices sit one target height apart, as Figma's rows.

**`odd-radio-group`** (`radioGroup`, `radio`) — one value from a set (§2.2 values). Native radios in one shadow tree:
one Tab stop and arrow-key selection come from the platform. Field anatomy, `name`, `value`, `required`, `disabled`,
`orientation: vertical | horizontal = vertical`. Each option shows its description (`title` or `description`), which
describes its radio. `value` is the checked option's value: the attribute, else the last `<option selected>`, is the
default; without either nothing is checked, and nothing is submitted, as for native radios. `<optgroup label>` runs are
`role="group"` headings. The round box is the control-indicator box (§2.9); the dot is the group's own. Both elements
extend one internal base, `OddkinRadioControl` (`src/form-control/radio-control.ts`).

**`odd-segmented-control`** (`segmented`) — the radio-group behaviour with a segmented look (same foundation class,
another template and style set). `size: sm | md | lg = md` (segment height `target.min`, `control.height.sm` as Figma,
`control.height.md`). An option with `icon` (set through `options`) shows the icon alone and its `label` names it;
descriptions are tooltips (`title`), and groups are one run of segments. Each segment is drawn by its radio
(`appearance: none`) under its text. Use `odd-tabs` to switch content panels.

**`odd-slider`** (`slider`) — an ARIA slider the element draws (owner decision 2026-10-23: a native range's track and
thumb take styles only through prefixed pseudo-elements, and `accent-color` cannot meet Figma's tokens), as
`odd-progress` is drawn instead of `<progress>`. Field anatomy, `value: string` (the attribute is the default; snapped
to `step` from `min` and clamped, halfway without a default, as a native range), `valueAsNumber`, `min = 0`,
`max = 100`, `step = 1`, `name`, `disabled`. The thumb is a `role="slider"` with the APG keys (arrows by `step`,
Page Up and Page Down by a tenth of the range in whole steps, Home and End); a press on the track moves there and
drags. Each key dispatches `input` and `change`; a drag dispatches `input` while moving and one `change` at the end.
Parts `control`, `track`, `fill`, `thumb`, `output` (current value), and `min-label`/`max-label` (endpoints);
`renderValue?: (value: number) => string` formats all three and the announced `aria-valuetext`.

**`odd-rating`** (`rating`, `rating/Item`) — a score from one to `max` stars: the radio-group behaviour drawn as stars
(another template and style set on `OddkinRadioControl`), as the WAI-ARIA rating radio group example. Field anatomy,
`name`, `value` (the chosen star's value, `"1"` to `max`; the attribute is the default), `required`, `disabled`,
`max: number = 5`, `readonly` (the stars stay focusable and `aria-readonly` marks the group; clicks and keys change
nothing; still submitted and, as a native read-only field, barred from validation), `strings` (`star`, `starOne`:
each star's name in the page language's plural forms, "3 stars"; `summary`, "{value} of {max}"; `empty`, "Not
rated"). `<option>` children or `options` name the stars instead, and their count replaces `max`. Each star
(`option`) is drawn by its radio (`appearance: none`) under the built-in star glyph (§2.7); stars up to the chosen
one are `data-state="on"`. Part `value` shows the chosen position. Whole stars only.

**`odd-one-time-code`** (`oneTimeCode`, `oneTimeCode/Cell`) — a verification code sent by message, entered into
`maxlength` cells (default six). One native input on `OddkinTextControl` carries it: `autocomplete="one-time-code"`
(the platform offers the code from a message), `inputmode="numeric"`, and paste work as on any field; separate inputs
per digit would break autofill and read the code as six fields. The input is transparent over the drawn `cell`
parts (hidden from assistive technology); input keeps digits only, at most `maxlength`, and the caret stays after
the last digit (the arrow, Home, and End keys do not move it; a click puts it there; Tab selects the code, as in any\nfield). `minlength` defaults to the cell count, so a short
code is `tooShort` as on a native field. `status: idle | pending | complete = idle` reports the page's check:
`pending` makes the input read-only and shows `strings.pending` with the busy ring, `complete` shows
`strings.complete` with a check; a failure is `error`, which replaces the status line (`role="status"`,
`strings.hint` while idle). Resend is the page's own button.

**`odd-select`** (`select`) — native `<select>` built from the options (§2.2). Field anatomy, `name`, `value` (the
attribute is the default, then the last `<option selected>`, then, without a placeholder, the first usable option, as
native), `options`, `required`, `disabled`, `placeholder` (a disabled empty first option: native valueMissing with
`required`, secondary text while shown). The closed control is the shared control module with Oddkin's chevron
(`appearance: none`); native `input` crosses the shadow boundary and `change` is re-dispatched at the host; reset
restores the declared choice. The browser draws the picker; where `appearance: base-select` and `::picker(select)` are
supported (both gate it), the picker is Figma's raised listbox surface (the overlay module's `overlayPickerStyles`)
with square rows between dividers, drawn with the option-row module (`optionRowPickerStyles`), and the placeholder
stays out of it (F13, features.json `customizable-select`). WebKit reports a `style-src-attr` violation per native
`<select>` under a strict `style-src` (§10.2 of css-architecture.md); the component documents it as a limitation. No
`multiple`: use `odd-listbox` or `odd-combobox multiple`.

**`odd-listbox`** (`listbox`) — persistent choices. Field anatomy, `name`, `value` (the attribute is the default),
`values` (with `multiple`), `options`, `multiple`, `required`, `disabled`, `loading`, `strings` (`loading`, `empty`),
slots `empty`, `status`, `--odd-listbox-max-height`. The listbox element is the focus target and uses
`aria-activedescendant` over option parts (the option-row module, square rows between dividers on Figma's raised
surface; the active option's ring shows while the listbox has focus); typeahead. Single: the selection follows the
active option. Multiple: Space and Enter toggle, Shift+arrows extend, Ctrl+A selects all (APG listbox). Submits the
value (each value under `name` with `multiple`); `required` takes the browser's own valueMissing message from a
detached native select and points it at the listbox (`FormValue` `anchor`); reset restores the declared selection.

**`odd-combobox`** (`combobox`, `multiselect`) — an editable input with a popup listbox (APG combobox, list
autocomplete). Field anatomy, `name`, `value`, `values` and chips (parts drawn with the chip module, collapsing to
"+N") with `multiple`, `required`, `disabled`, `readonly`, `placeholder`, `loading`, `no-filter` (the host filters:
it listens to `odd-query-change`, detail `{ query }`, and replaces `options`), read-only `query`. Part `clear` clears
the value. Slots `empty`, `status`. Value changes dispatch `input` and `change`; typing does not. One shadow tree:
the field box (part `control`, the control look; a search glyph at the start of a single combobox, the chevron with
`multiple`, as Figma draws them) holds the `role="combobox"` input (part `input`), which names the active option with
`aria-activedescendant`; the popup (part `popup`, a manual popover on the overlay wiring and surface, at least as
wide as the field) holds the listbox (part `listbox`, the listbox's square rows between dividers; with `multiple`,
rows start with the control indicator's decorative box). Typing filters by label (case-insensitive contains) and makes
the first match active; Down and Up open the popup on the chosen (or first) and the last option, Alt+Down opens without
one, Alt+Up closes; Enter chooses (single: closes; multiple: toggles and stays open); Escape closes and restores the
chosen option's text, and on a closed combobox clears the text and the value (APG); leaving restores the text. With
`multiple`: Backspace in the empty input removes the last value; Left at the start moves to the chips (parts `chip`,
`chip-remove`, a list named by `strings.selected`), where Left and Right move, Backspace and Delete remove, and Escape
returns; while focus is outside, the chips that do not fit on one line become the `more` part ("+N", read as
`strings.more`). Form semantics are odd-listbox's (one internal base class: the declared default, each value under
`name`, `required` through a detached native select pointed at the input, reset, restore).

**`odd-picker`** (`Picker`) — a field that opens a list or a hierarchy to choose from (APG select-only combobox). One
element whose popup content follows the data (§2.2): `<option>`/`<optgroup>` children or `options` give a listbox;
`items` (`TreeItemRecord`, as `odd-tree`) gives a tree. Name (ADR 0045): HTML's `select` is `odd-select`, a native
select that can hold neither a tree nor chips; APG's `combobox` is `odd-combobox`, which edits text; "picker" is the
name Figma, React Spectrum (`Picker`), and Oddkin's date and colour pickers give a field that opens a chooser, and
covers both contents (the common `TreeSelect` names the tree alone). Field anatomy, `name`, `value`, `values` and
chips with `multiple`, `required`, `disabled`, `placeholder`, `loading`, `options`, `items`, `expanded` (as
`odd-tree`), `strings` (`loading`, `empty`, `clear`, `remove`, `selected`, `more`, `hint`, `count`, `close`, `done`,
`path`), slots `empty`, `status`. Form semantics are odd-combobox's (one internal base: the declared default, each
value under `name`, `required` through a detached native select pointed at the trigger, reset, restore); value
changes dispatch `input` and `change`, expanding dispatches `odd-toggle` (cancelable, as `odd-tree`). One shadow
tree on odd-combobox's field and popup wiring (an internal base, `src/collection/option-field.ts`): the field box
(part `control`) holds the chips and the trigger, a `div` with `role="combobox"` (part `trigger`, the one Tab stop,
`aria-haspopup="tree"` with `items`) that keeps focus and names the active row with `aria-activedescendant`; the
single value shows as its label, a tree item after its parent (`strings.path`, "Transportation / Roads"). The popup
(part `popup`, a manual popover as wide as the field and joined below it) holds the listbox (odd-listbox's rows) or
the tree (odd-tree's rows and its expansion model, `src/collection/tree-model.ts`: expanding never selects, and
selecting a branch never selects its descendants), the states (§2.5), and the footer (part `footer`): the hint or
with `multiple` the count (part `summary`), Clear (part `clear-all`) with `multiple`, and Close, Done with `multiple`
(part `close`), native buttons with the button look. Keyboard: Down, Up, Enter, Space, and Alt+Down open on the
chosen (or first) row, Home and End on the first and last, typing on the next match; in the popup, Up, Down, Home,
and End move the active row, Enter and Space choose it (single: closes; multiple: toggles and stays open), Escape
and Alt+Up close without changing the value; in a tree, Right, Left (mirrored right to left), and `*` as `odd-tree`.
Focus stays on the trigger; leaving closes the popup. On the closed trigger, Backspace removes the last value, and
with `multiple` Left moves to the chips (odd-combobox's chip keys). While the trigger has keyboard focus and the
popup is open, one focus ring (`radius.lg`) surrounds the field and the popup.

**`odd-file-input`** (`fileUpload`) — a drop zone (part `surface`) over a native `<input type="file">` whose
`::file-selector-button` takes the secondary button look. Field anatomy, the `error` taking the place of the `title`
("Choose a file or drop it here", `strings.title` and `strings.titleMultiple`); `name`, `accept`, `multiple`,
`required`, `disabled`; read-only `files: readonly File[]`. Files dropped on the surface replace the choice (the first
only unless `multiple`; not filtered by `accept`, as natively). Chosen files are rows (part `file`, glyph, name, size
in the page language) with remove buttons (part `remove`, `strings.remove`, "Remove {name}"; after a removal focus
moves to the next row's button, the previous one, or the input); the form value is the files under `name`, as a
native file input submits them. `input` and `change` on user changes only.

**`odd-calendar`** (`calendar`, `calendar/Day`) — one date from a month grid (the WAI-ARIA date grid). An element,
not a recipe (§2.1: keys, ARIA wiring, form association), and public: an inline calendar is useful alone, and the
date picker opens it. Field anatomy, `name`, `value` (`YYYY-MM-DD`; the attribute is the default, and anything else
is empty, as a native date input sanitizes it), `min`, `max`, `required`, `readonly`, `disabled`, `first-day` (1
Monday to 7 Sunday, as `Intl.Locale` week information; 0, the default, follows the page language, and Monday where
the browser has none), `isDateDisabled` (a property, `(date: string) => boolean`), `strings` (`previousMonth`,
`nextMonth`, `today`, `clear`). Names come from `Intl.DateTimeFormat` in the page language: the month and year (part
`heading`, a polite live region), the weekday column headers (short names, the full name as `abbr`), and each date's
name (the full date). A `group` named by the label holds the month buttons (parts `previous`, `next`; disabled where
no date of that month is within `min` and `max`), the `grid` of six weeks (part `day`, with `day-outside`,
`day-today` and `aria-current="date"`, `day-selected` and `aria-selected`, `day-disabled` and `aria-disabled`), and
Today and Clear (parts `today`, `clear`), the buttons drawn by the shared native-button sheet. The grid is one Tab
stop, on the active date: the value, else today, within `min` and `max`. Keys: Left and Right a day (mirrored right
to left), Up and Down a week, Home and End the week's first and last day, Page Up and Page Down a month (the month's
last day when it is shorter), with Shift a year; Enter and Space choose; moves stop at `min` and `max`; a date the
hook disables takes focus but cannot be chosen; read-only, nothing is chosen (`aria-readonly`). A click chooses a
date, also one of the month before or after, which then shows. Choosing and clearing dispatch `input` and `change`.
`required`, `min`, and `max` validity come from a detached native date input, pointed at the active date; disabled
or read-only, it is not validated. Focus leaving the calendar marks it touched.

**`odd-date-picker`** (`datePicker`) — one date, typed or chosen from a calendar (the WAI-ARIA date picker dialog;
owner decision B, 2026-10-25: the element draws it, and `odd-input type="date"` keeps the engine's picker). An element
(§2.1: keys, ARIA wiring, form association), public and form-associated. Field anatomy, `name`, `value` (`YYYY-MM-DD`,
sanitized as a native date input sanitizes it; the attribute is the default), `min`, `max`, `required`, `readonly`,
`disabled`, `placeholder`, `first-day`, `isDateDisabled`, `strings` (the calendar's, and `choose`, `change` with
`{date}`, `invalid` with `{format}`, `day`, `month`, `year`). The text input (part `control`, `inputmode="numeric"`)
shows the value as the page language writes a date in digits (`Intl.DateTimeFormat`, two-digit day and month) and reads
typed text as three groups of digits in that order with a four-digit year, when focus leaves it or on Enter. Text that
is not a date stays for the user to correct, the value empties, and validity is `badInput` with `strings.invalid`
("Enter a valid date in DD/MM/YYYY."). The button after it (part `button`: "Choose date", or "Change date," and the
full date; `aria-haspopup="dialog"`, `aria-expanded`) commits typed text, then opens a non-modal dialog (part `popup`,
named "Choose date", a popover on the overlay wiring, ADR 0044) holding an `odd-calendar` with the picker's value,
bounds, first day, hook, read-only state, and strings; focus moves to its active date. Choosing there (Enter, Space, a
click, Today, Clear) commits and closes, and focus returns to the button; Escape or a click outside closes without a
change. `input` and `change` come once for each committed date, not while typing. `required`, `min`, and `max`
validity come from a detached native date input; disabled or read-only, it is not validated; read-only, the calendar
opens and nothing changes. State `open` while the calendar shows.

**`odd-color-picker`** (`colorPicker`, `color/Swatch`) — one colour, typed as hex or chosen in a popup. An element
(§2.1: keys, ARIA wiring, form association), public and form-associated; HTML's colour input is the baseline. Field
anatomy, `name`, `value`, `alpha`, `disabled`, `options` (`{ value, label, disabled }`, or `<option>` children through
the collection source), `strings` (`choose`, `change` with `{color}`, `invalid`, `area`, `areaValue` with
`{saturation}` and `{brightness}`, `hue`, `hex`, `opacity`, `rgb` with `{r}`, `{g}`, `{b}`, `swatches`, `cancel`,
`apply`). The value is sanitized as a native colour input sanitizes it: any CSS colour, black for none, serialized as
lowercase `#rrggbb`; with `alpha` (HTML's attribute, which no engine implements yet), `color(srgb r g b)` with ` / a`
while not opaque, 8 bits per channel. HTML's `colorspace="display-p3"` is not offered. The text input (part `control`)
shows the colour as uppercase hex (with the alpha byte while not opaque) after its swatch (part `swatch`) and reads
three or six hex digits (four or eight with `alpha`, `#` optional) when focus leaves it or on Enter; other text stays
for the user to correct, the colour stays, and validity is `badInput` with `strings.invalid` ("Enter a six-digit hex
color, such as #2563EB."). The button after it (part `button`: "Change color," and the hex; `aria-haspopup="dialog"`,
`aria-expanded`) opens a non-modal dialog (part `popup`, named "Choose color", a popover on the overlay wiring, ADR
0044, joined under the field box) on the colour, and focus moves to the area. The area (part `area`) is one
`role="slider"` (part `area-thumb`): `aria-valuenow` is the saturation and `aria-valuetext` names saturation and
brightness; Left and Right move saturation (swapped right to left), Up and Down brightness, Page Up and Page Down
brightness by ten, Home and End saturation to its ends; a press or drag sets both. The hue (part `hue`, the shared
range pieces) is a slider in degrees, 0 to 360. The hex input (part `hex`) applies valid hex as it is typed and marks
other text invalid, which disables Apply; with `alpha`, the opacity input (part `opacity`) is a spinbutton in percent.
The RGB values (part `rgb`) follow. Suggested colours (part `swatches`, labelled `strings.swatches`) are native radios
named by their labels (part `option-swatch`); the one that is the popup's colour is checked. Apply (part `apply`)
commits the popup's colour and closes; Cancel (part `cancel`), Escape, or a press outside close without a change;
focus returns to the button. `input` and `change` come once for each committed colour, not while typing or picking.
No `required` or `readonly`: HTML's colour input takes neither. State `open` while the popup shows. In forced colours,
the swatches, the area, and the hue track keep the user's colours (the `forced-color-adjust` enhancement).

**`odd-validation-summary`** (`ValidationSummary`) — `label: string` (heading; default `strings.title`, "Please fix
{count} fields", and `strings.titleOne` for one, chosen by the page language's plural rules), `form: string` (ID;
default: the ancestor form). When constraint validation blocks a submission the user starts (a submit button or
Enter in a field), it cancels the browser's own report (no bubble, no focus move), lists each invalid control in form
order as a link that moves focus to the control (`strings.entry`, "{label} — {message}"; the label is the control's
`label`, its `<label>`s, its ARIA name, or its text; radios once per name, named by their fieldset's legend), and
takes focus itself (`tabindex="-1"`, a group named by the heading, with the danger tone look and glyph). A fixed
problem drops out after the next `input` or `change`; the summary hides when none remain, on reset, and when a
submission goes through. Entered values are never cleared. A script's `requestSubmit()` or `checkValidity()` alone
leaves it hidden.

### 3.4 Disclosure and navigation

**`odd-disclosure`** (`Disclosure`, `Accordion`) — native `<details>` and `<summary>`. `label` (summary text),
`open` (reflected), `name` (exclusive group: opening one closes the others with the same `name` in the same tree, as
native `<details name>` does inside one tree; an open member inserted into, or renamed into, a group that has one
open closes itself), `disabled` (the summary leaves the Tab order and reports `aria-disabled`). Dispatches `toggle`
(a `ToggleEvent`) at the host once per change, from any source, including find-in-page. Adjacent members of one group
draw as one surface with dividers (Figma `Accordion`; custom states `joined-start`, `joined-end`).

**`odd-tabs`** (`Tabs`) — `label` (names the tab list), `value` (the selected panel's `value`), `orientation:
horizontal | vertical = horizontal`, `activation: automatic | manual = automatic` (APG). Children: `odd-tab-panel`
(`label`, `value`, `disabled`; content in its default slot), assigned to tab-panel wrappers in the tabs' shadow root
(§2.3; other children are not shown). A panel without `value` is identified by its position ("0", "1", …); when
`value` matches no enabled panel, the first enabled one shows. Arrow keys move between tabs (mirrored right to left),
Home/End, disabled tabs are skipped, focus and selection may differ (Figma); the selected tab is the list's one Tab
stop, followed by the shown panel (`tabindex="0"`). `input` and `change` on user selection. `define/tabs` registers
`odd-tab-panel` too.

**`odd-breadcrumbs`** (`Breadcrumbs`) — `<nav>` named `label` (default `strings.label`, "Breadcrumb"), an ordered
list of links (§2.2 links: `<a href>` descendants, read as data and not rendered, or `items`) with separators hidden
from assistive technology; the last item is the current page, shown as text with `aria-current="page"`. Slot `home`
replaces the first item's text (Figma draws a home icon there): other text, or a decorative icon, in which case the
label stays as hidden text so the item keeps its name. `max-items: number = 0` (0: never collapse); above it, the first item, a "more" button (glyph, named by
`strings.more`, "Show 2 more"), and the last `max-items − 1` items (at least one) show; "more" reveals the rest and
moves focus to the first revealed link.

**`odd-pagination`** (`Pagination`) — `<nav>` named `label` (default `strings.label`) with the position as text
(`strings.status`, "Page 3 of 12") and a list. `current: string` (page number, ADR 0045 navigation `current`; kept
within 1 to `page-count`), `page-count: number`, `href: string` (a template with `{page}`; when set, pages are links).
The current page has `aria-current="page"`. Without `href`, pages are buttons that dispatch `odd-action`, detail
`{ id: '<page>', action: 'page' }` (odd-side-nav's `NavigationActionDetail`); the application loads the page and sets
`current`, and a focused page button keeps focus. Previous and next are always present and disabled at the ends (as
links: no `href`, `role="link"`, `aria-disabled`). Pages shown: first, last, current ±1, the first or last three at
the ends, a one-page gap as that page, longer gaps as a hidden ellipsis.

**`odd-toolbar`** (`Toolbar`) — `label`, `orientation: horizontal | vertical = horizontal`. Host `role="toolbar"`;
one Tab stop with roving focus over its slotted controls (`@oddkin/core/controllers/focus`), arrow keys (mirrored
right to left), Home/End; the last focused control keeps the Tab stop; disabled and hidden controls, text, and `<hr>`
separators (drawn as lines) are skipped; text fields and sliders keep their own arrow keys, Home, and End. Items are author content.

**`odd-tree`** (`Tree`) — `label`, `items` (`TreeItemRecord`: `{ id, label, icon?, disabled?, children?, lazy? }`;
`icon` is a URL drawn by `odd-icon`), `expanded` (property: ids; when set, the element only reports `odd-toggle`;
unset, items holding a selected item start expanded and the user's toggles are kept), `value`, `values`, `multiple`,
`loading`, `strings` (`loading`, `empty`), slots `empty`, `status`. Flat `treeitem` rows with `aria-level`,
`aria-setsize`, `aria-posinset`, drawn by the navigation-row module shared with `odd-side-nav` (a selected row takes
its current-row marker). A click on a row selects it; a click on its chevron expands or collapses it. Selection
dispatches `input` and `change`; expanding dispatches `odd-toggle`, detail `{ id, expanded }`, cancelable (lazy
children: the row is busy until the host assigns new `items` in which the item has `children`). APG tree keyboard
(arrows mirrored right to left, Home/End, `*`, Enter and Space, typeahead); one Tab stop, on the selected row. The
rows, their expansion, and the hierarchy keys are one internal model shared with `odd-picker`'s tree.

### 3.5 Overlays

**`odd-popover`** (`popover`) — the host is the popover (`popover="auto"` unless the author wrote `manual`), so
`<button popovertarget>` opens and closes it with no script. `anchor` (an ID in the same tree; default: the
`[popovertarget]` invoker in that tree) or the `anchorElement` property, `side = block-end`, `align = start` (flip and
shift by the position controller); `label` names the host `role="dialog"`; parts `base` (content) and `close` (a glyph
button named by `strings.close`) unless `no-close`. `show()`, `close()`, `open` (reflects); native
`beforetoggle`/`toggle` on the host. Opening leaves focus where it is; closing with focus inside returns it to where it
was. Fades in and out with the overlay-surface module unless motion is reduced. The wiring other overlays share is
`Overlay` and `closeButton` in `packages/components/src/overlay/overlay.ts` (internal).

**`odd-tooltip`** (`tooltip`) — `anchor` (an ID in the same tree), `anchorElement` (property), `side = block-start`,
`align = center`, `open` (reflected), `show()`, `close()`; default slot: short text. The host is the surface
(`popover="manual"`, role `tooltip`, part `base`). Shows on anchor hover after 500 ms (not for touch) and at once on
focus; stays while the pointer is on the anchor or the tooltip (100 ms to cross between them) or focus is in the
anchor; Escape hides it and is consumed (WCAG 1.4.13: hoverable, dismissible, persistent). Describes its anchor with
`aria-describedby` (same tree; an `id` is generated when it has none); never the only name. An Oddkin control anchor
renders the text as its inner focus target's description instead (`_describe`, §2.4), following text changes.

**`odd-dialog`** (`dialog`, `alertDialog`) — native `<dialog>` in the shadow root, always modal (`showModal()`, so
the page is inert; non-modal surfaces are `odd-popover`). `open` (reflected), `label` (the title, an `h2`, names it),
`alert: boolean` (`role="alertdialog"`, described by the body), `closedby: any | closerequest | none = closerequest`
(the native attribute where supported; elsewhere emulated: `any` closes on a press on the backdrop after a cancelable
`cancel`, `none` cancels Escape), `no-close`, `strings.close`. Default slot: body; slots `header` (under the title),
`footer` (actions at the inline end, under a divider; hidden while empty); parts `dialog`, `header`, `title`, `body`,
`footer`, `close`. `show()`, `close(returnValue?)`, `returnValue`; `close` and a cancelable `cancel` at the host.
Opening moves focus to the slotted `[autofocus]`, else the first control in the content, else the close button;
closing returns it to the opener. A slotted `<form method="dialog">`, or a `formmethod="dialog"` submitter, closes it
with the submitter's value (the native lookup does not cross the shadow boundary, so the element does it). Width
`--odd-dialog-inline-size` (32rem) within the viewport; height at most `100dvh` less a margin, the body scrolling.
The wiring is `ModalDialog` (`packages/components/src/overlay/dialog.ts`), which the drawer and the command palette
share.

**`odd-drawer`** (`drawer`) — `odd-dialog` with a side-sheet layout (it extends `OddkinDialog`).
`side: inline-start | inline-end = inline-end`, logical, so right-to-left text mirrors it. Modal by default; `no-modal`
opens it with `show()` (`ModalDialog`'s `modal: false`): no backdrop, nothing inert, and focus may leave it, while
Escape, and with `closedby="any"` a press outside it, still close it (emulated where the browser lacks `closedby`);
non-modal it is not in the top layer and stacks at `z-index.overlay`. Fixed at the inline edge for the viewport's height
less `space.sm`, the body scrolling; width `--odd-drawer-inline-size` (24rem) within the viewport; dividers under the
header and above the actions. Everything else as `odd-dialog`.

**`odd-toast`** (`toast`) — `tone`, `label` (the title: visible text above the message, UI type in `text.primary`;
the message is Small in `text.secondary`), `open`, `duration: number = 5000` (ms, read at each opening; 0 stays; any
toast with an action stays, WCAG 2.2.1), default slot: message, slot `end`: action. Top layer (`popover="manual"`) at
the block-end and inline-end corner, logical, so right-to-left text mirrors it. Open toasts stack in document order,
the last at the corner and `space.sm` apart, so reading and Tab order follow the screen; a new toast inserted before
the open ones stacks above them, and none moves under the pointer. Each toast is its own live region, `role="status"`
(`role="alert"` for `danger`): its title and message join the region just after it shows, so they are announced, and
the title is never an `aria-label`. No toast's time runs while the pointer or focus is on any open toast, or while the
page is hidden. Part `close`. `show()`, `close()`; native `toggle`.

### 3.6 Action collections

**`odd-menu`** (`Menu`, `MenuItem`) — menu button (APG): it renders its own trigger (part `trigger`, a native
`<button>` with the button look of the native-button path, `appearance`, `size`, `disabled`; default slot: trigger
content, manually assigned so the entry children are never rendered; `label` names a glyph-only trigger) and the menu
(part `menu`, a popover on the overlay wiring and the overlay surface, under the trigger and at least as wide).
Items per §2.2 actions, with groups (part `group` headings), separators (part `separator`), icons, shortcuts, the
danger tone, and submenus (part `submenu`, each a nested popover beside its item on its own overlay wiring while
open); rows (part `item`) are the option-row module, with the hover surface on the focused row (Figma `MenuItem`
Focus). `odd-action`, detail `{ id, action: 'select' }` (`id` is the item's `id`), cancelable (keeps the menu open);
choosing closes every level and focus returns to the trigger. Only the menu's own `beforetoggle` and `toggle` reach
the host. `show()`, `close()`. Keyboard: Enter, Space, Down open on the first item, Up on the last (roving focus per
level, disabled items focusable); Up/Down wrap, Home/End, typeahead; Enter and Space choose; Right opens a submenu,
Left and Escape close one level and return focus to its item; focus leaving every level (Tab, Shift+Tab) closes it.

**`odd-split-button`** (`splitAction`) — two independent targets in one element, two separate buttons a small gap
apart (Figma): a primary `<button>` (part `primary`, default slot manually assigned as on `odd-menu`, `value`) and a
complete `odd-menu` with a glyph-only trigger named by `strings.more` ("More actions"), whose parts it forwards
(`exportparts`: `trigger`, `menu`, `submenu`, `item`, `group`, `separator`). Items per §2.2 actions, passed to the
menu. `appearance`, `size`, `disabled` (both halves), `loading` (part `spinner`; the primary half keeps focus, sets
`aria-disabled`, and ignores presses). Both report `odd-action`: the primary half with `{ id: value, action:
'primary' }`, the menu with `{ id, action: 'select' }` for the item (cancelable, as on `odd-menu`).

**`odd-command-palette`** (`CommandPalette`, `CommandItem`) — a modal dialog with a search input and results
(`aria-activedescendant` from the input). `open`, `label`, `placeholder`, `items` (`{ id, label, description?, icon?,
shortcut?, group?, disabled? }`), `loading`, `no-filter` with `odd-query-change`, slots `empty`, `status`. Enter
dispatches `odd-action` `{ id, action: 'select' }` and closes (cancelable); Escape closes and focus returns to the opener (native
dialog behaviour). Built on the shared modal wiring (`ModalDialog`: `closedby="any"`, initial focus in the search input,
focus return) and the overlay surface's sheet with Figma's raised surface and `radius.lg`; read-only `query`; `show()`,
`close()`. Parts `dialog`, `search` (the field, ringed in the focus colour while the input has focus, with an Esc hint),
`input` (`role="combobox"`, named by `strings.search`), `listbox` (named by `label`), `item` (option-row module on
Figma `CommandItem`: the active command in the selection colours with `aria-selected`, its shortcut in the code role),
`group` (eyebrow headings for consecutive items with one `group`), `loading`, `empty`, `footer` (the keyboard hints,
`strings.navigate`, `choose`, `close`). Typing filters by label and makes the first match active; Up and Down wrap; each
opening starts from an empty search. Item icons are `odd-icon`, as on `odd-menu`.

### 3.7 Layout

**`odd-split-panel`** (`SplitPanels`, `Splitter/*`) — two panes in slots `start` and `end`, a focusable separator
between them (APG window splitter, `aria-valuenow` in percent, `aria-controls` the start pane). `orientation:
horizontal | vertical = horizontal` (side by side or stacked), `position: number = 50` (percent of the start pane),
`min = 0`, `max = 100`, `collapsed: boolean` (Enter toggles and restores the previous position; the start pane is
hidden), `label` (names the separator; default `strings.label`, "Resize"). Arrow keys step by 1%, Home/End go to the
limits. Dragging and keys dispatch `input`; release and key commits dispatch `change` (Enter dispatches both). Built on
`@oddkin/core/controllers/resize`: a drag follows the pointer's distance with pointer capture, and the separator's centre
sits on the position. Parts `base`, `start`, `separator`, `end`; `--odd-split-panel-separator-size`. Stacked panes
need a height on the element. More panes: nest split panels.

**`odd-scroll-region`** (`ScrollRegion`) — content that scrolls on its own inside a page; `block-size` or
`max-block-size` on the element bounds it. Keyboard users can reach and scroll it (WCAG 2.1.1): while its content
overflows, the scroller (part `base`) is focusable (`tabindex="0"`) and a `role="region"` named by `label` (default
`strings.label`, "Scrollable content"); when it fits, neither, so it adds no tab stop. It measures once it has rendered,
then follows its own size and its content's (`ResizeController`). Default slot, children `layout.gap` apart
(`--odd-scroll-region-gap`); where supported, the scrollbar gutter is stable.

**`odd-container`** (`Container`) — a content measure and an inline-size container: `measure: constrained |
fluid = constrained` (constrained: centred, at most the theme's `layout.measure`, 40rem, wide, or
`--odd-container-measure`; fluid: the full width). The element is the query container (`container: odd-container /
inline-size`), so container queries and recipe conditions inside it resolve against its width. It has no inset of its
own, as Figma draws it: insets are `.odd-box`'s (one home). No role or tab stop. Default slot; part `base`.

## 4. Recipes

| Recipe | Selectors | Notes |
| --- | --- | --- |
| Typography (`typography.css`) | `.odd-type-display`, `-title`, `-section`, `-body`, `-ui`, `-small`, `-eyebrow`, `-code` | The eight type roles (`--odd-type-*`); `small`, `eyebrow`, and `code` in the secondary text colour; native `h1`–`h6`, `p` keep their semantics. Heading roles take `text-wrap: balance` where supported |
| Link (`link.css`) | `a.odd-link` | UI text in the link colour, an underline on hover and keyboard focus (always inside `p` and `li`), the focus ring. For a link that opens a new tab, add an icon and say so in its text |
| Divider (`divider.css`) | `hr.odd-divider`, `.odd-divider` | A labelled divider ("or") is an element the author gives `role="separator"` and `aria-label` |
| Keyboard key (`kbd.css`) | `kbd.odd-kbd` | Sequences are adjacent keys with words between them |
| List (`list.css`) | `ul.odd-list`, `ol.odd-list`, `.odd-list-meta` | Rows divided by rules; the item with `aria-current` takes the selection colours; actions are author content |
| Table (`table.css`) | `table.odd-table` | Native table semantics; `aria-sort` headers in the primary colour; a row holding a checked checkbox takes the selection colours; loading, empty, and error rows are author content |
| Field (`field.css`) | `.odd-field`, `.odd-field-label`, `.odd-field-description`, `.odd-field-control`, `.odd-field-error` | For native and third-party controls (`<label for>`, `aria-describedby`, and `aria-invalid` written by the author); `.odd-field-control` marks the control, so checkboxes and other controls in the field keep their own look. Generated from the control module's rules, with the same `--odd-field-height`, `-radius`, `-border-color`, and `-background` variables as every Oddkin form control |
| Layout (`layout.css`) | `.odd-box` (`-none`, `-roomy`), `.odd-center`, `.odd-aspect-ratio` (`--odd-aspect-ratio`: 16 / 9 default; Figma's 4 / 3 and 1 / 1 through the property); variants of the existing classes: `.odd-stack-tight`, `.odd-stack-loose`, `.odd-row-between`; `--odd-grid-columns` takes Figma's 1–4 and any other count; presets from demonstrated needs (layout-recipes.md §13): `.odd-split-end` (the side after the main content), `.odd-auto-grid-fit` (a few items across the row) | Figma `Oddkin/Layout/*` (section 457:2078). Box insets and stack gaps default to the layout roles (`layout.inset`, `layout.gap`); the modifier classes are Figma's variants, presets that set the token itself (`space.none`, `space.xl`, `space.xs`, `space.lg`), and the override properties (`--odd-box-inset`, `--odd-stack-gap`, …) take one-off values (layout-recipes.md §12) |
| Avatar group (`avatar-group.css`) | `.odd-avatar-group`, `.odd-avatar-group-more` | Overlapping `odd-avatar` children ringed in the page colour; the author names the group |
| Timeline (`timeline.css`) | `ol.odd-timeline` | Events newest first: `<li><odd-status-marker status="complete"></odd-status-marker><div>title, time, detail</div></li>`. The markers (`icon.size.lg`) sit on a rail joined by a `color.border.default` connector `space.2xs` below each marker; past events (an idle, empty marker) show a dot on the sunken surface, complete and pending ones the selection surface, failed ones the danger surface. The content's first child is the title (UI role; the danger colour when the event failed), the others the time and detail (small, secondary); long content wraps. Status is said in words (the title); `<time datetime>` for times |
| Stepper (`stepper.css`) | `ol.odd-stepper` | Navigation through the steps of a task, not a form control: `<li><odd-status-marker status="complete"></odd-status-marker><div><a href>Name</a><span>Complete</span></div></li>`, a number in the marker for current and upcoming steps. The current step has `aria-current="step"` (on the `li` or its link) and the marker's action colours; a failed marker (Figma's "!" is the warning glyph) turns the step's words danger. Names in the UI role, status words small and secondary; links keep the text colour and their underline. Steps share the row, `space.sm` apart, and stack at 36rem of the list (container `odd-stepper`). Panels, actions, and validation are application content |
| Description list (`description-list.css`) | `dl.odd-description-list` | Native `<dl>` term and value pairs, each pair a `<div>` row (as HTML allows) divided by a rule; terms in the secondary UI role, values in the body role. One stable term column for every row (subgrid), as wide as the longest term up to `--odd-description-list-term-width` (33%); long terms and values wrap. The list is an inline-size container (`odd-description-list`): at 36rem of its own width or less, each term stacks above its value. A missing value is author text ("Not provided"), never an empty `<dd>` |

## 5. Build order

Dependencies first, each step complete to §2.10 before the next:

1. Shared modules: glyphs, tone, spinner, control (extracted from `odd-input`), control indicator, option row,
   overlay surface; core: typeahead, active descendant, and resize controllers (`@oddkin/core/controllers/*`).
2. Display: `odd-badge`, `odd-icon`, `odd-spinner`, `odd-progress`, `odd-skeleton`, `odd-avatar`, `odd-chip`,
   `odd-alert`, `odd-empty-state`; recipes.
3. Form controls: `odd-button` toggle, `odd-input` types, `odd-textarea`, `odd-checkbox`, `odd-switch`,
   `odd-checkbox-group`, `odd-radio-group`, `odd-segmented-control`, `odd-slider`, `odd-select`, `odd-file-input`,
   `odd-validation-summary`; the `Form` example.
4. Disclosure and navigation: `odd-disclosure`, `odd-tabs`, `odd-breadcrumbs`, `odd-pagination`, `odd-toolbar`.
5. Overlays: `odd-popover`, `odd-tooltip`, `odd-dialog`, `odd-drawer`, `odd-toast`.
6. Collections: `odd-listbox`, `odd-menu`, `odd-split-button`, `odd-combobox`, `odd-command-palette`, `odd-tree`.
7. Layout: `odd-split-panel`; the layout primitives (`layout.css` additions, `odd-scroll-region`, `odd-container`).
