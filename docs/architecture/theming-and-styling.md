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
  correction?: { token: string; mode: 'light' | 'dark'; value: string; hex: string; ratio: number }; // contrast.fail only (§10.4)
}
```

`value.syntax.aboveFloor` (warning) reports token values that use syntax the browser floor cannot parse (`light-dark()`, relative colour syntax, `contrast-color()`, `anchor-size()`, `if()`, …): readers of such a token become invalid at computed-value time in those browsers ([css-architecture.md](./css-architecture.md) §4.2). The list is `ABOVE_FLOOR_SYNTAX` in `@oddkin/tokens/generate`, verified against `@mdn/browser-compat-data` by `npm run lint:css`. Literal colour overrides already fail `color.invalid`; its suggestion names the floor browsers.

The shared diagnostic envelope planned in [agent-tooling.md](./agent-tooling.md) §9.1 only adds optional fields (`kind`, `subject`, `expected`/`received`, `docs`, `fix`) to this shape. Agent tooling explains tokens from the inspection output; it never recomputes them.

**Paths (implemented).** `path` is an RFC 6901 pointer into the configuration (`''` for the configuration itself). A value the configuration wrote is reported where it was written: an override's unit, alias, tier, cycle, CSS, floor-syntax, and target-size problems at `/overrides/<name>`, a profile value's at `/profiles/<profile>/<name>`, and a density's target-size failures at `/density/<name>/tokens/<role>`. `/tokens/<name>` names a preset or generated role: one that falls below its minimum because of an override it references, or the foreground role of a `contrast.fail` warning. An absent key takes its default, but an explicit `null` is rejected wherever the schema rejects it (`config.type`, or the key's own code such as `modes.invalid`), and so is a non-string `$schema`. Generation never throws for a JSON value. *(Verified in `packages/tokens/test/generate.test.ts`, `conditions-profiles.test.ts`, and `layers-floor.test.ts`. `schema.test.ts` replaces every value of three complete configurations with each of eight wrong-typed values, 584 drafts, and finds no draft the generator accepts but the schema rejects.)*

## 3. Units and precision

- Spacing and typography default to `rem`. Borders and optical adjustments may use `px`. Line heights are unitless. `em` is allowed where a value should track the local font size.
- Source units are preserved; the generator never converts `rem` to `px`.
- Numbers are rounded to 4 decimal places in their source unit, trailing zeros trimmed. Optional `snap` (e.g. to `0.125rem`) is explicit and documented.
- Pixel equivalents shown in docs state their reference root size (16 px). Live values in previews come from `getComputedStyle` in the preview itself, so host root font settings are respected.
- Each output validates its supported units. DTCG `dimension` output accepts `px` and `rem` in format 2025.10; other values are emitted as a documented extension or reported.
- **The consumer's root size (implemented, plan item 241).** Generated CSS declares only `--odd-*` custom properties and `color-scheme`: never a root or element `font-size`, so `rem` values follow whatever the page and the reader's preferences set. Nothing assumes a pixel size: `rem` stays `rem` in the CSS, the `values` literals, the inspection JSON, and DTCG output; target-size checks that would need a root size to compare `px` with `rem` report `target.unitMismatch` instead of converting. Three kinds of value are kept apart: **CSS references** (`refs`, `var(--odd-…)`, which follow scopes at runtime), **generated literals in source units** (`values`, inspection, DTCG — pure results of the configuration, per mode and, through `resolveToken(theme, name, context)`, per product/density/profile context), and **observed pixels** (only from `getComputedStyle` in a real document, e.g. Workbench previews). *(Verified in `packages/tokens/test/spacing-units.test.ts`, and in `e2e/tokens-css-only.spec.ts`, where a 20 px root font size scales every `rem` token in three engines.)*

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
Adding steps never renames or revalues existing steps: `multiples` and `explicit` steps are independent, and `ratio` steps are named by their signed offset (`md` = 0), so raising `stepsBelow`/`stepsAbove` only adds names at the ends. An explicit `names` list maps offsets to names instead.

### Parameters, bounds, zero and negative values (implemented, plan item 240)

| Strategy | Fields | Rules |
| --- | --- | --- |
| `multiples` | `unit` (a non-zero length), `steps` (name → factor), `snap?` | Factors are finite and ≥ 0; `0` gives a `0` step; negative factors are `scale.invalidParameter` (write negative spacing explicitly where it is used) |
| `ratio` | `base` (a non-zero length at offset 0), `ratio`, `stepsBelow`, `stepsAbove`, `names?`, `snap?` | `ratio` > 0 and ≠ 1; counts are integers 0–12 per side; `names` must list exactly `stepsBelow + stepsAbove + 1` names |
| `explicit` | `steps` (name → length), `snap?` | Values are taken as written, including `0` and negative lengths (for example a `pull` step) |

Every strategy keeps the unit it was given (`rem`, `em`, or `px`, which warns `unit.discouraged`) and rounds to 4 decimals in that unit. Fields from another strategy are `strategy.conflict`; there are no `default`, `multiplier`, or `range` fields.

**Required step names.** Preset roles alias `space.xs`, `space.sm`, `space.md`, and `space.lg` (and the preset profiles alias `xs`, `sm`, `md`). A custom scale without one of them is a single `spacing.missingStep` error at `/spacing`, naming the missing steps, the roles that reference them, and how the strategy can provide them (for `ratio`: positional names cover them with `stepsBelow` ≥ 2 and `stepsAbove` ≥ 1). Overriding those roles removes the requirement. A reference the user wrote to a missing step stays an `alias.missing` error at that override, with a "did you mean" suggestion. *(Verified in `packages/tokens/test/spacing-units.test.ts`; 5 of 5 mutants killed.)*

### Default preset (provisional)
Oddkin's starting default is an explicit `rem` scale with 11 steps: `none` 0, `3xs` 0.125, `2xs` 0.25, `xs` 0.5, `sm` 0.75, `md` 1, `lg` 1.5, `xl` 2, `2xl` 3, `3xl` 4, `4xl` 6 rem (§10.3). It is validated in real components (M2, M8) before being frozen. The examples above are supported configurations, not the default. Generation is a convenience; not every token family has to be geometric.

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

### 5.3 Scopes across shadow roots, and direction (verified, plan item 909)

Custom properties inherit through the flat tree, so the generated CSS is adopted once, in the document (§8), and scopes are declared in the document tree:

- A scope attribute (`data-odd-theme|mode|product|density|profile`) on any light-DOM ancestor, including the shadow host itself, reaches everything inside the host's shadow root and inside nested shadow roots at any depth.
- Slotted content inherits through its slot, not its light-DOM parent: a scope a component places around a `<slot>` applies to the slotted content.
- A scope attribute **inside** a shadow tree matches no document stylesheet and has no effect; the values inherited from outside continue. It applies only if the generated CSS is also adopted in that shadow root (mode, product, density, and theme scopes then work there, but `:root` still matches nothing). In that configuration, a profile on a light-DOM ancestor is lost inside a nested scope in the shadow tree, because the profile's re-application selector (`[data-odd-profile~=…] :is([data-odd-density], …)`) cannot cross the boundary; repeat `data-odd-profile` on the inner scope. Oddkin components never place scope attributes in their shadow trees.
- A nested `data-odd-theme` scope re-declares every token, so an outer product or density no longer applies inside it, while the mode toggles still come from outside.

Direction: token names carry no physical direction (`control.padding.inline.*`, `navigation.item.padding.{inline,block}`), so the same roles serve `dir="ltr"` and `dir="rtl"`; components apply them through logical properties (component-side evidence: [css-architecture.md](./css-architecture.md)).

*(Verified in `packages/tokens/test/scopes-shadow.browser.test.ts`: 12 cases in Chromium, Firefox, and WebKit, each compared with `resolveToken` for colour, spacing, layout, and navigation roles, plus a check that each pair of probes differs in the axis it tests; 6 of 6 emitter mutants killed. `generate.test.ts` checks that no token name is physical.)*

### 5.4 Composition and precedence of scope axes (implemented, plan item 244)

The CSS never contains a cross-product rule: each product, density, and profile is one rule (a profile also re-applies itself inside nested scopes, §5), and mode is two toggles. Legal compositions and what wins:

| Situation | Result |
| --- | --- |
| Axes on nested elements (any order, any depth, across shadow roots) | The nearest scope of each axis applies; each scope re-declares its alias closure, so outer scopes of other axes keep working (§5, §5.3) |
| Several axes on **one** element | Rules have equal specificity; emission order decides overlapping roles: products, then densities, then profiles, all after the mode rules. In practice only densities and profiles overlap (both touch layout and component roles), and the profile wins |
| Two profiles on one element (`data-odd-profile="a b"`) setting the same role | The profile that comes later in the configuration wins; the attribute's list order does not matter. Reported as `profile.overlap` with both paths |
| A profile on an ancestor and a density nested inside it | The profile still applies (its re-application selector) |
| A nested `data-odd-theme` | Re-declares every token: outer products, densities, and profiles stop applying inside it; mode toggles still come from outside |
| `overrides` vs. scopes | Overrides change the base values every scope starts from; a scope that re-declares a role still wins inside it |

**Reports with provenance.** Conflicts: `profile.overlap` (warning) at the later profile's value, naming the earlier one. Redundant settings, each a warning at the path where it was written: `override.redundant` (the override compiles to the CSS the token already has; the message names the token's origin and provenance), `profile.redundant` (a profile value equal to the value outside the profile), `product.redundant` (a product with the base brand colours, whose scope declares nothing), and `density.redundant` (a scale that changes no token, e.g. `1`). Redundant settings change no output; the generated CSS equals the configuration without them. A value that differs only in whitespace is not reported (it changes the emitted text). Duplicate keys inside one JSON object are not detected (JSON parsing keeps the last one).

**Measured growth** (default theme `#6250e8`, raw / gzip -9 bytes; 26,326 / 2,720 with no scopes): per product about 3,130 / 160–200, per density about 1,100 / 50 (a density re-declares 25 dimension tokens and their closure), per profile about 170 / 10–14. With 1, 2, 3, and 10 of every axis together: +3,297 / +209, +7,686 / +446, +12,083 / +655, +42,445 / +2,204 (68,771 / 4,924 total), exactly the sum of each axis alone. Configured densities replace the default `compact`. *(Verified in `packages/tokens/test/composition.test.ts` (redundancy reports, output unchanged, additive growth, one rule per scope) and in `scopes-shadow.browser.test.ts` (all axes on one element, and a profile with a density on one element inside another density, in three engines); 5 of 5 mutants killed.)*

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
| DTCG JSON | `emitDtcg(theme, context)` in `generate`; `oddkin-tokens build --format dtcg` writes `<theme>.<mode>.tokens.json` | Format Module 2025.10, one complete document per context (§6.1); not a Resolver document |
| Inspection metadata | `json/<theme>.inspect.json`, `inspect` | Config, formulas, origins, aliases, re-declaration sets, resolved values |
| Validation report | CLI / `generate` | JSON + readable text |

