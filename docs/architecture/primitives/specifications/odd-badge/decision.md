# Badge design decision

Scope is the November 19 Agent 1 redesign and implementation. The base primitive audit's accepted D1 spacing, the shared tone vocabulary and existing compose/registration architecture remain authoritative. This scoped decision adds no global ADR. [Base primitive audit](../../../../research/primitives-audit.md#2-badge) · [ADR 0036](../../../decisions/0036-component-composition-api.md) · [ADR 0045](../../../decisions/0045-api-vocabulary.md)

Keep Badge as an intrinsic foundational display primitive. Use the five existing meanings and their existing decorative glyphs. Place the glyph in the first line's lane so that longer labels read as one status. Preserve natural single-line size. Group default slot content in one private inline text container and use CSS to fit it within the parent's shrinkable grant. This repairs reading order around inline emphasis and makes wrapping independent of the surrounding row's whitespace rules.

| Considered | Decision |
| --- | --- |
| Center the marker over the entire label block | Use the first line's center for steady association and alignment with adjacent content. |
| Fix width/height, clip or move long text into a tooltip | Use normal wrapping and natural height. The parent may move the Badge or change the row when the physical grant is insufficient. |
| Add count formatting, automatic live announcements or color-only compact mode | Preserve the host's canonical words and contextual announcement choices. |
| Combine status, removable chip and action semantics | Keep Badge passive. Existing Button, Chip and StatusMarker retain their separate responsibilities. |
| Add a headless controller, observer or context subscriber | The constraint is physical allocation. CSS handles it without new state, measurement or dependencies. |

The contract applies to existing Badge consumers. Ordinary one-line uses keep the same token-derived geometry. A headless controller has no operation, draft, queue, concurrency or persistence boundary to own. Application actions and their revisions remain in the existing composition or application. [Research](./research.md) · [Contract](./contract.md)
