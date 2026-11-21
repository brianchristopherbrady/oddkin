# Checkbox · specification

## Purpose
A checkbox represents an independent choice in a form. Use the existing Checkbox Group for related choices and keep aggregate selection with the group or application.

## Research decision
HTML and the WAI checkbox pattern establish native Space activation, checkedness, mixed state and labeling. Material Web informs form association, Shoelace informs size and default/live state, and Spectrum demonstrates separate checked and mixed inputs with sized marks. Zag informs separate ownership. This design combines these mechanisms with the existing Oddkin native input, FormValue, glyphs and tokens.

[HTML checkbox](https://html.spec.whatwg.org/multipage/input.html#checkbox-state-(type=checkbox)) · [WAI checkbox pattern](https://www.w3.org/WAI/ARIA/apg/patterns/checkbox/) · [Material Web](https://github.com/material-components/material-web/blob/main/docs/components/checkbox.md) · [Shoelace](https://shoelace.style/components/checkbox/) · [Spectrum](https://opensource.adobe.com/spectrum-web-components/components/checkbox/) · [Zag](https://zagjs.com/components/checkbox#controlled-checkbox)

## Anatomy and composition
The indicator and visible label are a single pointer target. One native input owns focus, keyboard activation, and name, role, and value. Description and validation text follow the label in normal flow. Its label stays present in compact and narrow parents.

## State and themes
Unchecked, checked and mixed each have rest, hover, keyboard focus, invalid and disabled visual states. Both theme panels reuse the existing 15-variant family. In a real form, an unchecked required input can become invalid after validation. Other invalid swatches document visual treatment when validation is supplied by the host.

## Sizing and density
`size="sm|md|lg"` defaults to `md`. Box dimensions are 16, 20 and 24 px. The check and minus glyphs are 16, 16 and 20 px. Inherited density changes spacing and retains the minimum 24 px target, indicator size, selection and native input identity.

## Parent allocation
Use CSS intrinsic layout. The parent gives the label remaining inline space and receives the row's natural block growth. Wrap words, helping text and validation without clipping. A long unbroken token may break visually. Keep the original characters intact. Center the indicator within max(target.min, indicator size, first line height). Logical direction reverses the placement in RTL. The parent owns bounded scrolling.

## Tokens
Reuse `icon.size.sm/md/lg`, `target.min`, `space.sm`, `space.2xs`, `radius.sm`, existing border/selection/surface/focus/danger roles, and `type.ui.*`. The Figma library uses Roboto and the browser uses the selected theme font stack. The inset on the first label line is the geometric center offset, derived from target and line height.

## Attributes

| **Attribute** | **Behavior** |
| --- | --- |
| `size` | `sm`, `md`, `lg`. Default `md`. |
| `checked` | Boolean presence seeds the local reset baseline. |
| `indeterminate` | Separate local mixed flag. |
| `name`, `form`, `value` | Keep form association and serialization. Value defaults to `on`. |
| `disabled`, `required` | Keep native disabled and required behavior, including disabled fieldsets. |
| `description`, `error` | Existing helper and validation text. |

## Properties
`.defaultChecked` maps to the checked attribute. `.checked` exposes effective live checkedness. Write it in local mode to set the live choice independently of its baseline. `.checkedState` is property-only and optional.

```ts
type CheckboxSelection =
  | { readonly mode: 'uncontrolled'; readonly checked?: never; readonly indeterminate?: never }
  | { readonly mode: 'controlled'; readonly checked: boolean; readonly indeterminate?: boolean };
```

The controlled snapshot defaults omitted mixed to false. Read controlled mixed from that snapshot. The existing `indeterminate` attribute and property continue to describe local form state. Leaving controlled mode reveals the local value. While controlled, writes to `.checked` have no effect on the committed snapshot.

## Slots and parts
The default slot supplies the label. Existing parts are `field`, `control`, `label`, `description`, and `error`.

## Events
Local pointer or Space activation commits through the native input, then delivers `input` and `change`. Controlled activation emits `odd-checked-request` with `{ checked: boolean, indeterminate: false }`. It bubbles and crosses shadow boundaries. A replacement snapshot is the only controlled commit. Programmatic commits are silent.

## Native interaction
Activate the input or its label. A local gesture inverts checkedness and clears mixed. Reset restores the baseline and leaves mixed independent. A successful enabled checked checkbox submits its value. A disabled checkbox or disabled fieldset prevents activation and submission.

## Controlled interaction
Click or press Space to emit one request and retain the committed state. The host may ignore, accept immediately, or accept later. Repeated gestures can propose the same value again. An app decides how to reconcile pending requests. Prototype scenes show both outcomes.

## State ownership
The native input owns focus and local activation. Oddkin Checkable owns default and locally committed checkedness. FormValue projects effective state into the form. The application owns controlled snapshots, aggregate logic, validation policy, request correlation and any draft or durable persistence. This atomic choice needs no new controller, asynchronous service, or database contract.

## Verification
Inspect light/dark state instances, 320 and 176 px label grants, compact inherited density, and the toggle, mixed and controlled prototype destinations. Browser acceptance also covers Space, focus continuity at reflow and in RTL, descriptions, required validity, disabled fieldsets, dirty/default, reset/restore, mixed submission, and synchronous, deferred or ignored controlled intent. Browser and assistive technology observations are reported separately.

## References
[Editable review board](https://www.figma.com/design/E7LfRysny8V3qU24tv082i/Oddkin---Design-Framework?node-id=1521-27) · [Canonical Checkbox set](https://www.figma.com/design/E7LfRysny8V3qU24tv082i/Oddkin---Design-Framework?node-id=159-1181) · [Source baseline](https://github.com/brianchristopherbrady/oddkin/tree/2a8c84def4928bca269f559483d8300823ffb080/packages/components/src/checkbox)
