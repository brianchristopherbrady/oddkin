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
| Native lab | Real editing/submission; settings and viewport continuity; disclosure outcome, dialog lifecycle, fresh citation source reveal, late selection errors, reset and route cleanup | Chromium, Firefox, WebKit |
| Static documentation | Folder-index route, real fixture, isolated frame, strict content-security policy and readable guidance without JavaScript | Chromium, Firefox, WebKit |

The complete published-contract suites also ran for both component packages in all three engines. They verify the facts they exercise; they do not establish every product composition, backend outcome, localization, text-size setting or screen-reader behavior. The existing inline Figma citation specimens are tested with explicit `presentation="inline"`; those comparisons do not certify the new default popover's visual fidelity.

## Extend this matrix

Use the current catalog rather than copying this component count into tests. Select the relevant authored state, record the actual allocation and parent scroll owner, then perform a real action while changing the space. Include long content, larger text, direction, density, keyboard access and nested overlays where the change affects them. Distinguish a mounting failure, a rendering observation, an interaction result and an unsupported arrangement. Publish only observed results, and keep manual assistive-technology evidence separate.