Breakpoints: media and container query conditions cannot use `var()`. Thresholds are defined as named conditions (§11.2) and emitted as literal query strings (`conditions`, Sass `$oddkin-conditions` / `oddkin.when()`), and optionally as `@custom-media` definitions for tooling that supports them.

### 6.1 DTCG 2025.10 output (implemented, plan item 245)

`emitDtcg(theme, { mode?, product?, density?, profiles? })` returns `{ document, text, mappings }`: one complete [Format Module 2025.10](https://www.designtokens.org/tr/2025.10/format/) document for one resolution context (default: the theme's first mode), its canonical bytes (`JSON.stringify(…, null, 2)` + newline, deterministic), and one mapping entry per token (`lossless`, `lossy` with a reason, or `unsupported` with a reason). It is pure and Worker-safe, and produces the same bytes in Node, Chromium, Firefox, WebKit, and a module Worker. `oddkin-tokens build --format dtcg` (included in the default formats) writes one `<theme>.<mode>.tokens.json` per mode.

**Structure.** Token names split on `.` into groups (`color.text.primary` → `color` › `text` › `primary`); every token carries an explicit `$type`; descriptions become `$description`. A token whose name is also a group prefix is placed at `$root` and referenced as `{name.$root}` (§6.2 of the format). Aliases stay curly-brace references (`{color.action.default}`), so the document keeps Oddkin's reference structure; nothing uses `$ref` or `$extends`.

**Typed values.**

| Oddkin type | 2025.10 value | Mapping |
| --- | --- | --- |
| `color` `#rrggbb` | `{ colorSpace: 'srgb', components: [r, g, b] (6 decimals), hex }` | lossless (`hex` exact) |
| `color` `oklch(L C H)` (overrides) | `{ colorSpace: 'oklch', components: [L, C, H] }` | lossless |
| `dimension` `rem` / `px` / `0` | `{ value, unit }`; `0` → `{ value: 0, unit: 'px' }` | lossless |
| `dimension` in `em` (`letter-spacing.tight/wide`) | — | **unsupported**: 2025.10 dimensions allow only `px` and `rem`, and `em` depends on the font size |
| `number`, `fontWeight` | JSON number | lossless |
| `fontFamily` stack | array of names, quotes removed | lossless |
| `duration` | `{ value, unit: 'ms' \| 's' }` | lossless; **lossy** where a reduced-motion value exists (it is only in `$extensions`) |
| `cubicBezier` | `[x1, y1, x2, y2]` | lossless |
| `shadow` layers | shadow object, or an array for several layers; missing blur/spread are `0px`; `rgb(… / a)` → srgb + `alpha` | lossless; `none` is **unsupported** |
| expression over references (profile `calc({space.xs} / 2)`) | the flattened dimension in this context | **lossy**: the expression is kept in `$extensions` |
| alias to an unsupported token | — | **unsupported** (never a dangling reference) |

Unsupported tokens are omitted and listed with their type, original value, and reason under the root `$extensions["dev.oddkin"].unsupported`, so nothing is dropped silently. The default theme maps 201 tokens losslessly, 4 lossy (`motion.duration.*`), and 5 unsupported (`elevation.none`, `letter-spacing.tight/wide`, and the two `type.*.letter-spacing` aliases).

**Oddkin extension (`$extensions["dev.oddkin"]`).** Per token: `category`, `origin`, and when present `provenance`, `density`, `minimum` (target-size floor), `reducedMotion`, and `css` (the original expression of a lossy value). On the root group: `format` (`"2025.10"`), `theme`, `context` (`mode` and any `product`, `density`, `profiles`), `conditions` (name → literal at-rule prelude), and `unsupported`. Readers that do not understand the extension still get valid tokens; the format requires them to preserve it.

**Contexts, not modes.** 2025.10 has no modes or theming axes, so each mode, product, density, and profile combination is a separate complete document with that context's values. Composition across contexts (sets, modifiers, `resolutionOrder`) is the DTCG **Resolver**'s concern: no Resolver document is emitted and **no Resolver support is claimed** (plan item 246, M9). Import of DTCG documents is out of scope.

*(Verified in `packages/tokens/test/dtcg.test.ts`: `@terrazzo/parser` 2.10.0, an independent implementation, reads the default theme in both modes and the `products-density` theme with a product, a density, and two profiles, with dimensions restricted to `px`/`rem` as 2025.10 requires; every token it resolves, aliases included, equals Oddkin's `resolveToken` in that context; plus name rules, determinism, `$root`, and the exact unsupported and lossy lists. Committed fixtures `*.tokens.json.txt` are compared in Node, three browser engines, and a Worker; 10 of 10 emitter mutants killed.)*

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

**Implemented for `.css` (M4):** `odd-card`'s default visual styles are authored in `packages/components/src/card/card.styles.css`; `odd-button` and `odd-input` stay in CSS-in-TS. `card.styles.ts` is generated from the `.css` file and committed, like extracted recipe styles ([layout-recipes.md](./layout-recipes.md) §9): `UPDATE_FIXTURES=1 npx vitest run --project node packages/components/test/css-sources.test.ts` regenerates it, and the same test fails when the two differ. The file's leading comment documents the export. Theme variables written as `var(--odd-…)` become `token()` calls, so TypeScript checks them against `TokenName` and the analyzer records the same token reads as for CSS-in-TS. The component's own variables (`--odd-card-*`) stay as written. Any other `--odd-*` name, or a theme token read with a fallback, fails generation. The migration left the shipped `cssText` and the CEM declaration byte-identical, and the component metadata unchanged apart from its test-evidence records, which any rebuild sets aside until the tests run again. `styling-contract.browser.test.ts` shows the `.css`-authored card and the CSS-in-TS button and input resolving the same role through a live mode switch and a page-level role override. `.scss` is not implemented.

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

#### Verified behavior (`odd-button`, `odd-input`, `odd-card`)

- **Variables:** each documented variable works on the host or any ancestor (custom properties inherit) and otherwise falls back to the role of the element's nearest scope (tested with `data-odd-mode` scopes, also inside another element's shadow root, and the `layout.compact` profile). `--odd-button-background: initial` on one element restores its fallback inside a customized subtree. A value the property rejects (`--odd-button-radius: banana`) does not fall back: the property becomes invalid at computed-value time and takes its initial or inherited value.
- **Theme roles named like variables:** `--odd-card-padding` and `--odd-card-radius` are also the theme's `card.padding` and `card.radius` component roles, so the theme always sets them (density and the `layout.compact` profile adjust the padding). They are read without a fallback; setting them works like any variable, but `initial` removes the value (zero padding, square corners). `padding="none"`, `"sm"`, and `"lg"` replace the padding role, which applies to `padding="md"` (the default). No other component variable shares a name with a generated token.
- **States win:** a disabled `odd-button` keeps the disabled surface, text, and transparent border whatever its colour variables; an `odd-input` showing an error keeps the danger border. Variables apply in every interactive state, so a custom `--odd-button-background` also replaces the hover colour; style other states with `odd-button::part(control):hover`.
- **Parts:** each component exposes exactly its documented parts (`odd-button`: `control`, `spinner`; `odd-input`: `field`, `label`, `description`, `control`, `error`; `odd-card`: `base`, `header`, `body`, `footer`), each styled by an outer `::part()` rule, and `odd-input:state(user-invalid)::part(control)` follows the state.

Evidence: `packages/components/test/styling-contract.test.ts` (Node: no custom-property declarations, only roles the generated theme declares, a fallback for every variable the theme does not declare, documented variables equal to those read, no theme roles in structural styles) and `styling-contract.browser.test.ts` (Chromium, Firefox, WebKit, with the shipped theme loaded). Not covered: `odd-side-nav`.

### Shared style primitives (`@oddkin/components/styles`, implemented)

Rules every component needs are written once and adopted as one constructed sheet per document, whatever the number of components:

| Export | Contents | Tokens |
| --- | --- | --- |
| `hostStyles` | `box-sizing` inside the shadow root; the `hidden` attribute hides the host and internal elements even where a rule sets `display` | none (structural) |
| `focusRingStyles` | `:focus-visible` outline from `focus.width`, `focus.offset`, `color.focus.ring` | yes |
| `visuallyHiddenStyles` | `.visually-hidden` for text read by assistive technology without visual space | none (structural) |

Definition order: `hostStyles`, the component's structural styles, `focusRingStyles`, then visual styles (`[hostStyles, buttonStructuralStyles, focusRingStyles, buttonStyles]`). Foundation entries re-export `hostStyles`, so a recomposed definition can start `[hostStyles, cardStructuralStyles, …]` from one import. Consumers' own components use the same exports. Opt-in document stylesheets for pages (`reset.css`, `base.css`, `utilities.css`, and `button.css`, which styles native `<button class="odd-button">` elements like `odd-button` for forms that need native submit-button semantics) are described in [css-architecture.md](./css-architecture.md) §5.1 and §10.1.

## 8. Theme Studio

Edits a `ThemeConfig` in a docs store, runs `@oddkin/tokens/generate` in the browser, renders previews inside isolated scopes, and exports TS/JSON config plus CSS/SCSS/JSON outputs. Contrast uses WCAG 2.x as the normative check; colour-vision simulations and any supplementary metrics are labelled as such with cited methods.

Theme Studio never executes pasted JS/TS to preview a configuration; it edits the JSON-compatible model. It also edits layout roles, conditions, and profiles (§11.6).

Theme Studio is part of `@oddkin/workbench`, so any library documented with Workbench gets it, previewing the library's own components through specimen roles. It is a primary Workbench destination (`/theme-studio`), not a Foundations page; generated Foundations pages document the saved/generated baseline and show a Theme Studio draft only when explicitly selected and labelled ([workbench-pages.md §5.1, §8](./workbench-pages.md)). Full design (controls per category, live editing, latest-wins generation, specimen roles and adapters, token visualizations, comparison, sharing, export): [workbench.md](./workbench.md) §6–§9. The pure generator in `@oddkin/tokens/generate` is the only token engine; the CLI and browser must produce byte-identical outputs for the same config.

**Generation for Theme Studio (implemented; the tokens side of M5 items 843–845).**

- **Worker.** Theme Studio runs `@oddkin/tokens/generate` from the published entry in a module Worker. The entry uses no Node built-ins and no DOM; the boundary lint checks both on the built graph.
- **Results.** `generate(draft)` returns `{ ok, diagnostics, theme?, css? }`. Post back plain data: `ok`, `diagnostics`, `css`, and, for "View draft", `emitInspectJson(theme, diagnostics)`. `theme` holds Maps and stays in the Worker.
- **Same bytes as the CLI.** For the same configuration, the Worker's CSS is byte-identical to the file `oddkin-tokens build` writes. For `themes/default.theme.json`, it is byte-identical to `@oddkin/tokens/css/default.css`, and its inspection text to `@oddkin/tokens/inspect/default.json`. The CLI's `--css-layer <name>` corresponds to `{ css: { layer: '<name>' } }`, and `none` to `layer: false`.
- **Invalid drafts.** An invalid draft gets `ok: false`, no CSS, and diagnostics with configuration paths (§2), so the preview keeps its last valid sheet.
- **Applying the CSS.** Construct the sheet with the preview frame's own `CSSStyleSheet`, adopt it in the frame's document once, and update it with `replaceSync()`. The selectors are `:root`, `[data-odd-theme]`, and the scope attributes, and `:root` matches nothing in a shadow root's sheets. A sheet constructed in another document cannot be adopted. The rejected assignment empties `adoptedStyleSheets` in Chromium and Firefox (WebKit keeps it), which would drop the preview's theme.
- **Loading theme files.** Dev tooling loads TS and JS theme files with `loadConfig()` from `@oddkin/tokens/node`, which returns the JSON-compatible model (§9).

*(Verified in `packages/tokens/test/worker.browser.test.ts` in Chromium, Firefox, and WebKit, with the reference worker `test/fixtures/theme-studio.worker.ts`. A mutation of the built `dist/generate` module fails the byte comparisons, so the test exercises the published entry.)*

**Products** defined in `products:` (§1) are the local product source for Workbench's optional Products and modes page. External products may come from installed packages or versioned manifests that follow the same product schema ([workbench-pages.md §9](./workbench-pages.md)). Product identity stays distinct from mode, theme, density, and profiles.

**Multi-product (planned, [multi-product.md](./multi-product.md), ADR 0033).** Any number of products uses the existing `products:` map and `data-odd-product` scopes; a single product needs no product configuration. A design language maps onto a theme, so no new scope axis or runtime provider is required. Resolving one product never mutates presets or another product's output. Current limits stay explicit until M9 closes them: product scopes change brand inputs only, and one theme per document is supported. Generated CSS growth is measured for 1, 2, 3, and 10 products. Scope boundaries for slotted content, overlays, relocated components, and adopted documents are specified in multi-product.md §9.

## 9. Configuration tooling

- CLI: `oddkin-tokens init`, `build <config> --out <dir> --format css,json,scss,ts [--css-layer <name|none>]`, `check <config>`. Theme Studio calls the same pure generator.
- Config formats: JSON and native ESM JS first. Local erasable `.ts` configs via verified Node type stripping (proposed minimum Node 24.12); type-check separately because stripping does not type-check or honour path aliases. Precompiled JS is the fallback. Published packages ship JS. [R28]
- JSON model *(implemented)*: `loadConfig()` returns the configuration's JSON-compatible model, a plain-data copy with `undefined` properties dropped and `-0` written as `0`, as JSON does. Functions, class instances (`Map`, `Date`, …), non-finite numbers, `bigint`, array holes, and cycles are `config.notJson` errors at their paths. So the CLI and Theme Studio generate from the same model. *(Verified in `packages/tokens/test/cli.test.ts`.)*
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

### 10.1 Approved default palette and role vocabulary (implemented, ADR 0041)

Design source: Figma file `E7LfRysny8V3qU24tv082i`, frames 8:29 ("Oddkin · UI kit") and 31:441 ("Shared default theme / Palette approval"). Role names match the design. `themes/default.theme.json` sets `brand.primary` to Electric iris and pins each approved value as an override; the generic preset keeps ramp-step and contrast-selected roles so any other brand still gets a complete, checked theme.

| Role | Light | Dark | Use |
| --- | --- | --- | --- |
| `color.canvas` | `#f6f5f1` | `#171821` | Page background |
| `color.surface.default` | `#ffffff` | `#242631` | Cards, panels, controls |
| `color.surface.raised` | `#ffffff` | `#2d2f3b` | Raised surfaces (with an `elevation.*` shadow) |
| `color.surface.sunken` | `#f0eff3` | `#111219` | Wells, code, inset areas |
| `color.surface.hover` | `#f0eff5` | `#30323f` | Hover and transient highlights |
| `color.surface.specimen` | `#efedfc` | `#29263d` | Documentation specimen stages only (24 px inset); never a selected state |
| `color.text.primary` | `#23252b` | `#f5f3fd` | Body and headings |
| `color.text.secondary` | `#5f626f` | `#bdbbcd` | Supporting text |
| `color.text.disabled` | `#767985` | `#858393` | Disabled text (exempt from contrast minimums) |
| `color.action.default` / `hover` / `pressed` | `#6250e8` / `#5140cc` / `#4333ad` | `#b4a8ff` / `#c5bcff` / `#9b8cf0` | Primary actions |
| `color.text.on-action` | `#ffffff` | `#23252b` | Text on actions and selections |
| `color.link`, `color.focus.ring` | `#6250e8` | `#b4a8ff` | Links; 2 px focus ring at 2 px offset |
| `color.border.default` / `strong` | `#d9d8e1` / `#868997` | `#555368` / `#858395` | Dividers / control borders (3:1) |
| `color.selection.background` / `foreground` | action default / on-action | same | Selected controls, with a state marker |
| `color.danger.foreground` / `surface` | `#b4233a` / `#fff0f2` | `#ff9bab` / `#3d202a` | Errors; also danger borders |
| `color.success.foreground` / `surface` | `#267653` / `#eaf6ef` | `#8fd6b3` / `#1c352b` | Success |
| `color.warning.foreground` / `surface` | `#8a5900` / `#fff5de` | `#e9c478` / `#3a2e18` | Warnings (`status.warning` seeds the `ref.warning.*` ramp) |
| `color.accent.decorative` | `#dfedaa` | `#dfedaa` | Citron decoration; never status, text, or interaction |

Brand foundations: Chalk `#f6f5f1`, White `#ffffff`, Ink `#23252b`, Electric iris `#6250e8`, Pale iris `#efedfc`, Citron `#dfedaa`. Every contracted pair (§10.4) passes for the default theme in both modes.

**One home per value.** `default.theme.json` writes each colour literal once per mode: `color.link` and `color.focus.ring` alias `color.action.default`, and the white of `surface.default`, `surface.raised`, and light `text.on-action` aliases `{ref.neutral.0}`, as the preset does. `generate.test.ts` fails on a repeated literal or on a literal that equals a reference step. (`brand.primary` is a generator input, not a token, so it may equal `color.action.default`.)

### 10.2 Text styles (implemented, ADR 0042)

`type.<style>.{family,size,weight,line-height,letter-spacing}`, each an alias into the foundation scales (§10.3), so a theme changes a scale step once and every style that uses it follows. `font.family.display` aliases `font.family.sans` by default; themes that want a separate display face override it. Oddkin does not ship or load font files.

| Style | Family | Size | Weight | Line height | Letter spacing |
| --- | --- | --- | --- | --- | --- |
| `display` | display | `4xl` 2.25rem | semibold 600 | `tight` 1.25 | `tight` -0.025em |
| `section` | display | `2xl` 1.5rem | semibold 600 | `tight` 1.25 | `normal` 0 |
| `title` | display | `xl` 1.25rem | semibold 600 | `snug` 1.375 | `normal` 0 |
| `body` | sans | `md` 1rem | regular 400 | `normal` 1.5 | `normal` 0 |
| `ui` | sans | `sm` 0.875rem | medium 500 | `snug` 1.375 | `normal` 0 |
| `small` | sans | `xs` 0.75rem | regular 400 | `normal` 1.5 | `normal` 0 |
| `eyebrow` | sans | `xs` 0.75rem | semibold 600 | `normal` 1.5 | `wide` 0.05em |
| `code` | mono | `sm` 0.875rem | regular 400 | `normal` 1.5 | `normal` 0 |

Use a style as a set, e.g. `font: var(--odd-type-ui-weight) var(--odd-type-ui-size) / var(--odd-type-ui-line-height) var(--odd-type-ui-family); letter-spacing: var(--odd-type-ui-letter-spacing)`.

Component usage: `odd-button` text and `odd-input` labels use `ui` (`size="lg"` buttons use the body size); the `odd-input` control uses the body size, because iOS Safari zooms the page when a field under 16 px takes focus; descriptions and errors use `small`; `odd-card` sets `body` and gives slotted `h1`–`h6` in its header a `title` default (page styles for the heading still win, since `::slotted()` loses to light-DOM rules); `base.css` sets `body` on the page with the `canvas` background. Button and input colour changes transition over `motion.duration.fast` with `motion.easing.standard`, which become instant under reduced motion.

### 10.3 Foundation scales (implemented, ADR 0042)

Only the colour palette comes from the design source (§10.1); every other value is Oddkin's own scale, and designs adopt these tokens. Every step is overridable by name through `overrides`.

| Domain | Tokens | Values |
| --- | --- | --- |
| Spacing | `space.{none,3xs,2xs,xs,sm,md,lg,xl,2xl,3xl,4xl}` | 0, 0.125, 0.25, 0.5, 0.75, 1, 1.5, 2, 3, 4, 6 rem (default explicit strategy, §4; scaled by density) |
| Radius | `radius.{none,xs,sm,md,lg,xl,2xl,full}` | 0, 0.125, 0.25, 0.5, 0.75, 1, 1.5 rem, 9999px; `control.radius` = `md`, `card.radius` = `lg` |
| Border | `border.width.{default,strong}`, `focus.{width,offset}` | 1px, 2px; 2px, 2px |
| Font size | `font.size.{xs,sm,md,lg,xl,2xl,3xl,4xl}` | 0.75, 0.875, 1, 1.125, 1.25, 1.5, 1.875, 2.25 rem |
| Font weight | `font.weight.{regular,medium,semibold,bold}` | 400, 500, 600, 700 |
| Line height | `line-height.{none,tight,snug,normal,relaxed}` | 1, 1.25, 1.375, 1.5, 1.625 |
| Letter spacing | `letter-spacing.{tight,normal,wide}` | -0.025em, 0, 0.05em |
| Font family | `font.family.{sans,display,mono}` | system UI stack; alias of `sans`; system monospace stack |
| Icon size | `icon.size.{sm,md,lg}` | 1, 1.25, 1.5 rem |
| Target | `target.min` | 1.5rem (WCAG 2.5.8) |
| Elevation (`shadow`) | `elevation.{none,sm,md,lg,xl}` | Two-layer shadows, stronger in dark mode so they stay visible; `sm` controls, `md` cards (`odd-card variant="elevated"`), `lg` popovers and menus, `xl` dialogs |
| Motion duration (`duration`) | `motion.duration.{fast,normal,slow,slower}` | 100, 200, 300, 500 ms; **0ms under `prefers-reduced-motion: reduce`** |
| Motion easing (`cubicBezier`) | `motion.easing.{standard,enter,exit,linear}` | `cubic-bezier(0.4, 0, 0.2, 1)`, `(0, 0, 0.2, 1)`, `(0.4, 0, 1, 1)`, `(0, 0, 1, 1)` |
| Stacking | `z-index.{base,raised,sticky,overlay}` | 0, 1, 100, 200 — in-flow layers only; dialogs, popovers, and menus use the top layer (css-architecture.md §9) |

Reduced motion is emitted by the generator: tokens with a `reducedMotion` value are re-declared inside `@media (prefers-reduced-motion: reduce)` on the same selectors as the base declarations, so nested theme scopes cannot restore full motion and every alias of a duration follows. Components therefore get reduced motion by reading the duration tokens; essential motion (a progress spinner) keeps its own reduced-motion rule. Durations must not be relied on for cleanup (no `transitionend`-dependent logic, css-architecture.md §11).

Unit policy for the new types: durations are non-negative `ms`/`s` times, easings are `cubic-bezier()` with x values in [0, 1] (the DTCG `cubicBezier` type, so `linear` is written `cubic-bezier(0, 0, 1, 1)`), `z-index.*` values are integers; violations report `unit.invalid`. `values` literals of aliases are given per mode when the alias target is mode-dependent.

### 10.4 Semantic colour contracts (implemented, plan item 247)

`ROLE_CONTRACTS` (exported from `@oddkin/tokens/generate`) states, for each colour concern, which foreground role must reach which WCAG 2.2 minimum against which background roles, in every mode and every product. The backgrounds are the surfaces the components actually draw the role on.

| Concern | Foreground | Backgrounds | Minimum |
| --- | --- | --- | --- |
| text | `color.text.primary` | canvas, surface default/raised/sunken/hover/specimen, danger/success/warning surfaces | 4.5:1 (1.4.3) |
| text | `color.text.secondary` | canvas, surface default/raised/sunken/hover/specimen | 4.5:1 (1.4.3) |
| interaction | `color.text.on-action` | `color.action.{default,hover,pressed}` | 4.5:1 (1.4.3) |
| interaction | `color.selection.foreground` | `color.selection.background` (selection also has a non-colour marker) | 4.5:1 (1.4.3) |
| interaction | `color.link` | canvas, surface default/raised/sunken/hover | 4.5:1 (1.4.3) |
| interaction | `color.border.strong` (control boundaries) | canvas, surface default/raised/sunken/hover | 3:1 (1.4.11) |
| focus | `color.focus.ring` (drawn at an offset over the surrounding surface) | canvas, surface default/raised/sunken/hover/specimen | 3:1 (1.4.11) |
| invalid | `color.danger.foreground` (error text and invalid borders) | canvas, surface default/raised/sunken/hover, danger surface | 4.5:1 (1.4.3; so borders exceed 3:1) |
| status | `color.{success,warning}.foreground` | canvas, surface default/raised, own status surface | 4.5:1 (1.4.3) |
| disabled | `color.text.disabled` | surface sunken/default, canvas | exempt (1.4.3 exception): measured and reported, never warned |

**Loading** has no colour role: a busy control keeps its enabled colours and draws its indicator in `currentColor`, so the text and interaction contracts cover it. Hover and pressed states are covered by the interaction rows (`surface.hover` is a background of every text, link, and focus row).

**Generation.** Contrast-selected roles (`link`, `focus.ring`, and the status foregrounds) are chosen against every background their contracts name (`contractBackgrounds(name)`), so generated themes pass by construction: 14 brand vectors, alone and as products of one theme, generate with no diagnostics. Widening the backgrounds moved generated dark-mode roles one step lighter, because a generated dark `surface.hover` is lighter than the surfaces checked before (the old dark focus ring reached only 1.79:1 on it). A role step is shared by every product, so adding a product can move a contrast-selected role in the base theme (ADR 0006); nothing else in the base changes.

**Reports and corrections.** `contrast.fail` is one warning per foreground role and mode, naming every background it fails on with the measured ratio. When a reference step of the role's ramp meets the role's minimum on all its backgrounds, the warning carries that step as `correction` (`{ token, mode, value: '{ref.neutral.500}', hex, ratio }`), the step closest in OKLCH lightness to the current colour, and the suggestion names the override to write. Nothing is applied automatically; brand inputs and overrides are never changed. `contrastReport(theme)` returns every contracted pair for the base theme and each product (`concern`, roles, hex values, ratio rounded down to two decimals, minimum, criterion, `pass` / `fail` / `exempt`) for Theme Studio's contrast table and audits.

**Control boundaries (2026-10-22):** the owner changed the light `color.border.strong` in Figma from `#8c8f9d` (2.80:1 on `surface.sunken`) to `#868997`, and the default theme took the value from the variables snapshot (§10.5). It reaches 3.03:1 on `surface.sunken`, 3.04:1 on `surface.hover`, 3.18:1 on `canvas`, and 3.47:1 on `surface.default`/`raised`; dark is at least 3.43:1. The contract covers every surface. Profiles that override colour roles are not yet checked against the contracts.

*(Verified in `packages/tokens/test/generate.test.ts` and `products.test.ts`; see [verification.md](../verification.md).)*

### 10.5 Figma parity (implemented)

`design/figma/variables.json` is a read-only export of the Figma file's local variables, text styles, and effect styles (`design/figma/variables.export.js` run through the Figma MCP; schema `variables.schema.json`). Tests read the snapshot and never call Figma; refreshing it is a deliberate, dated export recorded in its `source`.

`packages/tokens/test/figma-parity.test.ts` holds the mapping table and checks that every Figma value equals a token of the default theme, in light and dark (colours as lower-case hex, Figma px as rem at 16 px):

- **Variables.** `Oddkin · Component roles` (Light/Dark modes) names token paths directly, and its Web code syntax must be the mapped `var(--odd-*)`. `Oddkin · Repository tokens` (one mode) uses `repo/<path>[/light|/dark]`; no suffix means the value holds in both modes. `Oddkin · Shared theme` uses `theme/<mode>/<path>` plus legacy names listed in the test.
- **Text styles** compare size, weight, line height, and letter spacing with `type.<style>.*`, or with the foundation steps a component style uses. Families are not compared: Figma substitutes Roboto and Roboto Mono for the system stacks, so text widths are not a contract.
- **Effect styles** `Oddkin/Elevation/<step>/<mode>` compare layer by layer with `elevation.<step>`.

The test also reports, as exact lists, Figma variables with no token, tokens Figma lacks, mismatches it attributes to Figma, and **alias gaps**: Figma literals where the theme aliases another token. Fixing one in Figma and refreshing the snapshot fails the test until its entry is removed, so the lists stay current. Results for the 2026-10-22 snapshot are in [verification.md](../verification.md).

### 10.6 Role scales for component style modules (from the Figma components)

Every concern below already has roles; component styles and the shared style modules in `@oddkin/components/styles` read these tokens and add none of their own. The Figma components bind the same variables (page 158:22, read 2026-10-22; Figma binds no component-level variables for these, so there are no component tokens). Rows marked *pending* need an owner decision before a role is added.

| Concern | Roles | Figma evidence |
| --- | --- | --- |
| Control size `sm \| md \| lg` | `control.height.{sm,md,lg}`, `control.padding.inline.{sm,md,lg}`, one `control.gap` for every size, `control.radius`; block padding 0 (the height sets it); text `type.ui`, and `font.size.md` with the `ui` weight and line height at `lg` | Buttons at three sizes, icon button (`md` square), input, select, segmented, listbox option and menu item rows (`md`) |
| Card | `color.surface.default`, `color.border.default`, `card.radius`, `card.padding`; filled: `color.surface.sunken`, no border; elevated: `elevation.md` | `card` Default and Filled |
| Floating surface (popover, menu, listbox popup, toast, tooltip) | `color.surface.raised`, `color.border.default`, `elevation.lg`, `card.radius` (tooltip: `control.radius`) | Not consistent in Figma: popover and toast use `surface.default`; the menu has no shadow; the select popup uses `border.strong`, `elevation.md`, `control.radius` (reported to the owner) |
| Modal surface (dialog, alert dialog, drawer) | `color.surface.default`, `color.border.default`, `elevation.xl`, `card.radius` | All three agree |
| Tone `neutral \| success \| warning \| danger` | `color.<tone>.surface` and `color.<tone>.foreground` (icon, title, emphasis); body text stays `color.text.primary`; neutral uses `color.surface.sunken` | `alert`, `badge`, `toast`; no tone borders (invalid controls draw `color.danger.foreground` as the border). *Pending:* `info` (no Figma tone), and the neutral foreground (`text.secondary` in badges, `text.primary` in alerts) |
| Selection | `color.selection.{background,foreground}` for checked and selected controls; selected rows mark selection with a non-colour indicator | Chip, checkbox, radio, switch on. *Pending:* a selected listbox option uses `surface.hover`, the hover colour |
| Indicators (checkbox, radio, switch) | Box or track: `color.surface.default` (switch track `color.surface.sunken`) with a `border.width.default` `color.border.strong` edge; hover `color.surface.hover`; checked `color.selection.background` with the mark or thumb in `color.selection.foreground`; switch thumb off `color.text.secondary`; invalid edge `color.danger.foreground`; radius `radius.sm` (checkbox), `radius.full` (radio, switch) | `checkbox`, `radio`, `switch`; disabled checked states use 50 % opacity in Figma, the other disabled states use `surface.sunken` and `text.disabled` |
| Overlay | `elevation.lg` floating, `elevation.xl` modal. *Pending:* a scrim colour for modal backdrops (no Figma source) | Dialog, drawer, popover |
| Focus ring | `color.focus.ring` (the action colour), `focus.width`, `focus.offset`; rows draw it inset with `radius.sm` | Every focus variant |
| Progress | Track `color.surface.sunken`, fill `color.action.default`, radius `radius.sm` | `progress` |

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

Recipes are the recommended way to use conditions in components; the raw outputs exist for ordinary CSS and tooling. (The TS example needs `unsafeCSS` because a query string is not a permitted value interpolation; `condition()` from `@oddkin/components/layout` wraps this: ``css`${condition('navigation.expanded')} { … }` ``.)

### 11.6 Validation, provenance, Theme Studio

- Diagnostics: `condition.unit.invalid`, `condition.syntax.unsupported`, `condition.container.unknown`, `profile.target.disallowed`, `profile.overlap`, `role.category.violation`, `role.targetSize.belowMinimum`.
- Every role, condition, and profile records provenance (default / preset / config / override).
- Theme Studio edits the same `conditions` and `profiles` config, previews the side-navigation fixture and other compositions in resizable containers side by side, shows which condition and profile are active in each preview, and traces each role through profile → alias → computed value.

### 11.7 Implementation notes (M2)

- **Conditions export shape.** A condition is either a container query or a media query, so `@oddkin/tokens/conditions` (and the `<name>.conditions.ts` module the CLI emits) maps each name to `{ kind, query, atRule }`: `query` is the prelude after the keyword and `atRule` the complete prelude, as in the §11.5 example. Names sort alphabetically; configured conditions replace preset conditions with the same name.
- **Features.** Container conditions accept a container name or `true` (nearest size container) with `minInlineSize`/`maxInlineSize` (emitted as `min-inline-size`/`max-inline-size`, supported wherever container queries are) and `minWidth`/`maxWidth`. Media conditions accept `minWidth`/`maxWidth` and `prefersReducedMotion`, `prefersColorScheme`, `prefersContrast`, `forcedColors`; logical sizes in media conditions report `condition.feature.unsupported`. Ranges that can never match report `condition.range.empty`; `px` thresholds warn.
- **Invalidation.** Thresholds are compiled into query text. Changing one means regenerating the outputs that contain it (CLI build, or a preview-owned stylesheet in Workbench/Theme Studio); setting any custom property at runtime never changes a query. *(Verified M4, `packages/components/test/conditions.browser.test.ts`, three engines: layout roles and `font-size` set on `odd-side-nav` leave its `40rem` container threshold where it is; a recipe built from a theme whose `navigation.expanded` threshold changed from `40rem` to `30rem` differs only in that query, and the stylesheet built earlier keeps its rules and its old breakpoint.)* Component thresholds such as the side navigation's are literal in its extracted styles; changing one is a new recipe (`extend()`) and a new extraction, not a theme setting.
- **Live condition editing (M4).** `recipe.extend({ conditions })` re-resolves inherited named (and inline) conditions from the new inputs, so a regenerated theme's thresholds reach an extended recipe without restating its `when` entries; the original recipe is unchanged. `previewStyles(shared, scope)` (`@oddkin/workbench/preview`) swaps a preview-owned copy of a shared sheet into the open shadow roots under one preview scope, nested ones included. `update(cssText)` replaces only the copy's rules, `refresh()` covers elements added later, and `restore()` puts the shared sheet back. *(Verified in `packages/workbench/test/preview.browser.test.ts`, three engines: a theme-named `navigation.expanded` edited from `40rem` to `30rem` switches the previewed element only. An `odd-side-nav` whose threshold is edited keeps the same shadow nodes, its focused link, and its expanded group. The shared sheet's rules, the recipe, and every instance outside the preview are unchanged.)* Variable-based query syntax is not used.
- **Profile precedence.** A `data-odd-profile` list is matched with `~=`, so CSS source order — not list order — decides between profiles that set the same role on one element. Profiles are emitted after products and densities in configuration order (preset first; a configured profile with a preset's name replaces it in place), and every overlap is reported as `profile.overlap` naming the winner.
- **Profiles inside nested scopes.** Density, product, mode, and theme scopes re-declare their closures with base expressions, which would drop a profile's values in a nested scope. Each profile rule therefore also matches `[data-odd-profile~="p"] :is([data-odd-mode], [data-odd-product], [data-odd-density], [data-odd-theme])` — the same declaration block, specificity (0,2,0). Verified in three engines.
- **Targets.** Target-size minimums are checked for each density, each profile, and each profile × density combination, limited to roles a profile actually changes or that depend on them.
- **Unit policy.** Line heights are unitless numbers, font weights are integers 1–1000, dimension literals need units, and `px` warns for type, control, layout, navigation, and card sizes (borders and optical values may use `px`). Values with references or `calc()`/`min()`/`max()`/`clamp()` are checked through what they reference.

## Open questions

- Whether `@custom-media` output is worth shipping (conditions now cover media thresholds; likely only as an optional build output).
- Final scope selector syntax (data attributes proposed: `data-odd-theme`, `data-odd-mode`, `data-odd-product`, `data-odd-density`).
