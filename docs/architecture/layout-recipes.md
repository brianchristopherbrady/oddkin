# Layout recipes and container-responsive composition

Status: the unbranded mechanism (§2–§5, §8 `describeRecipe`) is **implemented** in `@oddkin/core/layout` and `@oddkin/core/layout/inspect` (M3) and verified in three engines; §11 lists behaviors settled in implementation. The Oddkin-bound helpers, `defineLayoutRecipe`, `condition()`, and `layout.css` (§3, §7) are **implemented** in `@oddkin/components/layout` (M4, §12). The side-nav fixture (§10) and build-time extraction for component recipes (§9) are implemented (M4); the application extraction CLI is later work. These APIs reach candidate v1 status at the M8 compatibility checkpoint. Catalog expansion depends on passing the relevant foundation acceptance criteria. Breaking changes after M8 require an ADR, migration plan, and renewed verification. Final v1 contracts freeze at M12 after the shipped feature set passes release verification.

## 1. Purpose and boundaries

A **layout recipe** describes named regions, reusable arrangements, responsive conditions, variants, and their styling contract. A **template** describes content, semantics, slots, events, and dynamic structure. Recipes reduce repeated layout CSS without becoming a second language that renames every CSS property: anything a helper does not cover is written as ordinary CSS.

| Layer | Owns | Package |
| --- | --- | --- |
| Generic recipe mechanism | `defineLayoutRecipe`, `stack`, `row`, `grid`, `autoGrid`, `split`, `createLayoutHelpers`, region/variant/condition composition, diagnostics, CSS generation | `@oddkin/core/layout` (unbranded, DOM-free) |
| Oddkin defaults and presets | Helpers pre-bound to Oddkin layout roles and named conditions; reusable recipes (e.g. side navigation); CSS utility classes for page authors | `@oddkin/components/layout` |
| Roles, conditions, profiles | Token categories, thresholds, profile role sets | `@oddkin/tokens` (independent; no knowledge of recipes) |
| Recipe metadata | Regions, variants, conditions, parts, precedence | `@oddkin/core/layout/inspect` + generated Oddkin metadata (§8) |

Core never references `--odd-*` names, Oddkin conditions, or presets. Tokens never import core or components.

## 2. Proposed API

```ts
// side-nav.recipe.ts — module scope, DOM-free
import { defineLayoutRecipe, stack, row, grid } from '@oddkin/components/layout';

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
import { OddkinElement, html } from '@oddkin/core';
import { sideNav } from './side-nav.recipe.js';

class DemoSideNav extends OddkinElement {
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

- `defineLayoutRecipe` from `@oddkin/core/layout` takes the same shape but requires conditions to be supplied (`conditions: { … }`) or written inline as structured queries; the Oddkin-bound version resolves names from `@oddkin/tokens/conditions`.
- Recipes are evaluated once at module scope and produce an `OddkinStyles` object (ordinary CSS text). Calling `defineLayoutRecipe` during a render emits a dev diagnostic.
- Responsive behavior is pure CSS (container/media queries and intrinsic sizing). No `ResizeObserver`, reactive state, or re-render is involved.
- No build transform is required. Optional extraction (§9) emits equivalent `.css`.

## 3. Helpers and explicit defaults

All helpers use logical properties. `<gap>` and other defaults come from the helper factory: core's neutral factory uses plain lengths; `@oddkin/components/layout` binds them to Oddkin layout roles.

| Helper | Generated CSS (defaults) | Options |
| --- | --- | --- |
| `stack()` | `display:flex; flex-direction:column; gap:<gap>; min-inline-size:0` | `gap`, `align` |
| `row()` | `display:flex; flex-direction:row; align-items:center; gap:<gap>; flex-wrap:nowrap; min-inline-size:0` | `gap`, `align`, `justify`, `wrap` |
| `grid({ columns })` | `display:grid; grid-template-columns:repeat(n, minmax(0, 1fr)); gap:<gap>` | `columns`, `gap`, `rowGap`, `align` |
| `autoGrid({ min })` | `display:grid; grid-template-columns:repeat(auto-fill, minmax(min(<min>, 100%), 1fr)); gap:<gap>` | `min`, `fill` (`auto-fill`/`auto-fit`), `gap` |
| `split({ side, main })` | Intrinsic wrapping sidebar: container `display:flex; flex-wrap:wrap; gap`; side `flex-basis:<sideWidth>; flex-grow:1`; main `flex-basis:0; flex-grow:999; min-inline-size:<mainMin>` | `side` / `main` region names, `sideWidth`, `mainMin`, `position` (`start`/`end`) |

| Default | Neutral (core) | Oddkin (`@oddkin/components/layout`) |
| --- | --- | --- |
| `gap` | `1rem` | `var(--odd-layout-gap)` |
| `autoGrid.min` | `16rem` | `var(--odd-layout-item-min)` → resolved at token level, see note |
| `split.sideWidth` | `16rem` | `var(--odd-layout-sidebar-width)` |
| `split.mainMin` | `50%` | `var(--odd-layout-main-min)` |

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
- Page-author recipes from `@oddkin/components/layout` (implemented, §12) use the prefix `odd.layout`, so their layers (`odd.layout.base`, `odd.layout.variant`, `odd.layout.condition`) nest under the canonical document order `odd.reset, odd.tokens, odd.base, odd.layout, odd.components, odd.utilities` and stay below unlayered application CSS ([ADR 0039](./decisions/0039-cascade-layer-order.md), [css-architecture.md](./css-architecture.md) §5). Core's neutral default stays `recipe`.

### Extending without duplication
```ts
export const compactSideNav = sideNav.extend({
  regions: { footer: row({ justify: 'end', wrap: false }) },
});
```
`extend` returns a new immutable recipe. Region declarations merge per property (later wins); unspecified regions, variants, and conditions are inherited. The original recipe's `styles` object is never mutated, so other components sharing it are unaffected.

Product visual recipes use the same `extend()` mechanism. A recipe's region layout is structural and belongs with a component's structural styles; product-specific spacing and presentation are visual ([multi-product.md](./multi-product.md) §4, §6).

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
| Container names are not encapsulated | A named container declared inside a shadow tree is found by a page query of that name when the page styles slotted content (Chromium, Firefox, WebKit). Internal container names are therefore public: namespace them, or name only the host (as Oddkin recipes do; the host is in the page tree anyway). |
| Nearest vs named | An unnamed query uses the nearest container ancestor; a named query skips nearer containers to the nearest one with that name. Slotted content's nearest container is in the flat tree, so a region inside the shadow tree counts. |

*(Verified M4 on plain shadow roots in `packages/core/test/container-contract.browser.test.ts`, three engines: a container never matches its own query; inline-size containment gives shrink-to-fit and absolutely positioned boxes zero width; slotted content resolves both page queries and `::slotted()` queries against a region inside the shadow tree; container names are not encapsulated; nearest vs named selection; `::slotted()` matches only top-level slotted elements; `::part()` reaches declared parts only, not their descendants, attributes, or nested parts unless forwarded with `exportparts`; page selectors never match private shadow markup; inherited roles reach shadow internals, slotted content, and nested shadow roots, with the nearest declaration winning.)*

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
<link rel="stylesheet" href="@oddkin/tokens/css/default.css">
<link rel="stylesheet" href="@oddkin/components/css/layout.css">

<main class="odd-split" style="--odd-split-side-width: 18rem">
  <nav class="odd-stack">…</nav>
  <section class="odd-auto-grid">
    <odd-card>…</odd-card>
    <article class="card-like">…</article>
  </section>
</main>
```

