# Product-aware composite candidates (M4 prototype, decision at M8)

[multi-product.md §8](../../../docs/architecture/multi-product.md#8-component-families-and-product-aware-composites) needs a composite to render a product's children, not hardcoded `odd-*` tags. This prototype compares the three candidates on one composite: keyed member rows from the editable-list slice. Each row has an input and a "Move up" button, rendered with Oddkin's family (`odd-input`, `odd-button`) and with a product family (`studio-input`, `studio-button`, recomposed from the same foundations in [`family.ts`](./family.ts)). Nothing here is published. The candidates are prototyped on public core APIs, with no core change.

| Candidate | Source | How a product gets its children |
| --- | --- | --- |
| Element-reference parts | [`tag.ts`](./tag.ts), `tagRows` in [`rows.ts`](./rows.ts) | ``composite`<${t.input} .value=${v}></${t.input}>` `` with `t.input = tag(family.input)`; the validated name is inlined and the rewritten strings are cached per (call site, names) |
| Child directive | [`child.ts`](./child.ts), `childRows` | `${children.child(key, 'name', family.input, { attrs, props, on, text })}` creates the element from the definition |
| Family-specific template factories | `oddkinRows`, `studioRows` | each family writes the row template with its own literal tags |

Each product composes its own definition and lists its family as `dependencies`, so `define()` registers the children first.

Evidence: [`composite.browser.test.ts`](./composite.browser.test.ts) passes in Chromium, Firefox, and WebKit (18 tests per engine). Sizes: `node research/experiments/composite/measure.mjs`. Types: the files typecheck under `tsconfig.tests.json`, including the `@ts-expect-error` on a mistyped child property.

## Results

| | Element-reference parts | Child directive | Family template factories |
| --- | --- | --- | --- |
| Product's children rendered, upgraded, wired; two families on one page | Yes | Yes | Yes |
| Identity, typed text, and focus through a reorder, a re-render with new objects, and an insert above | Kept | Kept | Kept |
| Rows released, scopes back to baseline | Yes | Yes | Yes |
| How identity is kept | Core's prepared-template cache, because the rewritten strings array is stable per (call site, names) | An explicit cache keyed by repeat key and role, pruned to the live keys on every render | Core's cache (literal strings) |
| Binding syntax for children | All of it (`.prop`, `?bool`, `@event`, attributes, slotted markup) | Object form: attributes, properties, listeners, and text only; no slotted markup; no readables (re-render driven) | All of it |
| Typing | Tag references are typed (`TagRef<E>`); bindings are untyped strings, as in every template | **Child properties typed against the element** (`value: 3` is a compile error) | Untyped bindings |
| Static analyzability | Children are interpolations in tag position; a reader must follow `tag(family.x)` to the definitions | No child markup at all | **Literal tags**, visible to the analyzer's existing literal-tag reader |
| Trusted Types / CSP (by construction; not run under an enforced policy) | Runtime names reach core's `oddkin-template` policy. Only names matching `^[a-z][a-z0-9._]*-[a-z0-9._-]*$` pass (no `<`, `>`, quotes, `=`, `/`, or spaces), so no markup can be injected. The policy's stated input ("author-written source, never runtime values") would need to admit validated names. | `createElement` plus property and attribute writes; no HTML parsing, no Trusted Types sink | Unchanged |
| Helper size (gzip, core external, development messages included) | 594 B (974 B minified) | 438 B (783 B minified) | 0 B; each family adds a hand-maintained copy of the row template |
| Core change for a real version | Accept references in tag position in the template parser and cache by (strings, names); update the policy contract | A child-part directive protocol with per-part state, so identity comes from the part rather than a cache the composite must prune | None; needs the anatomy contract and shared interaction fixtures to keep copies equivalent |

Mutation probes, Chromium: dropping the rewritten-strings cache (every render parses a new template) fails identity and the call-site cache test. Writing child properties on every render, rather than only when they change, overwrites typed text and fails identity and the directive test.

## Findings

- **A template cannot read its definition's dependencies.** Each product passes its family twice: to the template factory and to `dependencies`, and nothing checks that the two agree. A real mechanism should let the template receive its definition's roles (for example `template(host, roles)`), so `dependencies` is the single source.
- **Core rejects tag-position bindings only at first render** (`template.binding.position`), not when `html` is called. The prototype checks positions eagerly in `composite`.
- A duplicated family template has no drift check: two templates can diverge in anatomy and still pass rendering tests. That is what the anatomy contract (multi-product.md §7) and the shared interaction fixtures are for.

## Recommendation for M8

Lead with **element-reference parts in core**. One template serves every family with the full binding syntax, and identity comes from the existing template cache. The cost is a parser change, cache keys of (strings, names), and an explicit Trusted Types policy statement for validated names. Pair it with a way for templates to receive their definition's roles. Keep **family template factories** as the zero-mechanism fallback for products that only need one or two composites; they are the only fully analyzable option today. Take the **child directive** only if typed child properties outweigh losing markup, slots, and readables; it also needs per-part state in core.
