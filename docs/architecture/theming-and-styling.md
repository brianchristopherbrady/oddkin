# Theming, token pipeline, and styling

Status: §1–§5 and §10 are **implemented** in `@oddkin/tokens` (`./theme`, `./generate`, `./schema.json`) for the M2 slice and verified in Node and three browser engines ([verification.md](../verification.md)); §5.1 records the implemented mode mechanism. Of the outputs (§6), CSS, typed `refs` (`token()`, `TokenName`), literal `values`, and inspection JSON are implemented, as is the CLI (§9: `init`, `build`, `check`; JSON, ESM JS, and type-stripped `.ts` configs). Conditions and profiles (§11.2–§11.3, with the implementation notes in §11.7) and the unit policy are implemented. Generated CSS is emitted in the `odd.tokens` cascade layer (§5.2, ADR 0039), and token values outside the browser floor are diagnosed (`value.syntax.aboveFloor`, [css-architecture.md](./css-architecture.md) §4.2). Sass and DTCG outputs and `inspect.computedToken` remain **proposals**.

## 1. Configuration model

One authoritative model, `ThemeConfig`, is used by TypeScript files, JSON files, the CLI, and Theme Studio.

```ts
import { defineTheme } from '@oddkin/tokens/theme';

export default defineTheme({
  name: 'acme',
  preset: 'oddkin-default',          // optional
  brand: { primary: '#5b46e8' },   // the only required domain input
  spacing: { strategy: 'multiples', unit: '0.25rem', steps: { xs: 1, sm: 2, md: 3, lg: 4.5, xl: 9 } },
  modes: ['light', 'dark'],
  products: { clinic: { brand: { primary: '#0f766e' } } },
  density: { compact: { scale: 0.75 } },
  conditions: { 'navigation.expanded': { container: 'side-nav', minInlineSize: '40rem' } },  // §11
  profiles: { 'navigation.compact': { 'navigation.item.padding.inline': '{space.sm}' } },    // §11
  overrides: { 'color.surface.default': '#fbfaff' },
});
```

JSON form uses `"$schema": "https://…/@oddkin/tokens/schema.json"` with the same shape. The schema is generated from (or contract-tested against) the TypeScript types.

### Precedence

```
Oddkin defaults → preset → user configuration → explicit overrides (by stable token name)
```

Each resolved token records its origin so tools can label values as *generated*, *preset*, *configured*, or *overridden*. Generated files are never edited by hand; overrides target stable names.

This is configuration precedence. Runtime precedence in the browser — component overrides, unlayered application CSS, scoped attributes, system preferences, library defaults — is defined in [css-architecture.md](./css-architecture.md) §5.3.

## 2. Pipeline

| Stage | Input → output | Notes |
| --- | --- | --- |
| 1. Load & validate | file / object → `ThemeConfig` | Schema + semantic checks; diagnostics carry JSON-pointer paths |
| 2. Resolve defaults & preset | → complete recipe | Deep merge with documented rules (arrays replace, objects merge) |
| 3. Generate scales & palettes | recipe → reference tokens | Per-domain generators |
| 4. Resolve aliases | reference + semantic + component definitions → graph | Detect missing refs, cycles, tier violations |
| 5. Compose | graph × modes × products × density → scoped graphs | Computes per-scope re-declaration sets (§5) |
| 6. Context validation | scoped graphs → diagnostics | Contrast of real role pairs, unit validity per output, min target size under density |
| 7. Emit | graphs → CSS, SCSS, DTCG JSON, TS types/refs/values, inspection metadata, report | Pure functions; Node layer writes files |

Stages 1–7 are pure and live in `@oddkin/tokens/generate` (browser-compatible). File I/O and the CLI live in `@oddkin/tokens/node`. Generation is deterministic: stable key ordering, fixed number formatting, no timestamps.

### Diagnostics

