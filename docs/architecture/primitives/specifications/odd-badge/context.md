# Badge context

The active source is Agent 1's `a1-main` worktree at `7220497638764abbb03add15eec89106bbe12d6f`. The previous Badge implementation landed in `e84a08e33ee5510cb86dc462ccbf9e3a7fcce7dd`. The worktree already carried Avatar design documents and shared inventory edits. Badge source and tests were clean at discovery.

## Existing surface

- The [Badge folder](../../../../../packages/components/src/badge/) holds class, template, visual/structural styles, definition, registration, exports, the skin-free foundation and development examples.
- The shared [tone styles](../../../../../packages/components/src/styles/tone.styles.ts) supply five color and glyph choices. The [glyph assets](../../../../../packages/components/src/styles/glyphs.ts) supply decorative SVGs. Their dependencies are one-way from Badge into shared modules.
- The [base primitive audit](../../../../research/primitives-audit.md#2-badge) records the compact D1 spacing decision. [ADR 0045](../../../decisions/0045-api-vocabulary.md) establishes the tone vocabulary. [ADR 0049](../../../decisions/0049-agent-workflow-components.md) identifies Badge as the renderer of compact AI status and expiry text.
- Real consumers include [AI status](../../../../../packages/ai/src/internal/status.ts), [expiry](../../../../../packages/ai/src/internal/expiry.ts), [approval risk text](../../../../../packages/ai/src/action-approval/action-approval.template.ts), the [Docs home](../../../../../apps/docs/src/pages/home.ts) and external package consumers. A Side Nav badge part does not imply an `odd-badge` implementation dependency.

## Design baseline

The existing [Badge page](https://www.figma.com/design/E7LfRysny8V3qU24tv082i/Oddkin---Design-Framework?node-id=1395-2) contains canonical set `159:582`, historical Count composition `159:581`, native spec `1395:960`, states `1395:106`, allocation `1395:562`, and host interaction flows `1395:852`. The five masters expose Tone, Show marker and Label. All are live design context to reconcile with source and research.

A Chromium probe of the prior build found three related failures. An 80 px Badge inherited `white-space: nowrap` and measured 173 px. Inline emphasis inside a 140 px Badge produced separate flex items for the adjoining text. A row containing a 36 px action, a 4 px gap and Badge required 85 px inside an 80 px usable grant. These measurements describe those fixtures and baseline only. A separate source and Figma read found the marker centered across the whole multiline block.
