# Layout recipes and container-responsive composition

Status: the unbranded mechanism (§2–§5, §8 `describeRecipe`) is **implemented** in `@mote/core/layout` and `@mote/core/layout/inspect` (M3) and verified in three engines; §11 lists behaviors settled in implementation. The Mote-bound helpers, `layout.css`, extraction CLI, and side-nav fixture (§7, §9, §10) are M4+ work. These APIs reach candidate v1 status at the M8 compatibility checkpoint. Catalog expansion depends on passing the relevant foundation acceptance criteria. Breaking changes after M8 require an ADR, migration plan, and renewed verification. Final v1 contracts freeze at M12 after the shipped feature set passes release verification.

## 1. Purpose and boundaries

A **layout recipe** describes named regions, reusable arrangements, responsive conditions, variants, and their styling contract. A **template** describes content, semantics, slots, events, and dynamic structure. Recipes reduce repeated layout CSS without becoming a second language that renames every CSS property: anything a helper does not cover is written as ordinary CSS.

| Layer | Owns | Package |
| --- | --- | --- |
| Generic recipe mechanism | `defineLayoutRecipe`, `stack`, `row`, `grid`, `autoGrid`, `split`, `createLayoutHelpers`, region/variant/condition composition, diagnostics, CSS generation | `@mote/core/layout` (unbranded, DOM-free) |
| Mote defaults and presets | Helpers pre-bound to Mote layout roles and named conditions; reusable recipes (e.g. side navigation); CSS utility classes for page authors | `@mote/components/layout` |
| Roles, conditions, profiles | Token categories, thresholds, profile role sets | `@mote/tokens` (independent; no knowledge of recipes) |
| Recipe metadata | Regions, variants, conditions, parts, precedence | `@mote/core/layout/inspect` + generated Mote metadata (§8) |

Core never references `--mote-*` names, Mote conditions, or presets. Tokens never import core or components.

## 2. Proposed API

```ts
// side-nav.recipe.ts — module scope, DOM-free
import { defineLayoutRecipe, stack, row, grid } from '@mote/components/layout';

export const sideNav = defineLayoutRecipe({
  container: { selector: ':host', name: 'side-nav' },   // container-type: inline-size by default

  regions: {
    root: stack(),
    header: row({ justify: 'space-between' }),
    content: grid({ columns: 1 }),
    footer: row({ justify: 'space-between', wrap: true }),
  },

  variants: {
    align: {
      start: { footer: row({ justify: 'start' }) },
      end: { footer: row({ justify: 'end' }) },
    },
  },

  when: {
    'navigation.expanded': {
      content: grid({ columns: 3 }),
      profile: 'navigation.comfortable',     // optional: apply a token profile in this condition (§6)
    },
  },
});
```

```ts
// side-nav.ts
import { MoteElement, html } from '@mote/core';
import { sideNav } from './side-nav.recipe.js';

class DemoSideNav extends MoteElement {
  static styles = [sideNav.styles];

  render() {
    return html`
      <nav class="root" aria-label="Sections">
        <header class="header"><slot name="header"></slot></header>
        <ul class="content" part="content"><slot></slot></ul>
        <footer class="footer"><slot name="footer"></slot></footer>
      </nav>
    `;
  }
}
```

- `defineLayoutRecipe` from `@mote/core/layout` takes the same shape but requires conditions to be supplied (`conditions: { … }`) or written inline as structured queries; the Mote-bound version resolves names from `@mote/tokens/conditions`.
- Recipes are evaluated once at module scope and produce a `MoteStyles` object (ordinary CSS text). Calling `defineLayoutRecipe` during a render emits a dev diagnostic.
- Responsive behavior is pure CSS (container/media queries and intrinsic sizing). No `ResizeObserver`, reactive state, or re-render is involved.
- No build transform is required. Optional extraction (§9) emits equivalent `.css`.

## 3. Helpers and explicit defaults

All helpers use logical properties. `<gap>` and other defaults come from the helper factory: core's neutral factory uses plain lengths; `@mote/components/layout` binds them to Mote layout roles.

