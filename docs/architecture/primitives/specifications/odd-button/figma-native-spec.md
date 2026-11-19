# odd-button — architecture and interaction specification (v2)

- **Revision/date:** 2026-11-18; design-and-implement run 2026-11-18-button-redesign (repository path: `../../runs/2026-11-18-button-redesign/v1-specification-archive.json`). Implementation tree at `e84a08e3` (main), which carries v1. v1's specification is archived verbatim in that run.
- **Work:** full Primitive Architect flow at the owner's request, not treating the existing Figma button as authoritative; the redesign then implemented in code.
- **Figma:** [Dedicated Button specification](https://www.figma.com/design/E7LfRysny8V3qU24tv082i/Oddkin---Design-Framework?node-id=1398-2), page `1398:2`; text sets `159:439` (md), `181:2332` (sm), `181:2390` (lg); icon-only sets `159:471` (md), `1455:4545` (sm), `1455:4798` (lg); toggle `159:501`; native spec `1398:2760`.
- **Status:** no public property, event, slot, part or custom property added; one derived custom state (`icon-only`) and one console diagnostic added; native recipe corrected for links and icon-only. Browser evidence is recorded separately.
- **Related records:** context (repository path: `./context.md`), research (repository path: `./research.md`), scoped decision (repository path: `./decision.md`), full contract (repository path: `./contract.md`), token map (repository path: `./token-map.md`).

## 1. Overview and classification

Button is the foundational interaction primitive for an action: a named, activatable native control with an optional binary toggle. It is not navigation (a link styled by the recipe stays a link), an operation record, a notification or a menu. v2 makes icon-only actions a first-class configuration of the same element, because Calendar and Carousel were hand-building the same square and some design examples were using text glyphs for icon-only actions. ORCP level 0, intrinsic; no controller.

## 2. Research summary and source references

The research comparison (repository path: `./research.md`) reads WCAG 2.5.3 Label in Name (symbols are not labels), the APG button pattern, and seven implementation lineages: Spectrum 2 (`ActionButton` source: icon-only inferred with `:has()`, icons one line tall, centred pending spinner), Primer (`ButtonBase` source: icon-only is a square modifier of the same base, link buttons drop the underline), Fluent web components (source: explicit `icon-only` attribute, 20/24 px icons), Web Awesome 3.15 (icon-only inferred, `:state(icon-button)`), Material Web (separate icon-button element), Carbon (16 px icons) and v1's React Aria evidence. It also measures Oddkin itself: four hand-built 32 px squares with 20 px glyphs, `odd-button` never square with an icon, and a legacy 20 px-in-40 Figma iconButton.

Primary links: [Spectrum 2 ActionButton](https://react-spectrum.adobe.com/ActionButton), [Primer IconButton](https://primer.style/product/components/icon-button/), [Fluent web components](https://github.com/microsoft/fluentui/tree/master/packages/web-components), [Web Awesome Button](https://webawesome.com/docs/components/button), [Material Web icon button](https://material-web.dev/components/icon-button/), [Carbon Button style](https://carbondesignsystem.com/components/button/style/), [WCAG 2.5.3](https://www.w3.org/WAI/WCAG22/Understanding/label-in-name.html).

## 3. Architecture and responsibility boundaries

| Fact/state | Authority | Boundary/mechanism |
|---|---|---|
| Native control, focus, local hover/down | Button/platform | One retained native button in an open shadow root with `delegatesFocus`. |
| Binary pressed | Button, externally writable property | Accepted activation flips; a cancelled click rolls back. |
| Icon-only presentation (v2) | Button, derived from its slotted content | Recomputed on `slotchange` and in-place text edits. A custom state represents it. |
| Icon size (v2) | Button, by context | Inherited `--odd-icon-size`; an icon may override it. |
| Loading/disabled inputs | Host, plus a disabled fieldset | Rendered and enforced; the button runs no task. |
| Label, icons, operation identity | Host | Default/start/end content and `label`. |
| Inline/block grant, sibling arrangement, scrolling | Parent | Existing CSS layouts and named scrollers. |
| Request, result, retry, status, navigation | Host/controller | Never inferred from a click or spinner. |
| Form validation, data, reset | Form/platform | The documented temporary submitter. |

Shared host, focus-ring, spinner and description modules are reused. Calendar and carousel use the native recipe's icon-only geometry instead of their hand-built squares; the overlay close and file-input remove buttons are plain buttons with their own look and are unchanged. AI compositions use text content and are unaffected; the AI Message's glyph-text buttons are recorded for the AI lane.

## 4. Component anatomy

Semantic tree: host → native `<button part="control" type="button">` → decorative `<span part="spinner" aria-hidden="true">`, start slot, label container with the default slot, end slot. The default slot holds the action text, or exactly one icon (an `odd-icon` or an `svg`) for an icon-only button. Icons in any slot take the button's context size. The spinner is centred over the content, which keeps its size and name while undrawn. No interactive content inside slots.

## 5. Complete public API

Every property is **EXISTING**; v2 changes no public member. Full detail in contract §2 (repository path: `./contract.md#2-public-api-unchanged`).

| Property/attribute | Type/default | Reflection |
|---|---|---|
| appearance | primary/secondary/ghost; secondary | Yes |
| size | sm/md/lg; md | Yes |
| type | button/submit/reset; button | No |
| disabled, loading, toggle, pressed | boolean false | Yes |
| fullWidth/full-width | boolean false | Yes |
| label, name, value | string empty | No |
| formAction/formaction, formMethod/formmethod, formEnctype/formenctype, formTarget/formtarget | optional raw strings | Yes |
| formNoValidate/formnovalidate | boolean false | Yes |
| form | readonly HTMLFormElement or null | Native association |

Slots: default, start, end. Parts: control, spinner. Custom properties: `--odd-button-{radius,background,color,border-color,height,padding-inline}`. **v2 custom state:** `icon-only` (`odd-button:state(icon-only)`). **v2 diagnostic:** `[button.label.missing]`, a console warning once per element when an icon-only button has no Button label. Events unchanged: native click; on a toggle `input` then `change`. Native recipe attributes: `data-appearance`, `data-size`, `data-full-width`, `aria-pressed`, and (**v2**) `data-icon-only`.

## 6. Canonical visual design

Primary, secondary and ghost at sm, md and lg keep v1's token-bound paint, type and minimum heights (32/40/48, compact 24/30/36). Pressed toggles take selection colours in every appearance; disabled keeps its appearance at 0.5 opacity; focus is the 2 px outline at 2 px offset.

**v2 icons:** icons follow the content colour of their button (on-action in primary, selection foreground when pressed), as CSS `currentColor` does; in Figma through the `Oddkin · Content colour` collection's `content/current` variable, whose mode each button variant sets. Beside text an icon is 16 px at sm and md and 20 px at lg; an intrinsic icon-only button is square at the size's height with a 20, 20 or 24 px icon. The text sets add `End icon` and `Show end icon`. The chevron is the default Figma swap when enabled, and the slot stays hidden by default. In code the author supplies end-slot content.

**v2 loading:** the spinner is centred over the content; icons and label stay in place, undrawn, so the loading button keeps the exact size of its resting state (in Figma the icons sit in variant-owned slot frames that carry the opacity, so a swapped icon is hidden too).

## 7. Conditional layout contract

ORCP intrinsic; no layout context subscriber, resolver, size observer, overlay or component scroller. Labels wrap within the parent's grant; the parent wraps or stacks peer actions. **v2:** an icon-only button has a square intrinsic footprint at or above the minimum target. Explicit full-width uses the parent grant, subject to the same minimum. In a narrow parent a toolbar of intrinsic icon-only buttons wraps (B-L9). Compact density shrinks the square to 24/30/36 while icons keep their sizes (B-L10). Icons size by context (B-L11). Width never turns an action into an icon, menu or link. Full rules in contract §8 (repository path: `./contract.md#8-conditional-allocation-contract`).

## 8. Parent-context demonstrations

| Fixture | Allocation/owner | Content/context | Expected result |
|---|---|---|---|
| Wide and narrow action row | Parent 640/240 px after insets | Save + Cancel | Row wraps; same actions and focus. |
| Full-width label | Parent 240/320 px | Long localization with icons | Label wraps, control grows. |
| Unbroken label | Narrow grant | Long identifier | Emergency wrap, no horizontal scrollbar. |
| Async result | Parent reserves status space | Save → loading → host result | Same footprint; external status explains the outcome. |
| Icon-only toolbar (v2) | Parent 240 px, 208 usable | Nine sm icon-only buttons incl. a pressed toggle | Two wrapped rows of 32 px squares, nothing scrolls. |
| RTL, text size, density | Nested parent, both themes | Icons and long label | Slots mirror, text reflows, identity kept. |

## 9. State inventory

| State | Owner/entry | Treatment/exit |
|---|---|---|
| Rest/hover/down/focus | Native interaction | Appearance paint; focus-visible outline. |
| Disabled | Host or fieldset | Not focusable; appearance at 0.5 opacity. |
| Loading | Host | Focusable `aria-disabled`; centred spinner over retained content. |
| Toggle off/on | Activation or host write | Stable label, `aria-pressed`, selection paint. |
| Selected disabled/loading | Pressed + host status | Selection paint kept. |
| Icon-only (v2) | Derived from content | Square geometry; returns to text geometry when text is added. |
| Success/error/cancellation | Host operation | External status region; no button variant. |

Figma covers 3 appearances × 3 sizes × 6 states for text buttons and 3 × 3 × 7 (with On) for icon-only buttons, in light and dark.

## 10. Interaction flows

Action: Save → host sets loading → host reports the result → loading clears; failure keeps the same retry control and an external error. Toggle: Bold off → activation → Bold on, label unchanged; a cancelled click restores the prior state. **v2:** an icon-only toggle behaves the same and keeps its name ("Bold", "Helpful"). Figma links simulate the transitions; they execute no native input.

## 11. Events and transitions

| Current+trigger | Guard/owner | Next/event | Focus/announcement |
|---|---|---|---|
| Enabled+activation | Not loading or disabled | Click; host action or form proxy | Stays unless the host changes context. |
| Toggle+activation | Click not cancelled | Pressed flip, then input and change | Same control, stable name. |
| Toggle+cancelled click | defaultPrevented | Rollback; no input/change | Same control. |
| Programmatic write | Host | Render; no user event | No focus move. |
| Content becomes one icon (v2) | Host | `icon-only` set; warning if unnamed | Same control keeps focus. |
| Text added to icon-only (v2) | Host | `icon-only` cleared | Same control. |
| Focused+loading | Host | `aria-disabled`, activation suppressed | Focus kept. |
| Remove/reconnect | Scoped lifecycle | Listeners cleaned; state recomputed | Parent recovers focus. |

## 12. Accessibility contract

Native button role, Enter/Space, Tab, delegated focus. Text content names the button; an icon-only button is named by `label` (its icon stays decorative), and one without `label` logs a console warning once. Symbols are not names: no glyph-text buttons. Toggles report `aria-pressed` with a stable label. Loading stays focusable with `aria-disabled`; the spinner is decorative. Icon-only squares are never below 24 px. Forced colours keep the ButtonText border, GrayText when disabled and Highlight when pressed, including icon-only and link recipes. A link styled by the recipe remains a link (role, navigation, context menu).

## 13. Content and edge cases

Long, unbroken and RTL labels wrap without changing the text. Exactly one icon in the default slot makes the button icon-only; an icon plus any text, or two icons, does not. Icons in start/end slots never make a button icon-only. An `odd-icon` `size` attribute is overridden inside a button (use `--odd-icon-size`). Content changed while loading is a new content update. Nested interactive content is invalid.

## 14. Composition examples

`<odd-button appearance="primary">Save</odd-button>`. Toggle: `<odd-button toggle>Bold</odd-button>`. Icon-only: `<odd-button label="Close"><odd-icon>…</odd-icon></odd-button>`. Leading and trailing icons: `<odd-button><odd-icon slot="start">…</odd-icon>New project</odd-button>`, `<odd-button>Continue<odd-icon slot="end">…</odd-icon></odd-button>`. Native recipe: `<button class="odd-button" data-size="sm" data-icon-only aria-label="Previous month">…</button>`; a link: `<a class="odd-button" data-appearance="primary" href="/start">Get started</a>`. In forms that need native submit semantics, use the recipe with `type="submit"`.

## 15. Token inventory and implementation mapping

Token map (repository path: `./token-map.md`): control heights, padding, gap, radius, border, type, colours, focus, motion, opacity and (**v2**) `icon.size.sm/md/lg` per context, the icon-only square from `control.height.*`, and the Figma `content/current` variable (code syntax `currentColor`). Implementation targets: `button.ts`, `button.template.ts`, `button.structural.styles.ts`, `button.styles.ts`, `button.native.styles.ts`, the calendar and carousel, examples and tests, regenerated metadata and diagnostics.

## 16. Verification results and architecture decisions

Design evidence: Figma reconciled in place (54 text variants with end icons and loading slots, 63 icon-only variants, review rows in both themes, an icon-only toolbar allocation), read back numerically (sizes, layer order, SVG colours) and rendered. Browser acceptance B-A1–B-A13 is recorded in the run, separately from this design record.

| Applicable decisions | Conformance / explicit gap |
|---|---|
| ADR0001/0003/0004 | Owners retained; no global acceptance implied. |
| ADR0036/0043 | Existing definitions and modules; consumers move to the shared recipe. |
| ADR0038/0046 | `:state()` and `:has()` are within the existing floor (compatibility matrix). |
| ADR0041/0042 | Existing tokens; the Figma `content/current` variable aliases existing roles (no new code token). |
| ADR0045 | No new property; the custom state and diagnostic follow existing vocabulary. |
| ADR0051 Proposed | Intrinsic; no context consumer. |

Limits: real assistive technology, real browser zoom and the historical browser floor are not executed here.

## Live Figma identity

[Dedicated Button specification](https://www.figma.com/design/E7LfRysny8V3qU24tv082i/Oddkin---Design-Framework?node-id=1398-2): page `1398:2`; text sets `159:439`, `181:2332`, `181:2390`; icon-only sets `159:471`, `1455:4545`, `1455:4798`; toggle `159:501`; states review `1398:76` (v2 section `1456:1676`); allocation review `1398:2328` (toolbar hosts `1462:2074`, `1462:2104`); flows `1398:2658`; native spec `1398:2760`. Content colour collection `VariableCollectionId:1460:2`. Authoring evidence (repository path: `./figma-evidence.json`) records identities.
