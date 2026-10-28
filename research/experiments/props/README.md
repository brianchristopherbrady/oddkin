# `props()` assessment (M3)

**Outcome (M8 review, 2026-10-27): dropped for v1.** The evidence and the conditions for reopening are in [data-composition.md §2](../../../docs/architecture/data-composition.md).

A prototype of the optional property-binding helper proposed in [data-composition.md §2](../../../docs/architecture/data-composition.md), built only on public APIs: the attribute-directive protocol and `elementProperties()`. It is not published. The keep/rename/drop decision stays at M8 with the ergonomics study.

```ts
html`<x-nav .props=${props({ label, items, current })}></x-nav>`;
```

Evidence: [`props.browser.test.ts`](./props.browser.test.ts) passes in Chromium, Firefox, and WebKit.

## Contract check

| Proposed contract | Prototype result |
| --- | --- |
| Element-position syntax `<x-nav ${props(…)}>` | **Not available.** The template has no element-position part; tag- and attribute-name positions are rejected (`template.binding.position`). The prototype uses a named property binding, `.props=${…}`, through the existing directive protocol, with no core change. Adding element parts would add parser and part code to every template. |
| Only declared public properties; unknown keys produce a diagnostic | **Met after definition.** Unknown keys report `props.key.unknown` and are skipped. Native event-handler names (`onselect`) are rejected rather than wiring a handler. Before the element is defined, keys cannot be checked. |
| Explicit `.prop` / attribute bindings on the same element win | **Not met.** A directive cannot see other parts on its element. The later binding in source order commits first-render values, and afterwards whichever binding changed last wins. Enforcing precedence needs per-element part bookkeeping in core. |
| Removed key resets to the declared default | **Met**, through `elementProperties()` and `definition.initial()`. |
| No listeners, nothing to dispose | **Met.** Clearing the binding resets the keys it set. |
| Pre-upgrade values replayed | **Met** by `OddkinElement`'s constructor replay. Unknown keys stay as plain own properties, unchecked. |
| Readable values | Update the target without re-running the parent `render()`, like `classMap`. |

## Costs and benefits

- **Bytes:** 662 B gzip (1,102 B minified) for the helper alone, with core external and the development message included.
- **Authoring:** `.label=${label} .items=${items} .current=${current}` (73 characters in the sample) versus `.props=${props({ label, items, current })}` (64). The real gain is forwarding a configuration object built elsewhere: `.props=${props(config)}` (45).
- **Typing opportunity:** `html` templates are strings, so explicit `.prop=` bindings are not type-checked. A typed `props<typeof Nav>({ … })` could check keys and value types against the element's `with()` definition. This is the strongest argument for the helper.
- **Risk:** two ways to set the same property, with order-dependent results.

## Recommendation

Do not add `props()` to `@oddkin/core` for M4–M7. Ordinary property bindings cover every catalog need, are explicit, and have no precedence ambiguity. If the M8 ergonomics study shows a need for configuration-object forwarding, the contract should change in three ways:
1. Use the named binding `.props=${…}` instead of an element-position part.
2. Replace "explicit wins" with "do not bind the same key both ways" (development diagnostic only if core gains per-element bookkeeping).
3. Ship a typed `props<typeof Element>()` signature.
