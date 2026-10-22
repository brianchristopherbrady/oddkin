# 0043. Composite dependency mechanism: element-reference parts and definition roles

- **Status:** Proposed (draft for the M8 multi-product review; nothing implemented)
- **Date:** 2026-10-21
- **Area:** Core / Components
- **Detailed design:** [multi-product.md](../multi-product.md) §8; prototype: [research/experiments/composite](../../../research/experiments/composite/README.md)
- **Related:** 0033 (multi-product foundations), 0036 (composition API), 0031 (size budgets), 0038 (CSS and platform floor)
- **Owner of the implementation, if accepted:** Agent 1 (`packages/core`); Agent 4 for the component side

## Context

A composite (a component that renders other components, such as the editable list's input rows, and in M10 select, combobox, menu, tree, toolbar, pagination, and command palette) must render **the product's** child implementations, not hardcoded `odd-*` tags. `compose({ dependencies })` (ADR 0036) registers child definitions first, but it does not change the tags a template writes. Multi-product.md §8 lists what the mechanism has to connect: named roles, the definitions selected for them, the references the template renders, their registration, and a compatibility check.

The M4 prototype rendered keyed rows of an input and a button with Oddkin's family (`odd-input`, `odd-button`) and a recomposed product family (`studio-*`) through three candidates, on public APIs, in Chromium, Firefox, and WebKit (18 tests per engine; 2 of 2 mutants killed):

| | Element-reference parts | Child directive | Family template factories |
| --- | --- | --- | --- |
| Binding syntax for children | Full (`.prop`, `?bool`, `@event`, attributes, slotted markup) | Attributes, properties, listeners, text; no slotted markup, no readables | Full |
| Identity across reorders and re-renders | Core's prepared-template cache | A composite-owned cache that must be pruned | Core's cache |
| Typing | Typed tag references; bindings untyped as in every template | Child properties typed | Untyped |
| Static analyzability | Through `tag(roles.x)` to the definition | No child markup | Literal tags |
| Trusted Types / CSP | Validated names reach the `oddkin-template` policy | No parsing sink | Unchanged |
| Helper size (gzip) | 594 B | 438 B | 0 B, plus one template copy per family |

Two findings shape the decision: a template cannot read its definition's dependencies, so each product passes its family twice (to the template and to `dependencies`) with nothing checking that they agree; and core rejects tag-position bindings only at first render, not when `html` runs.

## Decision (proposed)

1. **Roles live on the definition.** `dependencies` stays the single source: `compose({ ..., dependencies: { input: inputDefinition, button: buttonDefinition } })`. A template receives them as its second argument, `template(host, roles)`, where `roles.input` is a frozen, typed `TagRef<OddkinInput>` derived from the dependency's definition name. Recomposing a composite with another family replaces entries in `dependencies` and nothing else.
2. **Element-reference parts in core.** The template parser accepts a `TagRef` interpolation only in tag position (`<${roles.input} .value=${v}></${roles.input}>`, opening and matching closing tag). Names are re-validated against the custom-element name grammar (no `<`, `>`, quotes, `=`, `/`, or whitespace) when the template is prepared. Prepared templates are cached by (strings identity, resolved names), so identity, focus, and typed text survive re-renders exactly as with literal tags.
3. **Errors at authoring time.** A `TagRef` in any other position is `template.tagRef.position`, reported when `html` runs in development builds; an invalid name is `template.tagRef.invalid`; a template reading a role its definition does not declare is `definition.role.missing`. Production builds keep the checks that guard safety (name grammar, position) and drop the messages (ADR 0031).
4. **Trusted Types.** The `oddkin-template` policy's stated input becomes "author-written template strings plus custom-element names validated by the parser". No runtime value other than a validated name reaches the policy.
5. **Compatibility check.** A role may declare the contract it relies on (properties, events, and anatomy parts from the role definition's published metadata). The analyzer verifies it statically for recomposed families; development builds check required properties and events once at `define()`. Behavioral equivalence stays with the shared interaction fixtures and conformance suites (ADR 0034), never with this check.
6. **Analyzer.** It resolves `roles.x` to `dependencies.x` to the definition's literal name, so composites stay statically analyzable and family mappings (`extends`, product links) are emitted without executing templates.
7. **Fallback kept.** Family-specific template factories remain a supported, zero-mechanism option for products with one or two composites; they are the only route that needs no core change. Documentation says when each fits.

## Alternatives considered

- **Child directive** (`child(roles.input, { props, on })`) — typed child properties, but loses slotted markup and readables, and needs per-part state in core or a pruned composite cache. Rejected as the primary mechanism; could return as a typed helper on top of element-reference parts if typing evidence demands it.
- **Family template factories only** — no core change, but every family copies every composite template, and nothing but fixtures keeps the copies equivalent.
- **Tag-name guessing, global substitution, string replacement of internal tags, or scoped custom-element registries** — rejected by multi-product.md §8 (implicit, unanalyzable, or not available at the floor).

## Consequences

- Core changes: the parser, the prepared-template cache key, the policy statement, the template signature `(host, roles)`, and three diagnostics. Existing templates (one argument) are unaffected.
- **Size is the main risk.** The counter budget is 9,728 B with 9,521 B used at ADR 0036 (207 B margin). The prototype helper is 594 B gzip outside core; a core implementation must be measured against the counter, component, and list budgets before acceptance, and the budget change, if any, recorded under ADR 0031.
- The composite prototype becomes the first conformance case: the editable list with `studio-*` rows must pass the same fixtures as with `odd-*` rows.

## Acceptance criteria for the M8 decision

1. A core spike passes the 18 prototype tests through `roles` instead of a family argument, in three engines, plus a strict-CSP and enforced Trusted Types run (the prototype was never run under an enforced policy).
2. Size budgets measured with the change; any increase justified or the decision revisited.
3. Analyzer fixture: a recomposed composite emits the product's child tags and `extends` links without executing templates.
4. Agent 1 (core owner) and the multi-product review accept the API shape; until then the status stays Proposed and M10 composites use family template factories.

## Open questions

- Should a role be optional (render nothing or a native fallback when absent)? Proposed: no; every role is required, and a native fallback is a different composite.
- Typed bindings on element-reference parts (checking `.value=${v}` against `OddkinInput`) need template type checking Oddkin does not have; out of scope here.