```css
/* Ordinary CSS using the same roles */
.card-like { padding: var(--odd-layout-inset); gap: var(--odd-layout-gap); }
```

- `layout.css` is generated from the same helpers and Oddkin defaults; classes expose override custom properties (`--odd-stack-gap`, `--odd-split-side-width`, …); §12 lists them.
- **Custom element or native element + recipe?** Use a custom element when it adds behavior, managed semantics/ARIA, keyboard handling, an attribute/property API that frameworks need, or establishes a container contract (`odd-theme-scope`, `odd-scroll-region`, `odd-container`). Use a native element with a recipe class when the wrapper would only apply layout (`stack`, `row`, `grid`, `autoGrid`, `split`). The final list of layout elements is decided in M10 from this rule.
- The same token contracts appear in native elements, custom components, and ordinary CSS; docs examples show all three side by side.

## 8. Metadata

- `recipe.styles` is the only runtime artifact a component needs. Rich metadata is never bundled into element modules.
- `@oddkin/core/layout/inspect` (`describeRecipe(recipe)`) returns regions, helpers, variants, conditions, parts, containers, and layer order — DOM-free.
- `@oddkin/analyzer` statically extracts recipe contracts (regions, helpers, variants, conditions, profiles, parts) into `oddkin.metadata.json` ([metadata-and-analyzer.md](./metadata-and-analyzer.md)) so Workbench, docs, and `@oddkin/agent` read them without loading browser modules. Recipes using dynamic definitions are diagnosed and can supply explicit metadata.
- *(Planned.)* The agent kit's recipe references and the `getRecipe` operation are rendered from this extracted contract plus authored guidance (regions, variants, conditions, responsive expectations); nothing about a recipe is inferred beyond it ([agent-tooling.md](./agent-tooling.md) §5, §8).
- *(Planned.)* Explanations and impact reports use recipe → region/condition/profile edges from this contract. A condition is reported as **active** only when reliably observed (`matchMedia` for media queries; container conditions only through instrumentation verified in three engines), never by emulating responsiveness in JavaScript ([change-impact-and-verification.md](./change-impact-and-verification.md) §4.1).

## 9. Optional build-time extraction