```ts
interface Diagnostic {
  code: 'unit.invalid' | 'number.nonFinite' | 'scale.invalidParameter' | 'strategy.conflict'
      | 'token.duplicate' | 'alias.missing' | 'alias.cycle' | 'tier.violation' | 'contrast.fail'
      | 'value.syntax.aboveFloor' | …;
  severity: 'error' | 'warning';
  path: string;        // e.g. '/spacing/scale/lg'
  message: string;
  suggestion?: string;
}
```

`value.syntax.aboveFloor` (warning) reports token values that use syntax the browser floor cannot parse (`light-dark()`, relative colour syntax, `contrast-color()`, `anchor-size()`, `if()`, …): readers of such a token become invalid at computed-value time in those browsers ([css-architecture.md](./css-architecture.md) §4.2). The list is `ABOVE_FLOOR_SYNTAX` in `@oddkin/tokens/generate`, verified against `@mdn/browser-compat-data` by `npm run lint:css`. Literal colour overrides already fail `color.invalid`; its suggestion names the floor browsers.

The shared diagnostic envelope planned in [agent-tooling.md](./agent-tooling.md) §9.1 only adds optional fields (`kind`, `subject`, `expected`/`received`, `docs`, `fix`) to this shape. Agent tooling explains tokens from the inspection output; it never recomputes them.

## 3. Units and precision

- Spacing and typography default to `rem`. Borders and optical adjustments may use `px`. Line heights are unitless. `em` is allowed where a value should track the local font size.
- Source units are preserved; the generator never converts `rem` to `px`.
- Numbers are rounded to 4 decimal places in their source unit, trailing zeros trimmed. Optional `snap` (e.g. to `0.125rem`) is explicit and documented.
- Pixel equivalents shown in docs state their reference root size (16 px). Live values in previews come from `getComputedStyle` in the preview itself, so host root font settings are respected.
- Each output validates its supported units. DTCG `dimension` output accepts `px` and `rem` in format 2025.10; other values are emitted as a documented extension or reported.

## 4. Spacing strategies

Exactly one strategy per spacing config (discriminated union on `strategy`; extra keys from another strategy are a `strategy.conflict` error).

### `multiples`
`value = unit × multiplier`

| Name | Multiplier | Output | px @16 |
| --- | --- | --- | --- |
| xs | 1 | `0.25rem` | 4 |
| sm | 2 | `0.5rem` | 8 |
| md | 3 | `0.75rem` | 12 |
| lg | 4.5 | `1.125rem` | 18 |
| xl | 9 | `2.25rem` | 36 |

### `ratio`
`value(offset) = base × ratio^offset`, `offset ∈ [-stepsBelow, stepsAbove]`. The base is the anchor at offset 0.

Default names are positional around `md`: offsets −2…+2 → `xs, sm, md, lg, xl`; further steps → `2xs, 3xs…` and `2xl, 3xl…`. Custom `names` may be supplied (length must equal step count).

`base: '0.75rem', ratio: 1.5, stepsBelow: 2, stepsAbove: 2`:

| Name | Offset | Output | px @16 |
| --- | --- | --- | --- |
| xs | −2 | `0.3333rem` | 5.33 |
| sm | −1 | `0.5rem` | 8 |
| md | 0 | `0.75rem` | 12 |
| lg | +1 | `1.125rem` | 18 |
| xl | +2 | `1.6875rem` | 27 |

### `explicit`
`steps: { xs: '0.25rem', sm: '0.5rem', … }` — named dimensions with units required.

All strategies name their output map `steps` (resolves the `scale` / `steps` naming difference between the two source plans; `scale` is reserved for density multipliers).

### Stability
Adding steps never renames or revalues existing steps; a contract test compares before/after manifests. Ratio steps use stable signed indices with an optional explicit naming map.

### Default preset (provisional)
Oddkin's starting default is an explicit `rem` scale: `0, 0.25, 0.5, 0.75, 1, 1.5, 2, 3, 4rem`, mapped to documented stable names. It is validated in real components (M2, M8) before being frozen. The examples above are supported configurations, not the default. Generation is a convenience; not every token family has to be geometric.

### Scale vs semantics
The scale produces reference tokens (`space.md`). Semantic tokens choose from it deliberately:

