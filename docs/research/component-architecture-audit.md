# Component architecture and abstraction audit

A first pass over the public custom elements of `@oddkin/components` and `@oddkin/ai`. It asks whether each element earns its place as public API, or would serve users better as:

- a documented composition of existing elements;
- an internal part;
- nothing at all.

The AI package comes first. The owner asked for this audit on 2026-11-06.

**Status:** approved by the owner on 2026-11-06; §10 records the decisions. Agent 2 implements the plan (§9) as its items 11 to 13 in [IMPLEMENTATION_PLAN.md](../../IMPLEMENTATION_PLAN.md). Nothing in the packages changed in this first pass.

**Basis:**

- Sources: `main` at `8eee44c` (2026-11-06).
- Manifests: the `custom-elements.json` and `oddkin.metadata.json` of both packages, built from that source on 2026-11-06.
- Reading: every element's class, template, and styles.
- Intent: the AI contract ([ai-interaction.md](../architecture/ai-interaction.md), ADR 0040) and the [AI contract review](./ai-contract-review.md) of 2026-11-04.
- Fact checks: the claims below were checked against the source on 2026-11-06, and the line references are to `8eee44c`.

**Classifications:**

- **Foundational primitive:** a general building block (button, input, popover).
- **Specialized primitive:** one job, narrower than a foundational primitive, still general (copy button, citation).
- **Composite:** combines primitives and owns the behaviour between them.
- **Composition pattern:** an arrangement better documented than packaged.
- **Application-specific:** assumes one product's logic.
- **Redundant abstraction:** duplicates another element without adding behaviour.

**Dispositions:**

| Disposition | Meaning |
| --- | --- |
| Keep | The public element is justified as it is. The package-wide changes of §9, steps 1 to 3, may still touch its implementation; its API stays. |
| Refine | The public element is justified, but its implementation or API needs work of its own. |
| Decompose | Its responsibilities should be split into better building blocks. |
| Consolidate | Overlapping elements should become one. |
| Convert to pattern | Replace the element with documented composition guidance. |
| Internalize | Keep the code for internal reuse; remove it from the public API. |
| Remove | Delete a redundant or unjustified abstraction. |

**Priorities** follow the plan in §9:

- **P1:** the package-wide, non-breaking steps 1 to 3.
- **P2:** element refinements (step 4).
- **P3:** public API reductions (step 7), after the owner's decisions.
- **—:** no change of its own.

## 1. Summary

1. **The AI elements are mostly justified as elements, but they do not stand on the foundation.**
   - Most of the 24 encode behaviour that consumers should not rebuild:
     - streaming Markdown from untrusted content;
     - a feed that keeps the reader's place;
     - IME-safe composing whose drafts survive failures;
     - decisions bound to a record's revision;
     - stale proposals;
     - microphone permission and device states;
     - announcements.
   - But `@oddkin/ai` was first committed on 2026-10-17 (`8d1e424`), when `@oddkin/components` had three elements: button, card, and input. It still renders only `odd-button` from that package. Meanwhile the components package grew to 55 elements.
   - So the AI package hand-builds again what the foundation now provides:
     - disclosures, copy actions, selects, text areas, toggle buttons, a toolbar, and status symbols;
     - a private button style, `.text-button`, used 39 times in 16 folders.
   - Fixes to the foundation (focus rings, forced colours, density, right-to-left, Figma parity) therefore do not reach the AI elements.
   - This is the main architectural weakness, and most recommendations below follow from it.
2. **Two AI elements should leave the public API:**
   - `odd-message-branch`: internalize. Only `odd-message` renders it.
   - `odd-suggestions`: convert to a pattern. It is a labelled group of buttons, and the choice between inserting and sending belongs to the host.

   The owner agreed to both on 2026-11-06 (§10).
3. **Ten AI elements need refinement:** they should compose existing primitives instead of re-implementing them. Their public APIs stay, except where §6.1 renames a renderer hook (with deprecated aliases).
4. **`@oddkin/components` is in good shape:**
   - Its overlaps are deliberate. Each follows a distinct WAI-ARIA pattern or visual contract over shared modules:
     - select, picker, combobox, and listbox;
     - radio group, segmented control, and rating;
     - dialog and drawer;
     - popover and tooltip;
     - toast and alert.
   - Two refinements make it composable from other packages:
     - **Export the native-button stylesheet for shadow roots.** `odd-button`'s look is kept equal to this sheet, but it is published only as a document stylesheet. That gap is why the AI package grew its own button style.
     - **Add a `summary` slot to `odd-disclosure`** (owner, 2026-11-06). Its summary is text only, so disclosures whose summary carries status, such as a tool call, cannot use it.
5. **Patterns already have a home.** They can live in:
   - the CSS recipes (`.odd-stepper`, `.odd-timeline`, `.odd-description-list`, the layout classes);
   - the composition documents;
   - the docs site.

   §7 proposes a page format and the first eight patterns.
6. **Size is the binding constraint:**
   - `ai-chat` measures 51,683 of its 51,712-byte budget, and `ai:styles` 5,351 of 5,376 (measured at `8eee44c`).
   - Composing foundational elements into AI elements costs bytes that must be measured. Deleting the private styles saves some.
   - Every step in §9 measures size and, where a budget must rise, posts a `BUDGET` request.

| Package | Elements | Keep | Refine | Internalize | Convert to pattern | Decompose, Consolidate, Remove |
| --- | --- | --- | --- | --- | --- | --- |
| `@oddkin/ai` | 24 | 12 | 10 | 1 | 1 | 0 |
| `@oddkin/components` | 55 | 53 | 2 | 0 | 0 | 0 |

## 2. Inventory

Counts come from the published Custom Elements Manifest:

- **Lines:** the element folder's `.ts` files, without examples.
- **Props:** public instance properties, without private or underscore members.
- **States:** custom states (`:state()`).
- **Renders:** other `odd-*` elements the element's own source renders.

Every element has a registering module (`<name>.define.ts`), authored examples (`<name>.examples.ts`), and a docs page generated from its metadata. Appendix A lists each element's public properties, methods, events, slots, parts, and states.

Two things show at once in the tables:

- Only two AI elements have slots: `odd-conversation` (`composer`, `empty`, `status`) and `odd-prompt-input` (`header`, `toolbar-start`, `toolbar-end`).
- The only foundational element the AI package renders is `odd-button`.

### `@oddkin/ai` (24 elements)

| Element | Folder | Lines | Props | Attrs | Events | Slots | Parts | CSS vars | States | Renders |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `odd-action-approval` | `packages/ai/src/action-approval/` | 424 | 4 | 1 | 3 | 0 | 3 | 0 | 0 | `odd-button` |
| `odd-activity` | `packages/ai/src/activity/` | 234 | 4 | 0 | 3 | 0 | 2 | 0 | 0 | — |
| `odd-ai-label` | `packages/ai/src/ai-label/` | 146 | 2 | 0 | 0 | 0 | 3 | 0 | 0 | — |
| `odd-artifact` | `packages/ai/src/artifact/` | 432 | 8 | 2 | 3 | 0 | 4 | 0 | 0 | — |
| `odd-change-review` | `packages/ai/src/change-review/` | 494 | 5 | 3 | 4 | 0 | 6 | 0 | 0 | `odd-button` |
| `odd-checkpoint` | `packages/ai/src/checkpoint/` | 311 | 4 | 1 | 2 | 0 | 3 | 0 | 0 | `odd-button` |
| `odd-citation` | `packages/ai/src/citation/` | 296 | 4 | 2 | 2 | 0 | 2 | 0 | 0 | — |
| `odd-context-picker` | `packages/ai/src/context-picker/` | 353 | 5 | 3 | 2 | 0 | 4 | 0 | 0 | — |
| `odd-conversation` | `packages/ai/src/conversation/` | 618 | 11 | 2 | 1 | 3 | 5 | 1 | 0 | `odd-activity`, `odd-message` |
| `odd-inline-assist` | `packages/ai/src/inline-assist/` | 333 | 10 | 3 | 1 | 0 | 3 | 0 | 0 | — |
| `odd-message` | `packages/ai/src/message/` | 559 | 15 | 0 | 3 | 0 | 3 | 0 | 0 | `odd-action-approval`, `odd-ai-label`, `odd-artifact`, `odd-button`, `odd-message-branch`, `odd-response`, `odd-response-feedback`, `odd-sources`, `odd-tool-call` |
| `odd-message-branch` | `packages/ai/src/message-branch/` | 153 | 4 | 1 | 1 | 0 | 1 | 0 | 0 | — |
| `odd-model-select` | `packages/ai/src/model-select/` | 172 | 6 | 3 | 1 | 0 | 3 | 4 | 0 | — |
| `odd-prompt-input` | `packages/ai/src/prompt-input/` | 675 | 14 | 9 | 5 | 3 | 5 | 1 | 0 | `odd-button` |
| `odd-question` | `packages/ai/src/question/` | 399 | 3 | 1 | 3 | 0 | 2 | 0 | 0 | `odd-button` |
| `odd-response` | `packages/ai/src/response/` | 416 | 8 | 2 | 1 | 0 | 3 | 1 | 0 | — |
| `odd-response-feedback` | `packages/ai/src/response-feedback/` | 322 | 6 | 3 | 2 | 0 | 2 | 0 | 0 | `odd-button` |
| `odd-sources` | `packages/ai/src/sources/` | 218 | 3 | 1 | 0 | 0 | 3 | 0 | 0 | — |
| `odd-suggestions` | `packages/ai/src/suggestions/` | 212 | 4 | 2 | 2 | 0 | 3 | 0 | 0 | — |
| `odd-task-plan` | `packages/ai/src/task-plan/` | 288 | 2 | 0 | 1 | 0 | 3 | 0 | 0 | — |
| `odd-tool-call` | `packages/ai/src/tool-call/` | 271 | 5 | 0 | 1 | 0 | 4 | 0 | 0 | `odd-action-approval` |
| `odd-transcript` | `packages/ai/src/transcript/` | 170 | 4 | 1 | 1 | 0 | 2 | 0 | 0 | — |
| `odd-usage-meter` | `packages/ai/src/usage-meter/` | 182 | 3 | 1 | 0 | 0 | 2 | 0 | 0 | — |
| `odd-voice-input` | `packages/ai/src/voice-input/` | 291 | 5 | 1 | 2 | 0 | 3 | 0 | 0 | `odd-transcript` |

### `@oddkin/components` (55 elements)

