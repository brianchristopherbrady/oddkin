# Multi-product design systems and reusable component foundations

Status: **proposal**, except where §1 lists an existing, verified capability. Decision record: [ADR 0033](./decisions/0033-multi-product-foundations.md) (extends [ADR 0026](./decisions/0026-products-and-modes.md)). Planned work: [IMPLEMENTATION_PLAN.md](../../IMPLEMENTATION_PLAN.md) §5g. Export names below are illustrative until reconciled with the composition API ADR (M4).

**Contract.** Oddkin supports shared interaction foundations, product-specific visual implementations, and scoped token themes. Teams reuse supported behavior and templates through public exports. Product implementations keep the documented interaction contracts and pass shared verification fixtures.

## 1. What exists today and what is proposed

| Capability | Status | Evidence / owner |
| --- | --- | --- |
| Product scopes in theme config (`products:` → `[data-odd-product="…"]`), alias-closure re-declaration, nesting with mode/density/profile without cross-products | **Implemented** (M2) | theming-and-styling.md §5, §5.1; `packages/tokens/test/generate.browser.test.ts` |
| Product scopes change brand inputs only; product-specific role overrides unsupported; one theme per document | **Current limitation** | theming-and-styling.md §5.1 |
| `define()` idempotent for the same pair; `registry.collision` for a taken name; `registry.constructorReused` for one class under two names; `static dependencies` registered first | **Implemented** (M3) | `packages/core/src/element/define.ts`; `element.browser.test.ts` |
| One constructed sheet per style object per document; `flattenStyles` keeps order and drops later duplicates | **Implemented** (M3) | theming-and-styling.md §7; `@oddkin/core/styles` |
| `ref()` element references in templates | **Implemented** (M3) | `@oddkin/core/helpers/ref` |
| Products and modes page: absent by default, local/installed/versioned-manifest sources, discovery suggests only, product schema v1 draft | **Designed**; implementation M9 | workbench-pages.md §9; ADR 0026; `docs/schemas/product.v1.schema.json` |
| `compose()` / `define(definition)`, spread recomposition with `extends` lineage, `registry.definitionConflict` | **Implemented** (M4 runtime and analyzer) | core-contracts.md §1.1; ADR 0036; `definition.browser.test.ts` |
| Recomposition, layered component exports, foundation entry points, anatomy contracts, component families, product-aware composites, product scale, multi-product metadata and tooling | **Proposed** (this document) | §2–§11 |

## 2. Vocabulary

| Term | Meaning | Not the same as |
| --- | --- | --- |
| **Product** | A stable id (`^[a-z][a-z0-9-]*$`) naming something a company ships. It selects a design language, component family, theme values, and overrides | A repository, package, theme, mode, density, or profile |
| **Design language** | A coherent visual system: a theme configuration (tokens, presets) plus the visual styles of a component family. Several products may share one | A product |
| **Component family** | A named mapping from component roles (`button`, `input`, `card`, …) to definitions used together; `@oddkin/components` is Oddkin's default family | A package (one package may hold several families, one family may span packages) |
| **Foundation** | A component's behavior class, template (anatomy), structural styles, and interaction contract, reusable through public exports | A skin |
| **Visual implementation (skin)** | Visual styles, and optionally an alternative template, composed onto a foundation into a new definition | A theme |
| **Theme / mode / density / profile** | Scoped token values (existing `data-odd-theme`, `-mode`, `-density`, `-profile` scopes) | A product |

- One product may support several themes and modes; two products may share one design language and family.
- A design language maps onto the existing `data-odd-theme` scope and a product's values onto the existing `data-odd-product` scope (or onto its own theme). No new CSS scope axis and no runtime provider is required to express these relationships.

