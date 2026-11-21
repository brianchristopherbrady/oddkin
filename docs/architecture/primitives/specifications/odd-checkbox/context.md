# Checkbox source and design context

Agent 1 is the implementation base at `a1-main@2a8c84def4928bca269f559483d8300823ffb080`. The sibling `oddkin` checkout supplies the workflow and validation schemas. Existing Avatar evidence and generated Tree catalog changes are outside this slice.

[Oddkin/Common/checkbox](https://www.figma.com/design/E7LfRysny8V3qU24tv082i/Oddkin---Design-Framework?node-id=159-1181) has 15 editable variants across three selection states and five interaction states. The live November 20 inventory showed dedicated Avatar, Badge, and Button pages. Code Connect maps the original Checkbox variants to `OddkinCheckbox`.

| Responsibility | Source |
| --- | --- |
| Native input, slotted label and described-by text | `packages/components/src/checkbox/checkbox.template.ts` |
| Current/default checkedness, events, and form callbacks | `packages/components/src/form-control/checkable.ts` |
| Form-associated value and validity | `packages/components/src/form-control/form-control.ts`, `packages/core/src/controllers/form.ts` |
| Shared indicator, glyphs and focus | `packages/components/src/styles/control-indicator*.ts`, `glyphs.ts`, `focus-ring.styles.ts` |
| Group context and individual submission | `packages/components/src/checkbox-group` |

Checkbox is a form primitive with intrinsic allocation. Checkbox Group composes it and owns aggregate validity. Switch reuses Checkable. The browser probe found that a wrapped label visually loses its starting marker because the indicator centers across the entire paragraph. The proposed first-line lane, explicit indicator sizes, and opt-in ownership are Checkbox-local. [Research and baseline probes](./research.md)