```
space.md  →  layout.gap.default  →  card.padding
space.sm  →  control.padding.inline.md         (independent of layout.gap)
```

Changing `layout.gap.default` therefore does not change control dimensions.

## 5. Tiers, scopes, and CSS alias re-declaration

Tiers: **reference** (`--odd-ref-*`, raw scale and palette) → **semantic** (`--odd-color-text-primary`, `--odd-space-md`, `--odd-layout-gap-default`) → **component** (`--odd-button-radius`, owned by the component, normally unset with a fallback).

### The inheritance problem
CSS resolves `var()` at computed-value time on the element where a property is declared, then inherits the *resolved* value. If `:root` declares `--odd-color-action: var(--odd-ref-brand-600)` and a descendant scope overrides only `--odd-ref-brand-600`, descendants still inherit the ancestor's already-resolved `--odd-color-action`.

### Proposed rule
For every scope (`[data-odd-theme]`, `[data-odd-product]`, `[data-odd-mode]`, `[data-odd-density]`, `[data-odd-profile~=…]`, and profile rules inside recipe conditions), the generator emits:

1. The tokens the scope overrides, **and**
2. Every alias whose dependency closure includes an overridden token, re-declared with its `var()` expression.

```css
:root {
  --odd-ref-brand-600: oklch(52% 0.2 280);
  --odd-color-action: var(--odd-ref-brand-600);
}
[data-odd-product="clinic"] {
  --odd-ref-brand-600: oklch(50% 0.12 180);
  --odd-color-action: var(--odd-ref-brand-600); /* re-declared so it re-resolves here */
}
```

The re-declaration set is computed from the token graph in stage 5 and recorded in inspection metadata. Verification happens in real browsers with nested scopes and Shadow DOM, not only in the generator.

### 5.1 Mode switching without cross-products (implemented)

A product or density scope must re-declare the roles that depend on it, and those roles have different expressions in light and dark. Selectors cannot target the *nearest* mode ancestor, so per-mode cross-product rules would break when scopes nest. Instead every mode-dependent role is one mode-agnostic expression switched by two inherited toggles:

```css
:root { --odd-mode-light: initial; --odd-mode-dark: ; }            /* light: light toggle invalid → its fallback is used */
[data-odd-mode="dark"] { --odd-mode-light: ; --odd-mode-dark: initial; /* + mode-dependent roles */ }
:root { --odd-color-action-default: var(--odd-mode-light, var(--odd-ref-brand-600)) var(--odd-mode-dark, var(--odd-ref-brand-400)); }
```

A guaranteed-invalid toggle (`initial`) selects its fallback; an empty toggle contributes nothing. Each scope re-declares the same expression, which resolves on that element with its inherited toggles and reference tokens, so mode, product, and density scopes nest in any order. `:root` follows `prefers-color-scheme` unless `data-odd-mode` is set; `data-odd-mode="system"` restores system behavior inside an explicit subtree. `color-scheme` is set with each mode. Verified with computed styles in nested scopes and a shadow root in Chromium, Firefox, and WebKit (`packages/tokens/test/generate.browser.test.ts`).

Consequences: product scopes may change only brand inputs (reference tokens), and contrast-selected roles choose steps that pass for the base brand and every product, so role expressions are identical in every scope. Product-specific role overrides are not supported yet. A nested `data-odd-theme` scope re-declares all tokens, but mode/product/density scopes inside it use the expressions of the last loaded theme file; one theme per document is the supported case for now.

Mode toggles must never be registered with `@property`: registration would give them an initial value and break the guaranteed-invalid selection ([css-architecture.md](./css-architecture.md) §7).

### 5.2 Cascade layer of the generated CSS (implemented, ADR 0039)

Generated CSS begins with the canonical Oddkin layer order and places every declaration in `odd.tokens`:

```css
@layer odd.reset, odd.tokens, odd.base, odd.layout, odd.components, odd.utilities;

@layer odd.tokens {
  :root,
  [data-odd-theme="default"] { --odd-space-md: 1rem; /* … */ }
  /* modes, products, densities, profiles */
}
```

