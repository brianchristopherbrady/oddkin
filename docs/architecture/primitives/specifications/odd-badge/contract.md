# Badge contract

## Public API

| Surface | Contract |
| --- | --- |
| `tone` | Reflected enum: neutral (default), info, success, warning, danger. Invalid attribute values use neutral with the existing diagnostic. |
| `noMarker` / `no-marker` | Reflected boolean presence. Default false. Figma Show marker is its inverse and defaults true. |
| Default slot | Caller supplies readable words or a count with adjacent context. Inline emphasis stays inside the same reading run. |
| Parts and CSS | `base`, `marker`, and `--odd-badge-radius` falling back to `radius.sm`. Set `--odd-badge-radius: var(--odd-radius-full)` for a pill. The text wrapper is internal. |
| Events and interaction | Plain text in reading order. No default action, tab stop, role, live region, selection, animation or form participation. |

Badge keeps the same element and attributes when text, marker, tone, direction, theme, density or parent space changes. The decoration uses the existing glyph and is excluded from the accessibility tree. Text must communicate meaning independently of glyph/color. A separate action represents dismissal, navigation, review or retry. The record owner may announce important committed updates through one appropriate stable status region.

## State and authority

| Scope | Owns | Lifetime and write boundary |
| --- | --- | --- |
| Badge | Projection of current props and supplied light-DOM content | Presentation for the existing element lifetime. Public setters/attributes render without an outcome event. |
| Parent composition | Sibling layout, reserved space or bounded scroll region, reading order and real controls | Changes allocation in CSS and decides where related text/control lives. Active sibling focus stays with that control. |
| Headless controller | No Badge responsibility | No draft, command, arbitration, retry or shared state enters this component. Existing host controller owns any actual workflow. |
| Application | Canonical record, status tone/words, locale, counts, announcements and interpretation of requests | Renders explicit state. Network outcome, stale response handling and state transitions are application policy. |
| Server/database | Durable domain records when applicable | Existing service authorizes and commits domain state. Badge reads no database and writes no revision. |

Badge has no draft/submitted revision, in-flight requests, concurrent writer, cancellation, retry, rollback or reconnect lifecycle. Host examples show observed words before and after a host change. A Figma trigger only navigates the host scenario. It cannot prove focus behavior, announcement or request completion.

## Parent allocation

Badge is intrinsic in the [Oddkin responsiveness contract](../../../responsiveness.md). The parent gives it a usable inline grant after insets, gaps and sibling geometry. Badge does not consume ORCP policy, choose density by width or promote itself to an overlay.

| Input and condition | Response and invariants | Owner, mechanism and fallback | Evidence target |
| --- | --- | --- | --- |
| Short text with usable natural space | Width hugs content. Marker and text align within one line. | Badge's inline host and shared spacing tokens. | Short marked and markerless rows, both themes and inline alignment. |
| Finite grant including narrow row or grid | Full label wraps, height grows and glyph stays beside the first line at logical start. Words, tone and identity stay. | CSS intrinsic shrinking, one text wrapper, normal whitespace and emergency breaking. Parent rearranges below usable marker/insets/text budget. | 80/160/240 px fixtures, inline emphasis, long/unbroken labels, RTL and larger text. |
| Parent uses nowrap on its row | Badge text still wraps once constrained, preserving words and emphasis. | Set wrap behavior on the text wrapper. Parent policy remains in effect for its layout and other children. | A constrained Badge inside an inherited no-wrap row. |
| Parent explicitly bounds a reader | Badge grows with its full text. The owner region scrolls and its neighbor stays reachable. | Parent owns scrolling and adequate reservations. Badge needs no overflow affordance. | Scrollable region, focused external action and stable Badge during resize/update. |
| Marker off | Words retain the full available text lane. Former glyph and gap consume no space. | Hide decorative marker via existing property. | All five tones × marker visibility, count with context, changes without remount. |
| Host commits new status or count | Same element shows supplied words and tone, with neighboring focus intact. | Committed outcome, announcement and retry are host-owned. | Real browser fixture and host flows in the editable spec. |
| Theme/density or forced-colors changes | Color derives from theme and the system boundary stays visible in forced colors. Width alone changes no semantic state. | Existing theme and density scopes. Browser owns forced colors. | Light/dark, default/compact and forced-colors checks. |

The 80/160/240 px fixture values are allocations for tests and review. No universal breakpoint or minimum width is introduced.