| Situation | Shared | Product-specific |
| --- | --- | --- |
| Shared design language, different branding | Component definitions and behavior | Tokens, themes, typography, spacing, density |
| Different visual languages, compatible anatomy | Behavior classes, templates, interaction contracts | Styles, visual recipes, composed definitions |
| Different component anatomy | Reusable interaction logic, documented contracts | Templates, styles, composition, dependencies |
| Different interaction requirements | Appropriate reusable mechanisms (controllers, `Scope`) | Deliberately extended or separate component behavior |

Distinct implementations are created only when differences require them; no product needs its own component, constructor, package, or design language by default.

## 3. Any number of products

Two-product examples are verification fixtures, not an architectural limit. One, two, three, ten, or more products use the same model.

- Products are entries in a collection keyed by stable id. No hardcoded product counts, fixed comparison slots, or product-specific schema fields.
- **Single product:** no `products` configuration, no product selector, no product attribute required; the base theme is the product. The Products and modes page stays absent unless explicitly enabled, regardless of product count.
- **Shared foundations without duplication:** presets, token contracts, component families, and behavior foundations are referenced by id or import from each product. Products override only what differs.
- **Isolation:** resolving or editing one product's configuration never mutates shared presets or another product's resolved configuration. The token generator is pure; tests resolve products from frozen inputs and compare the other products' outputs byte for byte.
- **Distribution:** products may live in one repository, several workspaces, separate repositories, or installed packages (§9).
- **No combinatorial generation:** token CSS grows with each product's overridden closure (§9), not with product × mode × density × profile. Agent references, Workbench previews, and implementation assets for a product are generated or loaded on demand, never for every combination.

## 4. Component layers and public exports

For components declared **recomposable**, the folder convention ([IMPLEMENTATION_PLAN.md](../../IMPLEMENTATION_PLAN.md) §3.3) adds structural styles and a foundation entry:

| Layer | Responsibility | File | Illustrative export |
| --- | --- | --- | --- |
| Behavior | Properties, state transitions, methods, events, lifecycle, `Scope` ownership, keyboard interaction, native-platform integration (forms, focus delegation) | `card.ts` | `Card` |
| Anatomy | Template structure required by behavior: references, focus targets, slots, native elements, ids, accessibility associations | `card.template.ts` | `cardTemplate`, `CardAnatomy` (type) |
| Structural styles | Styles the implementation relies on for supported layout or interaction (display, positioning, focus-target sizing, visually-hidden helpers, overflow rules) | `card.structural.styles.ts` | `cardStructuralStyles` |
| Visual styles | Default presentation: surfaces, colour, typography, borders, radii, elevation, motion, supported layout choices | `card.styles.ts` | `cardStyles` |
| Definition | Composition of the above plus dependencies | `card.definition.ts` | `cardDefinition` |
| Theme values | Scoped semantic tokens consumed by components and product styles | `@oddkin/tokens` output | — |

- Oddkin's default components are built from these same public pieces.
- Structural styles are documented per component. Including them does **not** make arbitrary visual overrides safe; it only preserves the layout and interaction behavior the implementation depends on. They read no brand or visual tokens; they may read component variables with neutral fallbacks and documented layout roles.
- Only recomposable components export templates and styles, and doing so is a deliberate compatibility commitment covered by M8/M12 rules. Private helpers are never exported as customization APIs.

**Entry points and import graphs.** Installation dependencies (what `package.json` lists) and import graphs (what a browser actually loads) are documented separately.

| Entry | Exports | Loads |
| --- | --- | --- |
| `@oddkin/components/card/foundation` | `Card`, `cardTemplate`, `cardStructuralStyles`, anatomy and contract types | Core, the behavior, template, and structural styles only — no default skin, theme generation, catalog, or tooling |
| `@oddkin/components/card` | Everything above plus `cardStyles`, `cardDefinition` | Also the default visual styles |
| `@oddkin/components/define/card` | Registers `cardDefinition` and its dependencies | The definition graph plus registration |

All three are free of registration side effects except the `define` entry. Classes, templates, styles, definitions, `foundation.ts`, and `index.ts` never register anything.