Recipe modules are DOM-free, so Node tooling can import them and write `.css` files with identical output (`oddkin-layout extract <module> --out <dir>`, exposed from the components package's Node tooling). Extraction is optional; direct runtime authoring and extracted CSS must produce byte-identical rule text (contract test).

**Implemented for `@oddkin/components` (M4).** Each component recipe has a generated sibling module (`side-nav.recipe.styles.ts` exports `sideNavRecipeStyles` as one `unsafeCSS` string). The element definition uses the extracted module, so the element bundle does not contain the recipe engine (side-nav: 17,935 → 14,517 B gzip). `packages/components/test/recipes.test.ts` is the contract test: it fails when an extracted module differs byte for byte from `recipe.cssText`, and `UPDATE_FIXTURES=1` rewrites it. The recipe itself is exported from the opt-in `@oddkin/components/side-nav/recipe` for `describeRecipe`, `extend()`, and metadata; `@oddkin/components/side-nav` does not load it. The `oddkin-layout extract` command for applications is not built yet.

## 10. Side-navigation prototype (acceptance fixture)

Location: `examples/side-nav/` (handwritten CSS version and recipe version side by side). Implemented in M4: `odd-side-nav` with `sideNavRecipe` (one column; three columns from `40rem` of its own inline size), `examples/side-nav/` under a strict CSP, `packages/components/test/side-nav.browser.test.ts` and `e2e/side-nav.spec.ts` in three engines.

- [x] Renders simultaneously in a narrow and a wide container on one page
- [x] Uses named and default slots and nested custom elements (`odd-link`/`odd-button`, a nested component with its own shadow root) *(an `odd-button` in the footer slot renders, is focusable, and shows its slotted label)*
- [x] Responsive layout works with no JavaScript resize handling (no `ResizeObserver`, no re-render) *(the browser test spies on `ResizeObserver` and records zero DOM mutations in or on the element across width changes)*
- [x] Nested themes, products, density, and profiles; role inheritance into slotted content and nested shadow roots *(dark mode and `navigation.compact` scopes; roles read through the shadow boundary; a role set on the page reaches the slotted `odd-button`'s own shadow root; under a generated theme, `data-odd-product` changes the current-page marker, `data-odd-density="compact"` reduces the entry padding, both combine, and the innermost scope wins (`side-nav.scopes.browser.test.ts`))*
- [x] Overrides via `extend` and unlayered CSS never mutate the shared recipe stylesheet *(`extend()` leaves `sideNavRecipe.cssText` unchanged; a host role and an unlayered `::part()` rule change one instance only; the shared adopted sheets' rules are identical before and after)*
- [x] Handwritten CSS and recipe-generated versions are computed-style-equivalent across widths *(11 properties at 12, 24, 36, 44, and 56rem)*
- [x] Keyboard behavior, focus visibility/order, 200%/400% zoom, wrapping, overflow, narrow reflow *(keyboard, focus ring, 200% text, and 320 CSS px reflow verified; 400% zoom of a 1,280 px window is 320 CSS px, the equivalence WCAG 1.4.10 uses)*
- [x] Minimal consumers exclude unused recipe catalogs and `@oddkin/agent` *(import-graph test: the registration entry loads no layout engine, `@oddkin/core/model`, or schema emitter; the foundation loads only four core subpaths)*
- [ ] Checks are scripted so an agent-generated version runs the same suite (M11)
- [x] Data-driven navigation (`.items`), declarative, and hybrid variants covered by [data-composition.md §10](./data-composition.md)

## 11. Behaviors settled in the M3 implementation

- **API.** `defineLayoutRecipe({ name?, container?, regions, variants?, when?, conditions?, profiles?, scope?, parts?, layer? })`. `when` keys are names from `conditions` (e.g. entries of `@oddkin/tokens/conditions`, which have `{ kind, query }`) or inline `'@container …'` / `'@media …'` strings. `profiles` maps a profile name to custom-property declarations; a condition's `profile` re-declares them on the recipe's **root region** (the first region), never on `:host`.
- **Containers.** `container: { region? | selector?, name?, type? }` (default selector `:host` in shadow DOM, `.{scope}` in light DOM; default type `inline-size`). A `:host` container also gets `display: block`. `recipe.container.self` applies when the container is a region and a condition targeting that container styles the same region.
- **Specificity.** Base and condition rules use one class (0,1,0); variant rules are `:host(:where([attr="v"])) .region` (0,2,0) or `:where(.scope[attr="v"]) .scope__region` (0,1,0). Specificity only orders rules within a layer; unlayered component CSS outranks every layer.
- **Smaller variant and condition rules.** Later layers emit only declarations that differ from the base region, which leaves the cascade result unchanged.
- **`split`.** `split({ side, main, sideWidth?, mainMin?, gap? })` sizes two named regions inside the split region. There is no `position` option: reordering visually would separate visual order from DOM and focus order, so DOM order decides.
- **Helper conflicts.** A region given an array of helpers that set different `display` or `flex-direction` reports `recipe.helper.conflict`. A variant, condition, or `extend` replacing a region's helper merges per property instead.
- **Values.** Helper and profile values are trusted module code but are still validated (`recipe.value.invalid` for `;`, braces, angle brackets, backslashes, or comments).
- **Render-time definitions** report `recipe.render.definition` (not thrown). `checkRecipeRegions(recipe, root)` returns missing regions and parts; automatic post-`mounted` checks are left to M4 dev tooling.
- **Layer prefixes** may be dotted (`odd.layout`), so recipe layers nest under a document layer; each segment is a lowercase identifier (`recipe.layer.invalid` otherwise).
- **New condition inputs in `extend()`** (M4) re-resolve the queries of inherited conditions, named or inline, without restating `when`; inputs for conditions the recipe does not use change nothing.

## 12. Oddkin-bound layout (`@oddkin/components/layout`, implemented, M4)

Verified in `packages/components/test/layout.test.ts` (Node) and `layout.browser.test.ts` (three engines); DOM-free import checked by the boundary tool.

| Export | Contract |
| --- | --- |
| `stack`, `row`, `grid`, `autoGrid`, `split`, `declarations` | Core helpers created with `LAYOUT_DEFAULTS`: `gap` = `layout.gap`, `itemMin` = `layout.item-min`, `sideWidth` = `layout.sidebar-width`, `mainMin` = `layout.main-min`, as `var()` references, so themes, density, and profiles reach every recipe |
| `defineLayoutRecipe(definition)` | Core `defineLayoutRecipe` with the default theme's named conditions available in `when` (caller `conditions` win on name clashes) and the `odd.layout` layer prefix unless `layer` is given |
| `condition(name)` | The at-rule of a named condition as a `CSSResult`, for component styles: ``css`${condition('page.wide')} { … }` `` |
| `./css/layout.css` | Page-author classes in `@layer odd.layout`, preceded by the canonical layer order |

| Class | Arrangement | Override properties (default) |
| --- | --- | --- |
| `.odd-stack` | Column, `min-inline-size: 0`; `.odd-stack-tight` and `.odd-stack-loose` use `space.xs` and `space.lg` | `--odd-stack-gap` (`layout.gap`) |
| `.odd-row` | Row, centred, no wrapping; `.odd-row-between` spreads the children | `--odd-row-gap` |
| `.odd-cluster` | Row that wraps | `--odd-cluster-gap` |
| `.odd-grid` | Equal columns, `minmax(0, 1fr)` | `--odd-grid-columns` (`2`), `--odd-grid-gap` |
| `.odd-auto-grid` | As many columns as fit, `min(item-min, 100%)`; `.odd-auto-grid-fit` lets a few items stretch across the row (`auto-fit`) | `--odd-auto-grid-min` (`layout.item-min`), `--odd-auto-grid-gap` |
| `.odd-split` | Two children in DOM order: the first is the side, the last takes the rest and wraps below its minimum, which is capped at the container (`min(main minimum, 100%)`), so a split narrower than it stacks without overflowing; `.odd-split-end` puts the side after the main content (the first child is the main content) | `--odd-split-side-width` (`layout.sidebar-width`), `--odd-split-main-min` (`layout.main-min`), `--odd-split-gap` |
| `.odd-box` | Inset wrapper, `min-inline-size: 0`; `.odd-box-none` and `.odd-box-roomy` use `space.none` and `space.xl` | `--odd-box-inset` (`layout.inset`) |
| `.odd-center` | Grid that centres its content on both axes | — |
| `.odd-aspect-ratio` | Locked ratio whatever the content; children share one cell (a caption over media); `img`, `video`, `iframe`, `canvas`, `svg` fill it | `--odd-aspect-ratio` (`16 / 9`; Figma's `4 / 3` and `1 / 1`) |

All classes have one-class specificity inside `odd.layout`, so any unlayered page rule overrides them. The modifiers are Figma's `Oddkin/Layout/*` variants (section 457:2078): presets that set the token itself and come after the class they modify, so an ancestor's override property never changes them; a one-off value uses the override property instead. Figma's `Split` arrangements and `Grid` columns are not classes: the split wraps by itself, and `--odd-grid-columns` takes any count. Figma parity per family at 320, 640, and 960 px: `packages/components/test/figma-parity.layout.browser.test.ts`. Budget: `components:layout` 704 B gzip (666 measured on 2026-10-26; 660 before the main minimum's cap).

## 13. Preset catalog (M10)

Decided from demonstrated needs: a preset ships only where real consumers already make the same layout decision (component-catalog.md §6: a shared home when a second real consumer needs the same decision); a decision only one consumer makes stays its own CSS.

| Need | Consumers that make the decision today | Preset |
| --- | --- | --- |
| Side navigation | `odd-side-nav` | `recipe:side-nav` (§10) |
| Page shell: a side column beside the main content that stacks when narrow | `apps/docs` `.site-layout`, `examples/ai-research` `.app`, `examples/ai-writing` `.app` (side after the main content), Workbench's shell (contents after the body) | `.odd-split`, and `.odd-split-end` for a side after the main content; the page flow and header from `.odd-stack` and `.odd-row-between`. Intrinsic: no media or container query. No JavaScript recipe: no consumer renders a page shell in a shadow root except Workbench, whose container-query shell is its own, and the composition schema's `"recipe": "page-shell"` (data-composition.md §8) waits for the M8 go |
| Card grid: as many columns as fit, a few cards across the whole row | `apps/docs` `.card-grid`, `examples/ai-agent` `.grid`, `examples/css-gallery` `.controls` (each `auto-fit` with its own minimum) | `.odd-auto-grid odd-auto-grid-fit` with `--odd-auto-grid-min` |
| Toolbar: a row of actions that wraps, or spreads to both ends | `examples/ai-agent` `.toolbar`, `examples/ai-research` `.buttons`, `examples/css-gallery` `.actions`; `apps/docs` `.site-header` | `.odd-cluster` and `.odd-row-between`; `odd-toolbar` when the row is an ARIA toolbar (one tab stop, arrow keys) |

The consumers above still write these layouts by hand; moving them to the classes is follow-up work for their owners. Checked by `packages/components/test/layout.browser.test.ts` (the side after the main content, wide and stacked; a few items across the row) and `layout.test.ts`, in three engines.

## 14. Layout in shadow roots (M10 audit, 2026-10-26)

**Rule.** An element's shadow root uses a layout helper where its arrangement is the decision a page makes with a primitive: children in a column (`stack`), in one row (`row`), in a row that wraps (`row({ wrap: true })`, the cluster), equal columns (`grid`), as many columns as fit (`autoGrid`), or a side beside the main content (`split`), spaced by one gap token. It keeps its own CSS where the arrangement is component geometry:

| Geometry | What it is | Examples |
| --- | --- | --- |
| Inline box | The element's own box centring its glyph and label | button, chip, badge, tab, pagination tile |
| Centred box | A glyph or image centred in a fixed box | avatar, chip remove, control indicator, star |
| Control box | A control and its adornments sharing one cell; chips that wrap around an input | field `.control-box`, combobox `.box`, picker trigger |
| Roving row | Rows and lists of a composite widget whose keyboard model follows their order and axis | option row, navigation row, tab list, rating stars |
| Track | Children that share one track | slider, segmented control, split panel |
| Cell grid | Named or sized columns | toast, progress, one-time code, usage meter entry |
| Anchored surface | A popup or dialog shown as a column only while open; lists whose rows are flush | picker popup, dialog, command palette, listbox |

**How an element uses a helper.** As `odd-side-nav` does (§9, §10): `<name>.recipe.ts` defines the arrangement with `defineLayoutRecipe({ name, regions })` from `@oddkin/components/layout`, one region per class it arranges (a region named `footer` styles `.footer`), with the gap token the element used (`row({ gap: token('space.sm'), wrap: true })`); `recipes.test.ts` extracts it into `<name>.recipe.styles.ts` (`UPDATE_FIXTURES=1`), which the definition lists before the element's structural sheet; the hand-written `display`, direction, wrapping, alignment, and gap leave the structural and visual sheets. The extracted rules sit in `@layer odd.layout.base`, so the element's unlayered rules still win where they differ, and `hidden` still hides (host styles' `!important`). A helper that cannot express a common decision is extended in `@oddkin/core/layout`, not worked around.

**Audit.** Every `display: flex`, `inline-flex`, `grid`, or `inline-grid` in `packages/components/src` (129 rules in 51 files; the generated side-nav sheet holds five of them) and `packages/ai/src` (69 in 24 files), each rule classified by its declarations and the element's behaviour. Not element arrangements, so not counted as either class: the light-DOM recipes in `src/css` (page classes, §13), the generated side-nav sheet (already helpers), and one example's page CSS.

| Class | Rules |
| --- | --- |
| Same decision as a primitive | 97 (`stack` 51, `row` 45, `autoGrid` 1) |
| Component geometry | 83 |
| Not counted (src/css recipes, generated sheet, example) | 18 |

Lanes (the owner converts its own candidates with its tests and parity unchanged): Agent 1 form controls 5 (converted 2026-10-26: `checkbox-group.recipe.ts` with its horizontal variant, `radio-group.recipe.ts`, `rating.recipe.ts`, `slider.recipe.ts`, and the new odd-color-picker's popup in `color-picker.recipe.ts`; the slider's label row needs no `justify`, as its output keeps to the end with an auto margin. Kept: `.field` in `field.structural.styles.ts`, which is also the source of the published light-DOM `css/field.css` recipe in `@layer odd.components`, so a shadow recipe would move the layout of every form control and of that recipe into the `odd.layout` layers. Tests and parity unchanged in three engines, with new layout tests; `components:slider` 807 B and `components:color-picker` 1,689 B gzip, budgets 832 and 1,728), Agent 2 overlays, navigation, file input, and every `@oddkin/ai` element 74, Agent 3 collections and layout 8 (converted 2026-10-26: `listbox.recipe.ts`, `tree.recipe.ts`, `command-palette.recipe.ts`, `scroll-region.recipe.ts`, and a `group-items` region in `side-nav.recipe.ts`; each extracted sheet opens the element's structural sheet, so odd-combobox and odd-picker, which compose the listbox and tree sheets, get the same rules; browser tests and Figma parity unchanged in three engines; `components:listbox` 663 B and `components:scroll-region` 266 B gzip, budgets 704 and 288, as each recipe brings its layer order), Agent 4 display, odd-combobox, and odd-picker 10.

| File | Lane | Same decision as a primitive | Component geometry |
|---|---|---|---|
| components/alert/alert.structural.styles.ts | Agent 4 | `.alert` row({ gap: space.sm, align: 'start', wrap: true }); `.end` row({ gap: space.xs, wrap: true }) | `.marker`: inline box: glyph and label inside the element box |
| components/avatar/avatar.structural.styles.ts | Agent 4 | — | `.avatar`: centred box: centres a glyph or image |
| components/badge/badge.structural.styles.ts | Agent 4 | — | `.badge`, `.marker`: inline box: glyph and label inside the element box |
| components/breadcrumbs/breadcrumbs.structural.styles.ts | Agent 2 | `.list` row({ gap: space.sm, wrap: true }) | `.item`, `.link, .current, .more`, `.separator`: inline box: glyph and label inside the element box |
| components/button/button.native.styles.ts | Agent 1 | — | `.odd-button`: inline box: glyph and label inside the element box |
| components/button/button.structural.styles.ts | Agent 1 | — | `button`, `.label`: inline box: glyph and label inside the element box |
| components/calendar/calendar.structural.styles.ts | Agent 2 | `.calendar` stack({ gap: space.sm }); `.header, .actions` row({ gap: space.xs }) | — |
| components/card/card.structural.styles.ts | Agent 4 | `.card` stack({ gap: space.sm }) | — |
| components/checkbox-group/checkbox-group.structural.styles.ts | Agent 1 | `.options` stack({ gap: space.lg, align: 'start' }) | — |
| components/chip/chip.structural.styles.ts | Agent 4 | — | `.chip`: inline box: glyph and label inside the element box; `.remove`: centred box: centres a glyph inside the element box |
| components/combobox/combobox.structural.styles.ts | Agent 4 | `.chips` row({ gap: control.gap, wrap: true }) | `.chevron`: inline box: glyph and label inside the element box; `.box`: control box: chips wrap around the input, which takes the rest of the line |
| components/command-palette/command-palette.structural.styles.ts | Agent 3 | `.search` row({ gap: space.sm }); `.state` row({ gap: space.sm }); `.footer` row({ gap: space.md, align: 'stretch', wrap: true }) | `.palette[open]`: anchored surface: the top-layer dialog shows as a column only while open; `.search-glyph`: inline box: glyph and label inside the element box; `.listbox, .group`: anchored surface: rows flush in the scrolling list (no gap) |
| components/copy-button/copy-button.structural.styles.ts | Agent 4 | — | `.base`: inline box: glyph and label inside the element box |
| components/css/index.ts | Agent 4 | — | `.odd-divider:not(hr)`, `.odd-list > li`, `.odd-avatar-group`, `.odd-description-list`, `.odd-description-list > div`, `@container odd-description-list (max`, `.odd-timeline`, `.odd-timeline > li`, `.odd-timeline > li > :last-child`, `.odd-stepper`, `.odd-stepper > li`, `.odd-stepper > li > :last-child`: light-DOM recipe (src/css), not a shadow root: page classes are layout-recipes.md §13 |
| components/date-picker/date-picker.structural.styles.ts | Agent 2 | — | `.button`: centred box: centres a glyph or image |
| components/dialog/dialog.structural.styles.ts | Agent 2 | `.header` row({ gap: space.sm, align: 'start' }); `.footer` row({ gap: space.sm, align: 'stretch', wrap: true, justify: 'end' }) | `.dialog[open]`: anchored surface: the modal shows as a column only while open |
| components/disclosure/disclosure.structural.styles.ts | Agent 2 | `.summary` row({ gap: space.sm }) | `.marker`: inline box: glyph and label inside the element box |
| components/empty-state/empty-state.structural.styles.ts | Agent 4 | `.empty` stack({ gap: space.sm, align: 'center' }); `.footer:not([hidden])` row({ gap: 0, align: 'stretch', wrap: true, justify: 'center' }) | `.media:not([hidden])`: centred box: centres a glyph or image |
| components/file-input/file-input.structural.styles.ts | Agent 2 | `.surface` stack({ gap: space.xs, align: 'start' }); `.header, .file` row({ gap: space.md }); `.files` stack({ gap: space.sm }); `.file-text` stack({ gap: 0 }) | `.header-glyph, .file-glyph`, `.remove`: inline box: glyph and label inside the element box |
| components/input/input.structural.styles.ts | Agent 1 | — | `.clear, .step`: centred box: centres a glyph or image; `.stepper`: control box: the decrement and increment buttons pinned to the end of the field |
| components/listbox/listbox.structural.styles.ts | Agent 3 | `.state` row({ gap: space.sm }) | `.surface, .listbox, .group`: anchored surface: rows flush in the scrolling list (no gap; rows draw their own spacing) |
| components/menu/menu.structural.styles.ts | Agent 3 | — | `.trigger-glyph`: inline box: glyph and label inside the element box |
| components/one-time-code/one-time-code.structural.styles.ts | Agent 1 | — | `.box`: cell grid: the input over the drawn cells, one shared cell; `.cells`: cell grid: one drawn cell per character of the input; `.cell`: cell grid: centres a character in its cell; `.status`: cell grid: the status line under the cells |
| components/pagination/pagination.structural.styles.ts | Agent 2 | `.pagination` row({ gap: space.sm, wrap: true, justify: 'space-between' }); `.list` row({ gap: space.xs, wrap: true }) | `.tile`, `.ellipsis`: inline box: glyph and label inside the element box |
| components/picker/picker.structural.styles.ts | Agent 4 | `.footer` row({ gap: space.xs }) | `.combobox`: control box: the trigger fills the field box and truncates its value; `.popup:popover-open`: anchored surface: the popover shows as a column only while open |
| components/popover/popover.structural.styles.ts | Agent 2 | — | `.popover`: anchored surface: content beside the close button in the popover |
| components/progress/progress.structural.styles.ts | Agent 4 | `.head` row({ gap: 0, align: 'baseline', justify: 'space-between' }) | `.progress`: cell grid: label, value, and track in named cells |
| components/radio-group/radio-group.structural.styles.ts | Agent 1 | `.options, .group` stack({ gap: inherit, align: 'start' }) | — |
| components/rating/rating.structural.styles.ts | Agent 1 | `.row` row({ gap: space.sm, wrap: true }) | `.stars`: roving row: the stars of one radio group (arrow keys); `.star`: centred box: centres a glyph or image |
| components/relative-time/relative-time.structural.styles.ts | Agent 4 | — | `.base`, `.relative`: inline box: glyph and label inside the element box |
| components/scroll-region/scroll-region.structural.styles.ts | Agent 3 | `.content` stack({ gap: layout.gap }) | `:host`: container contract: the host is the scroll container and its single cell |
| components/segmented-control/segmented-control.structural.styles.ts | Agent 1 | — | `.track`: track: segments share one track with the selection indicator; `.segment`: track: a segment centres its label in its share of the track; `.segment-label`: track: glyph and label inside a segment |
| components/side-nav/side-nav.recipe.styles.ts | Agent 3 | — | `\n .root`, `\n .header`, `\n .content`, `\n .footer`, `\n@layer odd.layout.condition`: already a helper (side-nav recipe, generated) |
| components/side-nav/side-nav.structural.styles.ts | Agent 3 | `.group-items` stack({ gap: navigation.item.gap }) | `::slotted(a)`: roving row: slotted links take the navigation row geometry |
| components/skeleton/skeleton.structural.styles.ts | Agent 4 | — | `.lines`: placeholder geometry: line boxes spaced by the text line height (0.5em), not a layout token |
| components/slider/slider.structural.styles.ts | Agent 1 | `.heading, .endpoints` row({ gap: 0, align: 'baseline', justify: 'space-between' }) | `.slider`: track: thumb and track share one cell |
| components/spinner/spinner.structural.styles.ts | Agent 4 | — | `.base`: inline box: glyph and label inside the element box |
| components/split-button/split-button.structural.styles.ts | Agent 3 | — | `:host`: joined pair: the action and the menu button share one border |
| components/split-panel/split-panel.structural.styles.ts | Agent 3 | — | `.split`: track: start pane, separator, end pane sized by the separator position; `.separator`: track: centres the grip in the separator |
| components/stat/stat.structural.styles.ts | Agent 4 | `.base` stack({ gap: space.xs }); `.context` row({ gap: space.xs }) | — |
| components/status-marker/status-marker.structural.styles.ts | Agent 4 | — | `:host`: centred box: the marker is its own inline cell; `.base`: centred box: centres a glyph or image |
| components/styles/control-indicator.structural.styles.ts | Agent 1 | — | `.choice`: inline box: glyph and label inside the element box; `.indicator`: centred box: centres a glyph inside the element box |
| components/styles/field.structural.styles.ts | Agent 1 | `.field` stack({ gap: space.xs }) | `.control-box`: control box: the control and its adornments share one grid cell; `.control-start, .control-end`: control box: adornments pinned to the ends of the shared cell |
| components/styles/nav-row.structural.styles.ts | Agent 3 | — | `.entry`: roving row: the navigation row (marker, label, end) is the focus target |
| components/styles/option-row.structural.styles.ts | Agent 3 | — | `.option`: roving row: start, label (grows), end slots of an active-descendant row; `.option-start, .option-end, .option-`: inline box: glyph and label inside the element box; `.option-label`: roving row: label over description inside the row |
| components/styles/overlay-surface.structural.styles.ts | Agent 2 | — | `.overlay-close`: centred box: centres a glyph inside the element box |
| components/tabs/tabs.structural.styles.ts | Agent 2 | — | `.tabs`: roving row: the tab list above its panels (orientation switches the axis); `.list`: roving row: the tablist (arrow keys between tabs; overflow scroll); `.tab`: inline box: glyph and label inside the element box; `.panels`: roving row: panels under the tab list, one shown |
| components/toast/toast.structural.styles.ts | Agent 2 | — | `.toast`: cell grid: marker, content, and actions in template areas; `.marker`: inline box: glyph and label inside the element box; `.end`: cell grid: the actions cell of the toast grid |
| components/toolbar/toolbar.structural.styles.ts | Agent 2 | `.toolbar` row({ gap: space.sm, wrap: true }) | — |
| components/tree/tree.structural.styles.ts | Agent 3 | `.root, .tree` stack({ gap: space.sm }); `.state` row({ gap: space.sm }) | `.toggle`: inline box: glyph and label inside the element box |
| components/validation-summary/validation-summary.structural.styles.ts | Agent 2 | `.summary` stack({ gap: space.sm }); `.header` row({ gap: space.xs, align: 'start' }); `.list` stack({ gap: space.sm }) | `.marker`: inline box: glyph and label inside the element box |
| ai/action-approval/action-approval.styles.ts | Agent 2 | `.base` stack({ gap: space.xs }); `.changes` stack({ gap: space.2xs }); `.change` row({ gap: space.xs, align: 'stretch', wrap: true }); `.reason` stack({ gap: space.2xs }) | — |
| ai/activity/activity.styles.ts | Agent 2 | `.base` row({ gap: space.xs, wrap: true }) | — |
| ai/ai-label/ai-label.styles.ts | Agent 2 | `.details div` row({ gap: space.xs, align: 'stretch' }) | `.label`: inline box: glyph and label inside the element box |
| ai/artifact/artifact.styles.ts | Agent 2 | `.base` stack({ gap: space.xs }); `.header` row({ gap: space.xs, wrap: true }) | — |
| ai/change-review/change-review.styles.ts | Agent 2 | `.list` stack({ gap: space.sm }); `.proposal` stack({ gap: space.xs }); `.split` autoGrid({ min: '14rem', fill: 'auto-fit', gap: space.sm }) | — |
| ai/checkpoint/checkpoint.styles.ts | Agent 2 | `.base` stack({ gap: space.xs }); `.confirm` stack({ gap: space.xs }) | — |
| ai/citation/citation.styles.ts | Agent 2 | `.preview` stack({ gap: space.2xs }) | `.trigger`: inline box: glyph and label inside the element box |
| ai/context-picker/context-picker.styles.ts | Agent 2 | `.base` stack({ gap: space.xs }); `.list` stack({ gap: space.2xs }); `.row` row({ gap: space.xs, wrap: true }); `.url` row({ gap: space.2xs, align: 'stretch', wrap: true }) | — |
| ai/conversation/conversation.styles.ts | Agent 2 | `.base` stack({ gap: space.xs }); `.feed` stack({ gap: space.lg }); `.history, .empty` row({ gap: space.xs, align: 'stretch', wrap: true, justify: 'center' }) | — |
| ai/inline-assist/inline-assist.styles.ts | Agent 2 | `.base` stack({ gap: space.xs }); `.toolbar` row({ gap: space.2xs, align: 'stretch', wrap: true }); `.language` row({ gap: space.xs, wrap: true }) | — |
| ai/internal/base.styles.ts | Agent 2 | `.actions` row({ gap: space.xs, wrap: true }) | `.status`: inline box: glyph and label inside the element box |
| ai/message/message.styles.ts | Agent 2 | `.base` stack({ gap: space.xs }); `.header` row({ gap: space.xs, wrap: true }); `.content` stack({ gap: space.sm }); `.edit` stack({ gap: space.xs }) | — |
| ai/model-select/model-select.styles.ts | Agent 1 | — | `:host`: control box: the native select fills the host; `.details`: cell grid: model name and details in two cells |
| ai/prompt-input/prompt-input.styles.ts | Agent 2 | `.toolbar` row({ gap: space.xs, wrap: true }); `.attachments, .issues` row({ gap: space.xs, align: 'stretch', wrap: true }); `.attachment` row({ gap: space.2xs, wrap: true }) | `.form`: control box: the textarea and the toolbar share the bordered box; `.drop-hint`: centred box: the drop hint over the form |
| ai/question/question.styles.ts | Agent 2 | `.form` stack({ gap: space.xs }); `fieldset` stack({ gap: space.xs }); `.options` stack({ gap: space.2xs }); `.option` row({ gap: space.xs }); `.field` stack({ gap: space.2xs }) | — |
| ai/response/response.examples.ts | Agent 2 | — | `css\n@container (min-inline-size: 40`: example page CSS (author content in an example), not element styles |
| ai/response-feedback/response-feedback.styles.ts | Agent 2 | `.base` stack({ gap: space.xs }); `.form` stack({ gap: space.xs }); `fieldset` stack({ gap: space.2xs }); `.check` row({ gap: space.xs }); `.field` stack({ gap: space.2xs }) | — |
| ai/sources/sources.styles.ts | Agent 2 | `.list` stack({ gap: space.xs }); `.item` stack({ gap: 0.125rem }) | — |
| ai/suggestions/suggestions.styles.ts | Agent 2 | `.list` row({ gap: space.xs, align: 'stretch', wrap: true }) | `.item`: inline box: glyph and label inside the element box |
| ai/task-plan/task-plan.styles.ts | Agent 2 | `.base` stack({ gap: space.sm }); `.progress` row({ gap: space.xs, wrap: true }); `.steps, .tasks` stack({ gap: space.xs }); `.step, .task` row({ gap: space.xs, align: 'stretch' }); `.body` stack({ gap: 0.125rem }) | — |
| ai/tool-call/tool-call.styles.ts | Agent 2 | `:host` stack({ gap: space.xs }); `.summary` row({ gap: space.xs, wrap: true }); `.body` stack({ gap: space.xs }); `.failure` row({ gap: space.xs, wrap: true }) | — |
| ai/transcript/transcript.styles.ts | Agent 2 | `.list` stack({ gap: space.2xs }) | — |
| ai/usage-meter/usage-meter.styles.ts | Agent 2 | `.list` stack({ gap: space.xs }); `dd` stack({ gap: space.2xs }) | `.entry`: cell grid: named or sized columns |
| ai/voice-input/voice-input.styles.ts | Agent 2 | `.base` stack({ gap: space.xs }) | `.record`: inline box: glyph and label inside the element box |
