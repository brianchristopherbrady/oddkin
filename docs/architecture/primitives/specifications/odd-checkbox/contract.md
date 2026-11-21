# Oddkin Checkbox contract

## Anatomy and interface

One native input owns focus, keyboard activation, and accessibility. The custom element participates in forms. The default slot supplies the visible label and its accessible name. The `field`, `label`, `control`, `description`, and `error` parts retain their identity. Existing glyphs distinguish Check and Mixed.

| Surface | Contract |
| --- | --- |
| `checked` HTML / `.defaultChecked` | Boolean presence gives the reset baseline, false by default. |
| `.checked` | Effective committed checkedness. A local write detaches it from its default. Controlled snapshots own it while controlled. |
| `indeterminate` | Independent local mixed flag. Native activation clears it. |
| `name`, `form`, `value`, `required`, `disabled` | Existing form association, validation and disablement. Value defaults to `on`. Checkedness controls submission independently of mixed. |
| `description`, `error` | Existing described-by text below the choice. |
| `size="sm|md|lg"` | Reflected visual indicator size. Default `md`. Target minimum still applies. |
| `data-odd-density` | Existing theme scope. Density supplies spacing roles, and size remains explicit. |
| `.checkedState` | Optional property-only union for ownership. Omission uses native local state. |
| `input`, `change` | Native composed input followed by the bubbling host change on local activation. Programmatic updates are silent. |
| `odd-checked-request` | Controlled user intent. Bubbles and composes. Detail is `{ checked: boolean, indeterminate: false }`. The act of requesting makes no commitment. |

```ts
type CheckboxSelection =
  | { readonly mode: 'uncontrolled'; readonly checked?: never; readonly indeterminate?: never }
  | { readonly mode: 'controlled'; readonly checked: boolean; readonly indeterminate?: boolean };
```

The controlled snapshot defaults omitted mixed to false. Apps accept by assigning a replacement snapshot. Read controlled mixed state from the snapshot; the existing reflected `indeterminate` remains the local setting. Direct `.checked` writes while controlled are ignored. Leaving controlled mode reveals native local state. A visible label slot is the supported naming path. A standalone icon-only control and a readonly checkbox are outside the interface; disabled and slot labels cover the reviewed cases.

## Interactions and authority

| Input | Local mode | Controlled mode |
| --- | --- | --- |
| Pointer on input or label, Space | Native toggles checkedness, clears mixed, commits before input and change. | Cancel native commit and deliver one proposal after the canceled activation rolls back. Keep the committed facts until the app sets a snapshot. |
| Host changes state | Local property writes update visual state silently. | Assign a replacement `.checkedState` snapshot. Project committed state, including synchronous acknowledgement from a request listener. Programmatic updates are silent. |
| Reset and restore | Reset checkedness to the default and clear dirty/touched state. Existing restore accepts checked/unchecked. Mixed stays independent. | App owns reset and restore of its snapshot. |
| Disabled or disabled fieldset | Native disablement prevents activation and submission. | No request while disabled. |
| Focus, hover, invalid | Existing token and validation states with one native focus target. | Same focus and committed form state. |

The native input owns transient focus, hover, and activation. Existing Checkable owns local checkedness and dirty/default. Existing FormValue projects effective value, restore state, and validity into internals; after script writes or activation, wait for `updateComplete` before inspecting the form projection. Checkbox Group owns aggregate validity and context; each child submits its own value.

The application owns controlled snapshots and any policy, request correlation, drafts or persistence. A task tied to the checkbox connection delivers the proposal after native rollback. If the originating snapshot is replaced, or the checkbox becomes disabled or disconnects before delivery, the proposal is discarded. Repeated eligible activation before acceptance can repeat the proposal. App transports use their own revision and duplicate-handling rules.

## Parent allocation

The parent grants inline space and receives natural block growth. The indicator remains alongside the first label line; the label wraps and preserves canonical text, including unbroken tokens. The direction follows CSS. The checkbox retains its native input and one target across density, size, label wrapping, and sibling allocation changes. The parent owns any bounded scrolling region. No layout-policy receiver, private scroller, or overlay is needed.

| Input | Condition | Response | Owner and invariants |
| --- | --- | --- | --- |
| Parent inline allocation | Label exceeds its share | CSS shrinks and wraps the label while preserving indicator size | Browser CSS, canonical text and focus retained |
| Size and density | Explicit size or inherited scope changes | Update CSS tokens in place | Theme/host, target minimum and input identity retained |
| Error and help | Content becomes visible or wraps | Natural flow below choice | Application provides content; parent supplies room or scrolling |

## Acceptance

- Editable states and matched light/dark short and wrapped fixtures. Inspect bindings, readable labels, and prototype destinations.
- Check all three sizes, inherited density, narrow text, RTL, visible errors, target minimum, and no remount during focus.
- Exercise native label and Space, exact input/change order, dirty/default, mixed submission, reset, restore, and disabled fieldset.
- Exercise ignored and accepted controlled requests, synchronous and deferred acknowledgement, repeated gestures, committed form validity, and returning to local mode.
- Re-run native Checkbox, Switch, and Checkbox Group regression checks and historical Checkbox parity. Keep actual assistive-technology results separate from browser assertions.