## 5. Recomposing a definition

```ts
import { compose } from '@oddkin/core/element';
import { Card, cardDefinition, cardStructuralStyles } from '@oddkin/components/card';
import { hostStyles } from '@oddkin/components/styles';
import { studioCardStyles } from './studio-card.styles.js';

export class StudioCard extends Card {}

export const studioCardDefinition = compose({
  ...cardDefinition,
  name: 'studio-card',
  element: StudioCard,
  styles: [hostStyles, cardStructuralStyles, studioCardStyles],
});
```

Recomposition:

- creates a new frozen definition with its own identity; the original definition and class are never mutated;
- preserves constructor, host, and template typing (`compose` is generic over the element and template host);
- reuses behavior and templates by reference, never by copying source;
- records a traceable relationship to its foundation. One candidate: every definition carries an enumerable `source` field referencing itself, so a spread copies it and `compose()` records `extends: cardDefinition`. The analyzer sees the same relationship statically from the spread. The alternative is an explicit `extend(cardDefinition, overrides)` helper. The composition ADR picks one;
- never copies registration state, compiled-template caches, or runtime ownership. Those live in module-private `WeakMap`s keyed by definition or constructor, so spreading a definition copies only its declarative inputs.

**Behavior classes are safely subclassable.** An element resolves its template, styles, and dependencies from the definition registered for its **exact constructor**, never through the prototype chain. A subclass therefore never inherits a parent's product configuration. Class-based colocated authoring (`render()`, `static styles`) keeps ordinary JavaScript inheritance.

**Style ordering policy (one rule, to confirm in the composition ADR).**

- A definition that supplies `styles` defines the complete, ordered style list for that definition; the class's `static styles` are not consulted. A definition without `styles` uses the class's `static styles`.
- A definition's `template` takes precedence over the class's `render()`. Development builds report `definition.render.ignored` when both exist.
- Order is the flattened array order (depth-first; a repeated style object keeps its first position — existing `flattenStyles`). Later sheets win at equal specificity. The convention is structural styles first, then default or product visual styles, then product refinements.
- Styles stay shared: one constructed sheet per style object per document (existing), so any number of products sharing `cardStructuralStyles` share one sheet per document. Nothing is rebuilt per instance or per product, and shared sheets are never mutated. CSS-in-TS, `.css`/`.scss` sources, CSP nonces, and the `<style>` fallback are unchanged.

**Constructor identity and registration.**

| Rule | Status |
| --- | --- |
| Re-registering the same name and constructor is a no-op | Existing |
| A different constructor for a taken name throws `registry.collision`; nothing is silently replaced | Existing |
| One constructor cannot be registered under two names (`registry.constructorReused`); a product subclass supplies a distinct constructor | Existing |
| `define(definition)` is idempotent per definition; two different definitions for the same name throw `registry.definitionConflict` | Proposed |
| Separate applications select their definitions independently; same-document coexistence needs compatible shared definitions or distinct names and constructors | Proposed contract on existing behavior |
| Scoped registries are feature-detected only (ADR 0009) and never assumed cross-browser | Existing policy |

## 6. Customization ladder

| Level | Change | Effect on existing instances |
| --- | --- | --- |
| 1 | Semantic theme values (tokens, themes, product overrides) | Updated in place; instances preserved (theme-value edits, ADR 0030) |
| 2 | Documented component variables, parts, slots, and options | Updated in place through CSS and ordinary property/slot updates |
| 3 | Product visual styles composed with shared structural styles | Selects a different implementation (new definition, name, constructor): structural |
| 4 | Alternative template satisfying the component's anatomy contract | Structural |
| 5 | Reuse behavior mechanisms or deliberately extend behavior for different interaction requirements | Structural |

Teams start at level 1 and move up only when the lower level cannot express the difference. Choosing a different definition, template, or component family follows the existing replacement rules (Workbench remount policy, ADR 0030); theme and token edits never remount. The data-composition customization ladder (options → slots/parts → render functions → registered kinds) applies within levels 2 and 4 for data-driven components.