| Helper | Generated CSS (defaults) | Options |
| --- | --- | --- |
| `stack()` | `display:flex; flex-direction:column; gap:<gap>; min-inline-size:0` | `gap`, `align` |
| `row()` | `display:flex; flex-direction:row; align-items:center; gap:<gap>; flex-wrap:nowrap; min-inline-size:0` | `gap`, `align`, `justify`, `wrap` |
| `grid({ columns })` | `display:grid; grid-template-columns:repeat(n, minmax(0, 1fr)); gap:<gap>` | `columns`, `gap`, `rowGap`, `align` |
| `autoGrid({ min })` | `display:grid; grid-template-columns:repeat(auto-fill, minmax(min(<min>, 100%), 1fr)); gap:<gap>` | `min`, `fill` (`auto-fill`/`auto-fit`), `gap` |
| `split({ side, main })` | Intrinsic wrapping sidebar: container `display:flex; flex-wrap:wrap; gap`; side `flex-basis:<sideWidth>; flex-grow:1`; main `flex-basis:0; flex-grow:999; min-inline-size:<mainMin>` | `side` / `main` region names, `sideWidth`, `mainMin`, `position` (`start`/`end`) |

| Default | Neutral (core) | Mote (`@mote/components/layout`) |
| --- | --- | --- |
| `gap` | `1rem` | `var(--mote-layout-gap)` |
| `autoGrid.min` | `16rem` | `var(--mote-layout-item-min)` → resolved at token level, see note |
| `split.sideWidth` | `16rem` | `var(--mote-layout-sidebar-width)` |
| `split.mainMin` | `50%` | `var(--mote-layout-main-min)` |

Note: `min()` inside `minmax()` accepts `var()` values, so item minimums can remain theme-responsive.

- Item rules that target children emit both `> *` and `> ::slotted(*)` so slotted content participates (§5).
- `minmax(0, 1fr)` and `min(<min>, 100%)` prevent overflow from long content; `min-inline-size: 0` on flex regions lets them shrink.
- Helpers never set typography, colour, or target sizes.

## 4. Regions, composition, and precedence

### Region mapping
| Render root | Default mapping | Rationale |
| --- | --- | --- |
| Shadow DOM | Class selector `.{region}` (`.content`) | Shadow scoping prevents collisions; static class strings keep templates readable |
| Light DOM | Scoped class `.{scope}__{region}` with required `scope` option | Light DOM is not encapsulated |
| Public part | Opt-in `parts: ['content']` → recipe metadata records it; the template writes `part="content"` | Parts are a public API and stay deliberate |

In development, after `mounted`, a check reports declared regions missing from the render root and declared public parts without a matching `part` attribute.

### Cascade order
Recipe CSS is emitted into cascade layers inside the element's stylesheet:

```
@layer recipe.base, recipe.variant, recipe.condition;
```

- Base → variants → conditions, in that order. Within a layer, declaration order follows the definition.
- Recipe layers organize styles within their encapsulation context. Among normal author stylesheet rules in the same context — across stylesheets, not only the same file — unlayered declarations outrank layered declarations, so a component author's ordinary CSS overrides recipe defaults.
- Recipes emitted inside a component's shadow root remain encapsulated. Ordinary page selectors cannot target private shadow elements. Consumers customize through documented role/token custom properties, component variables, exposed `::part` selectors, and host styles. Normal CSS inheritance also applies, subject to declarations inside the component. Exposed parts are an explicit styling interface, not unrestricted access to internal markup.
- Recipes emitted into the light DOM participate in the page's cascade, where normal unlayered author rules can override layered recipe defaults.
- When outer and inner rules can both target the host or an exposed part, normal outer-context declarations take precedence and important inner-context declarations take precedence; this is resolved before layer ordering.
- These guarantees concern normal declarations. `!important` reverses layer precedence and follows different cross-context precedence.
- Selectors are flattened with `:where()` so every recipe rule has the specificity of one class (0,1,0); variant host selectors use `:host(:where([align="end"]))`.
- Layer names use a configurable prefix (default `recipe`) so multiple recipes in one root share layers predictably.

### Extending without duplication
```ts
export const compactSideNav = sideNav.extend({
  regions: { footer: row({ justify: 'end', wrap: false }) },
});
```
`extend` returns a new immutable recipe. Region declarations merge per property (later wins); unspecified regions, variants, and conditions are inherited. The original recipe's `styles` object is never mutated, so other components sharing it are unaffected.