Unlayered application CSS therefore overrides generated values whatever the stylesheet order and specificity (an override of a scope selector such as `[data-odd-mode="light"]` no longer depends on loading after the tokens). A root override still does not reach scopes that re-declare the role (§5); theme-wide changes belong in `overrides`. Options: `generate(config, { css: { layer } })`, `buildTheme(config, { cssLayer })`, `oddkin-tokens build --css-layer <name|none>`; a custom name emits only that layer, `none` emits the previous unlayered output. Layering adds 59 B gzip to the default theme.

### Modes and density
- `light`/`dark` via `[data-odd-mode]`; `system` via `@media (prefers-color-scheme)` applied when no explicit mode is set.
- Density (`comfortable`/`compact`) changes spacing and control sizing only; it does not change font sizes (text-size preference belongs to the user agent) and never reduces targets below the documented minimum.
- `odd-theme-scope` (component package) is a convenience that sets these attributes; plain elements with the same attributes work identically.

## 6. Outputs

| Output | Entry | Notes |
| --- | --- | --- |
| CSS custom properties | `css/tokens.css`, `css/default.css`, `css/themes/<name>.css` | No runtime engine, store, or provider required; declarations in the `odd.tokens` layer (§5.2) |
| Typed references | `refs` | `token('space.md')` → `'var(--odd-space-md)'`; DOM-free; no registration |
| Literal values | `values` | `values.space.md === '0.75rem'`; explicit, never substituted for refs silently |
| Computed values | `inspect.computedToken(name, element)` | Requires an element; reads `getComputedStyle` |
| Sass refs | `scss/refs` | `oddkin.token('space.md')` → `var(--odd-space-md)`; follows runtime themes |
| Sass literals | `scss/values` | `oddkin.value('space.md')` → `0.75rem`; compiled in, does not follow runtime themes. Use for arithmetic, colour functions, query thresholds |
| Conditions | `conditions`, `scss/refs` (`$oddkin-conditions`, `oddkin.when()`) | Literal query strings; DOM-free |
| Profiles | Included in theme CSS as `[data-odd-profile~="…"]` rules; profile data in `inspect` | Role overrides + alias closure |
| DTCG JSON | `json/<theme>.tokens.json` | Format Module 2025.10; conditions/profiles as documented `$extensions` |
| Inspection metadata | `json/<theme>.inspect.json`, `inspect` | Config, formulas, origins, aliases, re-declaration sets, resolved values |
| Validation report | CLI / `generate` | JSON + readable text |

Breakpoints: media and container query conditions cannot use `var()`. Thresholds are defined as named conditions (§11.2) and emitted as literal query strings (`conditions`, Sass `$oddkin-conditions` / `oddkin.when()`), and optionally as `@custom-media` definitions for tooling that supports them.

## 7. Styling contract

CSS custom properties are the browser-facing theming interface. Authoring style is a separate, optional choice.

### Plain CSS / SCSS (no Oddkin JavaScript)
```html
<link rel="stylesheet" href="https://cdn.example/@oddkin/tokens/css/default.css">
```
```css
.panel {
  padding: var(--odd-space-md);
  color: var(--odd-color-text-primary);
  background: var(--odd-color-surface-default);
}
```

### CSS-in-TypeScript (optional)
```ts
import { css } from '@oddkin/core';          // generic, token-agnostic
import { token } from '@oddkin/tokens/refs'; // Oddkin token knowledge

export const styles = css`
  :host {
    display: block;
    padding: ${token('space.md')};
    color: ${token('color.text.primary')};
    background: ${token('color.surface.default')};
  }
`;
```
Both forms emit the same `var(--odd-…)` references and respond identically to theme changes. `css` is also exported from `@oddkin/core/styles`.

**Permitted interpolations in `css`:** nested `css` fragments, finite numbers, and constrained CSS-variable reference strings (`var(--name)` with a tested fallback grammar). Arbitrary strings require an explicit `unsafeCSS`. `css` is not a sanitizer and must never receive untrusted Workbench editor input.