## 7. Anatomy contracts and template compatibility

A component that supports alternative templates publishes an **anatomy contract**. It is documented and typed where practical (e.g. `CardAnatomy`). Where applicable it lists:

- required elements and native semantics (e.g. a real `<button>` for an action);
- required references and their types (`control: HTMLButtonElement`), obtained with `ref()`;
- focus targets and focus restoration;
- keyboard relationships;
- slots and supported content relationships;
- state hooks and required visual states (custom states, attributes, parts);
- identifiers and accessibility associations (label, description, error, `aria-controls`);
- ownership and teardown expectations;
- form behavior where applicable.

Sharing a behavior class preserves its implementation, but every alternative template and style set must be verified against the contract with the shared interaction fixtures; foundation verification does not certify downstream skins or templates. Not every component supports arbitrary template replacement: each component documents its supported customization levels (`@customization` on the class; the analyzer records them as `customization.levels`, unknown when absent). For substantially different templates, extract reusable behavior controllers with explicit host requirements on top of the existing controller and `Scope` mechanisms, only from demonstrated needs. Broader extension contracts are justified by prototypes and interaction evidence.

## 8. Component families and product-aware composites

A composite must render the product's implementations of its children. A dependency registration list alone does not change hardcoded child tags in markup, so the mechanism must connect:

1. the composite's named component roles (e.g. `input`, `button`);
2. the child definitions selected for those roles;
3. the references its template actually renders;
4. registration of those definitions;
5. a compatibility check between the composite and each child (the properties, events, and anatomy the composite relies on).

```ts
// illustrative — recomposing a composite with a product family's children
export const studioListDefinition = compose({
  ...editableListDefinition,
  name: 'studio-editable-list',
  element: StudioEditableList,
  dependencies: { input: studioInputDefinition },   // named role → definition
});
```

Candidate mechanisms, evaluated by prototype against the current template engine (which today has no dynamic tag parts):

| Candidate | Shape | Risks |
| --- | --- | --- |
| Element-reference parts | Template interpolates a role reference as a tag (`<${c.input} …>`); the parser accepts it only in tag position, validates the name grammar, and caches per (strings, resolved names) | Parser change and cache keys; CSP/Trusted Types and size budget must still pass |
| Child directive | `${child(c.input, { props, events, slots })}` creates the element from the definition in a child part | Less static markup for the analyzer; attribute and slot ergonomics |
| Family-specific template factories | Each family supplies a template satisfying the composite's anatomy contract with its own literal tags | Template duplication across families |

Constraints for the selected mechanism:
- static analyzability and type checking where practical;
- safe template construction;
- independent component families on the same page;
- ordinary use without a global registry provider or Oddkin application state.

Never tag-name guessing, implicit global substitution, or string replacement of internal tags. Validate with one real composite with product-specific interactive children — the editable list with input rows from the M4 data slice — before expanding.

**Prototype results (M4; decision at M8):** [research/experiments/composite](../../research/experiments/composite/README.md) renders keyed member rows with Oddkin's and a product's (`studio-*`) input and button through all three candidates, on public APIs only. All three render the right children, run two families on one page, keep identity, typed text, and focus through reorders and re-renders, and release their rows, in Chromium, Firefox, and WebKit.
- **Element-reference parts:** prototyped as a template tag that inlines validated names and caches the rewritten strings per call site and names. It keeps the full binding syntax. The validated names pass through the template Trusted Types policy (594 B gzip).
- **Child directive:** gives typed child properties, but loses slotted markup and readables. Without core per-part state it needs a composite-owned identity cache (438 B).
- **Family factories:** need no helper and are the only fully analyzable option, but copy the row template per family.

Recommendation: element-reference parts in core, with templates receiving their definition's roles; today each product passes its family both to the template and to `dependencies`.