| Element | Folder | Lines | Props | Attrs | Events | Slots | Parts | CSS vars | States | Renders |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `odd-alert` | `packages/components/src/alert/` | 190 | 3 | 3 | 0 | 2 | 3 | 1 | 0 | — |
| `odd-avatar` | `packages/components/src/avatar/` | 182 | 3 | 3 | 0 | 1 | 2 | 1 | 0 | — |
| `odd-badge` | `packages/components/src/badge/` | 133 | 2 | 2 | 0 | 1 | 2 | 1 | 0 | — |
| `odd-breadcrumbs` | `packages/components/src/breadcrumbs/` | 387 | 4 | 2 | 0 | 1 | 7 | 1 | 0 | — |
| `odd-button` | `packages/components/src/button/` | 558 | 17 | 16 | 2 | 3 | 2 | 6 | 0 | — |
| `odd-calendar` | `packages/components/src/calendar/` | 803 | 18 | 11 | 2 | 0 | 19 | 0 | 1 | — |
| `odd-card` | `packages/components/src/card/` | 235 | 3 | 3 | 0 | 3 | 4 | 6 | 0 | — |
| `odd-carousel` | `packages/components/src/carousel/` | 392 | 3 | 2 | 2 | 1 | 9 | 0 | 0 | — |
| `odd-checkbox` | `packages/components/src/checkbox/` | 154 | 13 | 8 | 2 | 1 | 5 | 0 | 1 | — |
| `odd-checkbox-group` | `packages/components/src/checkbox-group/` | 231 | 11 | 7 | 0 | 1 | 5 | 0 | 1 | — |
| `odd-chip` | `packages/components/src/chip/` | 237 | 4 | 3 | 1 | 1 | 2 | 1 | 0 | — |
| `odd-color-picker` | `packages/components/src/color-picker/` | 1082 | 14 | 7 | 2 | 0 | 19 | 0 | 2 | — |
| `odd-combobox` | `packages/components/src/combobox/` | 726 | 23 | 15 | 3 | 2 | 16 | 0 | 1 | — |
| `odd-command-palette` | `packages/components/src/command-palette/` | 598 | 8 | 5 | 2 | 2 | 9 | 1 | 0 | `odd-icon` |
| `odd-container` | `packages/components/src/container/` | 99 | 1 | 1 | 0 | 1 | 1 | 1 | 0 | — |
| `odd-copy-button` | `packages/components/src/copy-button/` | 336 | 5 | 4 | 1 | 0 | 4 | 0 | 0 | — |
| `odd-date-picker` | `packages/components/src/date-picker/` | 498 | 19 | 12 | 2 | 0 | 7 | 0 | 2 | `odd-calendar` |
| `odd-dialog` | `packages/components/src/dialog/` | 330 | 7 | 5 | 0 | 3 | 6 | 1 | 0 | — |
| `odd-disclosure` | `packages/components/src/disclosure/` | 330 | 4 | 4 | 1 | 1 | 5 | 2 | 2 | — |
| `odd-drawer` | `packages/components/src/drawer/` | 186 | 9 | 7 | 0 | 3 | 6 | 2 | 0 | — |
| `odd-empty-state` | `packages/components/src/empty-state/` | 172 | 1 | 1 | 0 | 3 | 4 | 0 | 0 | — |
| `odd-file-input` | `packages/components/src/file-input/` | 525 | 14 | 8 | 2 | 0 | 10 | 0 | 2 | — |
| `odd-icon` | `packages/components/src/icon/` | 153 | 3 | 3 | 0 | 1 | 1 | 1 | 0 | — |
| `odd-input` | `packages/components/src/input/` | 559 | 24 | 17 | 2 | 0 | 10 | 4 | 1 | — |
| `odd-listbox` | `packages/components/src/listbox/` | 401 | 16 | 9 | 2 | 2 | 10 | 1 | 1 | — |
| `odd-menu` | `packages/components/src/menu/` | 636 | 6 | 5 | 1 | 1 | 6 | 0 | 0 | `odd-icon` |
| `odd-one-time-code` | `packages/components/src/one-time-code/` | 370 | 19 | 13 | 2 | 0 | 7 | 0 | 1 | — |
| `odd-pagination` | `packages/components/src/pagination/` | 386 | 5 | 4 | 1 | 0 | 7 | 1 | 0 | — |
| `odd-picker` | `packages/components/src/picker/` | 698 | 22 | 13 | 3 | 2 | 23 | 0 | 1 | — |
| `odd-popover` | `packages/components/src/popover/` | 300 | 9 | 7 | 0 | 1 | 2 | 1 | 0 | — |
| `odd-progress` | `packages/components/src/progress/` | 269 | 6 | 4 | 0 | 0 | 6 | 1 | 0 | — |
| `odd-radio-group` | `packages/components/src/radio-group/` | 239 | 13 | 8 | 2 | 0 | 8 | 0 | 1 | — |
| `odd-rating` | `packages/components/src/rating/` | 334 | 15 | 9 | 2 | 0 | 7 | 0 | 1 | — |
| `odd-relative-time` | `packages/components/src/relative-time/` | 194 | 3 | 2 | 0 | 0 | 3 | 0 | 0 | — |
| `odd-scroll-region` | `packages/components/src/scroll-region/` | 173 | 2 | 1 | 0 | 1 | 1 | 1 | 0 | — |
| `odd-segmented-control` | `packages/components/src/segmented-control/` | 279 | 13 | 8 | 2 | 0 | 6 | 0 | 1 | `odd-icon` |
| `odd-select` | `packages/components/src/select/` | 339 | 13 | 8 | 2 | 0 | 5 | 4 | 1 | — |
| `odd-side-nav` | `packages/components/src/side-nav/` | 691 | 6 | 2 | 2 | 3 | 9 | 0 | 0 | — |
| `odd-skeleton` | `packages/components/src/skeleton/` | 165 | 2 | 2 | 0 | 0 | 2 | 1 | 0 | — |
| `odd-slider` | `packages/components/src/slider/` | 377 | 16 | 9 | 2 | 0 | 11 | 0 | 1 | — |
| `odd-spinner` | `packages/components/src/spinner/` | 165 | 3 | 2 | 0 | 1 | 2 | 1 | 0 | — |
| `odd-split-button` | `packages/components/src/split-button/` | 226 | 7 | 5 | 1 | 1 | 8 | 0 | 0 | `odd-menu` |
| `odd-split-panel` | `packages/components/src/split-panel/` | 321 | 7 | 6 | 2 | 2 | 4 | 1 | 0 | — |
| `odd-stat` | `packages/components/src/stat/` | 212 | 5 | 4 | 0 | 1 | 5 | 0 | 0 | `odd-skeleton` |
| `odd-status-marker` | `packages/components/src/status-marker/` | 171 | 1 | 1 | 0 | 1 | 1 | 1 | 0 | — |
| `odd-switch` | `packages/components/src/switch/` | 234 | 13 | 7 | 2 | 1 | 7 | 0 | 1 | — |
| `odd-tab-panel` | `packages/components/src/tab-panel/` | 93 | 3 | 3 | 0 | 1 | 0 | 0 | 0 | — |
| `odd-table` | `packages/components/src/table/` | 606 | 11 | 7 | 3 | 2 | 8 | 0 | 0 | — |
| `odd-tabs` | `packages/components/src/tabs/` | 385 | 4 | 4 | 2 | 1 | 4 | 2 | 0 | — |
| `odd-textarea` | `packages/components/src/textarea/` | 257 | 20 | 14 | 2 | 0 | 6 | 5 | 1 | — |
| `odd-toast` | `packages/components/src/toast/` | 380 | 5 | 4 | 0 | 2 | 4 | 1 | 0 | — |
| `odd-toolbar` | `packages/components/src/toolbar/` | 223 | 2 | 2 | 0 | 1 | 1 | 2 | 0 | — |
| `odd-tooltip` | `packages/components/src/tooltip/` | 270 | 5 | 4 | 0 | 1 | 1 | 1 | 0 | — |
| `odd-tree` | `packages/components/src/tree/` | 419 | 8 | 4 | 3 | 2 | 5 | 0 | 0 | `odd-icon` |
| `odd-validation-summary` | `packages/components/src/validation-summary/` | 427 | 3 | 2 | 0 | 0 | 5 | 0 | 0 | — |

Shared machinery that is not an element:

- **Components:**
  - `overlay/` (popover, tooltip, menu, and dialog surfaces);
  - `form-control/` (form association, and the radio control shared by the radio group, segmented control, and rating);
  - `collection/` (rows for the listbox, tree, and picker);
  - `layout/` (layout recipes);
  - `styles/` (shared shadow-root sheets, [styles/index.ts](../../packages/components/src/styles/index.ts));
  - `css/` (document stylesheets: layout classes and CSS recipes, [css/index.ts](../../packages/components/src/css/index.ts));
  - `composition/` (composition documents).
- **AI:**
  - `contracts/` (record models and normalization);
  - `controllers/` (DOM-free state: composer, conversation, document, voice);
  - `markdown/`, `stream/`, and `highlight/`;
  - `internal/` (the base sheet, the AI layout recipe, strings, ids).

## 3. How the AI package is built today

### The contract it implements

The AI elements render records from the AI interaction contract ([ai-interaction.md](../architecture/ai-interaction.md)):

1. The host owns the records, and an element renders one.
2. User intent leaves the element as an event.
3. The outcome comes back as a new record, never as an echo of the event.

The record models include:

- message, attempt, and tool call;
- approval, checkpoint, and question;
- plan, proposal, and artifact;
- source, usage, and provenance.

The design is sound and worth protecting:

- Records are plain data, so the elements work with any framework.
- A newer record replaces the last one, which suits streaming.
- Nothing the model writes ever becomes HTML.
- The metadata publishes every record's schema, so agents can read it.

Most AI elements are therefore *record renderers*. A documented composition cannot replace a record renderer without moving its record-to-UI mapping, revision rules, and announcements into every application. That is why most dispositions below are Keep or Refine, not Convert to pattern.

### Shared conventions that work

- **Localization:** `strings`, `format()`, and `langOf()` from `@oddkin/core/i18n`, re-exported by [internal/strings.ts](../../packages/ai/src/internal/strings.ts). Every element is localizable.
- **Capabilities:** every action is `{ available, reason? }`. Elements hide or disable unavailable controls and show the reason.
- **Announcements:** `odd-announce` events, routed to live regions ([announce.ts](../../packages/ai/src/announce.ts)). Six elements have an `announce` property (`'none'` or `'important'`): action-approval, change-review, checkpoint, conversation, question, and response-feedback.
- **Shared sheets:** the base sheet and AI layout recipe ([internal/base.styles.ts](../../packages/ai/src/internal/base.styles.ts), [internal/ai-element.recipe.ts](../../packages/ai/src/internal/ai-element.recipe.ts)). The AI package already imports `@oddkin/components/styles` and `@oddkin/components/layout`, so the channel for composition exists.