### Diagnostics
| Code | When |
| --- | --- |
| `recipe.region.unknown` | A variant, condition, or `extend` names a region that does not exist |
| `recipe.helper.conflict` | One region combines helpers that set conflicting `display`/direction |
| `recipe.condition.unknown` | A named condition is not in the supplied conditions map |
| `recipe.container.missing` | A container condition is used but the recipe declares no container and none is named |
| `recipe.container.self` | A condition targets a region that *is* the queried container (§5) |
| `recipe.profile.unknown` | A condition applies an unknown profile |
| `recipe.render.definition` | `defineLayoutRecipe` called during render |
| `recipe.override.shadowed` | (dev inspect) a variant/condition declaration is always overridden by unlayered CSS |

Every diagnostic includes the recipe name, region, layer, and property.

## 5. Container-responsive composition

| Rule | Consequence for recipes |
| --- | --- |
| A container query styles eligible **descendants** of the container, never the container itself | `container.selector: ':host'` lets inner regions respond to the host's size; a region cannot respond to its own size. `recipe.container.self` catches it. |
| Containment on the host | Recommended for components that adapt internally. Requires a block-level host (`:host { display: block }`), which the recipe emits when it declares a host container. |
| Slotted content | Participates in the flattened tree for layout (flex/grid items, container ancestry) but selector encapsulation still applies: style it with `::slotted()` only at the top level. |
| Child shadow roots | Parents cannot style a nested component's internals. Influence them through inherited roles (§6), the child's documented custom properties, or its public parts. |
| Container-relative units (`cqi`, `cqb`, …) | Resolve against the nearest eligible container ancestor, not a named one. Recipes do not assume a unit refers to a specific named container. |
| Size containment affects intrinsic sizing | `inline-size` containment makes the element ignore its content for inline sizing; in shrink-to-fit contexts it can collapse. Primitives (button, badge, icon, input) never declare containers by default. |
| `rem`/`em` in queries | In container query conditions, relative units resolve against the query container's computed values (`em` = container font size, `rem` = root font size); in media queries, `em`/`rem` use the initial (user-default) font size. Documented next to every condition and verified in browsers. |

**Prefer intrinsic layouts** (`autoGrid`, wrapping `row`, `split`) and add explicit conditions only when a composition needs a real transition (e.g. a navigation that changes from one column to three).

**Not adopted:** broad helpers such as `containerScale(container, button)`. Their effect on a nested component is ambiguous unless backed by explicit role contracts; profiles (§6) are that contract.

## 6. Roles, conditions, and profiles in recipes

Defined in [theming-and-styling.md](./theming-and-styling.md) §11. Recipes consume them like this:

- Gaps, insets, and minimum sizes default to **semantic layout roles** (`layout.gap`, `layout.inset`, …).
- `when` keys are **named conditions** (`navigation.expanded`) resolved to literal query strings at definition time.
- `profile` inside a condition re-declares that profile's role overrides **on the region element** inside the query. Roles inherit to descendants, including slotted content and nested custom elements' shadow trees. Declaring on the region (not `:host`) is required because the host cannot respond to its own container size.
- Arrangement choices (column counts, justification) stay in the recipe; they become tokens only when shared across products.

## 7. Two authoring paths

### Component authors
Native semantic elements + templates + recipes, as in §2. A recipe is enough when the wrapper adds no behavior.

### Page authors
Compose existing components and layout primitives with a few meaningful options, with or without JavaScript:

```html
<link rel="stylesheet" href="@mote/tokens/css/default.css">
<link rel="stylesheet" href="@mote/components/layout/layout.css">

<main class="mote-split" style="--mote-split-side-width: 18rem">
  <nav class="mote-stack">…</nav>
  <section class="mote-auto-grid">
    <mote-card>…</mote-card>
    <article class="card-like">…</article>
  </section>
</main>
```

```css
/* Ordinary CSS using the same roles */
.card-like { padding: var(--mote-layout-inset); gap: var(--mote-layout-gap); }
```

- `layout.css` is generated from the same helpers and Mote defaults; classes expose override custom properties (`--mote-stack-gap`, `--mote-split-side-width`, …).
- **Custom element or native element + recipe?** Use a custom element when it adds behavior, managed semantics/ARIA, keyboard handling, an attribute/property API that frameworks need, or establishes a container contract (`mote-theme-scope`, `mote-scroll-region`, `mote-container`). Use a native element with a recipe class when the wrapper would only apply layout (`stack`, `row`, `grid`, `autoGrid`, `split`). The final list of layout elements is decided in M10 from this rule.
- The same token contracts appear in native elements, custom components, and ordinary CSS; docs examples show all three side by side.