**Decision (M8, [ADR 0043](./decisions/0043-composite-dependency-mechanism.md), accepted 2026-10-21):** element-reference parts as an opt-in core subpath, `@oddkin/core/template/roles` ([core-contracts.md §6.3](./core-contracts.md)). A template reads its definition's `dependencies` with `rolesOf(host)` and writes them in tag position with `composite`; `dependencies` is the single source, so recomposing a composite changes only `dependencies`. Core's parser and every non-composite bundle are unchanged; a composite pays 370 B gzip. Family factories remain the zero-mechanism alternative.

## 9. Product configuration, distribution, and scope isolation

- **Distributable units:** shared behavior foundations, shared token contracts or presets, product-specific skins and definitions, product theme configurations, and independently versioned applications — in a monorepo or separate repositories.
- **Explicit references:** products are found through supported package, configuration, or manifest references (ADR 0026 sources). Cross-repository tooling works from installed or supplied artifacts; no repository needs to be checked out.
- **Compatibility:** a product implementation package declares its foundation package as a peer range and records `foundation` (package, version range, definition ids) in its enrichment metadata. Tooling reports `product.foundation.incompatible` when installed versions fall outside the declared range.
- **Scope correctness:** existing alias-closure behavior covers nested scopes, independent roots, and separately configured product values. Boundaries addressed explicitly:
  - Shadow DOM (verified for mode/product/density);
  - slotted content (inherits from its light-DOM position);
  - overlays and popovers (top-layer content keeps its DOM position; content relocated elsewhere must carry its scope attributes explicitly);
  - components moved between product roots (re-resolve through inheritance without re-render);
  - document adoption (sheets re-adopted; the destination document must load the theme CSS).
- **Known gaps to close (M9):**
  - product-specific semantic role overrides (today only brand inputs);
  - several design languages in one document (today one theme per document);
  - additive `product.v1` fields for design language, component family, and foundation compatibility.
- **No accidental global styling:** resets, font loading, and page defaults stay explicit opt-in assets.
- **CSS growth is measured**, not assumed: generated bytes and rules for 1, 2, 3, and 10 products, with the per-product cost reported; no product × mode × density × profile emission. *(Measured M4, `packages/tokens/test/products.test.ts`: one rule per product and nothing else changes; the rule re-declares only colour references and colour roles whose values differ from the base theme (41 declarations for a distinct hue, 36 for a hue close to the base brand, whose neutral ramp is unchanged). Default theme: 26,326 B raw / 2,720 B gzip -9 with no products; 29,455 / 2,928 with 1; 32,584 / 3,099 with 2; 35,713 / 3,241 with 3; 57,254 / 4,346 with 10, about 3.1 KB raw and 160–210 B gzip per product. Products are emitted in configuration order.)*

## 10. Metadata, documentation, Workbench, and agents

- **Metadata** (additive, [metadata-and-analyzer.md](./metadata-and-analyzer.md) §3.2): foundation and derived-definition relationships; behavior, template, structural-style, and visual-style source references; component-family mappings; anatomy and customization contracts; registration entries; compatibility requirements; authored guidance and verification evidence bound to the implementation and configuration tested. Derived definitions get their own ids (`component:studio-card`) with a traceable `extends` reference. Standard CEM stays interoperable; everything else is enrichment. The analyzer never executes component modules, template factories, or configuration expressions; dynamic cases stay explicit diagnostics.
- **Workbench:** compare product implementations using shared examples and interaction fixtures. Product selection is searchable and scales to many products; comparisons mount only the products the user chose, lazy-load each product's implementation assets, and dispose previews on deselection. Value edits update in place; changing component family or implementation follows the structural replacement rules. The existing Products and modes rules are unchanged: absent by default, discovery only suggests, a workspace package is never automatically a product, sources are local, installed, or versioned, and Theme Studio remains a separate primary destination.
- **Agent kits:** lookups take an optional `product` and return only that product's family, tokens, styles, templates, and dependencies. Kits tell an assistant which foundation a product component uses, which customization level fits a request, what is product-specific, and which contracts and checks must be preserved. References for a product are generated or retrieved on demand from the same metadata and examples.