### What it re-implements

Counted in `packages/ai/src` without examples and tests:

| Re-implemented piece | Where | What exists in the foundation |
| --- | --- | --- |
| A private button style, `.text-button` ([base.styles.ts:61–92](../../packages/ai/src/internal/base.styles.ts#L61-L92)), 39 uses | 16 folders: activity, ai-label, artifact, citation, context-picker, conversation, inline-assist, internal, message, message-branch, prompt-input, response, response-feedback, task-plan, tool-call, voice-input | `odd-button`, or its native-button sheet `nativeButtonStyles` ([button.native.styles.ts](../../packages/components/src/button/button.native.styles.ts)) |
| Toggle buttons with `aria-pressed` | artifact (view, [artifact.template.ts:44](../../packages/ai/src/artifact/artifact.template.ts#L44)), response-feedback (rating), voice-input (record), internal | `odd-button` `toggle` and `pressed`; `odd-segmented-control` for a choice of views |
| Native `<details>` disclosures | ai-label ([ai-label.template.ts:13](../../packages/ai/src/ai-label/ai-label.template.ts#L13)), message (reasoning, [message.template.ts:36](../../packages/ai/src/message/message.template.ts#L36)), tool-call ([tool-call.template.ts:21](../../packages/ai/src/tool-call/tool-call.template.ts#L21)) | `odd-disclosure` |
| An `aria-expanded` toggle drawn by hand | context-picker (Inspect, [context-picker.template.ts:35](../../packages/ai/src/context-picker/context-picker.template.ts#L35)) | `odd-disclosure` |
| Clipboard copy (`navigator.clipboard.writeText`) | artifact ([artifact.ts:132](../../packages/ai/src/artifact/artifact.ts#L132)), message ([message.ts:163](../../packages/ai/src/message/message.ts#L163)), response | `odd-copy-button` (`value` or `from`) |
| Native `<select>` | artifact (revision, [artifact.template.ts:18](../../packages/ai/src/artifact/artifact.template.ts#L18)), inline-assist (language, [inline-assist.template.ts:45](../../packages/ai/src/inline-assist/inline-assist.template.ts#L45)), model-select, question | `odd-select` |
| A field around a native select, built from the shared field classes ([model-select.template.ts:6–17](../../packages/ai/src/model-select/model-select.template.ts#L6-L17)) | model-select | `odd-select` |
| Native `<textarea>` | action-approval (reason), message (edit, [message.template.ts:137](../../packages/ai/src/message/message.template.ts#L137)), prompt-input (composer), question, response-feedback (comment), transcript | `odd-textarea`. The composer is a justified exception: a composer is not a labelled form field. |
| A roving-focus toolbar | inline-assist ([inline-assist.ts:142](../../packages/ai/src/inline-assist/inline-assist.ts#L142)) | `odd-toolbar` |
| Decorative status symbols from a private map ([task-plan.ts:21–29](../../packages/ai/src/task-plan/task-plan.ts#L21-L29)) | task-plan | `odd-status-marker` |
| Status text coloured by `data-tone` | tool-call ([tool-call.template.ts:24](../../packages/ai/src/tool-call/tool-call.template.ts#L24)), context-picker ([context-picker.template.ts:27](../../packages/ai/src/context-picker/context-picker.template.ts#L27)) | `odd-badge` with `tone` |

Two behaviours are copied element by element instead of shared:

- **A guard against deciding twice:** a `_requested` signal holding the record's id and revision ([action-approval.ts:80](../../packages/ai/src/action-approval/action-approval.ts#L80), [question.ts:57](../../packages/ai/src/question/question.ts#L57)). It appears in action-approval, checkpoint, and question, 18 references in all.
- **Focus recovery when the focused control disappears:** `FocusRecovery` from `@oddkin/core/controllers/focus`, set up separately in action-approval, change-review, checkpoint, question, and response-feedback.

## 4. `@oddkin/ai`: classification and disposition

No AI element is application-specific: none assumes a product's business logic.

| Element | Classification | Disposition | Priority | Confidence |
| --- | --- | --- | --- | --- |
| `odd-conversation` | Composite | Keep | — | High |
| `odd-message` | Composite | Refine | P1 | High |
| `odd-message-branch` | Specialized primitive; only `odd-message` renders it | Internalize | P3 | Medium |
| `odd-response` | Specialized primitive | Keep | P1 (copy) | High |
| `odd-prompt-input` | Composite | Keep | — | High |
| `odd-suggestions` | Composition pattern | Convert to pattern | P3 | Medium |
| `odd-model-select` | Specialized primitive, overlapping `odd-select` | Refine | P2 | Medium |
| `odd-context-picker` | Composite | Refine | P2 | Medium |
| `odd-activity` | Specialized primitive | Keep | — | High |
| `odd-task-plan` | Specialized primitive | Refine | P2 | High |
| `odd-tool-call` | Composite | Refine | P2 | Medium |
| `odd-action-approval` | Composite | Keep | — | High |
| `odd-checkpoint` | Composite | Keep | — | High |
| `odd-question` | Composite | Refine | P2 | Medium |
| `odd-change-review` | Composite | Keep | — | High |
| `odd-inline-assist` | Composite | Refine | P2 | Medium |
| `odd-ai-label` | Specialized primitive | Refine | P2 | Medium |
| `odd-citation` | Specialized primitive | Keep | — | High |
| `odd-sources` | Specialized primitive | Keep | — | High |
| `odd-response-feedback` | Composite | Refine | P2 | Medium |
| `odd-artifact` | Composite | Refine | P1 (copy), P2 | Medium |
| `odd-usage-meter` | Specialized primitive | Keep | — | High |
| `odd-voice-input` | Composite | Keep | — | High |
| `odd-transcript` | Specialized primitive | Keep | — | Medium |

Each element below lists its responsibilities, the reason for its disposition, the proposal, and the effect on consumers. Appendix A has its full API.

### The conversation surface

**`odd-conversation`: Keep.**

- **Responsibilities** ([conversation.ts:47–63](../../packages/ai/src/conversation/conversation.ts#L47-L63)):
  - messages as an ARIA `feed` of `article`s with position and size;
  - history loading;
  - a follow-latest scrolling policy that respects reading earlier content;
  - a visible-anchor guarantee when history is prepended or content above changes size;
  - "Jump to latest";
  - Page Up and Page Down between messages;
  - one polite and one assertive live region.
- **API:**
  - `store` or `state`, the renderer hooks, and the scroll-position methods;
  - three slots: `composer`, `empty`, and `status`. They are the AI package's best composition points.
- **Why keep:** no composition reproduces this scrolling and focus behaviour simply.
- **Proposal:**
  - Show the "Empty conversation" pattern (§7) in its `empty` slot examples.
  - Align its renderer hooks with §6.1.
- **Consumer impact:** none.

**`odd-message`: Refine (P1).**

- **Responsibilities:**
  - renders a message's ordered parts with their renderers;
  - owns the inline-edit draft and restores focus after it;
  - shows only the actions its role, status, and capabilities allow.
- **What needs work:**
  - Copy, regenerate, and edit are drawn with the private `.text-button` ([message.template.ts:157–172](../../packages/ai/src/message/message.template.ts#L157-L172)). The edit form's own actions use `odd-button` ([lines 140–144](../../packages/ai/src/message/message.template.ts#L140-L144)).
  - Reasoning is a bare `<details>` (line 36).
  - Its copy duplicates `odd-response`'s.
- **Proposal:**
  - the shared native button styles (§9 step 2);
  - `odd-copy-button` for copy, and `odd-disclosure` for reasoning (step 3);
  - an `actions` slot for host actions (§6.1).
- **Consumer impact:**
  - No properties or events change.
  - The parts `content`, `footer`, and `header` stay, though elements inside them change.
  - Hosts that style the inner buttons through `::part()` have nothing to migrate: the buttons are not parts today.

**`odd-message-branch`: Internalize (P3).**

- **Responsibilities:** previous, next, and "*n* of *m*" over a message's `branch` record. It sends `odd-branch-switch`.
- **Why internalize:**
  - Outside its own folder, only [message.template.ts](../../packages/ai/src/message/message.template.ts) and the Figma parity test render it. No example app or other element does.
  - As public API it still costs a registering module, a docs page, a Figma family, examples, contract tests, and compatibility promises, for a control a host never places on its own.
- **Proposal:**
  - Keep the module as an internal part of `odd-message`, and keep the `branch` record and the `odd-branch-switch` intent.
  - Remove its public registration after a deprecation period (§9 step 7).
  - The "Branch navigation" pattern (§7) shows hosts with their own message layout how to build it.
- **Consumer impact:**
  - Hosts that render `<odd-message-branch>` themselves would switch to the pattern.
  - Hosts that listen for `odd-branch-switch` are unaffected.
- **Confidence: medium.** A host building a custom message layout may want the element.
- **Owner, 2026-11-06:** internalize.

**`odd-response`: Keep (P1 for copy).**

- **Responsibilities:**
  - streamed Oddkin Markdown, in which committed blocks stay put while the tail streams;
  - the statuses `streaming`, `complete`, `interrupted`, `cancelled`, and `failed` ([response.ts:23](../../packages/ai/src/response/response.ts#L23));
  - untrusted content: no HTML, a URL policy, and images as links unless allowed ([markdown/render.ts:27](../../packages/ai/src/markdown/render.ts#L27));
  - copy from the canonical text (`copy()`).
- **Why keep:** it is the package's core specialized primitive.
- **Proposal:** draw the copy action with `odd-copy-button` (step 3), and keep `copy()`.
- **Consumer impact:** none.

**`odd-prompt-input`: Keep.**

- **Responsibilities:**
  - draft revisions, so that acknowledging an older submission never clears newer input ([controllers/composer.ts:3](../../packages/ai/src/controllers/composer.ts#L3));
  - Enter that is safe during IME composition;
  - attachment validation and lifecycle: object URLs, and the statuses selected, uploading, uploaded, processing, ready, failed, and removed;
  - automatic sizing;
  - three slots.
- **Why keep:** this is real behaviour, and its native `<textarea>` is right for a composer.
- **Proposal:** later, consider drawing attachments as `odd-chip` (P3; measure the size first).
- **Consumer impact:** none.

**`odd-suggestions`: Convert to pattern (P3).**

- **Responsibilities:**
  - a labelled group of prompt buttons;
  - each inserts its prompt into the composer (`odd-suggestion-select`), and optionally sends it (`odd-suggestion-submit`, unless `insertOnly`).
- **Why convert:**
  - It encodes a visual arrangement and an application decision, not behaviour that is hard to get right.
  - The "Suggested prompts" pattern (§7), `odd-button`s in a labelled `.odd-cluster` group, is easier to adapt: one action or two, icons, wrapping, another layout.
- **Consumer impact:**
  - Hosts replace the element with a few lines of markup and two listeners, documented in the pattern.
  - `examples/ai-research/index.html` uses it and would migrate.
  - The Figma specimen stays, as the pattern's picture.
- **Confidence: medium.** The element's pair of intents is a small contract that agents read from metadata.
- **Owner, 2026-11-06:** convert to a pattern.

**`odd-model-select`: Refine (P2).**

- **Responsibilities:**
  - the model choice, as a native select inside the shared field classes;
  - a description of the chosen model;
  - unavailable models listed but disabled, with the host's reason.
- **Why refine:** it duplicates `odd-select`'s field anatomy, so it misses `odd-select`'s improvements.
- **Proposal:** render `odd-select` inside it, and keep the `models` record and `odd-model-change`.
- **Consumer impact:**
  - The parts `label` and `select` would change. `select` would become the inner `odd-select`.
  - `examples/ai-research/index.html` uses it.
- **Owner, 2026-11-06:** keep the element, composing `odd-select`. A "Model choice" pattern is not needed.

**`odd-context-picker`: Refine (P2).**

- **Responsibilities:**
  - adding files and links, with links checked by `safeUrl`;
  - each item's status (uploading, ready, failed);
  - an Inspect preview per item.
- **Why refine:**
  - The Inspect toggle is drawn by hand with `aria-expanded`.
  - The URL field is a bare input.
  - The status is toned text.
- **Proposal:**
  - `odd-disclosure` for Inspect, depending on the `summary` slot question (§6, S4);
  - `odd-input` for the URL, which brings the label, description, and error contract;
  - `odd-badge` for the status.
- **Consumer impact:** some parts change. The properties and events stay.

### Agent work and control

**`odd-activity`: Keep.**

- **Responsibilities:** one status line for the current attempt: active tools, approvals, stopping, disconnection, and interruption. It offers stop, resume, and retry.
- **Proposal:** only the shared native button styles (step 2).
- **Consumer impact:** none.

**`odd-task-plan`: Refine (P2).**

- **Responsibilities:**
  - steps with work running in parallel within a step, blockers, and input requests;
  - progress as text;
  - a Respond request (`odd-plan-input-request`).
- **Why refine:**
  - It draws decorative status symbols from a private map ([task-plan.ts:21–29](../../packages/ai/src/task-plan/task-plan.ts#L21-L29)).
  - The `.odd-stepper` recipe ([css/index.ts:620](../../packages/components/src/css/index.ts#L620)) describes exactly this: "the steps of a task, each an `li` holding an `odd-status-marker`".
- **Proposal:** `odd-status-marker` for each step and task, the stepper's arrangement, and native button styles.
- **Consumer impact:** none to the API.

**`odd-tool-call`: Refine (P2).**

- **Responsibilities:**
  - the tool lifecycle: the statuses `input-streaming`, `input-available`, `awaiting-approval`, `executing`, `output-available`, `output-error`, `denied`, and `cancelled` ([models.ts:122–134](../../packages/ai/src/contracts/models.ts#L122-L134));
  - retry;
  - an embedded `odd-action-approval`;
  - host rendering of results.
- **Why refine:**
  - Its disclosure is a bare `<details>`, and its status is toned text.
  - `odd-disclosure`'s summary is text only ([disclosure.ts:22–41](../../packages/components/src/disclosure/disclosure.ts#L22-L41)), and the tool call's summary holds a name, a purpose, and a status. So adopting `odd-disclosure` needs a `summary` slot there first (S4).
- **Proposal:**
  - `odd-badge` for the status;
  - `odd-disclosure` once it has a `summary` slot;
  - rename `renderOutput` under §6.1, with the old name kept as a deprecated alias.
  - Keep the embedded approval, because approval inside a tool call is the common case. Document standalone approval as a pattern (§7).
- **Consumer impact:** a deprecated property name. Some parts change.

**`odd-action-approval`: Keep.**

- **Responsibilities:**
  - one decision per revision of an approval, with no duplicate decisions;
  - expired and superseded states;
  - an Edit request and a reason draft;
  - outcomes announced, and focus recovered.
- **Proposal:**
  - `odd-textarea` for the reason;
  - the shared request guard and focus recovery (step 2).
- **Consumer impact:** none.

**`odd-checkpoint`: Keep.**

- **Responsibilities:** a restore confirmed in two steps, its outcome confirmed by the host and announced, and focus recovery.
- **Proposal:** only the shared changes of step 2.
- **Consumer impact:** none.

**`odd-question`: Refine (P2).**

- **Responsibilities:**
  - the question kinds `choice`, `multi-choice`, `text`, and `form` ([models.ts:290](../../packages/ai/src/contracts/models.ts#L290)), and an Other answer for the choice kinds;
  - answers bound to the question's revision;
  - validation;
  - Skip.
- **Why refine:** it renders every control natively.
- **Proposal:** compose `odd-radio-group`, `odd-checkbox-group`, `odd-textarea`, `odd-input`, and `odd-select`. They bring the label, description, error, and `:state(user-invalid)` contract, and the design system's look.
- **Effort: medium.** The controls are form-associated, so validation must keep working through the element's own form in its shadow root. Test it in three engines.
- **Consumer impact:** none to the API. The `form` part's contents change.

**`odd-change-review`: Keep.**

- **Responsibilities:**
  - word or line diffs (`granularity`), with runs of word changes separated only by whitespace merged ([change-review.ts:35](../../packages/ai/src/change-review/change-review.ts#L35));
  - inline and split views, with muted context around each change;
  - Accept, Reject, and Undo, with pending states ("Applying…", "Undoing…");
  - Dismiss for stale proposals;
  - outcomes announced.
- **Why keep:** it already uses `odd-button`.
- **Proposal:** only the shared changes of step 2.
- **Consumer impact:** none.

**`odd-inline-assist`: Refine (P2).**

- **Responsibilities:**
  - assistance bound to a selection and its content revision, so stale results can be detected;
  - a result rendered as inert Markdown.
- **Why refine:** its action row builds the APG toolbar by hand with `RovingFocus`, and its language choice is a native select.
- **Proposal:**
  - `odd-toolbar` and `odd-select`;
  - native button styles;
  - `odd-menu` for more than four actions (P3).
- **Consumer impact:** the `toolbar` part changes.

### Provenance, sources, feedback, and generated media

**`odd-ai-label`: Refine (P2).**

- **Responsibilities:**
  - a provenance label;
  - a native `<details>` whose summary is the label and whose body is a description list of the origin the host supplied;
  - the disclaimer "Information supplied by the application; not independently verified."
- **Why refine, not convert:**
  - Could provenance be a badge with a popover instead of an element? Its API is small (`provenance`, `strings`), so the usual reason to convert (a large configuration surface) does not apply.
  - The provenance record belongs to the AI contract, and `odd-message` renders the label from it.
  - The AI package also avoids popup layers on purpose. The citation's preview is "a `preview` panel after it (no popup layer, no hover-only content)" ([citation.template.ts:6](../../packages/ai/src/citation/citation.template.ts#L6)).
  - So the inline reveal should stay.
- **Proposal:**
  - `odd-disclosure` for the reveal (its `label` is the provenance label), styled through its `summary` part to read as a badge;
  - the `.odd-description-list` recipe for the details.
- **Consumer impact:** the parts change. `examples/ai-writing/index.html` uses it.
- **Owner, 2026-11-06:** keep the element, composing `odd-disclosure`.

**`odd-citation`: Keep.**

- **Responsibilities:**
  - an inline marker named after its source, which opens a preview;
  - Escape closes the preview and returns focus to the marker;
  - safe links;
  - `odd-citation-open`, and by default `odd-source-reveal` to the message's sources.
- **Why keep:**
  - The preview is deliberately ordinary content after the marker, not a popup layer. Screen reader and touch users reach it in reading order, and it cannot be clipped.
  - A popover was considered and not recommended (§10).
- **Proposal:** only the shared button styles, for "Show in sources".
- **Consumer impact:** none.

**`odd-sources`: Keep.** It is a small, clear primitive: the numbered list behind a response, `reveal(sourceId)`, and safe links. Consumer impact: none.

**`odd-response-feedback`: Refine (P2).**

- **Responsibilities:**
  - a positive or negative rating;
  - reasons and a comment while a rating is drafted;
  - a pending state, the outcome, and an announcement.
- **Proposal:**
  - `odd-button` toggles (`toggle`, `pressed`) for the rating;
  - `odd-checkbox-group` for the reasons;
  - `odd-textarea` for the comment.
- **Consumer impact:** the `form` part's contents change.

**`odd-artifact`: Refine (P1 for copy, P2 for the rest).**

- **Responsibilities:**
  - revisions with a stable identity;
  - preview and source views;
  - host renderers by kind;
  - export requests (`odd-artifact-export`);
  - copy and download from the canonical revision content.
- **Proposal:**
  - `odd-copy-button` (step 3);
  - `odd-select` for the revision;
  - `odd-segmented-control` for the view;
  - native button styles for download and exports, in an `odd-toolbar`.
- **Consumer impact:** the `toolbar` part's contents change.

**`odd-usage-meter`: Keep.**

- **Responsibilities:**
  - figures the host supplies, formatted for the locale;
  - each marked `measured`, `estimated`, or `unknown` ([models.ts:222](../../packages/ai/src/contracts/models.ts#L222));
  - a native `<meter>` when a limit exists.
- **Why keep:** `<meter>` is the right semantics; `odd-progress` is not.
- **Proposal:** consider the `.odd-description-list` recipe for its list.
- **Consumer impact:** none.

**`odd-voice-input`: Keep.**

- **Responsibilities:**
  - microphone states: unsupported, permission denied, no device, interrupted, and processing ([controllers/voice.ts](../../packages/ai/src/controllers/voice.ts));
  - an owned controller (released on disconnect) or a host controller;
  - Escape to stop;
  - its transcript.
- **Proposal:** native button styles with `aria-pressed` for the record toggle (step 2).
- **Consumer impact:** none.

**`odd-transcript`: Keep.**

- **Responsibilities:** final segments, optionally editable, and the interim text. `odd-voice-input` shows it, and it is useful for any transcript.
- **Proposal:** consider `odd-textarea` for editable segments (P3).
- **Consumer impact:** none.
- **Confidence: medium.** It may be better as an internal part of `odd-voice-input` if no other use appears.

## 5. `@oddkin/components`: classification and disposition

For every element marked Keep:

- Its API is in Appendix A, and its documentation in its metadata (`@useFor`, `@notFor`, `@a11y`, `@keyboard`).
- Consumer impact and migration are none.
- The note says why it is kept, or how the AI package should use it.

| Element | Classification | Disposition | Confidence | Note |
| --- | --- | --- | --- | --- |
| `odd-alert` | Specialized primitive | Keep | High | Persistent inline message; `odd-toast` is transient |
| `odd-avatar` | Foundational primitive | Keep | High | |
| `odd-badge` | Foundational primitive | Keep | High | For toned status text in the AI elements |
| `odd-breadcrumbs` | Composite | Keep | High | |
| `odd-button` | Foundational primitive | Refine | High | §5.1 |
| `odd-calendar` | Specialized primitive | Keep | High | Used by `odd-date-picker` |
| `odd-card` | Foundational primitive | Keep | High | |
| `odd-carousel` | Composite | Keep | Medium | Confirm demand before more work |
| `odd-checkbox` | Foundational primitive | Keep | High | |
| `odd-checkbox-group` | Composite | Keep | High | For question and feedback reasons |
| `odd-chip` | Foundational primitive | Keep | High | For attachments, later |
| `odd-color-picker` | Composite | Keep | High | |
| `odd-combobox` | Composite | Keep | High | APG editable combobox |
| `odd-command-palette` | Composite | Keep | High | |
| `odd-container` | Foundational primitive (layout) | Keep | Low | Overlaps `.odd-center`; §10 |
| `odd-copy-button` | Specialized primitive | Keep | High | Three AI elements should use it |
| `odd-date-picker` | Composite | Keep | High | |
| `odd-dialog` | Foundational primitive | Keep | High | |
| `odd-disclosure` | Foundational primitive | Refine | Medium | §5.2 |
| `odd-drawer` | Specialized primitive | Keep | Medium | Shares the dialog's structural styles ([drawer.definition.ts:2](../../packages/components/src/drawer/drawer.definition.ts#L2)) |
| `odd-empty-state` | Composite | Keep | High | For the conversation's `empty` slot |
| `odd-file-input` | Specialized primitive | Keep | High | |
| `odd-icon` | Foundational primitive | Keep | High | |
| `odd-input` | Foundational primitive | Keep | High | |
| `odd-listbox` | Foundational primitive | Keep | High | |
| `odd-menu` | Foundational primitive | Keep | High | |
| `odd-one-time-code` | Specialized primitive | Keep | High | |
| `odd-pagination` | Composite | Keep | High | |
| `odd-picker` | Composite | Keep | High | APG select-only combobox over a list or tree |
| `odd-popover` | Foundational primitive | Keep | High | |
| `odd-progress` | Foundational primitive | Keep | High | |
| `odd-radio-group` | Foundational primitive | Keep | High | |
| `odd-rating` | Specialized primitive | Keep | Medium | Extends the shared radio control |
| `odd-relative-time` | Specialized primitive | Keep | High | |
| `odd-scroll-region` | Foundational primitive (layout) | Keep | High | |
| `odd-segmented-control` | Specialized primitive | Keep | Medium | Extends the shared radio control; for the artifact's view |
| `odd-select` | Foundational primitive | Keep | High | For model, revision, and language choices |
| `odd-side-nav` | Composite | Keep | High | |
| `odd-skeleton` | Foundational primitive | Keep | High | |
| `odd-slider` | Foundational primitive | Keep | High | |
| `odd-spinner` | Foundational primitive | Keep | High | |
| `odd-split-button` | Composite | Keep | High | |
| `odd-split-panel` | Composite (layout) | Keep | High | |
| `odd-stat` | Composite | Keep | Medium | Dashboard-leaning; keep while it has a Figma family |
| `odd-status-marker` | Specialized primitive | Keep | High | For plan steps and tasks |
| `odd-switch` | Foundational primitive | Keep | High | |
| `odd-tab-panel` | Foundational primitive, a part of `odd-tabs` | Keep | High | |
| `odd-table` | Composite | Keep | High | |
| `odd-tabs` | Foundational primitive | Keep | High | |
| `odd-textarea` | Foundational primitive | Keep | High | For reasons, comments, and answers |
| `odd-toast` | Specialized primitive | Keep | High | |
| `odd-toolbar` | Foundational primitive | Keep | High | For inline-assist and artifact actions |
| `odd-tooltip` | Foundational primitive | Keep | High | Describes a control and is never its name |
| `odd-tree` | Foundational primitive | Keep | High | |
| `odd-validation-summary` | Composite | Keep | High | |

The overlaps are deliberate:

| Overlapping elements | Why they stay separate |
| --- | --- |
| `odd-select`, `odd-picker`, `odd-combobox`, `odd-listbox` | Four APG patterns: native select, select-only combobox, editable combobox, persistent listbox |
| `odd-radio-group`, `odd-segmented-control`, `odd-rating` | One behaviour (they extend `OddkinRadioControl` from [form-control/radio-control.ts](../../packages/components/src/form-control/radio-control.ts)), three visual contracts |
| `odd-dialog`, `odd-drawer` | The same modal structure, two placements |
| `odd-popover`, `odd-tooltip` | A tooltip describes its anchor and never takes focus |
| `odd-badge`, `odd-chip`, `odd-status-marker` | A passive label, a removable item, and a status glyph |
| `odd-spinner`, `odd-progress`, `odd-skeleton` | Indeterminate, determinate, and placeholder |

None is redundant enough to consolidate before 1.0.

### 5.1 `odd-button`: export the native-button sheet for shadow roots

- **Current:**
  - `<button class="odd-button">` looks like `odd-button`, through `nativeButtonStyles` ([button.native.styles.ts](../../packages/components/src/button/button.native.styles.ts)). It supports `data-appearance`, `data-size`, `data-full-width`, and `aria-pressed`.
  - `styling.browser.test.ts` keeps the two equal.
  - The sheet is published only as the document stylesheet `@oddkin/components/css/button.css`.
  - [button/index.ts](../../packages/components/src/button/index.ts) exports the element, its events, its template, its structural and skin sheets, and its definition, but not this sheet. Another element cannot adopt it in its shadow root.
- **Proposal:**
  - Export it with the shared sheets of `@oddkin/components/styles` ([styles/index.ts](../../packages/components/src/styles/index.ts)).
  - Then the AI elements, and any library built on Oddkin, can render light native buttons that look exactly like `odd-button`, without an element per action. That matters in a conversation with hundreds of messages.
- **Consumer impact:** none. It adds an export, and it removes the reason `.text-button` exists.
- **Migration:** none.
- **Priority:** P1, §9 step 1.

### 5.2 `odd-disclosure`: add a `summary` slot

- **Current:** the summary is the `label` text ([disclosure.ts:22–41](../../packages/components/src/disclosure/disclosure.ts#L22-L41)).
- **Proposal:** a named `summary` slot that replaces the label when filled. It would be additive and non-breaking, and would let disclosures with a rich summary compose it: `odd-tool-call` (name, purpose, status), and possibly `odd-context-picker`.
- **Owner, 2026-11-06: yes.** A rich summary inside a native `<summary>` must stay one accessible name, without interactive content, so Agent 2 designs it with its accessibility tests first.
- **Priority:** P2.

## 6. Cross-component synthesis

| # | Recurring problem | Evidence | Response |
| --- | --- | --- | --- |
| S1 | Custom implementations where foundational ones exist | §3: buttons, toggles, disclosures, copy, selects, text areas, toolbar, status | §9 steps 1–4 |
| S2 | Duplicated behaviour inside a package | The decision guard in 3 elements; `FocusRecovery` set up in 5 | One internal controller (step 2) |
| S3 | A missing composition point: document stylesheets and recipes cannot be adopted inside another element's shadow root | `nativeButtonStyles` (§5.1); the `.odd-stepper` and `.odd-description-list` recipes that task-plan, ai-label, and usage-meter would use | Export shadow-root forms of what other packages need (step 1) |
| S4 | A primitive slightly too narrow to compose | `odd-disclosure`'s text-only summary (§5.2) | A `summary` slot (owner, 2026-11-06) |
| S5 | Inconsistent extension APIs | `renderers`, `artifactRenderers`, and `renderTool` on conversation and message ([conversation.ts:84–90](../../packages/ai/src/conversation/conversation.ts#L84-L90)); `renderOutput` on tool-call ([tool-call.ts:48](../../packages/ai/src/tool-call/tool-call.ts#L48)); `renderers` by kind on artifact ([artifact.ts:69](../../packages/ai/src/artifact/artifact.ts#L69)) | One convention (§6.1) |
| S6 | Insufficient composability: almost no slots in AI elements | 2 of 24 have slots | Slots for static additions (§6.1) |
| S7 | Unnecessary public exposure | `odd-message-branch` is rendered only by `odd-message` | Internalize (step 7) |
| S8 | An arrangement packaged as an element | `odd-suggestions` | Pattern (steps 6, 7) |

Not found:

- **Application-specific elements.**
- **Components doing too much.** The largest AI elements (prompt-input, 675 lines; conversation, 618) are large because of real behaviour that is already split into DOM-free controllers.
- **Rigid layout in the API.** The arrangements are layout recipes ([layout-recipes.md](../architecture/layout-recipes.md) §14) and stay out of the API.

### 6.1 One convention for renderer hooks and slots (proposal)

Record-driven content that a host customizes should use one scheme:

- **One property:** `renderers`, a map from an extension point to a function that renders into a container and returns a cleanup.
- **Named extension points:** `data` (by part name), `artifact` (by kind), and `toolOutput`.
- **Old names:** `renderTool`, `artifactRenderers`, and `renderOutput` stay for one beta as deprecated aliases, marked `@deprecated` with the replacement's id ([metadata-and-analyzer.md §3.1](../architecture/metadata-and-analyzer.md)).

Static additions should be slots, not render functions. Candidates:

- an `actions` slot on `odd-message`;
- a `header` slot on `odd-tool-call` and `odd-artifact`.

**Confidence:** medium. Agent 2 owns the AI contract and should design this.

## 7. Composition patterns as deliverables

A pattern is a recommended arrangement of existing elements, documented and tested, with no custom element of its own.

### Where patterns live

Oddkin already has the pieces:

- **CSS recipes** in [css/index.ts](../../packages/components/src/css/index.ts), the precedent to follow:
  - the layout classes: `.odd-stack`, `.odd-row`, `.odd-cluster`, `.odd-grid`, `.odd-auto-grid`, `.odd-split`, `.odd-box`, `.odd-center`;
  - the pattern recipes: `ol.odd-stepper`, `ol.odd-timeline`, `dl.odd-description-list`, `.odd-avatar-group`, `.odd-field`, `.odd-list`.
- **Composition documents:** [composition/](../../packages/components/src/composition/) (`validateComposition`, `renderComposition`, a generated catalog), with schemas in `packages/components/schemas/composition/` and the contract in [data-composition.md](../architecture/data-composition.md) §8. Workbench renders them through a renderer's `renderComposition`.
- **The docs site,** under `apps/docs`.
- **Product patterns and flows:** proposed and parked ([product-patterns-and-flows.md](../architecture/product-patterns-and-flows.md), owner decision O-8). It covers multi-step product flows, a larger idea than the patterns here.

### Page format

One page per pattern, in a "Patterns" section of the docs site. The docs site is paused except fixes (owner, 2026-11-01), so the patterns ship first as composition documents with example tests, listed in the agent kits (Agent 2), and the pages follow when the pause ends (Agent 3). Each page has:

1. **The problem.** One paragraph.
2. **The elements and recipes,** linked to their pages.
3. **A working example:**
   - plain HTML with Oddkin's elements and a few lines of script, so it works with any framework;
   - also a composition document, so Workbench can show it and agents can read it.
4. **Interaction and accessibility:** roles, names, keyboard, focus, and announcements.
5. **Responsive behaviour,** through the layout classes and container queries.
6. **States:** empty, loading, error, and disabled, as they apply.
7. **When to use it,** and when to choose another pattern or an element.
8. **Evidence:**
   - an example test in three engines;
   - where Figma has a specimen, a parity check of the composed result.

The agent kits list the patterns next to the elements.

### The first patterns

| Pattern | Replaces or complements | Elements |
| --- | --- | --- |
| Suggested prompts | Replaces `odd-suggestions` | `odd-button`s in a labelled `.odd-cluster` group; host wiring to `odd-prompt-input` |
| Branch navigation | Complements the internalized `odd-message-branch` | Two `odd-button`s and the position text over the `branch` record |
| Reasoning disclosure | How a message shows reasoning | `odd-disclosure` |
| Copy action | How any AI output offers copying | `odd-copy-button` with `value` or `from` |
| Empty conversation | The conversation's `empty` slot | `odd-empty-state` with suggested prompts |
| Chat layout | A conversation, its composer, and a side panel for sources or artifacts | `odd-conversation`, `odd-prompt-input`, `odd-split-panel` or `.odd-split` |
| Citations with sources | Inline markers and the list they reveal | `odd-response`, `odd-citation`, `odd-sources` |
| Approval outside a tool call | A standalone decision on any action | `odd-action-approval` |

## 8. The cost of each change

| Change | Consumer complexity | Accessibility | Maintenance and testing | Contract stability and migration | Size |
| --- | --- | --- | --- | --- | --- |
| Export `nativeButtonStyles` (step 1) | None | None | Pin the export in the export-list tests | Additive | None for existing bundles |
| AI adopts native button styles; shared guard and focus recovery (step 2) | None | Gains the foundation's focus ring, forced colours, and sizes | One button look to maintain; AI Figma parity re-run | None | Saves the private sheet; measure |
| Copy and disclosure from the foundation (step 3) | None | Gains the foundation's contracts | Fewer bespoke tests | Some parts change; parts are public, so list each change | Adds `odd-copy-button` and `odd-disclosure` to `ai-chat`; measure and post `BUDGET` |
| Element refinements (step 4) | None | Gains labels, errors, and keyboard contracts | Parity tests re-run per element | Some parts change | Measure per element |
| `odd-disclosure` `summary` slot (§5.2) | None | Needs design: one name, no interactive content | Disclosure tests extended | Additive | Small |
| Renderer convention (step 5) | Lower: one scheme | None | One mechanism | Deprecated aliases for one beta | None |
| Internalize `odd-message-branch`; convert `odd-suggestions` (step 7) | Slightly higher for hosts that used them directly | Kept in the patterns | Fewer public elements to test and document | Breaking: deprecate in one beta, remove in the next | Saves two registrations |

Accessibility never moves backwards: each step keeps an element's existing behaviour, and its tests, or gains the foundation's.

## 9. Implementation plan

**Every step:**

- lands on its own;
- passes the AI and component browser tests in Chromium, Firefox, and WebKit;
- keeps the Figma parity tests (`packages/ai/test/figma-parity.browser.test.ts`) green;
- regenerates the metadata and agent kits;
- measures size, and posts `BUDGET` where a budget must rise.

**Lanes (owner, 2026-11-06):** Agent 2 implements every step, the components ones (step 1 and §5.2) included, as its items 11 to 13; Agent 1 reads the components changes and the budget raises. Agent 3's fidelity work (row X3) touches the same AI styles, so Agents 2 and 3 agree their order in the lanes.

1. **Shadow-root exports (P1).**
   - Export `nativeButtonStyles` from `@oddkin/components` (§5.1) and pin it in the export-list tests.
   - Where a refinement needs them, also export shadow-root forms of the stepper and description-list recipes (S3), as additive exports.
   - Non-breaking. Depends on nothing.
2. **AI shared internals (P1).**
   - Replace `.text-button` with the native button styles in the 16 folders.
   - Move the decision guard and the focus recovery into one internal controller in `packages/ai/src/internal/`.
   - Non-breaking. Depends on step 1.
   - Coordinate with the fidelity pass's open row X3 (text weight and letter spacing), which touches the same styles.
3. **Copy and disclosure (P1).**
   - `odd-copy-button` in `odd-response`, `odd-message`, and `odd-artifact`.
   - `odd-disclosure` for the message's reasoning and for `odd-ai-label`.
   - No properties or events change; some parts do. Depends on step 2.
4. **Element refinements (P2),** one landing each:
   - `odd-task-plan`;
   - `odd-tool-call` (after §5.2) and `odd-context-picker`;
   - `odd-inline-assist`, `odd-artifact`, `odd-question`, and `odd-response-feedback`;
   - `odd-model-select` and `odd-ai-label`, which stay elements (owner).

   Agent 2 reads every change.
5. **Renderer convention (§6.1).** New names, with the old ones as deprecated aliases. Agent 2 designs it. Independent of steps 1–4.
6. **Patterns.**
   - The eight patterns of §7 as composition documents, each with an example test, and a parity check where Figma has a specimen (Agent 2).
   - The agent kits list them.
   - Patterns over unchanged elements can start at once. The others follow the steps that change their elements.
   - The docs site's Patterns section, in the page format of §7, waits for the docs pause to end (Agent 3).
7. **Public API reductions (P3),** after the owner's decisions and once the patterns exist.
   - Deprecate `odd-message-branch` and `odd-suggestions` in the next beta. They are marked `@deprecated` with the replacement and a migration note, and `examples/ai-research` moves to the pattern.
   - Remove their public registrations one beta later.

## 10. The owner's decisions, and open questions

| Question | Recommendation | Confidence | Owner, 2026-11-06 |
| --- | --- | --- | --- |
| `odd-suggestions`: element or pattern? | Pattern | Medium | Pattern |
| `odd-message-branch`: public or internal? | Internal | Medium | Internal |
| `odd-ai-label`: an element composing `odd-disclosure`, or the "Provenance label" pattern? | Element | Medium | Element |
| `odd-model-select`: an element composing `odd-select`, or the "Model choice" pattern? | Element | Medium | Element |
| `odd-disclosure`: add a `summary` slot? | Yes, if the accessibility design holds | Medium | Yes |
| Raise `ai-chat` for foundation reuse? | Yes, per change, with measurements | Medium | Yes, per change, each raise measured |
| Who implements the components steps while Agent 1 is on light duty? | The owner assigns | — | Agent 2 |

Still open, with no change before they are decided:

| Question | Recommendation | Confidence |
| --- | --- | --- |
| `odd-citation`: move the preview into an `odd-popover`, so the paragraph does not reflow when it opens? | No. The inline panel is a deliberate accessibility choice, and a popover would bring the positioning controller (its own 3,840-byte budget) into `ai-chat`. Revisit only with user research. | Medium |
| `odd-container`: keep, or document `.odd-center` instead? | Count its uses first | Low |
| `odd-transcript`: public, or internal to `odd-voice-input`? | Public for now | Medium |

## 11. What this pass changed

This pass changed no package code; this document is its record, with the owner's decisions of 2026-11-06 (§10). The one isolated, non-breaking correction it found, exporting `nativeButtonStyles`, is §9 step 1. It is left to the components lane because the export lists are pinned by browser tests, which this pass did not run (Agent 1 is on light duty).

## Appendix A. Public API of each element

From the published Custom Elements Manifest, built from `8eee44c`:

- **Properties:** public instance properties.
- **Methods:** public methods.
- **Events:** the events an element dispatches.
- **Slots:** the slots, where `(default)` is the unnamed slot.

### `@oddkin/ai`

| Element | Properties | Methods | Events | Slots | Parts | States |
| --- | --- | --- | --- | --- | --- | --- |
| `odd-action-approval` | `approval`, `capabilities`, `announce`, `strings` | — | `odd-approval-decide`, `odd-approval-edit`, `odd-announce` | — | `actions`, `base`, `changes` | — |
| `odd-activity` | `attempt`, `tools`, `capabilities`, `strings` | — | `odd-prompt-stop`, `odd-attempt-resume`, `odd-attempt-retry` | — | `actions`, `base` | — |
| `odd-ai-label` | `provenance`, `strings` | — | — | — | `base`, `details`, `label` | — |
| `odd-artifact` | `artifact`, `revisionId`, `view`, `renderers`, `exports`, `markdown`, `strings`, `revision` | — | `odd-artifact-export`, `odd-artifact-revision-change`, `odd-announce` | — | `header`, `preview`, `source`, `toolbar` | — |
| `odd-change-review` | `proposals`, `view`, `granularity`, `announce`, `strings` | — | `odd-change-accept`, `odd-change-reject`, `odd-change-undo`, `odd-announce` | — | `actions`, `diff`, `label`, `list`, `proposal`, `status` | — |
| `odd-checkpoint` | `checkpoint`, `capabilities`, `announce`, `strings` | — | `odd-checkpoint-restore`, `odd-announce` | — | `actions`, `base`, `restores` | — |
| `odd-citation` | `sourceId`, `index`, `source`, `strings` | — | `odd-citation-open`, `odd-source-reveal` | — | `preview`, `trigger` | — |
| `odd-context-picker` | `items`, `accept`, `allowUrls`, `disabled`, `strings` | — | `odd-context-add`, `odd-context-remove` | — | `add`, `base`, `item`, `list` | — |
| `odd-conversation` | `store`, `state`, `label`, `announce`, `markdown`, `renderers`, `artifactRenderers`, `renderTool`, `feedbackReasons`, `strings`, `snapshot` | `jumpToLatest`, `getScrollPosition`, `restoreScrollPosition` | `odd-history-request` | `composer`, `empty`, `status` | `activity`, `base`, `feed`, `jump`, `scroller` | — |
| `odd-inline-assist` | `selection`, `documentRevision`, `actions`, `languages`, `status`, `pendingAction`, `result`, `error`, `markdown`, `strings` | — | `odd-assist-request` | — | `base`, `result`, `toolbar` | — |
| `odd-message` | `message`, `attempt`, `tools`, `approvals`, `artifacts`, `branch`, `feedback`, `capabilities`, `markdown`, `renderers`, `artifactRenderers`, `renderTool`, `feedbackReasons`, `strings`, `text` | — | `odd-message-edit`, `odd-message-regenerate`, `odd-announce` | — | `content`, `footer`, `header` | — |
| `odd-message-branch` | `messageId`, `branch`, `capabilities`, `strings` | — | `odd-branch-switch` | — | `base` | — |
| `odd-model-select` | `models`, `value`, `label`, `disabled`, `strings`, `selected` | — | `odd-model-change` | — | `details`, `label`, `select` | — |
| `odd-prompt-input` | `controller`, `label`, `placeholder`, `disabled`, `loading`, `attemptId`, `capabilities`, `accept`, `maxFileSize`, `maxFiles`, `enterBehavior`, `strings`, `activeController`, `value` | `acknowledge`, `fail`, `submit` | `odd-prompt-submit`, `odd-prompt-stop`, `odd-attachment-add`, `odd-attachment-remove`, `odd-announce` | `header`, `toolbar-end`, `toolbar-start` | `attachments`, `form`, `input`, `status`, `toolbar` | — |
| `odd-question` | `question`, `announce`, `strings` | — | `odd-question-answer`, `odd-question-skip`, `odd-announce` | — | `actions`, `form` | — |
| `odd-response` | `text`, `status`, `error`, `sources`, `markdown`, `copyable`, `strings`, `renderedSource` | `copy` | `odd-announce` | — | `actions`, `content`, `status` | — |
| `odd-response-feedback` | `messageId`, `feedback`, `reasons`, `disabled`, `announce`, `strings` | — | `odd-feedback-submit`, `odd-announce` | — | `base`, `form` | — |
| `odd-sources` | `sources`, `label`, `strings` | `reveal` | — | — | `base`, `item`, `list` | — |
| `odd-suggestions` | `suggestions`, `disabled`, `insertOnly`, `strings` | — | `odd-suggestion-select`, `odd-suggestion-submit` | — | `list`, `send`, `suggestion` | — |
| `odd-task-plan` | `plan`, `strings` | — | `odd-plan-input-request` | — | `base`, `progress`, `steps` | — |
| `odd-tool-call` | `tool`, `approval`, `capabilities`, `renderOutput`, `strings` | — | `odd-tool-retry` | — | `arguments`, `base`, `result`, `summary` | — |
| `odd-transcript` | `segments`, `interim`, `editable`, `strings` | — | `odd-transcript-change` | — | `interim`, `list` | — |
| `odd-usage-meter` | `usage`, `label`, `strings` | — | — | — | `list`, `meter` | — |
| `odd-voice-input` | `adapter`, `controller`, `disabled`, `strings`, `activeController` | — | `odd-voice-transcript`, `odd-announce` | — | `base`, `controls`, `status` | — |

### `@oddkin/components`

| Element | Properties | Methods | Events | Slots | Parts | States |
| --- | --- | --- | --- | --- | --- | --- |
| `odd-alert` | `tone`, `label`, `announce` | — | — | (default), `end` | `base`, `label`, `marker` | — |
| `odd-avatar` | `label`, `src`, `size` | — | — | (default) | `base`, `image` | — |
| `odd-badge` | `tone`, `noMarker` | — | — | (default) | `base`, `marker` | — |
| `odd-breadcrumbs` | `label`, `items`, `maxItems`, `strings` | — | — | `home` | `base`, `current`, `item`, `link`, `list`, `more`, `separator` | — |
| `odd-button` | `appearance`, `size`, `type`, `disabled`, `loading`, `fullWidth`, `toggle`, `pressed`, `name`, `value`, `formAction`, `formMethod`, `formEnctype`, `formTarget`, `formNoValidate`, `label`, `form` | `formDisabledCallback` | `input`, `change` | (default), `end`, `start` | `control`, `spinner` | — |
| `odd-calendar` | `name`, `disabled`, `description`, `error`, `label`, `defaultValue`, `min`, `max`, `required`, `readonly`, `firstDay`, `isDateDisabled`, `strings`, `form`, `validity`, `validationMessage`, `willValidate`, `value` | `checkValidity`, `reportValidity`, `setCustomValidity`, `formResetCallback`, `formStateRestoreCallback`, `formDisabledCallback`, `formAssociatedCallback`, `focus` | `input`, `change` | — | `actions`, `calendar`, `clear`, `day`, `day-disabled`, `day-outside`, `day-selected`, `day-today`, `description`, `error`, `field`, `grid`, `header`, `heading`, `label`, `next`, `previous`, `today`, `weekday` | `user-invalid` |
| `odd-card` | `appearance`, `padding`, `label` | — | — | (default), `footer`, `header` | `base`, `body`, `footer`, `header` | — |
| `odd-carousel` | `label`, `current`, `strings` | — | `input`, `change` | (default) | `base`, `controls`, `next`, `pick`, `picker`, `position`, `previous`, `slide`, `slides` | — |
| `odd-checkbox` | `name`, `disabled`, `description`, `error`, `defaultChecked`, `value`, `required`, `indeterminate`, `form`, `validity`, `validationMessage`, `willValidate`, `checked` | `checkValidity`, `reportValidity`, `setCustomValidity`, `formResetCallback`, `formStateRestoreCallback`, `formDisabledCallback`, `formAssociatedCallback` | `input`, `change` | (default) | `control`, `description`, `error`, `field`, `label` | `user-invalid` |
| `odd-checkbox-group` | `name`, `disabled`, `description`, `error`, `label`, `required`, `orientation`, `form`, `validity`, `validationMessage`, `willValidate` | `checkValidity`, `reportValidity`, `setCustomValidity`, `formResetCallback`, `formStateRestoreCallback`, `formDisabledCallback`, `formAssociatedCallback` | — | (default) | `control`, `description`, `error`, `field`, `label` | `user-invalid` |
| `odd-chip` | `removable`, `selected`, `disabled`, `strings` | — | `odd-chip-remove` | (default) | `base`, `remove` | — |
| `odd-color-picker` | `name`, `disabled`, `description`, `error`, `label`, `defaultValue`, `alpha`, `options`, `strings`, `form`, `validity`, `validationMessage`, `willValidate`, `value` | `checkValidity`, `reportValidity`, `setCustomValidity`, `formResetCallback`, `formStateRestoreCallback`, `formDisabledCallback`, `formAssociatedCallback` | `input`, `change` | — | `apply`, `area`, `area-thumb`, `button`, `cancel`, `control`, `description`, `error`, `field`, `hex`, `hue`, `hue-thumb`, `label`, `opacity`, `option-swatch`, `popup`, `rgb`, `swatch`, `swatches` | `open`, `user-invalid` |
| `odd-combobox` | `name`, `disabled`, `description`, `error`, `label`, `options`, `value`, `values`, `multiple`, `required`, `loading`, `view`, `selectAll`, `review`, `readonly`, `placeholder`, `noFilter`, `strings`, `form`, `validity`, `validationMessage`, `willValidate`, `query` | `checkValidity`, `reportValidity`, `setCustomValidity`, `formResetCallback`, `formStateRestoreCallback`, `formDisabledCallback`, `formAssociatedCallback` | `input`, `change`, `odd-query-change` | `empty`, `status` | `chip`, `chip-remove`, `clear`, `control`, `description`, `empty`, `error`, `field`, `group`, `input`, `label`, `listbox`, `loading`, `more`, `option`, `popup` | `user-invalid` |
| `odd-command-palette` | `label`, `placeholder`, `items`, `open`, `loading`, `noFilter`, `strings`, `query` | `show`, `close` | `odd-action`, `odd-query-change` | `empty`, `status` | `dialog`, `empty`, `footer`, `group`, `input`, `item`, `listbox`, `loading`, `search` | — |
| `odd-container` | `measure` | — | — | (default) | `base` | — |
| `odd-copy-button` | `value`, `from`, `label`, `disabled`, `strings` | `copy` | `odd-copy` | — | `base`, `button`, `fallback`, `status` | — |
| `odd-date-picker` | `name`, `disabled`, `description`, `error`, `label`, `defaultValue`, `min`, `max`, `required`, `readonly`, `placeholder`, `firstDay`, `isDateDisabled`, `strings`, `form`, `validity`, `validationMessage`, `willValidate`, `value` | `checkValidity`, `reportValidity`, `setCustomValidity`, `formResetCallback`, `formStateRestoreCallback`, `formDisabledCallback`, `formAssociatedCallback` | `input`, `change` | — | `button`, `control`, `description`, `error`, `field`, `label`, `popup` | `open`, `user-invalid` |
| `odd-dialog` | `label`, `alert`, `closedBy`, `noClose`, `open`, `strings`, `returnValue` | `show`, `close` | — | (default), `footer`, `header` | `body`, `close`, `dialog`, `footer`, `header`, `title` | — |
| `odd-disclosure` | `label`, `open`, `name`, `disabled` | — | `toggle` | (default) | `base`, `content`, `label`, `marker`, `summary` | `joined-end`, `joined-start` |
| `odd-drawer` | `label`, `alert`, `closedBy`, `noClose`, `open`, `strings`, `side`, `noModal`, `returnValue` | `show`, `close` | — | (default), `footer`, `header` | `body`, `close`, `dialog`, `footer`, `header`, `title` | — |
| `odd-empty-state` | `label` | — | — | (default), `footer`, `media` | `base`, `footer`, `label`, `media` | — |
| `odd-file-input` | `name`, `disabled`, `description`, `error`, `label`, `accept`, `multiple`, `required`, `strings`, `form`, `validity`, `validationMessage`, `willValidate`, `files` | `checkValidity`, `reportValidity`, `setCustomValidity`, `formResetCallback`, `formStateRestoreCallback`, `formDisabledCallback`, `formAssociatedCallback` | `input`, `change` | — | `control`, `description`, `error`, `field`, `file`, `files`, `label`, `remove`, `surface`, `title` | `drop-target`, `user-invalid` |
| `odd-icon` | `src`, `label`, `size` | — | — | (default) | `base` | — |
| `odd-input` | `name`, `disabled`, `description`, `error`, `label`, `defaultValue`, `minLength`, `maxLength`, `placeholder`, `autocomplete`, `required`, `readonly`, `type`, `min`, `max`, `step`, `pattern`, `strings`, `form`, `validity`, `validationMessage`, `willValidate`, `value`, `valueAsNumber` | `checkValidity`, `reportValidity`, `setCustomValidity`, `formResetCallback`, `formStateRestoreCallback`, `formDisabledCallback`, `formAssociatedCallback`, `stepUp`, `stepDown` | `input`, `change` | — | `clear`, `control`, `decrement`, `description`, `error`, `field`, `icon`, `increment`, `label`, `stepper` | `user-invalid` |
| `odd-listbox` | `name`, `disabled`, `description`, `error`, `label`, `options`, `value`, `values`, `multiple`, `required`, `loading`, `strings`, `form`, `validity`, `validationMessage`, `willValidate` | `checkValidity`, `reportValidity`, `setCustomValidity`, `formResetCallback`, `formStateRestoreCallback`, `formDisabledCallback`, `formAssociatedCallback` | `input`, `change` | `empty`, `status` | `base`, `description`, `empty`, `error`, `field`, `group`, `label`, `listbox`, `loading`, `option` | `user-invalid` |
| `odd-menu` | `label`, `items`, `appearance`, `size`, `disabled`, `context` | `show`, `close` | `odd-action` | (default) | `group`, `item`, `menu`, `separator`, `submenu`, `trigger` | — |
| `odd-one-time-code` | `name`, `disabled`, `description`, `error`, `label`, `defaultValue`, `minLength`, `maxLength`, `placeholder`, `autocomplete`, `required`, `readonly`, `status`, `strings`, `form`, `validity`, `validationMessage`, `willValidate`, `value` | `checkValidity`, `reportValidity`, `setCustomValidity`, `formResetCallback`, `formStateRestoreCallback`, `formDisabledCallback`, `formAssociatedCallback` | `input`, `change` | — | `cell`, `control`, `description`, `error`, `field`, `label`, `status` | `user-invalid` |
| `odd-pagination` | `label`, `current`, `pageCount`, `href`, `strings` | — | `odd-action` | — | `base`, `ellipsis`, `list`, `next`, `page`, `previous`, `status` | — |
| `odd-picker` | `name`, `disabled`, `description`, `error`, `label`, `options`, `value`, `values`, `multiple`, `required`, `loading`, `view`, `selectAll`, `review`, `placeholder`, `items`, `expanded`, `strings`, `form`, `validity`, `validationMessage`, `willValidate` | `checkValidity`, `reportValidity`, `setCustomValidity`, `formResetCallback`, `formStateRestoreCallback`, `formDisabledCallback`, `formAssociatedCallback` | `input`, `change`, `odd-toggle` | `empty`, `status` | `chip`, `chip-remove`, `clear`, `clear-all`, `close`, `control`, `description`, `empty`, `error`, `field`, `footer`, `group`, `item`, `label`, `listbox`, `loading`, `more`, `option`, `popup`, `summary`, `tree`, `trigger`, `value` | `user-invalid` |
| `odd-popover` | `label`, `anchor`, `side`, `align`, `noClose`, `open`, `interest`, `strings`, `anchorElement` | `show`, `close` | — | (default) | `base`, `close` | — |
| `odd-progress` | `value`, `max`, `label`, `description`, `renderValue`, `strings` | — | — | — | `base`, `description`, `indicator`, `label`, `track`, `value-text` | — |
| `odd-radio-group` | `name`, `disabled`, `description`, `error`, `label`, `options`, `value`, `required`, `orientation`, `form`, `validity`, `validationMessage`, `willValidate` | `checkValidity`, `reportValidity`, `setCustomValidity`, `formResetCallback`, `formStateRestoreCallback`, `formDisabledCallback`, `formAssociatedCallback` | `input`, `change` | — | `control`, `description`, `error`, `field`, `group`, `label`, `option`, `option-description` | `user-invalid` |
| `odd-rating` | `name`, `disabled`, `description`, `error`, `label`, `options`, `value`, `required`, `max`, `readonly`, `strings`, `form`, `validity`, `validationMessage`, `willValidate` | `checkValidity`, `reportValidity`, `setCustomValidity`, `formResetCallback`, `formStateRestoreCallback`, `formDisabledCallback`, `formAssociatedCallback` | `input`, `change` | — | `control`, `description`, `error`, `field`, `label`, `option`, `value` | `user-invalid` |
| `odd-relative-time` | `datetime`, `detail`, `strings` | — | — | — | `base`, `detail`, `time` | — |
| `odd-scroll-region` | `label`, `strings` | — | — | (default) | `base` | — |
| `odd-segmented-control` | `name`, `disabled`, `description`, `error`, `label`, `options`, `value`, `required`, `size`, `form`, `validity`, `validationMessage`, `willValidate` | `checkValidity`, `reportValidity`, `setCustomValidity`, `formResetCallback`, `formStateRestoreCallback`, `formDisabledCallback`, `formAssociatedCallback` | `input`, `change` | — | `control`, `description`, `error`, `field`, `label`, `option` | `user-invalid` |
| `odd-select` | `name`, `disabled`, `description`, `error`, `label`, `options`, `value`, `placeholder`, `required`, `form`, `validity`, `validationMessage`, `willValidate` | `checkValidity`, `reportValidity`, `setCustomValidity`, `formResetCallback`, `formStateRestoreCallback`, `formDisabledCallback`, `formAssociatedCallback` | `input`, `change` | — | `control`, `description`, `error`, `field`, `label` | `user-invalid` |
| `odd-side-nav` | `label`, `items`, `current`, `expanded`, `renderLabel`, `kinds` | — | `odd-action`, `odd-toggle` | (default), `footer`, `header` | `action`, `badge`, `base`, `footer`, `group`, `group-toggle`, `header`, `link`, `list` | — |
| `odd-skeleton` | `shape`, `lines` | — | — | — | `base`, `line` | — |
| `odd-slider` | `name`, `disabled`, `description`, `error`, `label`, `defaultValue`, `min`, `max`, `step`, `renderValue`, `form`, `validity`, `validationMessage`, `willValidate`, `value`, `valueAsNumber` | `checkValidity`, `reportValidity`, `setCustomValidity`, `formResetCallback`, `formStateRestoreCallback`, `formDisabledCallback`, `formAssociatedCallback` | `input`, `change` | — | `control`, `description`, `error`, `field`, `fill`, `label`, `max-label`, `min-label`, `output`, `thumb`, `track` | `user-invalid` |
| `odd-spinner` | `label`, `size`, `strings` | — | — | (default) | `base`, `indicator` | — |
| `odd-split-button` | `value`, `items`, `appearance`, `size`, `disabled`, `loading`, `strings` | — | `odd-action` | (default) | `group`, `item`, `menu`, `primary`, `separator`, `spinner`, `submenu`, `trigger` | — |
| `odd-split-panel` | `orientation`, `position`, `min`, `max`, `collapsed`, `label`, `strings` | — | `input`, `change` | `end`, `start` | `base`, `end`, `separator`, `start` | — |
| `odd-stat` | `label`, `value`, `trend`, `loading`, `strings` | — | — | (default) | `base`, `context`, `label`, `placeholder`, `value` | — |
| `odd-status-marker` | `status` | — | — | (default) | `base` | — |
| `odd-switch` | `name`, `disabled`, `description`, `error`, `defaultChecked`, `value`, `required`, `strings`, `form`, `validity`, `validationMessage`, `willValidate`, `checked` | `checkValidity`, `reportValidity`, `setCustomValidity`, `formResetCallback`, `formStateRestoreCallback`, `formDisabledCallback`, `formAssociatedCallback` | `input`, `change` | (default) | `control`, `description`, `error`, `field`, `label`, `state`, `thumb` | `user-invalid` |
| `odd-tab-panel` | `label`, `value`, `disabled` | — | — | (default) | — | — |
| `odd-table` | `label`, `columns`, `rows`, `sort`, `sortDirection`, `noSort`, `selection`, `selected`, `loading`, `error`, `strings` | — | `odd-sort`, `input`, `change` | `empty`, `error` | `base`, `cell`, `header-cell`, `row`, `selection`, `sort-button`, `status`, `table` | — |
| `odd-tabs` | `label`, `value`, `orientation`, `activation` | — | `input`, `change` | (default) | `base`, `list`, `panel`, `tab` | — |
| `odd-textarea` | `name`, `disabled`, `description`, `error`, `label`, `defaultValue`, `minLength`, `maxLength`, `placeholder`, `autocomplete`, `required`, `readonly`, `rows`, `resize`, `strings`, `form`, `validity`, `validationMessage`, `willValidate`, `value` | `checkValidity`, `reportValidity`, `setCustomValidity`, `formResetCallback`, `formStateRestoreCallback`, `formDisabledCallback`, `formAssociatedCallback` | `input`, `change` | — | `control`, `count`, `description`, `error`, `field`, `label` | `user-invalid` |
| `odd-toast` | `tone`, `label`, `duration`, `open`, `strings` | `show`, `close` | — | (default), `end` | `base`, `close`, `label`, `marker` | — |
| `odd-toolbar` | `label`, `orientation` | — | — | (default) | `base` | — |
| `odd-tooltip` | `anchor`, `side`, `align`, `open`, `anchorElement` | `show`, `close` | — | (default) | `base` | — |
| `odd-tree` | `label`, `items`, `expanded`, `value`, `values`, `multiple`, `loading`, `strings` | — | `odd-toggle`, `input`, `change` | `empty`, `status` | `base`, `empty`, `item`, `loading`, `tree` | — |
| `odd-validation-summary` | `label`, `form`, `strings` | — | — | — | `base`, `label`, `link`, `list`, `marker` | — |
