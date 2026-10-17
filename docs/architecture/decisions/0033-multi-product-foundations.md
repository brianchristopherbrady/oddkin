# 0033. Multi-product foundations, recomposition, and product scale

- **Status:** Proposed
- **Date:** 2026-10-17
- **Area:** Components / Theming / Tooling
- **Detailed contract:** [multi-product.md](../multi-product.md)
- **Extends:** [0026](./0026-products-and-modes.md); depends on the composition API ADR (M4)

## Context
Companies ship several products, sometimes with one design language and sometimes with several, often from separate repositories. They need to share interaction behavior and accessibility work while choosing product-specific visuals and themes. Today Mote has product token scopes (brand inputs only, one theme per document), strict registration diagnostics, shared constructed sheets, and an optional Products and modes page. It has no supported way to reuse a component's behavior and template with different styles, or to make a composite use a product's own children.

## Decision
- Product identity is independent of repository, component family, design language, theme, mode, density, and profile. Design languages map onto existing theme scopes and product values onto existing product scopes. No new runtime provider or CSS scope axis is mandatory.
- Any number of products uses one model: products keyed by stable id, no count-specific fields or fixed comparison slots, and no ceremony for a single product.
- Recomposable components expose behavior, template (anatomy), structural styles, default visual styles, and a composed definition through public exports. A separate `foundation` entry loads no default skin.
- `compose()` accepts an existing definition's fields to create a new, frozen definition with its own identity and a traceable foundation link. Runtime state stays in private maps. Elements resolve configuration by exact constructor, never by inheritance.
- One style policy: definition styles are a complete ordered list, with structural styles first by convention; sheets stay shared per document.
- A five-level customization ladder separates in-place theme updates from structural implementation changes.
- A product-aware composite mechanism is selected only after prototyping the candidates against the editable-list composite.
- Existing registration rules hold, adding `registry.definitionConflict`. Scoped registries are never assumed.

## Alternatives considered
- **One component package per product** — duplicates behavior and accessibility work.
- **A global substitution registry or runtime provider** — implicit, hard to analyze, and couples components to application setup.
- **Exporting all internals as customization API** — accidental compatibility commitments.
- **Emitting every product × mode × density × profile combination** — CSS and tooling growth without demonstrated need.

## Consequences
- More public exports with deliberate compatibility commitments (M8 checkpoint, M12 freeze, ADR 0029).
- Anatomy contracts and shared interaction fixtures for recomposable components.
- Metadata gains foundation, family, and compatibility facts.
- Workbench and agent kits gain product-scoped selection, comparison, and lookup.
- The token generator must add product role overrides and several themes per document before multi-language pages are supported.

## Evidence
Existing: product scopes and nesting (M2, three engines), registration diagnostics and sheet sharing (M3). Pending: M4 recomposition prototype on `mote-card`/`mote-button` and the editable-list composite; M8 review; M9 token and Workbench scale work with 1/2/3/10-product fixtures; M12 packed multi-repository consumers.

## Revisit when
Prototypes show recomposition breaks the binding rule, size budgets, or analyzability, or the composite mechanism cannot satisfy safe construction and static analysis.