## 11. Verification

Fixtures use **1, 2, 3, and 10 products**; representative coverage plus targeted checks for declared differences replace an exhaustive cross-product of every axis.

1. Two products using the same definitions with different scoped token values.
2. Two visual implementations sharing one foundation and template.
3. Explicit constructor and name handling when both implementations coexist in one document.
4. A composite selecting and registering product-specific children.
5. Properties, methods, events, slots, and documented interaction behavior preserved.
6. Keyboard, focus, dismissal, disabled/loading states, and form semantics where applicable.
7. Product-specific focus visibility, contrast, target sizes, direction, reduced motion, and forced colours where supported.
8. Nested product/theme scopes and overlay or relocation boundaries.
9. Equal analyzer and documentation accuracy for default and derived definitions.
10. Packed consumers using public exports across independently versioned packages.
11. No branded styles, tooling, or application services in minimal foundation consumers.
12. Definition and style reuse without per-instance reconstruction or mutation of shared sheets.
13. Shared and different design languages; shared and product-specific families; independent and nested scopes.
14. Configuration isolation and deterministic generation for every fixture size.
15. Workbench selection, comparison, loading, and cleanup at 10 products; agent lookups scoped to one product.
16. CSS size, bundle loading, shared-code reuse, startup, update behavior, and preview resource usage per fixture size.

Results are recorded against the implementation and configuration tested. Performance benefits of shared foundations are hypotheses until measured.

*Verified (M4):*

- Items 1–3: `packages/components/test/multi-product.browser.test.ts`.
- Items 5, 6, and 12, for `odd-button`, `odd-card`, `odd-input`, `odd-side-nav`, and a derived implementation of each: `contract.browser.test.ts` and `interactions.browser.test.ts`, with the derived definitions in `test/derived.ts`.
- Item 9, for a product package deriving from the published `@oddkin/components`: `packages/analyzer/test/products.test.ts`. The metadata half is covered; documentation pages wait for M5.
- Item 14: `packages/tokens/test/products.test.ts`.

All in Chromium, Firefox, and WebKit.

Shared interaction fixtures become portable conformance suites, and product-affecting changes are traced by impact reports ([change-impact-and-verification.md](./change-impact-and-verification.md) §2–§3). A change to shared structural styles, presets, or a foundation selects verification for every product that uses it.

## Open questions

- Definition lineage: self-referencing `source` field vs an explicit `extend()` helper.
- Composite dependency mechanism (§8 candidates).
- ~~Which M4/M10 components are declared recomposable, and at which customization levels.~~ Resolved 2026-10-27: every element declares levels 1–3 with `@customization`, except odd-tab-panel (2–3: it has no look of its own). `packages/components/test/customization.test.ts` checks what each declared level ships. Level 4 needs a typed anatomy contract, which no element has yet.
- Product-specific role overrides and several themes per document: generator and CSS-size implications.
- Product selector threshold and comparison limit in Workbench.

Research: [FAST 1.x component libraries](https://fast.design/docs/1.x/design-systems/creating-a-component-library/) (historical, version-specific), [FAST source](https://github.com/microsoft/fast), [Lit styles](https://lit.dev/docs/components/styles/), [Spectrum theme API](https://opensource.adobe.com/spectrum-web-components/tools/theme/api/), [custom element registration](https://html.spec.whatwg.org/multipage/custom-elements.html#dom-customelementregistry-define), [CSS custom properties](https://www.w3.org/TR/css-variables-1/), [CSS Shadow](https://drafts.csswg.org/css-shadow-1/) — register R26 and R42–R46. Documentation examples and drafts do not establish browser support or comparative performance.