## 8. Metadata

- `recipe.styles` is the only runtime artifact a component needs. Rich metadata is never bundled into element modules.
- `@mote/core/layout/inspect` (`describeRecipe(recipe)`) returns regions, helpers, variants, conditions, parts, containers, and layer order — DOM-free.
- `@mote/analyzer` statically extracts recipe contracts (regions, helpers, variants, conditions, profiles, parts) into `mote.metadata.json` ([metadata-and-analyzer.md](./metadata-and-analyzer.md)) so Workbench, docs, and `@mote/agent` read them without loading browser modules. Recipes using dynamic definitions are diagnosed and can supply explicit metadata.
- *(Planned.)* The agent kit's recipe references and the `getRecipe` operation are rendered from this extracted contract plus authored guidance (regions, variants, conditions, responsive expectations); nothing about a recipe is inferred beyond it ([agent-tooling.md](./agent-tooling.md) §5, §8).

## 9. Optional build-time extraction

Recipe modules are DOM-free, so Node tooling can import them and write `.css` files with identical output (`mote-layout extract <module> --out <dir>`, exposed from the components package's Node tooling). Extraction is optional; direct runtime authoring and extracted CSS must produce byte-identical rule text (contract test).

## 10. Side-navigation prototype (acceptance fixture)

Location: `examples/side-nav/` (handwritten CSS version and recipe version side by side).

- [ ] Renders simultaneously in a narrow and a wide container on one page
- [ ] Uses named and default slots and nested custom elements (`mote-link`/`mote-button`, a nested component with its own shadow root)
- [ ] Responsive layout works with no JavaScript resize handling (no `ResizeObserver`, no re-render)
- [ ] Nested themes, products, density, and profiles; role inheritance into slotted content and nested shadow roots
- [ ] Overrides via `extend` and unlayered CSS never mutate the shared recipe stylesheet
- [ ] Handwritten CSS and recipe-generated versions are computed-style-equivalent across widths
- [ ] Keyboard behavior, focus visibility/order, 200%/400% zoom, wrapping, overflow, narrow reflow
- [ ] Minimal consumers exclude unused recipe catalogs and `@mote/agent`
- [ ] Checks are scripted so an agent-generated version runs the same suite (M11)
- [ ] Data-driven navigation (`.items`), declarative, and hybrid variants covered by [data-composition.md §10](./data-composition.md)

## 11. Behaviors settled in the M3 implementation

- **API.** `defineLayoutRecipe({ name?, container?, regions, variants?, when?, conditions?, profiles?, scope?, parts?, layer? })`. `when` keys are names from `conditions` (e.g. entries of `@mote/tokens/conditions`, which have `{ kind, query }`) or inline `'@container …'` / `'@media …'` strings. `profiles` maps a profile name to custom-property declarations; a condition's `profile` re-declares them on the recipe's **root region** (the first region), never on `:host`.
- **Containers.** `container: { region? | selector?, name?, type? }` (default selector `:host` in shadow DOM, `.{scope}` in light DOM; default type `inline-size`). A `:host` container also gets `display: block`. `recipe.container.self` applies when the container is a region and a condition targeting that container styles the same region.
- **Specificity.** Base and condition rules use one class (0,1,0); variant rules are `:host(:where([attr="v"])) .region` (0,2,0) or `:where(.scope[attr="v"]) .scope__region` (0,1,0). Specificity only orders rules within a layer; unlayered component CSS outranks every layer.
- **Smaller variant and condition rules.** Later layers emit only declarations that differ from the base region, which leaves the cascade result unchanged.
- **`split`.** `split({ side, main, sideWidth?, mainMin?, gap? })` sizes two named regions inside the split region. There is no `position` option: reordering visually would separate visual order from DOM and focus order, so DOM order decides.
- **Helper conflicts.** A region given an array of helpers that set different `display` or `flex-direction` reports `recipe.helper.conflict`. A variant, condition, or `extend` replacing a region's helper merges per property instead.
- **Values.** Helper and profile values are trusted module code but are still validated (`recipe.value.invalid` for `;`, braces, angle brackets, backslashes, or comments).
- **Render-time definitions** report `recipe.render.definition` (not thrown). `checkRecipeRegions(recipe, root)` returns missing regions and parts; automatic post-`mounted` checks are left to M4 dev tooling.