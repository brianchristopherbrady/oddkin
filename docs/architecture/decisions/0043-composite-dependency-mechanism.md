# 0043. Composite dependency mechanism: element-reference parts and definition roles

- **Status:** Accepted (2026-10-21, by the owner, on condition of a pay-for-use implementation; the spike below met the acceptance criteria). Implemented as `@oddkin/core/template/roles`; core's template parser is unchanged.
- **Date:** 2026-10-21
- **Area:** Core / Components
- **Detailed design:** [multi-product.md](../multi-product.md) §8; prototype: [research/experiments/composite](../../../research/experiments/composite/README.md)
- **Related:** 0033 (multi-product foundations), 0036 (composition API), 0031 (size budgets), 0038 (CSS and platform floor)
- **Owners:** Agent 1 (`packages/core`, the analyzer); Agent 4 for the component side

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

## Decision

1. **Roles live on the definition.** `dependencies` stays the single source: `compose({ ..., dependencies: { input: inputDefinition, button: buttonDefinition } })`. A template reads them with `rolesOf(host)` (`@oddkin/core/template/roles`), which returns, from the host's registered definition, one frozen `TagRef` per dependency, the same object on every render. Recomposing a composite with another family replaces entries in `dependencies` and nothing else. (Drafted as a second template argument, `template(host, roles)`; reading the registered definition keeps the element base class and every non-composite bundle unchanged.)
2. **Element references, opt in.** `composite` is `html` that also accepts a `TagRef` in tag position (`<${roles.input} .value=${v}></${roles.input}>`). It validates each name against the custom-element name grammar (no `<`, `>`, quotes, `=`, `/`, or whitespace), writes it into the template strings, and caches the rewritten strings per (call site, names), so core's prepared-template cache keeps identity, focus, and typed text exactly as with literal tags. Core's parser is unchanged and still rejects tag-position bindings in plain `html`. (Drafted as a parser change; the opt-in module keeps the cost on composites only.)
3. **Errors at authoring time.** A `TagRef` in any other position, or a non-reference in tag position, is `template.tagRef.position` when `composite` runs; an invalid name is `template.tagRef.invalid`; reading a role the definition does not declare is `definition.role.missing` in development builds; a host without a registered definition is `definition.role.unbound`. Production builds keep the safety checks (name grammar, position) and drop the messages (ADR 0031).
4. **Trusted Types.** The `oddkin-template` policy's stated input becomes "author-written template strings plus custom-element names validated by `composite`". No runtime value other than a validated name reaches the policy.
5. **Compatibility check (later).** A role may declare the contract it relies on (properties, events, and anatomy parts from the role definition's published metadata); the analyzer would verify it statically for recomposed families, and development builds once at `define()`. Not part of the spike; it follows with the first M10 composite. Behavioral equivalence stays with the shared interaction fixtures and conformance suites (ADR 0034).
6. **Analyzer.** Each role's element is known from `dependencies`, which the analyzer already emits per definition, and it reads `composite` templates like `html` ones (slots, and parts including those on role elements), so composites stay statically analyzable and family mappings (`extends`) are emitted without executing templates.
7. **Fallback kept.** Family-specific template factories remain a supported, zero-mechanism option for products with one or two composites; they are the only route that needs no core change. Documentation says when each fits.

## Alternatives considered

- **Child directive** (`child(roles.input, { props, on })`) — typed child properties, but loses slotted markup and readables, and needs per-part state in core or a pruned composite cache. Rejected as the primary mechanism; could return as a typed helper on top of element-reference parts if typing evidence demands it.
- **Family template factories only** — no core change, but every family copies every composite template, and nothing but fixtures keeps the copies equivalent.
- **Tag-name guessing, global substitution, string replacement of internal tags, or scoped custom-element registries** — rejected by multi-product.md §8 (implicit, unanalyzable, or not available at the floor).

## Consequences

- Core gains one opt-in subpath (`@oddkin/core/template/roles`: `rolesOf`, `composite`, `tag`) and four diagnostics; the parser, the element base class, and existing templates are unchanged.
- Size: the counter, component, and list bundles are unchanged (9,531, 10,808, and 11,397 B gzip); a composite pays 370 B gzip for the module (new `composite` size entry, 11,876 B, budget 12,288 B).
- The composite prototype becomes the first conformance case: the editable list with `studio-*` rows must pass the same fixtures as with `odd-*` rows.

## Spike results (2026-10-21)

1. **Tests:** `packages/core/test/roles.browser.test.ts` ports the element-reference cases of the prototype through `rolesOf` (both families' children rendered, upgraded, and wired; two families side by side; identity, typed text, and focus through reorders, re-renders, and an insert; release to the ownership baseline; one rewritten template per call site and family; name and position checks) plus the role diagnostics: 8 tests in Chromium, Firefox, and WebKit. `e2e/composite-roles.spec.ts` runs `examples/composite-roles` under `require-trusted-types-for 'script'` with `trusted-types oddkin-template` and no policy violations in three engines (Trusted Types enforced where the browser supports them).
2. **Size:** as in Consequences; no budget raised.
3. **Analyzer:** `packages/analyzer/test/composite.test.ts` with `tests/fixtures/analyzer-composite`: a recomposed composite (`studio-rows`) emits `extends: component:acme-rows` and dependencies on the product's `studio-field` and `studio-button`, and the shared template's parts, including those on role elements, without executing a module.
4. **Mutants:** 9 of 9 killed (name grammar, position check, rewrite cache, name splicing, roles cache, both role diagnostics, and both analyzer changes).

## Acceptance criteria for the M8 decision

1. A core spike passes the 18 prototype tests through `roles` instead of a family argument, in three engines, plus a strict-CSP and enforced Trusted Types run (the prototype was never run under an enforced policy).
2. Size budgets measured with the change; any increase justified or the decision revisited.
3. Analyzer fixture: a recomposed composite emits the product's child tags and `extends` links without executing templates.
4. Agent 1 (core owner) and the multi-product review accept the API shape; until then the status stays Proposed and M10 composites use family template factories. *(Met: the owner accepted the API shape on condition of a pay-for-use implementation, 2026-10-21.)*

## Open questions

- Should a role be optional (render nothing or a native fallback when absent)? Proposed: no; every role is required, and a native fallback is a different composite.
- Typed bindings on element-reference parts (checking `.value=${v}` against `OddkinInput`) need template type checking Oddkin does not have; out of scope here.