### Component authoring from `.css` / `.scss` files
A build step (part of Oddkin's own tooling, a dev dependency) transforms component `.css` (or optional `.scss`) into a JS module exporting a `css` styles object. Published component modules already contain these; consumers need no CSS loader. Native CSS module scripts (`import s from './x.css' with { type: 'css' }`) are an optional future path, pending the browser support policy.

### Stylesheet attachment (`@oddkin/core/styles`)
- A `css` result is an `OddkinStyles` object holding text. On first use per document, `adoptStyles` constructs one `CSSStyleSheet` and caches it on the object keyed by document; every instance in that document adopts the same sheet.
- Fallback: a `<style>` element per render root when constructable sheets are unavailable, with a CSP nonce/policy option. Capability and scope tests decide which path runs. [R25]
- Styles are attached once per render root, never mutated per instance or per render, and preserved across disconnect/reconnect. After cross-document adoption, a sheet for the new document is used.
- Light DOM: a `<style>` in light DOM is **not** local. Light-DOM components use explicit selector scoping, classes, or supported scoped CSS, with a de-duplicated sheet in the nearest root.

### Public styling surface of Shadow DOM components
1. **Inherited theme variables** — semantic tokens from ancestors (theming).
2. **Component variables** — e.g. `--odd-button-radius`, read with a fallback to a semantic token; normally unset.
3. **Host styling** — `odd-button { margin: … }`.
4. **Parts** — selected `::part(control)` hooks for structural overrides (styling, not theming).
5. **Custom states** — e.g. `odd-input:state(user-invalid)`, derived from the component's own state; combine with parts (`odd-input:state(user-invalid)::part(control)`), since `::part()` cannot be followed by attribute selectors.

Global page selectors do not reach shadow internals. Styling explanations (planned, [change-impact-and-verification.md](./change-impact-and-verification.md) §4.1) trace observed computed values back through component variables, semantic roles, and alias chains using inspection provenance. They label declared, potential, and observed relationships and never claim full cascade reconstruction. Component styles read inherited roles with fallbacks and never re-declare the full theme on `:host`, which would mask ancestor scopes.

### Shared style primitives (`@oddkin/components/styles`, implemented)

Rules every component needs are written once and adopted as one constructed sheet per document, whatever the number of components:

| Export | Contents | Tokens |
| --- | --- | --- |
| `hostStyles` | `box-sizing` inside the shadow root; the `hidden` attribute hides the host and internal elements even where a rule sets `display` | none (structural) |
| `focusRingStyles` | `:focus-visible` outline from `focus.width`, `focus.offset`, `color.focus.ring` | yes |
| `visuallyHiddenStyles` | `.visually-hidden` for text read by assistive technology without visual space | none (structural) |

Definition order: `hostStyles`, the component's structural styles, `focusRingStyles`, then visual styles (`[hostStyles, buttonStructuralStyles, focusRingStyles, buttonStyles]`). Foundation entries re-export `hostStyles`, so a recomposed definition can start `[hostStyles, cardStructuralStyles, …]` from one import. Consumers' own components use the same exports. Opt-in document stylesheets for pages (`reset.css`, `base.css`, `utilities.css`) are described in [css-architecture.md](./css-architecture.md) §5.1.

## 8. Theme Studio

Edits a `ThemeConfig` in a docs store, runs `@oddkin/tokens/generate` in the browser, renders previews inside isolated scopes, and exports TS/JSON config plus CSS/SCSS/JSON outputs. Contrast uses WCAG 2.x as the normative check; colour-vision simulations and any supplementary metrics are labelled as such with cited methods.

Theme Studio never executes pasted JS/TS to preview a configuration; it edits the JSON-compatible model. It also edits layout roles, conditions, and profiles (§11.6).

Theme Studio is part of `@oddkin/workbench`, so any library documented with Workbench gets it, previewing the library's own components through specimen roles. It is a primary Workbench destination (`/theme-studio`), not a Foundations page; generated Foundations pages document the saved/generated baseline and show a Theme Studio draft only when explicitly selected and labelled ([workbench-pages.md §5.1, §8](./workbench-pages.md)). Full design (controls per category, live editing, latest-wins generation, specimen roles and adapters, token visualizations, comparison, sharing, export): [workbench.md](./workbench.md) §6–§9. The pure generator in `@oddkin/tokens/generate` is the only token engine; the CLI and browser must produce byte-identical outputs for the same config.

**Products** defined in `products:` (§1) are the local product source for Workbench's optional Products and modes page. External products may come from installed packages or versioned manifests that follow the same product schema ([workbench-pages.md §9](./workbench-pages.md)). Product identity stays distinct from mode, theme, density, and profiles.

**Multi-product (planned, [multi-product.md](./multi-product.md), ADR 0033).** Any number of products uses the existing `products:` map and `data-odd-product` scopes; a single product needs no product configuration. A design language maps onto a theme, so no new scope axis or runtime provider is required. Resolving one product never mutates presets or another product's output. Current limits stay explicit until M9 closes them: product scopes change brand inputs only, and one theme per document is supported. Generated CSS growth is measured for 1, 2, 3, and 10 products. Scope boundaries for slotted content, overlays, relocated components, and adopted documents are specified in multi-product.md §9.

## 9. Configuration tooling

- CLI: `oddkin-tokens init`, `build <config> --out <dir> --format css,json,scss,ts [--css-layer <name|none>]`, `check <config>`. Theme Studio calls the same pure generator.
- Config formats: JSON and native ESM JS first. Local erasable `.ts` configs via verified Node type stripping (proposed minimum Node 24.12); type-check separately because stripping does not type-check or honour path aliases. Precompiled JS is the fallback. Published packages ship JS. [R28]
- DTCG: target Format Module 2025.10 explicitly and validate serialized types/aliases against it. It is a community-group format, not a browser standard or W3C Recommendation. [R29]
- **DTCG Resolver 2025.10 (decision pending, experiment M9).** The Resolver module [R53] adds sets merged in array order, modifiers whose contexts select token sources (modifiers may not reference other modifiers), a required `resolutionOrder`, and permutations (one resolved token set per combination of modifier contexts). Format support does not imply Resolver support. The experiment maps Oddkin concepts through the canonical generator only:

  | Oddkin | Resolver candidate | Expected gap |
  | --- | --- | --- |
  | Defaults → preset → configuration → overrides | Ordered sets in `resolutionOrder` | Oddkin generates scales and palettes before resolution; Resolver sets hold literal tokens, so generated values are exported, not their formulas |
  | Modes, products, density | Modifiers with contexts | Oddkin emits one stylesheet with nested scopes and alias-closure re-declaration; Resolver describes per-permutation token sets |
  | Profiles, conditions | No direct equivalent | Subtree role overrides and literal query thresholds become `$extensions` or stay unsupported |
  | Aliases | References | Alias semantics and unit preservation must match |

  The experiment covers shared presets, independent overrides, preserved units, and 1, 2, 3, and 10 products. It records output determinism and size (the number of permutations grows multiplicatively with modifiers), and checks output with an independent Resolver implementation where one exists. It ends in an explicit decision — a bounded export subset, import as well, or an evidence-backed deferral — listing supported, lossy, and unsupported mappings and precedence differences. Import and round-trip support remain a separate scope decision; any adapter maps into the canonical generator rather than reimplementing generation.

## 10. Colour

Original OKLCH-based generator with deterministic, documented sRGB gamut mapping (start with tested chroma reduction; record visual limits). Full authored palettes and semantic-role overrides are supported. Generated ramps do not guarantee role contrast, so actual foreground/background/state pairs are checked against WCAG; APCA and colour-vision simulations are labelled supplementary diagnostics. [R30]

## 11. Layout roles, responsive conditions, and profiles

Consumed by layout recipes ([layout-recipes.md](./layout-recipes.md)) and ordinary CSS alike. The token package defines them; it knows nothing about recipes or components.

### 11.1 Token categories

| Category | Example | Emitted as | Allowed use |
| --- | --- | --- | --- |
| Foundation value | `space.md` | `--odd-space-md` | Source for roles; avoid using directly in components |
| Semantic layout role | `layout.gap`, `layout.inset`, `layout.item-min`, `layout.sidebar-width`, `layout.main-min` | `--odd-layout-gap` | Page and recipe layout |
| Component role | `navigation.item.padding.inline` | `--odd-navigation-item-padding-inline` | Consumed by the owning component (and documented for adapters) |
| Named condition | `navigation.expanded` | Literal query string in generated CSS, `conditions` export, Sass `$oddkin-conditions`, metadata | Recipes, `@container`/`@media` rules |
| Profile | `navigation.compact` | Scope selector rule set re-declaring roles + affected alias closure | Coordinated overrides of explicit roles |

Each token declares its category; the validator rejects disallowed references (e.g. a foundation token aliasing a component role, a profile overriding foundation values, a condition used as a value).

### 11.2 Conditions

```ts
defineTheme({
  // …
  conditions: {
    'navigation.expanded': { container: 'side-nav', minInlineSize: '40rem' },
    'page.wide': { media: { minWidth: '64rem' } },
  },
});
```

- Serialized to literal CSS: `@container side-nav (min-width: 40rem)` / `@media (min-width: 64rem)`. `var()` cannot appear in query conditions, so thresholds are always literal lengths.
- **Compatibility baseline:** the config accepts logical names (`minInlineSize`, `maxInlineSize`) and plain `minWidth`/`maxWidth`; the baseline emits `min-width`/`max-width` (and `inline-size` only where needed) with literal lengths, named or unnamed containers, and `prefers-*` media features. Range syntax, style queries, and newer features are progressive enhancements behind an explicit `syntax: 'range'` option, each requiring browser verification before docs present them as supported.
- Units: `rem` default; validator flags `px` thresholds as a warning (they ignore user font-size changes) and rejects `var()`, percentages, and unitless numbers.
- Outputs: `@oddkin/tokens/conditions` (DOM-free map of name → query string), Sass map `$oddkin-conditions` plus mixin `oddkin.when('navigation.expanded') { … }`, DTCG JSON as a documented Oddkin extension (`$extensions["oddkin.condition"]`), and inspection metadata.

### 11.3 Profiles

```ts
defineTheme({
  // …
  profiles: {
    'navigation.compact': {
      'navigation.item.padding.inline': '{space.sm}',
      'layout.gap': '{space.xs}',
    },
    'navigation.comfortable': {
      'navigation.item.padding.inline': '{space.md}',
    },
  },
});
```

- A profile is an explicit set of role overrides. It **never** inspects or rewrites descendants; it only declares custom properties on the element where it applies, and they inherit.
- Applied by attribute (`data-odd-profile="navigation.compact"`, space-separated list allowed) or by a recipe condition (§6 of layout-recipes.md).
- Each profile rule re-declares the overridden roles **and** their affected alias closure (same rule as §5), so nested component roles re-resolve inside the profile scope.
- **Composition and precedence:** within one element, profiles that set the same role are ordered by the theme configuration (later wins; CSS cannot honour attribute-list order — see §11.7); nearer ancestors win over farther ones through normal inheritance. Overlapping profiles that set the same role are reported as a warning with both provenance paths. Profiles sit above theme/product/density for the roles they name and do not affect other roles.
- Profiles may only target semantic layout roles and component roles. Validation rejects foundation or colour overrides in a profile unless the category explicitly allows it.

### 11.4 Keep concerns separate

| Concern | Mechanism | Must not |
| --- | --- | --- |
| Responsive layout | Recipe conditions + profiles | Shrink text or targets automatically |
| Density | `data-odd-density` | Change font size |
| Typography preference | User agent / root font size | Be overridden by layout conditions |
| Interaction target size | Component roles with a documented minimum (WCAG 2.5.8 target size minimum as baseline) | Drop below the minimum in any profile or density |

A narrow container changes arrangement; it does not automatically shrink every label and control. The validator checks that no profile/density combination sets a target-size role below the minimum.

### 11.5 Equivalent consumption

```css
/* CSS */
.toolbar { gap: var(--odd-layout-gap); }
@container side-nav (min-width: 40rem) { .toolbar { gap: var(--odd-layout-gap-wide, var(--odd-layout-gap)); } }
```
```scss
// SCSS
@use '@oddkin/tokens/scss/refs' as oddkin;
.toolbar { gap: oddkin.token('layout.gap'); @include oddkin.when('navigation.expanded') { flex-wrap: nowrap; } }
```
```ts
// TS (CSS-in-TS)
import { token } from '@oddkin/tokens/refs';
import { conditions } from '@oddkin/tokens/conditions';
css`.toolbar { gap: ${token('layout.gap')}; }
     ${unsafeCSS(conditions['navigation.expanded'].atRule)} { .toolbar { flex-wrap: nowrap; } }`;
```

Recipes are the recommended way to use conditions in components; the raw outputs exist for ordinary CSS and tooling. (The TS example needs `unsafeCSS` because a query string is not a permitted value interpolation; a `condition()` helper in `@oddkin/components/layout` will wrap this safely.)

### 11.6 Validation, provenance, Theme Studio

- Diagnostics: `condition.unit.invalid`, `condition.syntax.unsupported`, `condition.container.unknown`, `profile.target.disallowed`, `profile.overlap`, `role.category.violation`, `role.targetSize.belowMinimum`.
- Every role, condition, and profile records provenance (default / preset / config / override).
- Theme Studio edits the same `conditions` and `profiles` config, previews the side-navigation fixture and other compositions in resizable containers side by side, shows which condition and profile are active in each preview, and traces each role through profile → alias → computed value.

### 11.7 Implementation notes (M2)

- **Conditions export shape.** A condition is either a container query or a media query, so `@oddkin/tokens/conditions` (and the `<name>.conditions.ts` module the CLI emits) maps each name to `{ kind, query, atRule }`: `query` is the prelude after the keyword and `atRule` the complete prelude, as in the §11.5 example. Names sort alphabetically; configured conditions replace preset conditions with the same name.
- **Features.** Container conditions accept a container name or `true` (nearest size container) with `minInlineSize`/`maxInlineSize` (emitted as `min-inline-size`/`max-inline-size`, supported wherever container queries are) and `minWidth`/`maxWidth`. Media conditions accept `minWidth`/`maxWidth` and `prefersReducedMotion`, `prefersColorScheme`, `prefersContrast`, `forcedColors`; logical sizes in media conditions report `condition.feature.unsupported`. Ranges that can never match report `condition.range.empty`; `px` thresholds warn.
- **Invalidation.** Thresholds are compiled into query text. Changing one means regenerating the outputs that contain it (CLI build, or a preview-owned stylesheet in Workbench/Theme Studio); setting any custom property at runtime never changes a query.
- **Profile precedence.** A `data-odd-profile` list is matched with `~=`, so CSS source order — not list order — decides between profiles that set the same role on one element. Profiles are emitted after products and densities in configuration order (preset first; a configured profile with a preset's name replaces it in place), and every overlap is reported as `profile.overlap` naming the winner.
- **Profiles inside nested scopes.** Density, product, mode, and theme scopes re-declare their closures with base expressions, which would drop a profile's values in a nested scope. Each profile rule therefore also matches `[data-odd-profile~="p"] :is([data-odd-mode], [data-odd-product], [data-odd-density], [data-odd-theme])` — the same declaration block, specificity (0,2,0). Verified in three engines.
- **Targets.** Target-size minimums are checked for each density, each profile, and each profile × density combination, limited to roles a profile actually changes or that depend on them.
- **Unit policy.** Line heights are unitless numbers, font weights are integers 1–1000, dimension literals need units, and `px` warns for type, control, layout, navigation, and card sizes (borders and optical values may use `px`). Values with references or `calc()`/`min()`/`max()`/`clamp()` are checked through what they reference.

## Open questions

- Whether `@custom-media` output is worth shipping (conditions now cover media thresholds; likely only as an optional build output).
- Final scope selector syntax (data attributes proposed: `data-odd-theme`, `data-odd-mode`, `data-odd-product`, `data-odd-density`).
