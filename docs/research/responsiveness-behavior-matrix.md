# Responsiveness behavior matrix

Observed on 2026-11-10 in `codex/behavior-lab-docs`, based on `de271436`. This records the production responsiveness slice, not the earlier standalone demo. The [host contract](../architecture/responsiveness.md) defines ownership and the evidence levels; [verification.md](../verification.md#2026-11-10--production-responsiveness-and-native-behavior-lab) records commands and results.

## Catalog layout observations

The live public catalog supplied 77 visible components: 55 foundation components and 22 AI components. Each selected its default correct authored example, or first correct example if no default existed. The Chromium sweep opened a fresh documentation page and iframe for every component, preventing prior selections from masking missing registrations. It inspected light DOM and open shadow roots, including hidden fixture branches.

| Configuration | Samples | Observed result |
| --- | --- | --- |
| Flow, requested canvas 240 px | 77 | Ready, registered, no page overflow or runtime errors |
| Flow, requested canvas 640 px | 77 | Ready, registered, no page overflow or runtime errors |
| Bounded, requested canvas 240 px, allocation height 320 px | 77 | Ready, registered, no page overflow or runtime errors; intentional local scrolling below |
| Bounded, requested canvas 640 px, allocation height 320 px | 77 | Ready, registered, no page overflow or runtime errors |

Total: 308 observations, zero readiness failures, runtime/console errors, unknown custom element cases, or page overflow. Width is the requested iframe canvas, not the component's usable width: padding, borders and reserved scrollbars reduce the actual grant. Default density, light mode and left-to-right direction apply to this sweep. Other configurations have the interaction coverage below; they are not implied by these rendering results.

| Local observation | Classification and action |
| --- | --- |
| Question, bounded 240 px | Found an unintended fieldset intrinsic minimum. Corrected `min-inline-size` in the component. Allocation client/scroll width is now 207/207 px, formerly 207/222 px. Its 324 px of content remains vertically reachable inside the 320 px region. Choice, form and text cases have separate continuity regressions. |
| Response code block and Table at 240 px | Intentional local horizontal scrolling for two-dimensional content; no document overflow. |
| SplitPanel, bounded 240 px | The default start pane becomes 48 px wide and its authored indented list needs 54 px. Scrolling stays inside the explicitly scrolling pane. This composition is too narrow for that content to read comfortably; the application can choose the existing vertical orientation or allocate a useful pane minimum. No automatic orientation or font-size change was added. |

The local evidence artifact `.tmp/behavior-catalog-matrix.json` records the served catalog SHA-256, source revision, changed-file and build fingerprints, each actual allocation, and each observation. It is an execution artifact rather than a checked-in generated catalog. Desktop and phone exports of the native citation flow were visually inspected.

## Interaction and continuity evidence

These are separate browser suites, not conclusions drawn from the layout sweep.

| Surface | Checked behavior | Engines |
| --- | --- | --- |
| ComboBox | Same input and popup, query, caret and focus during shrink/grow; select and clear still work | Chromium, Firefox, WebKit |
| One-time-code | Same native input and six positions, retained value/selection, pointer hit area and typing across widths and densities | Chromium, Firefox, WebKit |
| Shared positioning controller | Resize feedback sizing settles without native observer-loop errors; close/disposal cancels queued placement | Chromium, Firefox, WebKit |
| Question | Choice/form/text shrink without horizontal overflow; draft, control identity, focus and selection survive resizing | Chromium, Firefox, WebKit |
| Citation | Popover leaves neighboring work in place; allocated inline mode grows intentionally; dismissal, deferred presentation, source replacement/removal, cancellation, atomic identity and focus recovery | Chromium, Firefox, WebKit |
| Approval | A drafted reason (same textarea, value, caret and focus) and a chosen scope survive resizing across the 30rem narrow arrangement; then a pending Approve keeps its loading button, focus, pending line and scope; no horizontal overflow; padding and control sizes unchanged | Chromium, Firefox, WebKit |
| Change review | An open context disclosure, the split view's sides (the same nodes, side by side when wide, stacked below 30rem) and an Accept in flight (loading button and focus) survive resizing; no horizontal overflow; padding and control sizes unchanged | Chromium, Firefox, WebKit |
| Tool call | Details stays open while the nested approval's drafted reason keeps its textarea, value, caret and focus; a failure keeps its message and a focused Retry; no horizontal overflow; padding and control sizes unchanged | Chromium, Firefox, WebKit |
| Activity wait | The wait's status badge and counts keep their nodes and text and wrap; a focused Stop keeps focus; no horizontal overflow; padding and control sizes unchanged | Chromium, Firefox, WebKit |
| Decision rows | The checkpoint's restore confirmation stays open with focus on Keep current state; the approval's and change review's rows keep their loading button and focus (above). Restore this checkpoint and Keep current state wrap inside their buttons at the narrowest grant, taller with the same padding and minimum size | Chromium, Firefox, WebKit |
| Prompt input | A draft (same textarea, value, caret and focus) survives resizing; then a Send in flight keeps its loading button and focus, and a running answer keeps a focused Stop; padding and control sizes unchanged; no horizontal overflow | Chromium, Firefox, WebKit |
| Conversation | While a reply streams, the end stays in view at every width; while earlier content is read, the message at the top stays there, within 2 px, as the width changes | Chromium, Firefox, WebKit |
| Response | A stream appends in place: the earlier paragraph and the code block keep their nodes, and the code scrolls on its own; the copy confirmation stays open beside its button and the focus stays on it | Chromium, Firefox, WebKit |
| Message reasoning | An open reasoning disclosure stays open and keeps its node | Chromium, Firefox, WebKit |
| Citation preview | An open preview stays beside its marker while the text around the marker wraps | Chromium, Firefox, WebKit |
| Sources and usage meter | A focused source link keeps the focus while titles wrap; the usage readings keep their nodes; no horizontal overflow | Chromium, Firefox, WebKit |
| Voice input and transcript | Recording continues, with the same pressed button holding the focus and the words heard so far; a transcript correction being typed keeps its field, value, caret and focus | Chromium, Firefox, WebKit |
| AI label and model select | The open details stay open; the chosen model and the focused select stay | Chromium, Firefox, WebKit |
| Task plan and inline assist | A focused Respond, the focused action in the toolbar and the chosen language stay; steps and actions wrap | Chromium, Firefox, WebKit |
| Artifact and feedback | The source view stays chosen, with the focus in it; a feedback reason stays checked and a comment being written keeps its field, value, caret and focus | Chromium, Firefox, WebKit |
| Theme Studio panel | Generate and the ramps beside the live preview and contrast from 52rem; stacked below in the reference's order. A typed, unapplied value (field, caret, focus), the file and product edited, the screen, an open diff and both preview frames (same documents, no reload) survive resizing; field groups shrink, the role overrides table and the diff scroll on their own, and a long file path wraps; padding and font sizes unchanged | Chromium, Firefox, WebKit |
| Component panel | The field being edited (value, caret, focus), the preview frame and its element survive resizing; typing continues at the caret; no horizontal overflow; the field's padding and font size unchanged | Chromium, Firefox, WebKit |
| Catalog panel | The query (value, caret, focus) and the same filtered cards survive resizing while the cards change columns; no horizontal overflow | Chromium, Firefox, WebKit |
| Theme Studio, keyboard | On the Workbench dev server at 1,280 and 390 px: Tab and Enter alone, from the skip link, edit the primary action's light and dark values (each frame updates on the same elements) and download the configuration and the CSS; no page overflow. WebKit, like Safari, leaves links out of the Tab order, so it starts at the first control | Chromium, Firefox, WebKit |
| Native lab | Real editing/submission; settings and viewport continuity; disclosure outcome, dialog lifecycle, fresh citation source reveal, late selection errors, reset and route cleanup | Chromium, Firefox, WebKit |
| Static documentation | Folder-index route, real fixture, isolated frame, strict content-security policy and readable guidance without JavaScript | Chromium, Firefox, WebKit |

The approval, change review, tool call, activity wait and decision rows were observed on 2026-11-10, based on `7e967228`, in `packages/ai/test/layout.browser.test.ts` (`continuity`). Each probe first acts as a person would (drafts a reason, chooses a scope, opens a disclosure, decides, or focuses an action), then sets a bounded parent 320 px tall, which owns the scrolling with a stable scrollbar gutter, to 680, 242, 222, 680 and 222 px. Chromium reserves a 15 px scrollbar, so the actual grants there are 645, 207 and 187 px; Firefox and WebKit grant 660, 222 and 202 px. Every probe runs in the default and the compact density and right to left, with the default text size. Density is compared as the base's padding and each control's padding, minimum block size and font size, so a label wrapping inside its button counts as content, not density. No probe found a fault, so no element changed. Larger text, other languages and screen readers were not part of these probes.

The Workbench rows were observed on 2026-11-11, based on `54e868c7`. The panel probes are in `packages/workbench/test/panels.browser.test.ts`, with the default theme linked: Theme Studio in a parent set to 1,400, 800, 420, 1,400 and 360 px (a file named by a long relative path, as on the dev server), the component and catalog panels at 1,000, 600, 360, 1,000 and 360 px, each in the default density. The keyboard rows are in `e2e/workbench-theme-studio.spec.ts`. Two findings were fixed in the panels' styles. A field group kept the fieldset's intrinsic minimum, so Theme Studio's role overrides table widened the panel to 551 px in a 420 px parent (Chromium). A long theme file path did not wrap in sentences and button labels, so the Workbench page was 415 px wide at a 390 px viewport in Chromium and WebKit; paragraphs, list items and buttons in the panels now wrap such a string anywhere.

The rows from Prompt input to Artifact and feedback were observed on 2026-11-11, based on `113e0cae`, in `packages/ai/test/layout.browser.test.ts` (`continuity`), each in the default and the compact density and right to left, in the same bounded parent; the popover probes stay inside the test viewport, between 400 and 222 px. Two findings were fixed at their source. The shared positioning controller (`@oddkin/core/controllers/position`) placed a surface again only when its anchor resized or something scrolled, so an open citation preview stayed where it opened while its marker moved with the wrapping text; it now also observes the boxes around the anchor. `odd-copy-button` placed its confirmation once, so the confirmation stayed behind when the response above it reflowed; it now follows the button while it shows. Both were reproduced in Chromium, Firefox and WebKit before the fix.

The complete published-contract suites also ran for both component packages in all three engines. They verify the facts they exercise; they do not establish every product composition, backend outcome, localization, text-size setting or screen-reader behavior. The existing inline Figma citation specimens are tested with explicit `presentation="inline"`; those comparisons do not certify the new default popover's visual fidelity.

## Extend this matrix

Use the current catalog rather than copying this component count into tests. Select the relevant authored state, record the actual allocation and parent scroll owner, then perform a real action while changing the space. Include long content, larger text, direction, density, keyboard access and nested overlays where the change affects them. Distinguish a mounting failure, a rendering observation, an interaction result and an unsupported arrangement. Publish only observed results, and keep manual assistive-technology evidence separate.
