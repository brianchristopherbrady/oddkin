# Badge design and implementation specification

[Editable Badge page](https://www.figma.com/design/E7LfRysny8V3qU24tv082i/Oddkin---Design-Framework?node-id=1395-2) · [Run and evidence](../../runs/2026-11-19-badge-redesign/README.md)

Badge displays short status, category or count text alongside its subject. The marker is optional decoration. A status reads in place and the adjacent link or Button owns any action.

Use the five semantic tones in the existing canonical set. Every tone uses the same geometry and a semantic surface with a matching 1 px inside edge. The edge helps distinguish the fill from the parent surface in either theme. Preserve the existing Label and Show marker properties and the default neutral, marker-on appearance. Count is text in context with marker off. The historical count composition remains available to existing designs.

The redesign anchors the decorative marker alongside the first readable line. A single-label lane wraps within constrained parents, including normalized whitespace and inline emphasis. It grows vertically with no clipped words or horizontal text recovery. Review the same words in the bounded reader, narrow and roomy rows, default and compact density, and light/dark and RTL examples. Preserve IDs and content during host updates. Show pending, success and failure through explicit host text and actual controls while Badge itself remains passive.

The [research](./research.md) compares independently maintained Web Components and CSS. The [decision](./decision.md) defines the primitive boundary. The [contract](./contract.md) and [token map](./token-map.md) define the public surface, owner boundaries, allocation and renderer mappings. The [handoff](./handoff.json) binds the inspected design to the implementation baseline.

## Corner radius

Badge uses `radius.sm` by default. Use an existing Oddkin radius token for an override. The [Figma comparison](https://www.figma.com/design/E7LfRysny8V3qU24tv082i/Oddkin---Design-Framework?node-id=1496-431) shows Small and Full applied to real Badge instances in both themes. The docs Controls panel exposes the same CSS property.

```css
.pill-badge {
  --odd-badge-radius: var(--odd-radius-full);
}
```
