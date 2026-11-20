# odd-badge — architecture and interaction specification

- **Revision:** 2026-11-19 research and redesign. Agent 1 source baseline `72204976`; the release-bound design-to-code handoff records current fingerprints.
- **Work kind / mode:** design and implementation. This Figma page records the editable design contract. Source and browser evidence are recorded in the implementation run.
- **Figma:** [Dedicated Badge specification](https://www.figma.com/design/E7LfRysny8V3qU24tv082i/Oddkin---Design-Framework?node-id=1395-2), page `1395:2`; canonical set IDs `159:582`; native spec `1395:960`. Actual authoring and refinement evidence records preserved masters and added coverage.
- **Decision status:** scoped Badge revision using the accepted compact spacing and public API.
- **Evidence:** source/research inspection observed; new rendered Figma, browser and AT claims remain separately scoped.
- **Shared decisions:** ADR0001 authority; ADR0010 Proposed CSS-layout direction, with actual mechanisms separately observed; ADR0036 compose/registration; ADR0043 dependencies; ADR0045 API vocabulary; proposed ADR0051 and current public responsive contract.
- **Change summary:** align the marker to the first text line and fit a single wrapping label into the available parent space. Keep tone, spacing, Count composition and existing asset links.

## 1. Overview and classification

Badge is a foundational display primitive for short status, category or count text alongside the thing described. Keep its passive responsibility. It reinforces words with semantic colors and an optional decorative glyph. Intrinsic CSS is sufficient: ORCP level 0, no controller, context subscription, width observer or resolver. This is not a removable Chip, compact StatusMarker, action Button, filter or notification service. See source context (repository path: `./context.md`).

## 2. Research summary and source references

Research matrix (repository path: `./research.md`) records primary URLs, inspection dates, source versions and limits. Native span semantics and CSS Text overflow wrapping support plain text that reflows without changing its canonical content. WCAG color, reflow and status guidance inform readable words, avoiding horizontal text recovery, and host-owned announcements.

Adobe Spectrum 2 treats Badge as a passive display that can wrap. SAP UI5 Tag aligns an icon with label text and exposes interactive and truncation options. Web Awesome Badge defaults to a live region and unbroken text. Bootstrap demonstrates context for a count in the surrounding control. Oddkin uses a passive label with CSS wrapping and first-line alignment. The parent provides count context and announces important updates.

Primary sources: [Spectrum 2 Web Components Badge](https://spectrum.adobe.com/web/swc/components/badge), [SAP UI5 Web Components Tag](https://ui5.github.io/webcomponents/components/Tag/), [Web Awesome Badge](https://webawesome.com/docs/components/badge/), and [Bootstrap Badge](https://getbootstrap.com/docs/5.3/components/badge/).

## 3. Architecture and responsibility boundaries

| Responsibility / state | Badge owner | Parent composition owner | Host application owner | Mechanism |
|---|---|---|---|---|
| Tone/marker rendering | Renders current props through shared module | No duplicate tone state | Chooses explicit tone for its record | `toneStyles`, `toneGlyph` |
| Words/count/source identity | Preserves slot text | Keeps related label and reading order | Owns canonical record, wording, locale and count | Default slot |
| Inline/block grant and placement | Fits grant with intrinsic layout | Owns siblings, insets, reservations and any scroll region | Selects composition appropriate to task | Existing CSS layout/ScrollRegion |
| Service outcome and retry | None | Contains real controls where needed | Owns request, response, failure, retry and stale-record policy | Existing host/controller |
| Announcements | No default live region | Owns stable notification region if delegated | Determines important update/wording | Native host ARIA composition |

No primitive-to-primitive registration edge exists between Badge, Avatar and Button. Badge imports shared host/glyph/tone styles. Reuse those mechanisms unchanged. A similarly named SideNav badge part is not an element dependency. Direct markup consumers include Docs Home/current status and composition/accessibility fixtures; dynamic external/recomposed consumers are an explicit impact gap.

## 4. Component anatomy

Semantic tree: host → `span[part="base"].badge` → decorative `span[part="marker"].marker` plus one private label span containing the default slot. Marker renders an existing SVG (`aria-hidden="true"`) and is hidden by `noMarker`. The entire surface groups glyph and words; there are no floating independent product children. Neutral/info share info-circle geometry, success uses check-circle, warning/danger use warning triangle. `badgeDefinition` preserves host → structural → glyph → tone → visual style order. The skin-free foundation and `.define.ts` registration remain separate.

## 5. Complete public API

| Property | Attribute | Type / accepted values | Default / validation | Reflection / owner |
|---|---|---|---|---|
| EXISTING `tone` | `tone` | neutral, info, success, warning, danger | neutral; invalid attribute reports `element.attribute.invalid` and falls back | Reflected; caller chooses meaning |
| EXISTING `noMarker` | `no-marker` | boolean presence | false; attribute value text does not negate presence | Reflected; caller suppresses decoration |

| Surface | Name / contract | Lifetime / notes |
|---|---|---|
| EXISTING slot | Default text | Caller controls words; no numeric formatting service |
| EXISTING parts | `base`, `marker` | Surface / optional decorative glyph |
| EXISTING CSS hook | `--odd-badge-radius` | Fallback `radius.sm` |
| Events / methods / custom states | None Badge-specific | No local default to cancel, form behavior, focus API or status event |
| Role / tab stop / announcement | None by default | Read words in place; host owns appropriate contextual ARIA |
| PROPOSED runtime API changes | None | Figma properties map to current props/slot |

There is no source size, selected, disabled, loading, count, max, href, dismissible or tooltip property. Programmatic/slot changes render without emitting user input or success events. Form reset, readonly, controlled/uncontrolled store behavior and selection are inapplicable. Exact source inventory and invalid-value distinctions are in contract §3 (repository path: `./contract.md#3-current-public-api`).

## 6. Canonical visual design

Reuse five existing tone variant identities in set `159:582`; expose Tone, actual Figma Show marker boolean (default true) and Label text. Map the design boolean explicitly to source `noMarker = !showMarker`: shown maps to false/absent `no-marker`; hidden maps to true/present `no-marker`. All ten tone/marker combinations are explicit instances in both themes. Preserve Count `159:581` as a separate content composition, not a sixth semantic tone. Current live inventory contains no Selected variant; a historical ADR0045 mention is not current Figma evidence.

Use source semantic foreground/surface, radius.sm, gap space.2xs, block inset space.3xs, inline inset space.xs, 12px/500/18px source type at the default root, and 16px source glyph. A short badge is 22px at default density. Multiline height follows the label. The marker is centered beside the first line, and later lines start at the same text edge. Actual themed host fill is required for reliable dark/light review. Badge has no focus, hover, pressed, disabled or loading visual treatment. Compact host spacing is independent; do not invent compact Badge padding.

## 7. Conditional layout contract

Intrinsic level 0. Badge takes the width its parent grants. Its label wraps at spaces first and can break an unbroken string where needed. A no-wrap ancestor does not disable Badge wrapping. Slotted inline emphasis stays within the same text flow. The optional marker keeps its token size and follows the first line in both directions. Parent rows and grids must provide a shrinkable track and reflow when there is no usable room for words.

Contract §7 (repository path: `./contract.md#7-conditional-parent-allocation-rules`) supplies B-L1…B-L8 with **Input → Condition → Response → Invariants → Owner → Mechanism → Fallback → Evidence**. The host and label can shrink. The label uses normal white space and emergency breaking, and the marker uses a first-line-height lane. Width never selects semantics, hidden text, icon-only form, density or a popup. Without a provider the same CSS works.

## 8. Parent-context demonstrations

| Fixture | Real allocation / owner | Content / scope | Continuity expectation |
|---|---|---|---|
| Natural record row | 240/320/640 parent fixture, subtract actual insets and sibling width | Short status, both themes | Parent wraps row when needed; no overlap |
| Narrow Badge grant | 80/160/240 usable Badge width | Long English/German, unbroken identifier | Soft wrap and natural height; complete canonical text |
| Nested composition | Shrinkable grid/row track next to real action | Status and count | No sibling scan or hidden action |
| Bounded reader | Actual named parent scroll region | Longer localized status and retry action | Parent scrolls; Badge never silently clips |
| Host update scene | Same record/Badge instance while neighbor remains active | Draft → In review → Published, failure/retry, 12 → 13 | Host commits outcome; no focus theft |
| Scope changes | Existing light/dark, density and RTL scopes | Arabic/Japanese and text-scaling target | Same words/role/glyph meaning |

Dimensions are fixture inputs, not universal thresholds/tokens. Extremely narrow grants below mandatory glyph/insets require parent rearrangement. Do not create a successful-looking clipped specimen. Figma transitions demonstrate design; later browser probes must observe actual same-node/focus continuity and scroll ownership.

## 9. State inventory

| Variable / state | Authoritative owner | Entry / exit | Visual and semantic treatment |
|---|---|---|---|
| Five tones | Host prop | Explicit assignment; neutral default | Corresponding surface/text/glyph, words still essential |
| Marker shown/hidden | Host noMarker prop | Boolean update | Decoration disappears; words persist |
| Status/category/count | Host record/slot | Committed data update | Badge displays supplied text; no operation inferred |
| Empty/invalid content | Caller | Missing words/unknown attribute | Annotated misuse; invalid tone fallback remains readable |
| Pending/failure/retry | Host service | Request/response/interruption | Wording and optional external explanation/action; no new Badge status API |
| Selected/disabled/hover/focus/loading | Not Badge states | Inapplicable | Use the actual owner control/pattern |

## 10. Interaction flows

Badge itself has no interaction sequence. For host simulation, begin with a record row and genuine Review/Publish action. Host request may show explicit In review/info; host confirmation may set Published/success; failure sets Failed/danger and exposes a separate Retry Button. Cancellation/stale completion is host policy; Badge does not change itself or emit an outcome. Include a return path between linked scenes.

For count update, a real host action/data event changes 12 to 13 while the adjacent `Unread messages` label persists. Parent resize/theme/RTL changes only presentation, retaining active sibling focus. Click navigation used to demonstrate Figma scenes must be attached to host controls or documentation navigation, not to the canonical Badge.

## 11. Events and transitions

| Current | Trigger / guard | Owner / intent | Next observation | Focus / announcement |
|---|---|---|---|---|
| Draft/neutral | Explicit host pending assignment | Host owns operation; no Badge event | In review/info | Neighbor stays focused; host announcement if relevant |
| In review/info | Matching committed response | Host verifies record/revision | Published/success or Failed/danger | No Badge focus move; host owns message/retry |
| Any count | New host count | No local count formatting/emit | New supplied string | Context remains understandable |
| Marker shown | noMarker=true | Caller presentation input | Hidden decorative marker | Text unchanged |
| Any tone | Invalid attribute | Diagnostic + neutral default | Original words, neutral styling | No user event |
| Any display | Allocation/scope change | CSS only | Wrapped/repainted same semantic content | Same instance/neighbor focus |

No cancelable Badge local default, payload schema, keyboard event, value-change event or async race handling is invented. Removal/reconnect owns no fetch, observer or context subscription; host retains its record. Full transition inventory appears in contract §5 (repository path: `./contract.md#5-state-owners-and-transitions`).

## 12. Accessibility contract

Read meaningful words in place. No built-in control role, tabindex, keyboard pattern or live region; Tab skips Badge. Enter/Space/Escape/arrows are not Badge commands. Glyphs are decorative; words/count context carry meaning beyond color. A standalone unlabeled count or decorative icon-only badge is not the small-space fallback.

Important dynamic status notifications use a stable host-owned announcement region, avoiding repeated live announcements across tables or duplicate wording from enclosing controls. Forced colors preserves existing system-color border/text; source tone colors are reviewed against actual surfaces. Text scaling/reflow/user spacing must not crop text. Actual keyboard/tree/AT/zoom observations are separate from Figma and source review, which do not establish universal compliance.

## 13. Content and edge cases

Include `0`, `12`, `1,234`, `Waiting for security review`, `Überprüfung der Veröffentlichung ausstehend`, `公開前の確認が必要です`, `بانتظار مراجعة النشر`, and `RELEASE_REVIEW_REQUIRED_2026_11_15`. No automatic numeric cap, text mutation or ellipsis. Empty/invalid usage is an annotation outside product anatomy. Long/unbroken words visually wrap without changing the canonical slot value. Late/replaced service records and naming are host policy. No editing/selection/IME/popup interaction belongs to Badge.

## 14. Composition examples

Register through `@oddkin/components/define/badge`; side-effect-free imports come from the existing Badge index/foundation. Minimal usage is `<odd-badge tone="success">Published</odd-badge>`. A count composition supplies adjacent wording: `<span>Unread messages</span><odd-badge no-marker>12</odd-badge>`. For a domain update, the host sets `badge.textContent` and `badge.tone` after its own outcome; it does not inspect Badge’s shadow root or call a nonexistent success method.

Existing row/cluster/grid/stack CSS manages sibling placement. A deliberately bounded parent owns its named scroller. Retry/open actions use actual Buttons/links with their own names and focus. Nonexamples: a clickable `odd-badge`, `selected`/`loading` attributes pretending to be public state, hidden essential words with tooltip-only recovery, or an observer/provider added simply to wrap text.

## 15. Token inventory and implementation mapping

Token map (repository path: `./token-map.md`) inventories exact token paths/default values and glyph mapping. Source targets are Badge class/template/structural/visual/definition/exports/examples, shared unchanged tone/glyph/host styles, and focused acceptance tests. Generated manifests/enrichment/kits are regenerated only in implementation scope.

| Role | Current token / value | Figma binding evidence |
|---|---|---|
| Tone words/surface | `color.<tone>.foreground`, `.surface`; neutral aliases text.secondary/surface.sunken | Actual IDs/modes/bindings owned by serialized Figma evidence |
| Insets/gap | space.3xs=2, xs=8, 2xs=4 at default root | Bind real existing variables; text labels alone do not count |
| Corner | radius.sm=4; existing override hook | Bind actual radius variable |
| Type | sans / xs=12 / medium500 / normal1.5 / tracking0 | Resolve available font and document any platform approximation |
| Glyph | icon.size.sm=16; existing SVG | Reuse canonical asset and dimension binding |
| Height/width | Content-derived; no fixed multiline height | Distinguish calculated measure from token/fixture size |
| Border/motion/focus/elevation | Existing forced-colors border only; no motion/focus/elevation role | Do not manufacture visual APIs |

Source hashes, canonical contract hashes, node mappings and acceptance IDs belong to the final handoff. Source token facts here do not assert Figma bindings that have not been inspected.

## 16. Verification results and architecture decisions

Current class/template/styles/definition/examples/tests, token authoring and primary research were inspected. Focused existing browser tests were **read, not rerun**, so their historical assertions are not a new passing redesign execution. B-A1…B-A8 in contract §10 (repository path: `./contract.md#10-acceptance-expectations-and-evidence-levels`) connect theme/variant, wrapping, state continuity, passive semantics, bounded ownership, scope, fallback and prototype checks to the final design/handoff evidence.

| Decision | Source conformance / scope | Exception / proposed work |
|---|---|---|
| ADR0001 | Canonical decision authority retained | Scoped companion does not accept new system policy |
| ADR0010 (Proposed) | Existing CSS mechanisms observed separately; the ADR is not Accepted | Actual parent-grant browser probes remain future implementation evidence |
| ADR0036 | Existing compose/registration/foundation | Preserve source identity/API |
| ADR0043 | No child registration dependency | No new controller or element justified |
| ADR0045 | Current tone/noMarker vocabulary | Figma Tone/Show marker/Label map to tone/!noMarker/default-slot content |
| ADR0051 / ORCP | Intrinsic contract candidate consistent with CSS-first rules | Badge wraps using intrinsic CSS. The design-to-code handoff records that capability. |

The linked review and handoff record the Figma IDs, layout, bindings and visual checks. Browser continuity, actual browser zoom, accessibility-tree and real AT evidence remain explicitly unexecuted in this design phase. A later material global rule follows the existing ADR process; shared index updates reflect inspected scope and preserve prior accepted history.

**Reconciliation, 2026-11-16:** replaced the initial draft’s NoMarker Figma-property name with the actual Show marker name and inverse source mapping, after the primary designer’s live property read. Source API/default/reflection remain unchanged. The revision-bound handoff refreshes only the reviewed affected contract fingerprints and records this reconciliation explicitly.

## Live Figma identity

[Dedicated Badge specification](https://www.figma.com/design/E7LfRysny8V3qU24tv082i/Oddkin---Design-Framework?node-id=1395-2): page `1395:2`, canonical component set `159:582`, states review `1395:106`, allocation review `1395:562`, flows `1395:852`, native spec `1395:960`. Authoring evidence (repository path: `./figma-evidence.json`) records actual preserved/new master IDs. The [first-line and wrapping review](https://www.figma.com/design/E7LfRysny8V3qU24tv082i/Oddkin---Design-Framework?node-id=1496-431) shows natural sizing, a 112px multiline label, and a markerless unbroken string in both themes. Browser results are recorded separately.
