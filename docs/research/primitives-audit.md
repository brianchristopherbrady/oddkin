# Base primitives audit

<!-- Generated from primitives-audit.json by primitives-audit.render.mjs. Edit the JSON, then run: node docs/research/primitives-audit.render.mjs --write -->

The owner, 2026-11-15: refine the primitives before the AI components, in alphabetical order. Started 2026-11-15, Agent 1 (packages/components). [primitives-audit.json](./primitives-audit.json) holds the same data for agents.

## Scope

The standalone components on Figma page 02 · Primitives (158:22), in alphabetical order of their Figma names, with the element or CSS recipe that implements each.

Not in this audit:

- AI components: Paused by the owner on 2026-11-15 until the primitives are refined.
- Composed components (Figma page 03 · Composed components, 356:62): Built from primitives; audited after them.
- Parts of composed components drawn on page 02: calendar Day, CheckboxOption, color Swatch, CommandItem, GridCell, GridColumnHeader, GridSelection, ListboxOption, ListboxSurface, MenuItem, multiselect parts, NavigationItem, oneTimeCode Cell, Splitter: Audited with the component that owns them.
- Layout primitives (Oddkin/Layout/*, page 02, frame 07 · Layout): Their own contract (layout.css); audited after the component primitives.
- Implementation reference specimens (odd-button/*, odd-input/* on page 02): Reference renders, read with the button and input rows.
- odd-status-marker: No Figma family: to audit once it is drawn, or with the composed components that use it.

## Notes

- The Figma snapshot (design/figma/components.json) matched the live Primitives page on 2026-11-15: the same 104 families, names, and variant counts. The page also has six top-level review frames (354:11578 to 354:11589, 685:3157) and 19 "Review row" frames; each audit reads its rows there too.
- Figma's review rows label Button and Text input SHIPPED and every other primitive DESIGN, though all are built. A row could turn SHIPPED when its primitive is done here.

## Checks

| Check | Question |
| --- | --- |
| API | Every Figma property maps to an attribute, a slot, a CSS custom property, or a browser state, with Figma's default. |
| Visual | Every token Figma binds reaches the styles, in light and dark. |
| Parity | The Figma parity tests compare every variant and state Figma draws. |
| Accessibility | Role and name, the contrast of every colour pair, the focus ring, the target size, forced colours. |
| Responsive | It follows docs/architecture/responsiveness.md in the space its parent grants. |
| Docs | An example shows each API value, with guidance for people and agents. |

Each check is ok, gap, n/a, or ? (not checked yet). A primitive is not started, audited, decided, fixing, done.

## Matrix

| # | Primitive | Figma | Code | Status | API | Visual | Parity | Accessibility | Responsive | Docs |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | [avatar](#1-avatar) | avatar (162:2022), avatar/Appearance (374:1576), AvatarItem (257:886) | `odd-avatar`, `.odd-avatar-group (avatar-group.css)` | audited | gap | gap | gap | ? | ok | gap |
| 2 | [badge](#2-badge) | badge (159:582) | `odd-badge` | audited | ok | gap | gap | ? | ok | ok |
| 3 | [button](#3-button) | button (159:439), button/sm (181:2332), button/lg (181:2390) | `odd-button`, `.odd-button (button.css)` | audited | gap | gap | ok | ? | ok | gap |
| 4 | [checkbox](#4-checkbox) | checkbox (159:1181) | `odd-checkbox` | audited | ok | ok | ok | ? | ok | ok |
| 5 | [chip](#5-chip) | chip (159:612) | `odd-chip` | audited | ok | ok | ok | gap | ok | ok |
| 6 | [copyButton](#6-copybutton) | copyButton (555:2984) | `odd-copy-button` | audited | ok | ok | ok | ? | ok | gap |
| 7 | [disclosure](#7-disclosure) | Disclosure (160:1501) | `odd-disclosure` | audited | ok | ok | ok | ? | ok | ok |
| 8 | [divider](#8-divider) | divider (162:2069) | `.odd-divider (divider.css)` | audited | ok | ok | gap | gap | ok | gap |
| 9 | [field](#9-field) | field (159:971) | `.odd-field (field.css)` | audited | gap | ok | gap | ? | ok | gap |
| 10 | [icon](#10-icon) | icon (162:2058) | `odd-icon` | audited | ok | ok | gap | ok | ok | ok |
| 11 | [iconButton](#11-iconbutton) | iconButton (159:471) | `odd-button` | audited | gap | gap | gap | ok | ok | gap |
| 12 | [input](#12-input) | input (159:1024) | `odd-input` | audited | gap | gap | ok | ? | ok | ok |
| 13 | [keyboardKey](#13-keyboardkey) | keyboardKey (162:2097) | `.odd-kbd (kbd.css)` | audited | ok | gap | ok | ok | ok | gap |
| 14 | [link](#14-link) | link (159:549) | `.odd-link (link.css)` | audited | ok | ok | gap | ? | ok | gap |
| 15 | [number](#15-number) | number (159:1097) | `odd-input` | audited | ok | gap | ok | ? | ok | ok |
| 16 | [progress](#16-progress) | progress (161:1916) | `odd-progress` | audited | ok | ok | gap | ? | ok | ok |
| 17 | [radio](#17-radio) | radio (159:1209) | `odd-radio-group` | not started | ? | ? | ? | ? | ? | ? |
| 18 | [rating](#18-rating) | rating (555:2787), rating/Item (555:2595) | `odd-rating` | not started | ? | ? | ? | ? | ? | ? |
| 19 | [relativeTime](#19-relativetime) | relativeTime (555:3030) | `odd-relative-time` | not started | ? | ? | ? | ? | ? | ? |
| 20 | [search](#20-search) | search (159:1144) | `odd-input` | not started | ? | ? | ? | ? | ? | ? |
| 21 | [skeleton](#21-skeleton) | skeleton (161:1959) | `odd-skeleton` | not started | ? | ? | ? | ? | ? | ? |
| 22 | [slider](#22-slider) | slider (159:1287) | `odd-slider` | not started | ? | ? | ? | ? | ? | ? |
| 23 | [spinner](#23-spinner) | spinner (161:1939) | `odd-spinner` | not started | ? | ? | ? | ? | ? | ? |
| 24 | [stat](#24-stat) | stat (555:2908) | `odd-stat` | not started | ? | ? | ? | ? | ? | ? |
| 25 | [switch](#25-switch) | switch (159:1258) | `odd-switch` | not started | ? | ? | ? | ? | ? | ? |
| 26 | [textarea](#26-textarea) | textarea (159:1056) | `odd-textarea` | not started | ? | ? | ? | ? | ? | ? |
| 27 | [toggleButton](#27-togglebutton) | toggleButton (159:501) | `odd-button` | not started | ? | ? | ? | ? | ? | ? |
| 28 | [tooltip](#28-tooltip) | tooltip (160:2470) | `odd-tooltip` | not started | ? | ? | ? | ? | ? | ? |
| 29 | [typography](#29-typography) | typography (162:2080) | `typography.css` | not started | ? | ? | ? | ? | ? | ? |

## 1. avatar

Status: audited (2026-11-15). Figma draws five preset backgrounds, a custom HEX background, and four corner radii (Oddkin/Common/avatar/Appearance, 374:1576; the review row 374:1580). odd-avatar has neither: it always draws a sunken circle with primary-text initials. Sizes match.

| Figma family | Id | Variants | Properties |
| --- | --- | --- | --- |
| Oddkin/Common/avatar | 162:2022 | 2 | State: Group, Initials |
| Oddkin/Common/avatar/Appearance | 374:1576 | 24 | Background: Brand, Custom, Danger, Neutral, Success, Warning; Shape: Circle, Rounded, Small radius, Square |
| Oddkin/Common/AvatarItem | 257:886 | 1 | — |

Code: `odd-avatar` (packages/components/src/avatar/), `.odd-avatar-group (avatar-group.css)`.

| Attributes | Slots | Parts | CSS properties | Events |
| --- | --- | --- | --- | --- |
| `label: string = ""`, `src: string = ""`, `size: sm \| md \| lg = md` | `(default)` | `base`, `image` | `--odd-avatar-size` | — |

| Finding | Check | What | Proposal |
| --- | --- | --- | --- |
| AV1 | api | Figma Background (Neutral, Brand, Success, Warning, Danger) has no attribute. Figma binds Neutral color.neutral.surface with color.neutral.foreground initials; Brand color.action.default with color.text.on-action; Success, Warning, and Danger color.<tone>.surface with color.<tone>.foreground. Every token exists. | A colour attribute (decision D1), each value drawing Figma's pair of tokens. |
| AV2 | api | Figma Background=Custom takes any HEX fill on the avatar, with the initials colour overridable on its own. The element offers only ::part(base). | CSS custom properties --odd-avatar-background and --odd-avatar-color (per instance through style, for example a colour from user data). The guidance says the author owns the contrast of a custom pair. |
| AV3 | api | Figma Shape (Square radius.none, Small radius radius.sm, Rounded radius.md, Circle radius.full) has no attribute; avatar.structural.styles.ts hard-codes border-radius: 50%. | A shape attribute (decision D2), and --odd-avatar-radius for any other radius. |
| AV4 | visual | Two Figma families disagree on the default look. avatar/Appearance draws Neutral as color.neutral.surface with color.neutral.foreground, and 32 px initials in the UI type. The older avatar State=Initials (the one the parity test compares) binds color.surface.sunken with color.text.primary, and the code follows it, with the small type at size sm. | Decision D3. Then the default draws the current family and the other is updated in Figma. |
| AV5 | visual | Figma's AvatarItem draws a border.width.strong ring in color.surface.default on every avatar. The code rings avatars only inside .odd-avatar-group, as a box-shadow in color.canvas. | Keep the ring for groups only, where it separates overlapping avatars (on the default surface a lone avatar's ring cannot be seen), recorded as a deliberate difference; draw it in Figma's color.surface.default. |
| AV6 | visual | Sizes match: Figma Small 32, Medium 40, Large 48 px are control.height.sm, md, and lg; size is sm, md, or lg. | None. |
| AV7 | parity | The parity tests compare only avatar State=Initials (md and sm) and the multiselect avatars view. Not compared: the 24 Appearance variants, the Group variant (.odd-avatar-group and .odd-avatar-group-more), the ring. | Compare every Background and Shape variant, and the group, in light and dark, with the fix. |
| AV8 | a11y | Not yet measured: the contrast of each preset's initials on its fill, in light and dark. Forced colours: the element draws a 1px CanvasText border, which must follow every shape. | Measure each pair (at least 4.5:1 for the initials) with the fix. |
| AV9 | docs | Examples cover sizes, a picture, an overflow count, an avatar beside a name, and name versus label; none shows a colour, a shape, a custom colour, or a group. | An example per new value, one with a custom colour, and a group with its overflow avatar. |
| AV10 | figma | For the owner, in Figma: (a) the review row's "Large · 12 px" is an instance of Shape=Rounded with its radius overridden to radius.lg, and there is no Large shape; (b) the Appearance set's default variant is Square, while AvatarItem and the older family are circles; (c) Custom's initials bind repo/ref/neutral/0, a reference colour, not a role token. | Decide (a) and (b) with D2; bind (c) to a role, or leave the custom foreground to the author. |

Decisions for the owner:

- **D1: The colour attribute: name and values.** Open.
  1. tone="neutral | brand | info | success | warning | danger": ADR 0045's meaning-colour name, with brand added for the avatar and info kept so it matches odd-badge and odd-alert (Figma has no Info avatar yet).
  2. tone with ADR 0045's values only (no brand), and the brand look stays the .odd-avatar-group-more recipe.
  - Recommendation: The first. odd-badge and odd-alert already take tone through the shared tone styles (packages/components/src/styles/tone.styles.ts), which draw neutral, info, success, warning, and danger with the same color.<tone>.surface and color.<tone>.foreground pairs Figma's avatar presets bind; only brand is new, and ADR 0045 records it as an avatar tone.
- **D2: The shape attribute: name, values, and default.** Open.
  1. shape="circle | rounded | small-radius | square", Figma's Shape values, default circle (today's look and AvatarItem's).
  2. radius="none | sm | md | full", the radius token names.
  - Recommendation: The first: Figma's property name and values, as button's appearance follows Figma; default circle. Any other radius (the review row's 12 px) through --odd-avatar-radius.
- **D3: Which Figma avatar is current: avatar/Appearance (the one linked on 2026-11-15) or the older avatar State=Initials?** Open.
  1. avatar/Appearance; the older Initials variant is updated or removed in Figma.
  2. The older avatar.
  - Recommendation: avatar/Appearance: Neutral becomes color.neutral.surface with color.neutral.foreground, and 32 px initials keep the UI type.

## 2. badge

Status: audited (2026-11-15). The API covers Figma: tone gives the five colours with their glyphs, and no-marker gives Count. Colours, radius, glyph size, and the Status type match. The spacing does not: Figma draws 8 px between glyph and text and a 28 px height; the code computes to 4 px and 22 px. Figma binds neither, so the parity test cannot see it.

| Figma family | Id | Variants | Properties |
| --- | --- | --- | --- |
| Oddkin/Common/badge | 159:582 | 6 | State: Count, Danger, Info, Neutral, Success, Warning |

Code: `odd-badge` (packages/components/src/badge/).

| Attributes | Slots | Parts | CSS properties | Events |
| --- | --- | --- | --- | --- |
| `tone: neutral \| info \| success \| warning \| danger = neutral`, `no-marker: boolean = false` | `(default)` | `base`, `marker` | `--odd-badge-radius` | — |

| Finding | Check | What | Proposal |
| --- | --- | --- | --- |
| BG1 | api | Figma State (Neutral, Info, Success, Warning, Danger, Count) maps to tone (neutral \| info \| success \| warning \| danger) and no-marker for Count. Figma's glyphs match toneGlyph: info for Neutral and Info, checkCircle for Success, warning for Warning and Danger. | None. |
| BG2 | visual | Gap between glyph and text: Figma 8 px (the glyph at x8 to 24, the text at x32), the code space.2xs (4 px). | Decision D1. |
| BG3 | visual | Height: Figma 28 px, the 18 px text 5 px from the top and bottom (5 px is not a token). The code: space.3xs (2 px) above and below the 18 px line, 22 px. Count: Figma a fixed 44 px box, the code about 30 px (space.xs either side of the digits). | Decision D1. |
| BG4 | visual | Matching: color.<tone>.surface and color.<tone>.foreground, radius.sm (overridable with --odd-badge-radius), the 16 px glyph (icon.size.sm), 8 px before it (space.xs), and the Status type (font.size.xs, font.weight.medium, line height 150%). | None. |
| BG5 | parity | The parity test compares fills, radius, and text for all six states; it cannot compare the gap or the height, which Figma does not bind (BG6). | Once Figma binds them, compare itemSpacing and padding (fields), and the height. |
| BG6 | figma | For the owner, in Figma: each badge Surface is a fixed 120 x 28 frame (Count 44 x 28) with no auto layout, so its padding, gap, and size are positions rather than tokens, and its width does not follow the text. | Auto layout on Surface: padding space.2xs and space.xs, gap from D1, hugging the text. |
| BG7 | a11y | Not yet measured: the contrast of each tone's foreground on its surface, in light and dark. The badge has no role and is read as text; its glyph is the non-colour marker; forced colours draw a 1px CanvasText border. | Measure the five pairs with the fix. |
| BG8 | responsive | The badge is at most as wide as its parent and wraps long words (overflow-wrap: anywhere). | None. |

Decisions for the owner:

- **D1: Badge spacing: Figma's look (8 px gap, 28 px tall, unbound) or the code's (4 px, 22 px)?** Open.
  1. Figma's, in tokens: gap space.xs (8 px), padding space.2xs (4 px) above and below, 26 px tall (the nearest token height to 28); Figma's Surface gets the same auto layout.
  2. The code's compact badge (space.2xs gap, space.3xs padding), and Figma is redrawn to match.
  - Recommendation: The first: Figma's spacing, expressed in tokens, with Figma bound to the same tokens so the parity test locks it.

## 3. button

Status: audited (2026-11-15). The closest to Figma so far: every appearance, size, and state matches, and the parity test compares all 54 in three engines. Two gaps: the default appearance (Figma primary, the code secondary), and the leading icon, which Figma draws at 16 px while the start slot leaves an odd-icon at its 20 px default.

| Figma family | Id | Variants | Properties |
| --- | --- | --- | --- |
| Oddkin/Common/button | 159:439 | 18 | Appearance: ghost, primary, secondary; Size: md; State: Default, Disabled, Focus, Hover, Loading, Pressed |
| Oddkin/Common/button/sm | 181:2332 | 18 | Appearance: ghost, primary, secondary; Size: sm; State: Default, Disabled, Focus, Hover, Loading, Pressed |
| Oddkin/Common/button/lg | 181:2390 | 18 | Appearance: ghost, primary, secondary; Size: lg; State: Default, Disabled, Focus, Hover, Loading, Pressed |

Code: `odd-button` (packages/components/src/button/), `.odd-button (button.css)`.

| Attributes | Slots | Parts | CSS properties | Events |
| --- | --- | --- | --- | --- |
| `appearance: primary \| secondary \| ghost = secondary`, `size: sm \| md \| lg = md`, `type: button \| submit \| reset = button`, `disabled: boolean = false`, `loading: boolean = false`, `full-width: boolean = false`, `toggle: boolean = false`, `pressed: boolean = false`, `name: string = ""`, `value: string = ""`, `formaction: string \| undefined = undefined`, `formmethod: string \| undefined = undefined`, `formenctype: string \| undefined = undefined`, `formtarget: string \| undefined = undefined`, `formnovalidate: boolean = false`, `label: string = ""` | `(default)`, `end`, `start` | `control`, `spinner` | `--odd-button-background`, `--odd-button-border-color`, `--odd-button-color`, `--odd-button-height`, `--odd-button-padding-inline`, `--odd-button-radius` | `input`, `change` |

| Finding | Check | What | Proposal |
| --- | --- | --- | --- |
| BT1 | api | Figma's properties map: Appearance (primary, secondary, ghost) to appearance; Size (the button, button/sm, and button/lg sets) to size; State Disabled and Loading to disabled and loading, Hover, Pressed, and Focus to browser states; Label to the default slot; Icon with Show icon to the start slot. The code adds type, full-width, toggle, pressed, label (an icon-only name), and the form attributes. | None. |
| BT2 | api | The default appearance: Figma's sets default to primary; odd-button defaults to secondary. | Decision D1. |
| BT3 | visual | Figma's Leading icon is 16 x 16 at every size (icon.size.sm), 8 px (control.gap) before the label. The start and end slots do not size their content, so an odd-icon there is 20 px (its md default) unless the author sets size="sm". | Size an odd-icon in the start and end slots to icon.size.sm, and compare Show icon in the parity test. |
| BT4 | visual | Matching: sm, md, and lg are 32, 40, and 48 px with 8, 12, and 16 px inline padding and the 8 px control.gap; labels 14, 14, and 16 px; primary on color.action.default, secondary on color.surface.default, ghost without a fill; Disabled keeps the appearance at 50% opacity (Figma's review 685:3157). | None. |
| BT5 | parity | figma-parity.browser.test.ts compares every Appearance, Size, and State (54 cases: frame, gap, label, focus ring) in Chromium, Firefox, and WebKit; Pressed is skipped in Firefox, which applies no :active while Space is held. The .odd-button recipe is the same stylesheet (styles.test.ts), with its own styling test. | Add the leading icon (BT3). |
| BT6 | figma | For the owner: the 50% disabled opacity is a raw value in Figma and in the code; no opacity token exists. | An opacity token for disabled controls, with the tokens lane, or accept the raw value. |
| BT7 | a11y | A native button: keyboard, focus, and name from the platform; the focus ring is compared with Figma; label names an icon-only button (button.browser.test.ts); a disabled control is exempt from contrast. Not yet measured: each appearance's label contrast in light and dark. | Measure with the fix. |
| BT8 | responsive | Long labels wrap (min-inline-size: 0, overflow-wrap: anywhere); full-width fills the parent; the catalog sweep at 240 px found no overflow (responsiveness-behavior-matrix.md). | None. |
| BT9 | docs | Examples cover the appearances, sizes, disabled, loading, toggle, full width, and a form submit; none shows a leading icon or an icon-only button. | Add both, the icon-only one named by label. |

Decisions for the owner:

- **D1: The default appearance: Figma's primary or the code's secondary?** Open.
  1. Keep secondary, and set the Figma sets' default variant to secondary: an unmarked button is an ordinary action, and the one primary action in a view is chosen on purpose.
  2. Change the code to primary, as Figma has it.
  - Recommendation: Keep secondary (the first). Changing it would restyle every button written without appearance in pages that already use Oddkin.

## 4. checkbox

Status: audited (2026-11-15). No gaps found: every Figma Selection and State maps to the API, every bound token matches, and the parity test compares all 15 variants in three engines. Left for the accessibility pass: the contrast of the check and minus glyphs on the selection colour.

| Figma family | Id | Variants | Properties |
| --- | --- | --- | --- |
| Oddkin/Common/checkbox | 159:1181 | 15 | Selection: Checked, Mixed, Unchecked; State: Default, Disabled, Focus, Hover, Invalid |

Code: `odd-checkbox` (packages/components/src/checkbox/).

| Attributes | Slots | Parts | CSS properties | Events |
| --- | --- | --- | --- | --- |
| `name: string \| undefined = undefined`, `disabled: boolean = false`, `description: string = ""`, `error: string = ""`, `checked: boolean = false`, `value: string = on`, `required: boolean = false`, `indeterminate: boolean = false` | `(default)` | `control`, `description`, `error`, `field`, `label` | — | `input`, `change` |

| Finding | Check | What | Proposal |
| --- | --- | --- | --- |
| CB1 | api | Figma Selection (Unchecked, Checked, Mixed) maps to checked and indeterminate; State Disabled to disabled, Invalid to error (with required), Hover and Focus to browser states. The code adds description, name, value, and form participation. | None. |
| CB2 | visual | Matching: the 20 px box with radius.sm and a border.width.default border in color.border.strong, color.surface.default, hover, and sunken (disabled) fills, color.selection.background when checked or mixed, the 16 px check and minus glyphs (icon.size.sm), the color.danger.foreground border when invalid (border.width.strong when checked), the space.sm gap, and primary or disabled label text. | None. |
| CB3 | parity | figma-parity.forms.browser.test.ts compares all 15 variants: the row and its gap, the label, the box, the focus ring, and the Required message. | None. |
| CB4 | a11y | The row is at least target.min (24 px) tall and the label is part of the target; the focus ring is compared with Figma. Not yet measured: the check and minus glyphs against color.selection.background, in light and dark. | Measure in the accessibility pass. |
| CB5 | docs | Examples cover unchecked, checked, mixed, a description, required with its error, disabled, and a form. | None. |

## 5. chip

Status: audited (2026-11-15). The API, tokens, and parity cover all four Figma states. One accessibility gap: the remove button is 20 x 20 px, below target.min (24 px).

| Figma family | Id | Variants | Properties |
| --- | --- | --- | --- |
| Oddkin/Common/chip | 159:612 | 4 | State: Default, Disabled, Focus, Selected |

Code: `odd-chip` (packages/components/src/chip/).

| Attributes | Slots | Parts | CSS properties | Events |
| --- | --- | --- | --- | --- |
| `removable: boolean = false`, `selected: boolean = false`, `disabled: boolean = false` | `(default)` | `base`, `remove` | `--odd-chip-radius` | `odd-chip-remove` |

| Finding | Check | What | Proposal |
| --- | --- | --- | --- |
| CH1 | api | Figma draws only the removable chip: State Default, Selected, Disabled, and Focus (on the remove button) map to removable, selected, disabled, and keyboard focus. The code also has a plain chip without remove, which Figma does not draw. | None; Figma could add the plain chip. |
| CH2 | visual | Matching: control.radius, color.surface.sunken (color.selection.background with color.selection.foreground text when selected), control.gap, the control.height.sm minimum height, control.padding.inline.sm padding, the border.width.default border, the UI type, and the 16 px close glyph. | None. |
| CH3 | parity | figma-parity.browser.test.ts compares all four states (surface, gap, text, focus ring); the collections parity test compares chips inside the multiselect. | None. |
| CH4 | a11y | The remove button is 20 x 20 px (icon.size.md), below target.min (24 px). WCAG 2.2 Target Size (2.5.8, AA) then holds only through its spacing exception, which depends on what sits around the chip. Figma draws the 16 px glyph without a target. | A remove target of target.min (24 px), centred on the 16 px glyph, inside the chip's 32 px height; Figma draws the target around the glyph. |
| CH5 | responsive | A chip is at most as wide as its parent and wraps long text (min-inline-size: 0, overflow-wrap: anywhere). | None. |
| CH6 | docs | Examples cover removable, plain, selected, and disabled chips. | None. |

## 6. copyButton

Status: audited (2026-11-15). The API and look match Figma, with one deliberate difference (the owner's): a successful copy is confirmed in a small popover, where Figma writes it inline. One docs gap: no example copies from another element (from).

| Figma family | Id | Variants | Properties |
| --- | --- | --- | --- |
| Oddkin/Common/copyButton | 555:2984 | 5 | State: Copied, Default, Disabled, Error, Focus |

Code: `odd-copy-button` (packages/components/src/copy-button/).

| Attributes | Slots | Parts | CSS properties | Events |
| --- | --- | --- | --- | --- |
| `value: string = ""`, `from: string = ""`, `label: string = ""`, `disabled: boolean = false` | — | `base`, `button`, `confirmation`, `fallback`, `status` | — | `odd-copy`, `odd-announce` |

| Finding | Check | What | Proposal |
| --- | --- | --- | --- |
| CP1 | api | Figma State Default, Focus, and Disabled map to the button, keyboard focus, and disabled; Copied and Error are outcomes of a copy, not attributes. The code takes the text from value or from another element (from), with an optional label. | None. |
| CP2 | visual | Figma draws the small (button/sm) button with the copy glyph, "Copied to clipboard." in color.text.secondary, and "Could not copy. Select the text." in color.danger.foreground. The code matches; the success message is in a popover (owner, 2026-11-07), recorded in the parity test. | None. |
| CP3 | parity | figma-parity.display.browser.test.ts compares the button frame and the outcome message for the copied and refused copies. | None. |
| CP4 | a11y | The outcome is announced (odd-announce); the button is named by label or its default text. Not yet measured: the contrast of the outcome text in light and dark. | Measure in the accessibility pass. |
| CP5 | docs | Examples copy a value, use their own label, and show disabled; none copies the text of another element with from, which the guidance describes. | Add an example with from. |

## 7. disclosure

Status: audited (2026-11-15). No gaps found: every Figma state maps to the API, the tokens match, and the parity test compares all three states.

| Figma family | Id | Variants | Properties |
| --- | --- | --- | --- |
| Oddkin/Common/Disclosure | 160:1501 | 3 | State: Closed, Expanded, Focus |

Code: `odd-disclosure` (packages/components/src/disclosure/).

| Attributes | Slots | Parts | CSS properties | Events |
| --- | --- | --- | --- | --- |
| `label: string = ""`, `open: boolean = false`, `name: string = ""`, `disabled: boolean = false` | `(default)`, `summary` | `base`, `content`, `label`, `marker`, `summary` | `--odd-disclosure-background`, `--odd-disclosure-radius` | `toggle` |

| Finding | Check | What | Proposal |
| --- | --- | --- | --- |
| DS1 | api | Figma State Closed, Expanded, and Focus map to open and keyboard focus. The code adds label, the summary slot for a richer summary, name (one open at a time in a group, an accordion), and disabled. | None. |
| DS2 | visual | Matching: card.radius, color.surface.default with a color.border.default border, the 20 px chevron (icon.size.md, right when closed and down when open), the UI label in color.text.primary, the content in color.text.secondary below an inset color.border.default divider, and the focus ring. | None. |
| DS3 | parity | figma-parity.navigation.browser.test.ts compares Closed, Expanded (surface, label, divider, and both content texts), and Focus (the ring). | None. |
| DS4 | a11y | A native details and summary: keyboard operation and the expanded state come from the platform. Not yet measured: the contrast of the secondary content text. | Measure in the accessibility pass. |
| DS5 | responsive | The label and the content wrap in the width the parent grants (min-inline-size: 0, overflow-wrap: anywhere). | None. |
| DS6 | docs | Examples cover closed, open, an accordion group (name), a rich summary, and disabled. | None. |

## 8. divider

Status: audited (2026-11-15). The recipe draws both Figma variants with Figma's tokens, but no parity test compares them, the labelled divider's suggested role="separator" can hide its words from screen readers, and no example shows it.

| Figma family | Id | Variants | Properties |
| --- | --- | --- | --- |
| Oddkin/Common/divider | 162:2069 | 2 | State: Horizontal, Labelled |

Code: `.odd-divider (divider.css)`.

| Finding | Check | What | Proposal |
| --- | --- | --- | --- |
| DV1 | api | Figma State Horizontal and Labelled map to hr.odd-divider and a labelled .odd-divider with its text ("OR") between two rules. | None. |
| DV2 | visual | Matching: a border.width.default rule in color.border.default; the label in color.text.secondary in the small type (12 px). The recipe adds space.md above and below and space.sm between the label and the rules; Figma's Labelled variant has no auto layout, so its gap is a position. | Figma: auto layout on Labelled, with the space.sm gap. |
| DV3 | parity | Not compared with Figma: recipes-css.browser.test.ts checks only that the rules are drawn. | Compare both variants (rule colour and width, label colour and type) in figma-parity.browser.test.ts. |
| DV4 | a11y | The recipe's comment has the author give a labelled divider role="separator". A separator's content is presentational, so screen readers may not read its words ("or"), which carry meaning between two choices. | Guidance: hr for a plain divider; a labelled divider stays ordinary text with no separator role, so its words are read. |
| DV5 | responsive | The rules stretch and shrink around the label in the width the parent grants. | None. |
| DV6 | docs | Documented in the architecture notes only; no example on the docs site or in the CSS gallery. | An example of each variant where the recipes are shown. |

## 9. field

Status: audited (2026-11-15). Every form control draws this anatomy, and its tokens match Figma. Figma's field has two things the code does not: the required state written in the label ("(required)"), and a second help text below the control. Both need the owner (D1, D2).

| Figma family | Id | Variants | Properties |
| --- | --- | --- | --- |
| Oddkin/Common/field | 159:971 | 2 | State: Invalid, Required |

Code: `.odd-field (field.css)`. The field look every form control shares (controlStyles).

| Finding | Check | What | Proposal |
| --- | --- | --- | --- |
| FD1 | api | Figma's anatomy (review row: "Label, description, control, validation. Required state is written as well as marked."): the label "Email address (required)", a description above the control, the control, and a line below it, "We never share your address." (secondary), which the error replaces when invalid. The code has the label, the description above, the control, and the error below; a valid field shows nothing below. Figma disagrees with itself: its input family (159:1024) draws the help text below the control. | Decision D1. |
| FD2 | api | Required: the code sets the native required state, which assistive technology announces, but writes nothing in the label; Figma writes "(required)". | Decision D2. |
| FD3 | visual | Matching: the UI type label in color.text.primary, the small type description in color.text.secondary, the control (control.radius, color.surface.default, a border.width.default border in color.border.strong, control.height.md, body text), and the error in color.danger.foreground with the danger border. | None. |
| FD4 | parity | The field family is not compared; the input family's parity test covers the same anatomy for odd-input, and recipes-css.browser.test.ts checks that .odd-field draws native markup exactly like odd-input. | Compare the field family (Required and Invalid) once D1 and D2 are decided. |
| FD5 | figma | For the owner: the field anatomy variants have no auto layout, so their gaps (8 px, 12 px) are positions, not tokens. | Auto layout with the field gap tokens. |
| FD6 | docs | The .odd-field recipe is documented in the architecture notes only; no example on the docs site or in the CSS gallery. | An example of a native control in .odd-field, with its label, description, and error wired. |

Decisions for the owner:

- **D1: Where help text sits: above the control (Figma's field anatomy, 159:971, and the code) or below it (Figma's input, search, and other fields, 159:1024)?** Open.
  1. Above the control, for every form control: Figma's field order, read before typing; Figma's input and other field specimens are redrawn with the help above.
  2. Below the control, replaced by the error when invalid: Figma's input specimens; every form control moves its description.
  - Recommendation: Above (the first): people and screen readers meet the help before they type, the error appears where the help was, and nothing in the code changes.
- **D2: Writing the required state, as Figma does.** Open.
  1. Every form control writes a localized "(required)" after its label when required; the word is hidden from assistive technology, which already announces the required state.
  2. The author writes it in the label text; the guidance says so.
  3. Mark the optional fields instead ("(optional)"), as some government design systems do.
  - Recommendation: The first: Figma's rule holds without each author remembering it, and screen readers hear "required" once.

## 10. icon

Status: audited (2026-11-15). The API and sizes match Figma: 20 px by default (icon.size.md), 16 and 24 px as size sm and lg. Figma binds no token on its icon specimens, so the parity tests cannot compare them; display.browser.test.ts checks the three sizes.

| Figma family | Id | Variants | Properties |
| --- | --- | --- | --- |
| Oddkin/Common/icon | 162:2058 | 2 | State: Default, Sizes |

Code: `odd-icon` (packages/components/src/icon/).

| Attributes | Slots | Parts | CSS properties | Events |
| --- | --- | --- | --- | --- |
| `src: string = ""`, `label: string = ""`, `size: sm \| md \| lg = md` | `(default)` | `base` | `--odd-icon-size` | — |

| Finding | Check | What | Proposal |
| --- | --- | --- | --- |
| IC1 | api | Figma State Default (20 px) and Sizes (16, 20, 24 px) map to size sm, md (default), and lg. The code also takes an SVG as content or a URL (src), and label for a meaningful icon. | None. |
| IC2 | parity | The icon family is not compared with Figma: its instances bind no size or colour. display.browser.test.ts checks each size against the icon.size tokens. | None needed; Figma could bind the icon sizes to icon.size tokens. |
| IC3 | a11y | Decorative by default (hidden from assistive technology); with label it is an image with that name, as Figma's review row asks ("decorative icons stay silent"). | None. |
| IC4 | docs | Examples cover a decorative icon, a labelled one, the three sizes, and an icon from a URL. | None. |

## 11. iconButton

Status: audited (2026-11-15). Figma draws a square 40 x 40 button with a 20 px icon. odd-button has no icon-only form: with only an icon it keeps the text padding, so it is not square, and the context picker adds its own .odd-button.icon rule (square, but a 16 px icon). Nothing compares it with Figma.

| Figma family | Id | Variants | Properties |
| --- | --- | --- | --- |
| Oddkin/Common/iconButton | 159:471 | 5 | State: Default, Disabled, Focus, Hover, Pressed |

Code: `odd-button` (packages/components/src/button/). An icon-only odd-button.

| Attributes | Slots | Parts | CSS properties | Events |
| --- | --- | --- | --- | --- |
| `appearance: primary \| secondary \| ghost = secondary`, `size: sm \| md \| lg = md`, `type: button \| submit \| reset = button`, `disabled: boolean = false`, `loading: boolean = false`, `full-width: boolean = false`, `toggle: boolean = false`, `pressed: boolean = false`, `name: string = ""`, `value: string = ""`, `formaction: string \| undefined = undefined`, `formmethod: string \| undefined = undefined`, `formenctype: string \| undefined = undefined`, `formtarget: string \| undefined = undefined`, `formnovalidate: boolean = false`, `label: string = ""` | `(default)`, `end`, `start` | `control`, `spinner` | `--odd-button-background`, `--odd-button-border-color`, `--odd-button-color`, `--odd-button-height`, `--odd-button-padding-inline`, `--odd-button-radius` | `input`, `change` |

| Finding | Check | What | Proposal |
| --- | --- | --- | --- |
| IB1 | api | Figma State (Default, Hover, Pressed, Focus, Disabled) maps to odd-button and browser states, and label names it (button.browser.test.ts). There is no icon-only form: the code relies on the author. | An icon-only odd-button, square at every size, its label required: decision D1. |
| IB2 | visual | Figma: a 40 x 40 surface (control.height.md) with control.radius, color.surface.default (hover and pressed color.surface.hover), a border.width.default border in color.border.strong, and a 20 px icon (icon.size.md); the focus ring around it. Its colours are the secondary button's. The code: no square form; the context picker's private rule draws a 16 px icon (icon.size.sm). | With D1: square at control.height, the icon at icon.size.md, and the context picker using it. |
| IB3 | parity | The iconButton family is not compared with Figma. | Compare all five states once the icon-only form exists. |
| IB4 | a11y | Figma's review row: "a required accessible name"; the label attribute gives it, and its visible name is the icon, so a tooltip can show the label (as the context picker's icon trigger does). | With D1, warn in development when an icon-only button has no label. |
| IB5 | docs | No example shows an icon-only button (also BT9). | An example with D1. |

Decisions for the owner:

- **D1: The icon-only button: how does an author ask for it?** Open.
  1. An attribute on odd-button (for example icon-only), square at its size with the icon at icon.size.md and label required.
  2. Automatic: odd-button becomes square when its only content is an icon and it has a label.
  - Recommendation: The first: an explicit attribute is predictable for people and agents, and the analyzer can require label with it. The context picker then uses it instead of its own rule.

## 12. input

Status: audited (2026-11-15). Seven of Figma's eight states match and the parity test compares all eight. Two gaps: Figma's Password variant has a show-password eye that odd-input lacks (D1), and Figma draws the help text below the control, where the code puts it above (field D1).

| Figma family | Id | Variants | Properties |
| --- | --- | --- | --- |
| Oddkin/Common/input | 159:1024 | 8 | State: Disabled, Empty, Filled, Focus, Hover, Invalid, Password, Read only |

Code: `odd-input` (packages/components/src/input/).

| Attributes | Slots | Parts | CSS properties | Events |
| --- | --- | --- | --- | --- |
| `name: string \| undefined = undefined`, `disabled: boolean = false`, `description: string = ""`, `error: string = ""`, `label: string = ""`, `value: string = ""`, `minlength: number \| undefined = undefined`, `maxlength: number \| undefined = undefined`, `placeholder: string = ""`, `autocomplete: string = ""`, `required: boolean = false`, `readonly: boolean = false`, `type: number \| search \| time \| text \| url \| email \| password \| tel \| date \| datetime-local \| month \| week = text`, `min: string \| undefined = undefined`, `max: string \| undefined = undefined`, `step: string \| undefined = undefined`, `pattern: string \| undefined = undefined` | — | `clear`, `control`, `decrement`, `description`, `error`, `field`, `icon`, `increment`, `label`, `stepper` | `--odd-field-background`, `--odd-field-border-color`, `--odd-field-height`, `--odd-field-radius` | `input`, `change` |

| Finding | Check | What | Proposal |
| --- | --- | --- | --- |
| IN1 | api | Figma State Empty, Filled, Invalid, Disabled, Read only, and Password map to placeholder, value, error, disabled, readonly, and type="password"; Hover and Focus are browser states. The code adds the other native types and constraints. | None. |
| IN2 | api | Figma's Password variant draws an eye icon (Icon · eye, 20 px) at the end of the field: a control to show the password. odd-input has none. | Decision D1. |
| IN3 | visual | Figma's input draws the help text ("We never share your email.") below the control, where the error replaces it; odd-input draws its description above the control. Figma's own field anatomy (field, 159:971) and the code put it above. | Field decision D1 decides it for every form control. |
| IN4 | parity | figma-parity.browser.test.ts compares all eight states (field, label, description, surface, text, error, focus ring); the description is compared by its tokens, not its position. | Compare positions too once field D1 is decided. |
| IN5 | responsive | The field fills its parent and wraps long labels, help, and errors (min-inline-size: 0, overflow-wrap: anywhere). | None. |
| IN6 | docs | Examples cover the default, description, required, invalid, disabled, read-only, password, number, search, date, time, constraints, and a form. | None. |

Decisions for the owner:

- **D1: Show password: should type="password" draw Figma's eye control?** Open.
  1. Yes: a toggle button at the end of the field, named "Show password" and "Hide password", switching the control between password and text; on by default, with an attribute to leave it out.
  2. Yes, but only when the author asks for it with an attribute.
  3. No: Figma's eye is removed.
  - Recommendation: The first: seeing the password lets people check what they typed before they submit, and it is what Figma draws.

## 13. keyboardKey

Status: audited (2026-11-15). The recipe draws Figma's key caps with Figma's tokens, but smaller: about 23 px tall where Figma draws 32 px (D1). Figma binds no size, so the parity test cannot see it.

| Figma family | Id | Variants | Properties |
| --- | --- | --- | --- |
| Oddkin/Common/keyboardKey | 162:2097 | 2 | State: Default, Sequence |

Code: `.odd-kbd (kbd.css)`.

| Finding | Check | What | Proposal |
| --- | --- | --- | --- |
| KB1 | api | Figma State Default (a chord, Ctrl + K) and Sequence (G then P) map to kbd.odd-kbd for each key, with the author's text between the keys. | None. |
| KB2 | visual | Matching: color.surface.default, a border.width.default border in color.border.default, radius.sm, and the code type (14 px) in color.text.secondary. Size: Figma's caps are 32 px tall (32 x 32 for a letter, 52 x 32 for Ctrl); the recipe's cap is its code line plus the border, about 23 px, at least 1.75em wide. | Decision D1. |
| KB3 | parity | figma-parity.browser.test.ts compares Default (the cap and both keys' text); Sequence is the same recipe with other text. | None. |
| KB4 | a11y | A kbd element, not focusable and not drawn as a button (Figma: "without making it look clickable"); forced colours draw its border. | None. |
| KB5 | docs | No example of the recipe; the docs site uses it in its own pages. | An example of a chord and a sequence where the recipes are shown. |

Decisions for the owner:

- **D1: Key cap size: the recipe's compact cap (about 23 px) or Figma's 32 px cap?** Open.
  1. Keep the compact cap, recorded as a deliberate difference: key caps sit in running text and menu rows, where a 32 px cap would push the lines apart.
  2. Figma's 32 px cap, with padding from the space tokens, and Figma binds it.
  - Recommendation: The first, unless key caps are meant to stand alone, larger than text.

## 14. link

Status: audited (2026-11-15). The recipe draws Figma's three states with Figma's tokens. No parity test compares it with Figma, and no example shows it, nor the external-link icon Figma draws after the text.

| Figma family | Id | Variants | Properties |
| --- | --- | --- | --- |
| Oddkin/Common/link | 159:549 | 3 | State: Default, Focus, Hover |

Code: `.odd-link (link.css)`.

| Finding | Check | What | Proposal |
| --- | --- | --- | --- |
| LK1 | api | Figma State Default, Hover, and Focus map to a.odd-link and the browser states. Figma draws a 16 px external-link icon after the text; the recipe leaves an icon to the author. | Guidance and an example: an odd-icon (size sm) after the text, and words saying a link opens a new tab. |
| LK2 | visual | Matching: color.link in the UI type, no underline at rest, an underline on hover and keyboard focus, and the focus ring (focus.width, color.focus.ring). Inside running text (p, li) the recipe always underlines, so links there do not rely on colour (WCAG 1.4.1); Figma draws no link in running text. | None. |
| LK3 | parity | The link family is not compared with Figma; recipes-css.browser.test.ts checks the colour, the hover underline, and the focus ring. | Compare the three states in figma-parity.browser.test.ts. |
| LK4 | a11y | A native link. Outside running text it has no underline at rest, as Figma draws it. Not yet measured: color.link against each surface, in light and dark. | Measure in the accessibility pass. |
| LK5 | docs | No example of the recipe; the docs site uses it in its own pages. | An example of a link alone, in running text, and with an external-link icon. |

## 15. number

Status: audited (2026-11-15). odd-input type="number" matches Figma's six states, its stepper included, and the parity test compares them all. As with the input, Figma draws the help text below the control (field D1).

| Figma family | Id | Variants | Properties |
| --- | --- | --- | --- |
| Oddkin/Common/number | 159:1097 | 6 | State: Default, Disabled, Focus, Invalid, Maximum, Minimum |

Code: `odd-input` (packages/components/src/input/). odd-input type="number".

| Attributes | Slots | Parts | CSS properties | Events |
| --- | --- | --- | --- | --- |
| `name: string \| undefined = undefined`, `disabled: boolean = false`, `description: string = ""`, `error: string = ""`, `label: string = ""`, `value: string = ""`, `minlength: number \| undefined = undefined`, `maxlength: number \| undefined = undefined`, `placeholder: string = ""`, `autocomplete: string = ""`, `required: boolean = false`, `readonly: boolean = false`, `type: number \| search \| time \| text \| url \| email \| password \| tel \| date \| datetime-local \| month \| week = text`, `min: string \| undefined = undefined`, `max: string \| undefined = undefined`, `step: string \| undefined = undefined`, `pattern: string \| undefined = undefined` | — | `clear`, `control`, `decrement`, `description`, `error`, `field`, `icon`, `increment`, `label`, `stepper` | `--odd-field-background`, `--odd-field-border-color`, `--odd-field-height`, `--odd-field-radius` | `input`, `change` |

| Finding | Check | What | Proposal |
| --- | --- | --- | --- |
| NB1 | api | Figma State Default, Focus, Disabled, Minimum, Maximum, and Invalid map to value, keyboard focus, disabled, a value at min or max, and error; the stepper is part of type="number". | None. |
| NB2 | visual | Matching: the field (control.height.md, control.radius, color.border.strong), the stepper (a color.surface.sunken segment of two 40 px buttons with 16 px minus and plus glyphs), and the danger border and message when invalid. Figma's help text ("1–50 seats available.") is below the control; the code draws the description above. | Field decision D1. |
| NB3 | parity | figma-parity.forms.browser.test.ts compares all six states: label, surface, value, the stepper, and both buttons. | None. |
| NB4 | docs | odd-input's number example shows the stepper with min and max. | None. |

## 16. progress

Status: audited (2026-11-15). The API and look match both Figma states. The parity test compares Determinate only; the indeterminate animation uses raw timing rather than motion tokens.

| Figma family | Id | Variants | Properties |
| --- | --- | --- | --- |
| Oddkin/Common/progress | 161:1916 | 2 | State: Determinate, Indeterminate |

Code: `odd-progress` (packages/components/src/progress/).

| Attributes | Slots | Parts | CSS properties | Events |
| --- | --- | --- | --- | --- |
| `value: number \| undefined = undefined`, `max: number = 1`, `label: string = ""`, `description: string = ""` | — | `base`, `description`, `indicator`, `label`, `track`, `value-text` | `--odd-progress-height` | — |

| Finding | Check | What | Proposal |
| --- | --- | --- | --- |
| PR1 | api | Figma Determinate and Indeterminate map to value set or unset, with label, description, and the value text ("64%"); max, and renderValue for custom value text. | None. |
| PR2 | visual | Matching: an 8 px track (space.xs, overridable with --odd-progress-height) in color.surface.sunken with radius.sm, the indicator in color.action.default, the label in the UI type, the value text and description in color.text.secondary. The indeterminate indicator slides on a raw 1.6 s ease-in-out, not the motion tokens. | Time the slide with motion tokens, or record why it needs its own timing. |
| PR3 | parity | figma-parity.browser.test.ts compares Determinate (track, indicator, label, value text, description); Indeterminate is not compared. | Compare Indeterminate (track, indicator fill, label, description; no value text). |
| PR4 | a11y | Unknown progress shows no percentage, as Figma's review row requires; reduced motion stops the slide and right-to-left reverses it; forced colours have their own styles. Not yet measured: color.action.default against the sunken track. | Measure in the accessibility pass. |
| PR5 | docs | Examples cover determinate, indeterminate, a fraction of one, and custom value text. | None. |

## 17. radio

Status: not started.

| Figma family | Id | Variants | Properties |
| --- | --- | --- | --- |
| Oddkin/Common/radio | 159:1209 | 10 | Selection: Checked, Unchecked; State: Default, Disabled, Focus, Hover, Invalid |

Code: `odd-radio-group` (packages/components/src/radio-group/). No standalone radio element: radios render inside odd-radio-group.

| Attributes | Slots | Parts | CSS properties | Events |
| --- | --- | --- | --- | --- |
| `name: string \| undefined = undefined`, `disabled: boolean = false`, `description: string = ""`, `error: string = ""`, `label: string = ""`, `value: string = ""`, `required: boolean = false`, `orientation: vertical \| horizontal = vertical` | — | `control`, `description`, `error`, `field`, `group`, `label`, `option`, `option-description` | — | `input`, `change` |

Not audited yet.

## 18. rating

Status: not started.

| Figma family | Id | Variants | Properties |
| --- | --- | --- | --- |
| Oddkin/Common/rating | 555:2787 | 6 | State: Disabled, Empty, Focus, Invalid, Read only, Selected |
| Oddkin/Common/rating/Item | 555:2595 | 5 | State: Disabled off, Disabled on, Focus, Off, On |

Code: `odd-rating` (packages/components/src/rating/).

| Attributes | Slots | Parts | CSS properties | Events |
| --- | --- | --- | --- | --- |
| `name: string \| undefined = undefined`, `disabled: boolean = false`, `description: string = ""`, `error: string = ""`, `label: string = ""`, `value: string = ""`, `required: boolean = false`, `max: number = 5`, `readonly: boolean = false` | — | `control`, `description`, `error`, `field`, `label`, `option`, `value` | — | `input`, `change` |

Not audited yet.

## 19. relativeTime

Status: not started.

| Figma family | Id | Variants | Properties |
| --- | --- | --- | --- |
| Oddkin/Common/relativeTime | 555:3030 | 5 | State: Absolute detail, Future, Past, Recent, Unavailable |

Code: `odd-relative-time` (packages/components/src/relative-time/).

| Attributes | Slots | Parts | CSS properties | Events |
| --- | --- | --- | --- | --- |
| `datetime: string = ""`, `detail: boolean = false` | — | `base`, `detail`, `time` | — | — |

Not audited yet.

## 20. search

Status: not started.

| Figma family | Id | Variants | Properties |
| --- | --- | --- | --- |
| Oddkin/Common/search | 159:1144 | 6 | State: Disabled, Empty, Filled, Focus, Inline, Inline focus |

Code: `odd-input` (packages/components/src/input/). odd-input type="search".

| Attributes | Slots | Parts | CSS properties | Events |
| --- | --- | --- | --- | --- |
| `name: string \| undefined = undefined`, `disabled: boolean = false`, `description: string = ""`, `error: string = ""`, `label: string = ""`, `value: string = ""`, `minlength: number \| undefined = undefined`, `maxlength: number \| undefined = undefined`, `placeholder: string = ""`, `autocomplete: string = ""`, `required: boolean = false`, `readonly: boolean = false`, `type: number \| search \| time \| text \| url \| email \| password \| tel \| date \| datetime-local \| month \| week = text`, `min: string \| undefined = undefined`, `max: string \| undefined = undefined`, `step: string \| undefined = undefined`, `pattern: string \| undefined = undefined` | — | `clear`, `control`, `decrement`, `description`, `error`, `field`, `icon`, `increment`, `label`, `stepper` | `--odd-field-background`, `--odd-field-border-color`, `--odd-field-height`, `--odd-field-radius` | `input`, `change` |

Not audited yet.

## 21. skeleton

Status: not started.

| Figma family | Id | Variants | Properties |
| --- | --- | --- | --- |
| Oddkin/Common/skeleton | 161:1959 | 2 | State: Default, List |

Code: `odd-skeleton` (packages/components/src/skeleton/).

| Attributes | Slots | Parts | CSS properties | Events |
| --- | --- | --- | --- | --- |
| `shape: circle \| rect \| text = text`, `lines: number = 1` | — | `base`, `line` | `--odd-skeleton-color` | — |

Not audited yet.

## 22. slider

Status: not started.

| Figma family | Id | Variants | Properties |
| --- | --- | --- | --- |
| Oddkin/Common/slider | 159:1287 | 3 | State: Default, Disabled, Focus |

Code: `odd-slider` (packages/components/src/slider/).

| Attributes | Slots | Parts | CSS properties | Events |
| --- | --- | --- | --- | --- |
| `name: string \| undefined = undefined`, `disabled: boolean = false`, `description: string = ""`, `error: string = ""`, `label: string = ""`, `value: string = ""`, `min: number = 0`, `max: number = 100`, `step: number = 1` | — | `control`, `description`, `error`, `field`, `fill`, `label`, `max-label`, `min-label`, `output`, `thumb`, `track` | — | `input`, `change` |

Not audited yet.

## 23. spinner

Status: not started.

| Figma family | Id | Variants | Properties |
| --- | --- | --- | --- |
| Oddkin/Common/spinner | 161:1939 | 2 | State: Default, Inline |

Code: `odd-spinner` (packages/components/src/spinner/).

| Attributes | Slots | Parts | CSS properties | Events |
| --- | --- | --- | --- | --- |
| `label: string = ""`, `size: sm \| md \| lg = md` | `(default)` | `base`, `indicator` | `--odd-spinner-color` | — |

Not audited yet.

## 24. stat

Status: not started.

| Figma family | Id | Variants | Properties |
| --- | --- | --- | --- |
| Oddkin/Common/stat | 555:2908 | 5 | State: Decrease, Increase, Loading, Neutral, Unavailable |

Code: `odd-stat` (packages/components/src/stat/).

| Attributes | Slots | Parts | CSS properties | Events |
| --- | --- | --- | --- | --- |
| `label: string = ""`, `value: string = ""`, `trend: none \| increase \| decrease = none`, `loading: boolean = false` | `(default)` | `base`, `context`, `label`, `placeholder`, `value` | — | — |

Not audited yet.

## 25. switch

Status: not started.

| Figma family | Id | Variants | Properties |
| --- | --- | --- | --- |
| Oddkin/Common/switch | 159:1258 | 8 | Value: Off, On; State: Default, Disabled, Focus, Hover |

Code: `odd-switch` (packages/components/src/switch/).

| Attributes | Slots | Parts | CSS properties | Events |
| --- | --- | --- | --- | --- |
| `name: string \| undefined = undefined`, `disabled: boolean = false`, `description: string = ""`, `error: string = ""`, `checked: boolean = false`, `value: string = on`, `required: boolean = false` | `(default)` | `control`, `description`, `error`, `field`, `label`, `state`, `thumb` | — | `input`, `change` |

Not audited yet.

## 26. textarea

Status: not started.

| Figma family | Id | Variants | Properties |
| --- | --- | --- | --- |
| Oddkin/Common/textarea | 159:1056 | 5 | State: Disabled, Empty, Filled, Focus, Invalid |

Code: `odd-textarea` (packages/components/src/textarea/).

| Attributes | Slots | Parts | CSS properties | Events |
| --- | --- | --- | --- | --- |
| `name: string \| undefined = undefined`, `disabled: boolean = false`, `description: string = ""`, `error: string = ""`, `label: string = ""`, `value: string = ""`, `minlength: number \| undefined = undefined`, `maxlength: number \| undefined = undefined`, `placeholder: string = ""`, `autocomplete: string = ""`, `required: boolean = false`, `readonly: boolean = false`, `rows: number = 4`, `resize: none \| vertical \| auto = vertical` | — | `control`, `count`, `description`, `error`, `field`, `label` | `--odd-field-background`, `--odd-field-border-color`, `--odd-field-height`, `--odd-field-radius`, `--odd-textarea-max-height` | `input`, `change` |

Not audited yet.

## 27. toggleButton

Status: not started.

| Figma family | Id | Variants | Properties |
| --- | --- | --- | --- |
| Oddkin/Common/toggleButton | 159:501 | 8 | Value: Off, On; State: Default, Disabled, Focus, Hover |

Code: `odd-button` (packages/components/src/button/). odd-button toggle.

| Attributes | Slots | Parts | CSS properties | Events |
| --- | --- | --- | --- | --- |
| `appearance: primary \| secondary \| ghost = secondary`, `size: sm \| md \| lg = md`, `type: button \| submit \| reset = button`, `disabled: boolean = false`, `loading: boolean = false`, `full-width: boolean = false`, `toggle: boolean = false`, `pressed: boolean = false`, `name: string = ""`, `value: string = ""`, `formaction: string \| undefined = undefined`, `formmethod: string \| undefined = undefined`, `formenctype: string \| undefined = undefined`, `formtarget: string \| undefined = undefined`, `formnovalidate: boolean = false`, `label: string = ""` | `(default)`, `end`, `start` | `control`, `spinner` | `--odd-button-background`, `--odd-button-border-color`, `--odd-button-color`, `--odd-button-height`, `--odd-button-padding-inline`, `--odd-button-radius` | `input`, `change` |

Not audited yet.

## 28. tooltip

Status: not started.

| Figma family | Id | Variants | Properties |
| --- | --- | --- | --- |
| Oddkin/Common/tooltip | 160:2470 | 2 | State: Default, Description |

Code: `odd-tooltip` (packages/components/src/tooltip/).

| Attributes | Slots | Parts | CSS properties | Events |
| --- | --- | --- | --- | --- |
| `anchor: string = ""`, `side: inline-end \| inline-start \| block-end \| block-start = block-start`, `align: center \| start \| end = center`, `open: boolean = false` | `(default)` | `base` | `--odd-tooltip-max-inline-size` | — |

Not audited yet.

## 29. typography

Status: not started.

| Figma family | Id | Variants | Properties |
| --- | --- | --- | --- |
| Oddkin/Common/typography | 162:2080 | 1 | State: Default |

Code: `typography.css`.

Not audited yet.
