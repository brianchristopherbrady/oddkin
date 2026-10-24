# CSS architecture, compatibility, and progressive enhancement

Status: **§2–§5, §7, §10.1, §12.1, §13.1, §14, and §16 are implemented and verified** for the existing packages and components (evidence in [verification.md](../verification.md)); overlays (§9), motion between states (§11), typography scales (§12.2), and the remaining layout primitives (§8.2) are **planned contracts** owned by later milestones. Decisions: [ADR 0009](./decisions/0009-browser-support-baseline.md) (floor), [ADR 0038](./decisions/0038-css-compatibility-and-progressive-enhancement.md) (compatibility policy), [ADR 0039](./decisions/0039-cascade-layer-order.md) (layer order). Related contracts: [theming-and-styling.md](./theming-and-styling.md) (token pipeline), [layout-recipes.md](./layout-recipes.md) (recipes), [core-contracts.md](./core-contracts.md) §6 (styles). The feature and fallback matrix is generated: [docs/compatibility/matrix.md](../compatibility/matrix.md).

Oddkin uses a reliable CSS baseline and adds modern capabilities as tested enhancements, without a second styling system. Every feature is classified against a pinned browser floor, every enhancement has a working baseline, and tooling checks both.

## 1. Inventory (2026-10-17)

| Area | Existing equivalent | Gap closed or planned here |
| --- | --- | --- |
| Token definitions, resolution, theme composition, CSS generation | `@oddkin/tokens/generate` — the only token engine; alias-closure re-declaration per scope (ADR 0007); mode toggles (theming-and-styling.md §5.1); literal query thresholds (ADR 0011) | Cascade layer for generated CSS (§5); above-floor syntax diagnostics (§4.2) |
| Global styles, resets, docs styles | None shipped; page defaults are opt-in assets (plan §5.1) | Opt-in `reset.css`, `base.css`, `utilities.css`, and `button.css` (native buttons styled like `odd-button`) in their layers (§5.1); shared shadow-root primitives (theming-and-styling.md §7) |
| Component styles and Shadow DOM customization | Structural and default styles per component; component variables, parts, host styles (theming-and-styling.md §7) | Custom state for consumer styling (`:state(user-invalid)`), hover gating, long-content wrapping (§10, §12) |
| Layout and responsive primitives | `@oddkin/core/layout` helpers `stack`, `row`, `grid`, `autoGrid`, `split`; container conditions (layout-recipes.md) | Contract audit and planned primitives (§8) |
| Overlays and native controls | None yet (M10) | Overlay and control contracts (§9, §10) |
| Motion, typography, accessibility, performance | Reduced-motion spinner, forced-colors borders, outline focus rings, `max()` target sizes; JS size budgets (ADR 0031) | Motion contract (§11), typography and input modes (§12), CSS budgets (§13) |
| Compatibility transforms and polyfills | None: CSS ships as written; colours are computed to sRGB hex by the generator | Explicit strategy (§14); no polyfills |

## 2. Support policy

### 2.1 Floor and data

| Browser | Floor | Released |
| --- | --- | --- |
| Chrome, Chrome Android | 125 | 2024-05-14 |
| Edge | 125 | 2024-05-17 |
| Firefox, Firefox Android | 126 | 2024-05-14 |
| Safari, Safari iOS | 17.4 | 2024-03-05 |

Resolved on **2026-10-17** with `@mdn/browser-compat-data` **8.1.6** and `web-features` **3.43.0**, pinned as exact dev dependencies and recorded in [features.json](../compatibility/features.json). Baseline Widely Available on that date, computed from web-features, is Chrome/Edge 123, Firefox 124, Safari 17.4. The floor sits slightly above it because of custom states (`:state()`, `ElementInternals.states`: newly available 2024-05-17, widely available 2026-11-17), which Oddkin components require. Baseline status is an adoption signal; the exact syntax and behavior used are tested.

The JavaScript and Web Component floor is the same: TypeScript compiles to ES2022 with the ES2023 library, so newer built-ins (set methods, iterator helpers) do not type-check in shipped code; DOM features above the floor are feature-detected (§2.3).

### 2.2 Categories

1. **Foundation** — required; fully supported by every floor browser, or listed with a documented **floor exception** (e.g. popover light dismiss on Safari iOS 17.0–18.2, cursor keywords on iOS).
2. **Enhancement** — above the floor in at least one browser; applied only behind a gate (§3.2), with a working baseline, documented differences, and tests of both paths.
3. **Experimental** — isolated evaluation only, never in shipped CSS (§15).
4. **Deferred / declined** — evaluated with a recorded reason and owner.

**Browsers outside the floor** (e.g. Safari 17.3, Firefox 125) are not supported: Oddkin may fail there, and no compatibility build targets them. Raising or lowering the floor is a release decision recorded in ADR 0009 with re-resolved data.

### 2.3 Re-pinning each release

`npm i -D -E @mdn/browser-compat-data@<v> web-features@<v>`, update `checked` and `data` in features.json, run `npm run compat` (regenerates the matrix and fails on any foundation that the data no longer supports at the floor, any stale exception or enhancement, and any token-syntax entry that disagrees), then `npm run compat:floor`.

## 3. Feature and fallback matrix

### 3.1 Registry

[docs/compatibility/features.json](../compatibility/features.json) (schema [compatibility.v1](../schemas/compatibility.v1.schema.json)) records, for every adopted or evaluated feature: exact syntax; every BCD key relied on (subfeatures individually — an anchor-positioning property does not establish `position-area` keywords or `anchor-scope`); web-features id; adoption category; status (`implemented`, `planned` with an owning milestone, `evaluated`); users; baseline behavior; enhanced behavior; gate; expected differences; floor exceptions; detection strings for the probe; and cited tests. The matrix is generated from it.

### 3.2 Gates

| Gate | Use | Not a gate |
| --- | --- | --- |
| `@supports (<property>: <value>)` / `@supports selector(<selector>)` | Any enhancement; required when the value reads `var()` or the enhancement needs companion declarations | A `var()` fallback |
| Literal fallback: a floor value, then the enhanced literal value of the same property in the same block | Values the parser drops at parse time (`text-wrap: wrap; text-wrap: balance;`) | The same pattern when either value contains `var()` (validity is decided at computed-value time) |
| Feature detection in script (`'moveBefore' in Element.prototype`) | DOM APIs with a scripted baseline | Mocked `CSS.supports()` in tests (does not change the parser) |

### 3.3 Checks

`npm run lint:css` (part of `npm run lint` and `npm run verify`, [scripts/compat/check-css.mjs](../../scripts/compat/check-css.mjs)):

- validates the registry against its schema and the pinned data versions;
- fails when a foundation is not fully supported at the floor without an exception, an exception is stale, an enhancement no longer exceeds the floor, a web-features id or BCD key does not exist, or a cited test is missing;
- verifies the token generator's above-floor syntax list (§4.2) against the data;
- parses every shipped and example stylesheet with css-tree (token CSS, component style modules, recipe outputs, example CSS) and maps each property, value keyword, function, unit, selector, media feature, and at-rule to BCD; anything above the floor must be a **registered enhancement** that is gated (§3.2); custom-property values are checked too, because their readers fail (§4.2); above-floor selectors may not share a non-forgiving selector list (the whole rule would be dropped);
- regenerates the matrix and fails if the committed copy is stale.

Unit tests prove each rule catches its hazard (`tests/compat/check-css.test.ts`).

## 4. Tokens and colour

### 4.1 One canonical engine

Primitive (reference), semantic, and component tokens keep their responsibilities (theming-and-styling.md §5, §11.1): reference tokens describe values, semantic tokens describe roles, component tokens and component variables are intentional customization points. Compatible and enhanced CSS both come from `@oddkin/tokens/generate`; no component, compatibility build, or tool computes token values independently. Theme, mode, product, density, and profile contexts compose through the same engine with alias-closure re-declaration (ADR 0007), so nested themes and dependent aliases re-resolve at every boundary — verified in nested scopes, across shadow roots, and in Chrome 125 and Firefox 126 (`tests/floor/probe.js`: `scope-*`). DTCG Format and Resolver interoperability stays owned by M9 (theming-and-styling.md §9).

Coverage today: colours and foreground/background pairs (contrast-selected roles and the approved default palette, theming-and-styling.md §10.1), status roles for danger, success, and warning, spacing and layout roles, typography scales and eight text-style roles (§10.2), radius and border scales, elevation `none`–`xl`, motion durations (0ms under reduced motion) and easings, in-flow stacking levels, icon sizes, control sizing and density, focus width/offset/colour, target minimum (§10.3, ADR 0042). Planned for M9: fluid type and font-metric fallbacks, scrims, a reduced-motion scope for in-page toggles.

Media and container thresholds are literal query strings generated by the canonical pipeline (ADR 0011); a runtime custom property never changes a query.

### 4.2 Unsupported syntax inside custom properties

A custom property accepts almost any value. When a declaration reads it with `var()` and the substituted value does not parse for that property, the declaration is **invalid at computed-value time**: the property behaves as `unset` (inherits or takes its initial value). The `var()` fallback is not used, because the variable is defined, and earlier declarations of the property have already lost the cascade. So unsupported syntax inside a token can silently remove essential colours or sizes. Evidence: `packages/tokens/test/cascade.browser.test.ts` (three engines) and the floor probe, which reproduces it with real syntax — `contrast-color(red)` in Chrome 125, `oklch(from red l c h)` in Firefox 126 — while the `@supports`-gated version keeps the baseline.

Rules:

- Token values stay within the floor. The generator reports `value.syntax.aboveFloor` (warning; `--strict` fails) for value syntax the floor cannot parse (`light-dark()`, relative colour syntax, `contrast-color()`, `calc-size()`, `anchor()`, `anchor-size()`, `if()`, `abs()`, `sign()`, `progress()`, `sibling-index()`, `sibling-count()`, `random()`), naming the browsers; literal colour overrides already fail `color.invalid`, whose suggestion now names the floor. The list lives in `@oddkin/tokens/generate` (`ABOVE_FLOOR_SYNTAX`) and is verified against the pinned data.
- Enhanced values are assigned only inside `@supports` blocks that test the consuming syntax, after a baseline assignment. When the generator emits enhanced token values (first use: wide-gamut ramps, M9), it emits the gated block itself, per scope, from the same definitions.
- The CSS lint applies the same rule to every stylesheet.

### 4.3 Colour decisions

| Feature | Decision |
| --- | --- |
| OKLCH / OKLab | Foundation for generation; output is gamut-mapped sRGB hex (ADR 0006) |
| Wide gamut (P3) | Deferred to M9: P3 ramp values from the same OKLCH definitions in a `(color-gamut: p3)` block, only after contrast is verified for the P3 values |
| `color-mix()` | At the floor; planned for scrims and elevation (M9) with contrast measured against real backgrounds |
| Relative colour syntax | Deferred to M9: derived state colours from consumer-supplied component colours, gated, with contrast verification; never in tokens |
| `light-dark()` | Declined for tokens: the inherited mode toggles work at the floor for any value type and nest with every scope; `light-dark()` needs Safari 17.5 and covers colours only |
| `contrast-color()` | Declined as an accessibility mechanism (black or white only); semantic foregrounds stay authoritative; possible bounded enhancement in M9 |

Light and dark themes, explicit overrides of the system preference (`data-odd-mode`), nested opposite-mode surfaces, and runtime mode changes are verified (`generate.browser.test.ts`, `e2e/tokens-css-only.spec.ts`, `e2e/css-compat.spec.ts`). Every mode scope sets `color-scheme`, so native controls and scrollbars follow it. The CSS-only path has no theme flash: the generated stylesheet decides the mode at first paint; there is no script-driven theme application or hydration step (an SSR/hydration strategy is deferred by the plan).

Planned verification (M9): transparent colours against their actual backgrounds, hover/active/selected/disabled/focus pairs per state, runtime accent changes in Theme Studio.

## 5. Cascade, encapsulation, and customization

### 5.1 Layer order (ADR 0039)

Every Oddkin document-level stylesheet that uses layers begins with the canonical statement, so whichever loads first establishes the same order:

```css
@layer odd.reset, odd.tokens, odd.base, odd.layout, odd.components, odd.utilities;
```

| Layer | Responsibility | Status |
| --- | --- | --- |
| `odd.reset` | Optional focused reset: border-box sizing, no body margin, media within their container, form controls inheriting fonts, long words wrapping; preserves inherited typography, direction, and user preferences | **Implemented** — opt-in `@oddkin/components/css/reset.css` |
| `odd.tokens` | Generated custom properties, `color-scheme`, scope selectors | **Implemented** — `@oddkin/tokens` CSS |
| `odd.base` | Optional page defaults from the theme: canvas background and `type.body` text, links, code fonts, the focus ring | **Implemented** — opt-in `@oddkin/components/css/base.css` |
| `odd.layout` | Page-author layout classes from `@oddkin/components/layout` | **Implemented** — opt-in `@oddkin/components/css/layout.css` (layout-recipes.md §12) |
| `odd.components` | Light-DOM component styles for documents | **Implemented** — opt-in `@oddkin/components/css/button.css`: `<button class="odd-button">` with `data-appearance`, `data-size`, `data-full-width`, the same `--odd-button-*` variables and focus ring as `odd-button` (§10.1) |
| `odd.utilities` | Optional utilities: `.odd-visually-hidden`, `.odd-focus-ring` (same rules as the shadow-root primitives) | **Implemented** — opt-in `@oddkin/components/css/utilities.css` |
| *(unlayered)* | **Application overrides** | — |

Emission options: `generate(config, { css: { layer } })`, `buildTheme(config, { cssLayer })`, `oddkin-tokens build --css-layer <name|none>`. A custom name emits only that layer (without the Oddkin order); `none` restores the unlayered output.

### 5.2 Precedence

- Normal unlayered declarations outrank normal layered declarations in the same encapsulation context, regardless of specificity or order: an application's unlayered `:root { --odd-color-text-primary: … }` wins over `odd.tokens` wherever both match the same element.
- Application layers win only when ordered after `odd`; an application that declares its own layers first states `@layer odd, app;`.
- `!important` reverses layer order (important `odd.*` declarations would beat important application declarations). Oddkin's document stylesheets contain no `!important`. The only `!important` declarations Oddkin ships are inside shadow roots: `hostStyles` makes the `hidden` attribute hide the host and internal elements even where a rule sets `display` (verified in `styling.browser.test.ts`).
- Shadow DOM is a separate encapsulation context: for normal declarations, outer-context rules that reach the host or an exposed part (host selectors, `::part()`) win over the component's inner rules regardless of specificity; inner `!important` wins over outer normal. Document layer order never reaches into a shadow root, and global descendant selectors never style internals.
- A root override does not cross a nested scope that re-declares the role (alias closure): theme-wide changes belong in the configuration's `overrides`, which the generator emits into every scope.

Evidence: `packages/tokens/test/cascade.browser.test.ts`, `packages/components/test/styling.browser.test.ts` (three engines), `tests/floor/probe.js` `layer-order` (Chrome 125, Firefox 126).

### 5.3 Theme precedence

From strongest to weakest for a given element:

1. **Component overrides** — component variables (`--odd-button-background`) set on the host or an ancestor, parts, and host styles: affect that component only.
2. **Explicit application configuration** — unlayered application CSS, and the configuration's `overrides` (generated into every scope).
3. **Scoped theme configuration** — the nearest `data-odd-theme|mode|product|density|profile` scope; nearer scopes win through inheritance.
4. **System preferences** — `prefers-color-scheme` applies at the root only when no explicit `data-odd-mode` is set; `data-odd-mode="system"` restores it in a subtree.
5. **Library defaults** — the preset and generated values in `odd.tokens`.

### 5.4 Selectors and customization surface

- Recipes flatten selectors with `:where()` (one class of specificity); tokens use `:is()` to re-apply profiles in nested scopes. Nested CSS (at the floor) takes the specificity of `:is()` over its parent list; review specificity when nesting existing rules.
- Customization surface: inherited semantic tokens; documented component variables (normally unset, read with a semantic fallback); stable parts; custom states (`odd-input:state(user-invalid)::part(control)`); appearance attributes. Component defaults never re-declare the theme on `:host`.
- `:has()` does not see into other shadow trees and cannot be combined with `::slotted()`; `::slotted()` matches only top-level slotted elements; `::part()` cannot be followed by attribute selectors, so component states are exposed as custom states, not attributes on internal elements. *(`::slotted()`, `::part()`, and `exportparts` limits verified in `packages/core/test/container-contract.browser.test.ts`, three engines.)*
- Container names are not encapsulated by shadow roots (same test): a page query by name finds a container named inside a component when it styles slotted content. Components name only their host as a container, or namespace internal names.
- `@scope` is deferred to docs-only light-DOM styling (M11; Firefox 126 and Safari 17.4 lack full support). Light-DOM components scope by tag or class.

## 6. Component styling rules (implemented)

- Structural styles hold what layout and interaction depend on; default visual styles read semantic tokens through component variables (multi-product.md layered exports).
- Hover feedback is gated by `@media (hover: hover)` so taps leave no sticky state; every action works without hover (`e2e/css-compat.spec.ts`, Chromium touch emulation).
- Long labels, URLs, and translated text wrap (`overflow-wrap: anywhere` on button labels, card content, field text); `min-inline-size: 0` on flex regions (`styling.browser.test.ts`).
- Logical properties throughout; `dir="rtl"` mirrors slots and spacing (`styling.browser.test.ts`).
- Targets never fall below `target.min` (`max()`), sizes are `rem`-based and grow with the root font size (`styling.browser.test.ts`).

## 7. Typed custom properties (`@property`, `CSS.registerProperty()`)

Decision (ADR 0038): **no registrations now**.

- Theme tokens are never registered: they must inherit, and the mode toggles depend on guaranteed-invalid values that registration would replace with an initial value.
- Component variables are never registered: a registered initial value always satisfies `var(--odd-button-background, <semantic fallback>)`, so the semantic fallback would never apply. Evidence: the floor probe's `registration-masks-fallback` shows the mask in Chrome 125, while Firefox 126 (no `@property`) uses the fallback — the same CSS would behave differently across floor browsers.
- Later candidates (M10) are component-private animatable properties (progress, skeleton). Each registration records name, owner, syntax, `inherits: false`, a valid initial value, registration once per document by the owning definition (not per instance), a deterministic conflict policy (an existing registration with a different syntax is reported, never re-registered), and unregistered behavior as the baseline. Essential validation stays in the token and configuration system.

## 8. Layout primitives

### 8.1 Contracts of the existing helpers

| Primitive | Helper | Contract |
| --- | --- | --- |
| Stack | `stack()` | Column flex with `gap`; `min-inline-size: 0` |
| Inline / cluster | `row({ wrap: true })` | Wrapping row with `gap`; `row()` without wrap is for toolbars that must not wrap |
| Grid | `grid({ columns })`, `autoGrid({ min })` | `repeat(n, minmax(0, 1fr))`; `repeat(auto-fill, minmax(min(<min>, 100%), 1fr))` — never overflows its container |
| Split / sidebar | `split()` | Intrinsic wrapping sidebar (`flex-grow: 999` main with a minimum); no query needed |
| Responsive switching | Container conditions on a recipe | Literal size queries against a declared container (ADR 0011) |

All helpers use logical properties, `min()`/`minmax()` against overflow, and never set typography or target sizes (layout-recipes.md §3). The baseline layout is usable without queries; queries add transitions, never essential function. No `ResizeObserver` is used for responsiveness.

### 8.2 Planned primitives (with the side-nav slice and M10, from demonstrated needs)

Constrained content (`max-inline-size: min(100%, <measure>)` with `margin-inline: auto`), aspect-ratio frames (`aspect-ratio` with `object-fit`; content may grow rather than clip), scroll regions (`overflow: auto`, keyboard-focusable with a name, `scrollbar-gutter` and `overscroll-behavior` as enhancements), and subgrid for aligned card headers and form rows (parent and child grids in the same tree only).

### 8.3 Container ownership

- Primitives (button, input, badge, icon) never declare containers: size containment would collapse their intrinsic size.
- Compositions own containers (cards in grids, side navigation, page regions) and name them when nested (`container: <name> / inline-size`), as the gallery's frame does (`gallery-frame`).
- Container-relative units (`cqi` and friends) are used only inside a declared container; without one they fall back to the small viewport, which a component must not assume.
- Container style queries and scroll-state queries are experimental (§15): attributes, profiles, and size queries remain the contract.
- The gallery's grid-blowout finding (a definite-width child widening an `auto` page track) is the pattern to avoid: page tracks that hold resizable content use `minmax(0, 1fr)`.

## 9. Overlays (planned, M10)

The overlay contract (menus, listboxes, tooltips, popovers, combobox surfaces) is independent of the positioning technology:

- **Positioning:** one shared Oddkin positioning controller in `@oddkin/core/controllers/position` ([ADR 0044](./decisions/0044-overlay-positioning-and-top-layer.md); no third-party runtime) computes placement from measured rectangles while an overlay is open — flip and shift fallbacks, nested scrolling, transformed ancestors, visual viewport and zoom changes — and starts observers and listeners only while open, under the overlay's `Scope`. Native anchor positioning replaces it only when every subfeature the contract needs is detected (`anchor-name`, `position-area` keywords, `position-try-fallbacks` tactics, `anchor-scope` for repeated component instances; BCD shows Chrome needs 151 for full `position-anchor` support). Exactly one backend owns positioning at a time. The measured backend is implemented (core-contracts §4.1, `packages/core/test/position.browser.test.ts`, three engines): sides and alignment in both directions and a vertical writing mode, flip, shift, scroll containers outside a shadow root, anchor resizing, listening only while open, and a surface that stays in place and inherits custom properties and `dir`. Pinch zoom (the visual viewport offset) is not yet exercised.
- **Top layer:** nonmodal overlays use `popover`; modal dialogs use `<dialog>` with `showModal()` and `inert` backgrounds. Safari iOS 17.0–18.2 does not light-dismiss popovers on outside taps (floor exception), so overlays always offer an explicit close control. Top-layer rendering keeps the element in place in the DOM, so theme scopes, `dir`, and `lang` are inherited as written; a portal would move content and lose them, and is not used.
- **Stacking:** regular `z-index` tokens (`z-index.{base,raised,sticky,overlay}`, implemented) order in-flow layers; top-layer order is the browser's open order and is never emulated with large `z-index` values.
- **Behavior:** roles, focus movement and return, dismissal, and keyboard interaction follow APG patterns independently of positioning; modal and nonmodal semantics stay distinct.

Verification (F09, F10): repeated instances with correct anchors and cleaned-up observers; theme, density, direction, and language inheritance in native and fallback paths; nested scroll containers.

## 10. States and native controls

### 10.1 Implemented

- Component state stays in its controller. `odd-input` derives one value (`_userInvalid`) for both `aria-invalid` on the native control and the `user-invalid` custom state on the host; there is no second state store. Native `:user-invalid` is at the floor but does not cover a custom `error` or failed submissions, so Oddkin form components expose `:state(user-invalid)` instead (plain native fields in docs may use `:user-invalid`).
- Focus uses `:focus-visible` with outlines, which remain visible in forced-colors mode (box shadows do not); verified with forced-colors emulation in three engines.
- Above-floor selectors never share a non-forgiving selector list with baseline selectors (the CSS lint enforces it), so an unsupported selector cannot drop a baseline rule.
- **Native buttons styled as `odd-button`:** `odd-button` submits through a temporary native button, so it is never the submitter the page sees nor the form's default button for Enter (limitations in its JSDoc). Where those semantics matter, `button.css` styles a native `<button class="odd-button">` with the same tokens, component variables, hover gating, focus ring, and forced-colors borders, in `odd.components`; `data-appearance`, `data-size`, and `data-full-width` mirror the element's attributes. It has no loading state. `styling.browser.test.ts` compares 25 computed properties of each native button with the matching `odd-button` control in every appearance, size, and disabled state, in light and dark mode, with component variables, full width, focus ring, and hover, in three engines; `e2e/forms.spec.ts` shows the native button submitting as itself and as the default button for Enter.

### 10.2 Planned (M10)

- **Field sizing:** textareas grow with `field-sizing: content` inside `@supports`, bounded by `min-block-size`/`max-block-size`; the baseline is a fixed row count with user resizing (`resize`; no handle on iOS or Firefox for Android) and scrolling. Script autosizing only from demonstrated need, and never together with native sizing; caret, selection, scrolling, and resizing are verified in both paths (F12).
- **Select:** a styled native `<select>` is the baseline (semantics, keyboard, validation, form participation); `appearance: base-select` and `::picker(select)` style the open picker only when the complete enhanced rule set is supported (F13). The control is never replaced to obtain styling. Finding: WebKit 27.2 reports one `style-src-attr` CSP violation per native `<select>` under a strict `style-src` policy, from its internal rendering (Chromium 156 and Firefox 157 report none); `odd-select` (a native `<select>` in its shadow root) documents it as a `@limitation` in its metadata and in component-contracts.md §3.3, and a strict-CSP check that renders it allows exactly that WebKit report, as css-compat.spec.ts and docs.spec.ts do for native selects.
- `:open` styling is gated (`@supports selector(:open)`) after an `[open]` baseline.

## 11. Motion (planned with overlays and disclosures, M10)

- Every open/close, navigation, and state change works with no animation; reduced motion removes or shortens decorative motion (the loading spinner turns slowly instead of fast; verified).
- Durations and easings come from `motion.duration.*` and `motion.easing.*` (implemented, theming-and-styling.md §10.3); the generated token CSS sets every duration to `0ms` under `prefers-reduced-motion: reduce`, so transitions that read the tokens stop without a component-level gate.
- Cleanup never depends only on `transitionend`/`animationend`: state, visibility, inertness, focus, and accessibility attributes change synchronously; cancelled, interrupted, and zero-duration transitions settle to the same final state (F11).
- `@starting-style` and `transition-behavior: allow-discrete` animate top-layer and `display: none` changes only behind `@supports` and `prefers-reduced-motion: no-preference`.
- Interpolating to intrinsic sizes (`interpolate-size`, `calc-size()`) is experimental.
- View transitions are an optional router enhancement (M7/M11) with generated per-instance names; scroll-driven animations are decorative only.
- Animation names are prefixed (`odd-button-spin`) and defined inside the component's shadow root.

## 12. Typography, accessibility, and input modes

### 12.1 Implemented

- Type and spacing in `rem`, unitless line heights; nothing forces a root size; `rem` outputs follow the reader's root font size (verified at 200%).
- Forced colours: control boundaries use system colours (`ButtonText`, `FieldText`, `CanvasText`, `GrayText`); no `forced-color-adjust` opt-out.
- Reflow: the components-only example and the gallery reflow at 320 CSS pixels without horizontal scrolling (WCAG 1.4.10), with long content.
- Pointer and hover: hover feedback only with `(hover: hover)`; nothing requires hover.
- Targets meet WCAG 2.5.8 through `target.min` in every density and profile (generator check) and in components (`max()`).
- **Names across shadow boundaries:** a native control inside a shadow root is named inside that root — `odd-input` by its own `<label for>`, `odd-button` by slotted text or by `label` (`aria-label` on the inner button) — and described there (`aria-describedby` to the description and error parts). Host semantics go through `ElementInternals` (`odd-card`: `role` with `ariaLabel` from `label`, or `ariaLabelledByElements` pointing at its slotted heading, feature-detected), so hosts carry no ARIA attributes. Evidence (`e2e/components-only.spec.ts`): Chromium's native accessibility tree (DevTools protocol) shows both card regions, the button and field names, the field's description, `required`, and `invalid` after a blocked submission. Playwright's ARIA snapshot, which Playwright computes from each engine's DOM, styles, and open shadow roots, is identical in Chromium, Firefox, and WebKit for names and the invalid state; it does not read `ElementInternals`, so it cannot show the card regions. Native accessibility trees in Firefox and WebKit (no Playwright API) and screen readers are not verified.
- **Automated audit:** axe-core 4.14.0 with the WCAG 2.0, 2.1, and 2.2 A and AA rules reports no violations for every `odd-button` and `odd-input` state and the `odd-card` naming cases with the shipped theme in light and dark mode, so colour contrast is measured on real role values (`packages/components/test/accessibility.browser.test.ts`, three engines), nor for the components-only page as a whole, workspace and packed, in both modes and after a blocked submission (`e2e/components-only.spec.ts`). axe reads open shadow roots, and a guard test confirms that it reports an unlabelled field, an unnamed icon button, and low-contrast text inside them. It does not read `ElementInternals` semantics, and an automated audit is not a screen-reader check.
- **Keyboard targets:** each component adds exactly the Tab stops of its native equivalent, in the same order, forward and back: one per enabled or loading `odd-button` (none when disabled), one per enabled or read-only `odd-input` (none when disabled or in a disabled fieldset), none for `odd-card` itself, and the links and buttons of `odd-side-nav`. The hosts are never focusable on top of their inner controls (`packages/components/test/keyboard.browser.test.ts`, compared with native markup in each engine, so WebKit's default of leaving links out of the Tab order applies to both).
- **Composite widgets (rule for M10).** Roles that reference each other stay in one tree: a combobox, its listbox, and its options (`aria-controls`, `aria-activedescendant`); tabs and their panels; a menu button and its menu; a radio group and its radios; a field and its label, description, and error. In order of preference:
  1. **One shadow root (the baseline).** The element renders every related role in its own shadow root and links them with ID references. This works at the browser floor. ID references never resolve across a shadow boundary, in either direction.
  2. **Host roles over light-DOM children.** Items the page authors as children (`<option>`, item elements) are allowed when the host carries the composite role through `ElementInternals` and references its children (host `role="listbox"` with `ariaActiveDescendantElement` set to a child: same tree). This needs ARIA element reflection, which arrived in Chrome 135, Firefox 136, and Safari 16.4 (`@mdn/browser-compat-data` 8.1.6), above the Chrome 125 and Firefox 126 floor, so it is an enhancement with a working baseline (as `odd-card`'s heading name is, registry entry `element-reflection`) or pattern 1 is used.
  3. **Outward references only.** An element inside a shadow root can reference the light DOM or an enclosing shadow root through element reflection (an enhancement, as above). References into a shadow root, from the light DOM or from an outer tree, are dropped by every engine. So a composite never uses a nested element as a part it must reference: a menu renders its own trigger `<button>` with the shared button styles rather than nesting `odd-button`, whose inner `<button>` the menu cannot point at, or be pointed at by, at the floor.

  Evidence: `tests/interop/aria-references.browser.test.ts`, 7 tests in Chromium 156, Firefox 157, and WebKit 27.2. The tests read the reflection getters, which return only references the engine considers valid; the engines' accessibility trees and screen readers are not checked here, and floor browsers are inferred from the compatibility data (runtime floor evidence is deferred by the owner).

### 12.2 Planned (M9 typography, M10 components)

Fluid type scales (`clamp()` with a `rem`-dominant slope, verified under zoom), font fallback metrics (`size-adjust` at the floor; `ascent-override`/`descent-override` as enhancements), variable-font axes, `text-wrap: balance` for headings and `pretty` for long text as literal-fallback enhancements, and `text-box` trimming only after tests with diacritics and non-Latin scripts. Verification covers RTL and vertical writing modes where components support them, text spacing (WCAG 1.4.12), 200%/400% zoom, `prefers-contrast`, and coarse pointers.

## 13. Delivery and performance

### 13.1 Implemented

- One constructed `CSSStyleSheet` per style definition per document, adopted by every instance; a `<style>` path with a CSP nonce for policy needs; per-document ownership after adoption (ADR 0008). Verified in three engines and in Chrome 125 and Firefox 126 (`shared-sheet`).
- Theme changes are inherited custom-property updates; component sheets are never regenerated per instance or per theme.
- Strict CSP with Trusted Types: the components-only example and the gallery run under `default-src 'none'` and `require-trusted-types-for 'script'`; inline styles are set through the CSSOM only.
- CSS budgets (gzip, `npm run size`): generated default theme 3,072 B (measured 2,764 B with the approved palette and the complete foundation scales, ADRs 0041–0042; 1,827 B before), button styles 1,280 B (1,056 B), card 640 B (531 B), input 768 B (590 B), shared primitives 384 B (297 B), document stylesheets 768 B (612 B), `button.css` 1,024 B (864 B).

### 13.2 Planned

Containment (`contain`, `contain-intrinsic-size`) and `content-visibility` per component only after measurement (M8) — containment changes containing blocks, stacking, intrinsic size, and clipping, so focus rings, shadows, overlays, sticky content, find-in-page, and the accessibility tree are checked first; no blanket containment. Broad, frequently invalidated relational selectors are avoided in dynamic interfaces. Representative measurements (component collections, theme changes, resizing, overlays, streaming AI transcripts) extend the M3 benchmarks in M8.

## 14. Compatibility build strategy

Oddkin ships **one CSS output with progressive enhancements** and no transpiler. The floor supports every syntax the shipped CSS uses (cascade layers, nesting, `:where()`/`:is()`, container queries, logical properties, `min()`/`max()`/`clamp()`); ungated shipped CSS needs at least Chrome/Edge 105, Firefox 110, Safari 16.4 (computed in the matrix).

| Transformation | Applies? |
| --- | --- |
| Syntax lowering (nesting, `@layer`, range media queries) | Not needed at the floor; not performed. Unwrapping layers would change override precedence, so it is never done |
| Prefixing | None needed for the CSS used; the lint would flag prefixed-only support |
| Statically computable values | Done by the canonical generator, not a CSS compiler: OKLCH computations become sRGB hex |
| Runtime-dependent behavior | Shared JavaScript only where behavior requires it (planned positioning controller) |
| Not faithfully transformable | `@scope`, `:has()` relational semantics, anchor scoping — enhancements or not adopted |

A compiler's presence would not establish polyfilling; Lightning CSS-style transpilation was evaluated and not added because the floor needs no lowering. Consumers load exactly one theme stylesheet per document (`@oddkin/tokens/css/default.css` or their generated theme); component styles ship inside the component modules. There is no alternate distribution to load by mistake.

## 15. Experimental policy

Experiments live outside shipped CSS until they meet the compatibility and testing requirements. Native browser features are distinct from build-time conveniences (the generator already covers token maths).

| Feature | Oddkin use case | Support (BCD 8.1.6) | Benefit over existing technique | Fallback | Decision |
| --- | --- | --- | --- | --- | --- |
| `if()` | Inline variant values | Chromium 137+ only | Fewer variant rules | Selectors and custom properties | Experiment only; generator warns in tokens |
| `@function` | Runtime value functions | Chromium 139+ only | Reusable maths | Build-time generation | Experiment only |
| Typed `attr()` | Progress/rating values from attributes | Chrome 133, Firefox 155; no Safari | No inline styles | Custom properties from script | Experiment only |
| Container style queries | Internals reacting to inherited roles | Chrome 111, Firefox 151, Safari 18 | No attributes | Attributes and profiles | Experiment only |
| Scroll-state queries | Stuck-header separators | Chrome 133 only | No scroll listeners | Constant separator | Experiment; decorative |
| `corner-shape` | Product skins (squircle, notch) | Chromium 139+ only | Brand shapes | `border-radius` | Experiment; literal enhancement in a skin later |
| Scoped view transitions | Component-local transitions | Chrome 147 only | No document-wide names | Instant changes | Experiment; revisit with view transitions (M11) |
| `interpolate-size` / `calc-size()` | Disclosure height animation | Chromium 129+ only | Animating to `auto` | Instant open | Experiment |
| `text-box` trimming | Optically centred labels | Chrome 133, Safari 18.2, Firefox 154 | Exact vertical centring | Padding-based centring | Experiment after script and diacritic tests |

Maintenance and delivery cost for each: CSS bytes in shipped styles, a gate and baseline per use, and a test of both paths; none is accepted while it would be the only path for essential function.

## 16. Verification

### 16.1 Regression scenarios

| ID | Required outcome | Status | Evidence |
| --- | --- | --- | --- |
| F01 | Baseline usable without enhancements | Verified | Gallery with the enhancement sheet disabled (`e2e/css-compat.spec.ts`); Chrome 125 and Firefox 126 probe |
| F02 | Unsupported syntax in tokens cannot silently remove essentials | Verified | `cascade.browser.test.ts`; probe `naive-token-syntax`/`gated-token-syntax` with real syntax in floor browsers; generator `value.syntax.aboveFloor`; CSS lint |
| F03 | Nested themes produce intended values incl. dependent aliases | Verified | `generate.browser.test.ts`; `e2e/tokens-css-only.spec.ts`; gallery nested surface; probe `scope-*` |
| F04 | Typed registration preserves inheritance and fallbacks | Policy verified | No registrations; probe `registration-masks-fallback` (Chrome 125 masks, Firefox 126 falls back) |
| F05 | Application overrides behave as documented across layers and Shadow DOM | Verified | `cascade.browser.test.ts`; `styling.browser.test.ts`; probe `layer-order` |
| F06 | Compatibility output preserves cascade and specificity | Not applicable | No compatibility output exists (§14); a single artifact ships |
| F07 | Components adapt in narrow containers without viewport changes | Verified (current components) | `styling.browser.test.ts`; gallery frame test |
| F08 | Container/containment choices never collapse layout or clip focus/overlays | Partly | Primitives declare no containers; gallery frame; containment adoption planned (M8) |
| F09 | Multiple overlays use the correct anchors and clean up observers | Planned | M10 overlays |
| F10 | Native and fallback overlays keep theme, direction, interaction | Verified (one positioning backend) | The top layer is native at the floor (`popover`, `<dialog>`), and the measured controller is the only positioning backend (native anchor positioning is not adopted, §9, so it has no path to test). `popover.browser.test.ts` and `dialog.browser.test.ts` (tests marked F10): an open popover and modal dialog in a dark, compact, right-to-left, German scope take that scope's surface colour and spacing, put the close button at the inline start, and keep the language, in three engines; Firefox does not match `:lang()` inside a shadow root by the host's language, and no component style uses `:lang()`. `packages/core/test/position.browser.test.ts`: the surface stays in place and inherits custom properties and `dir`. Right-to-left placement or keys in the popover, tooltip, drawer, toast, and menu tests; Escape, outside presses, and focus return in the dialog, drawer, popover, and menu tests |
| F11 | Reduced or unsupported animation leaves correct final state | Verified (spinner, overlays) | `e2e/css-compat.spec.ts` (spinner). `dialog.browser.test.ts` and `popover.browser.test.ts`: with a 2 s fade, `close()` sets the closed state (`open`, `:popover-open`) at once while the surface is still fading out, and the `close`/`toggle` event and focus return follow from the native events, not from `transitionend`, in three engines; with reduced motion there is no animation or transition (Chromium emulation; the token CSS also sets durations to `0ms`). Interrupted changes settle to the final state: a dialog closed and shown again before its `close` event stays open, one shown and closed in one task stays closed, and a toast closed and opened in one task starts over. The path without `transition-behavior: allow-discrete` (floor browsers, where closing is instant) is not exercised: the three current engines support it |
| F12 | Native and fallback field sizing preserve editing | Verified (odd-textarea) | `packages/components/test/textarea.browser.test.ts`: both paths, caret and scrolling, in three engines |
| F13 | Enhanced native controls keep a usable baseline | Verified (odd-select) | `packages/components/test/select.browser.test.ts`, three engines (2026-10-23): where `appearance: base-select` and `::picker(select)` are supported (Chromium and WebKit here), the open picker is the raised listbox surface with the option rows, the placeholder stays out of it, the chosen row has the selection surface, a keyboard-opened row the inset ring, and choosing reports `input` and `change` once; where they are not (Firefox), the engine draws the picker with the placeholder among its rows and the same control works (choose, `required`, reset, restore, disabled fieldset). WebKit reports unstyled computed values for a `base-select` select in a shadow root while drawing it styled, so its picker colours are not asserted there. features.json `customizable-select` |
| F14 | Forced colours, zoom, text enlargement, RTL keep controls and focus | Verified (current components) | `e2e/css-compat.spec.ts` (forced colours in three engines, 320 px reflow); `styling.browser.test.ts` (200% text, RTL); screen zoom and 400% page zoom remain manual (M8) |
| F15 | Shared styles work across document, Shadow DOM, registration, delivery | Verified | ADR 0008 evidence; probe `shared-sheet`; iframe adoption test |
| F16 | Static documentation shows actual emitted CSS and fallback paths | Verified (gallery); docs app planned | Gallery prints the emitted token, component, and enhancement CSS and toggles the baseline (`e2e/css-compat.spec.ts`); docs pages M11 |

### 16.2 Browsers

- Current engines: Playwright 1.64.1 — Chromium 156, Firefox 157, WebKit 27.2 — run every browser test and e2e spec.
- Floor engines: `npm run compat:floor` installs Chrome for Testing 125.0.6422.141 and Firefox 126.0 outside the repository (win64, linux64; sandbox kept on) and runs [tests/floor/probe.html](../../tests/floor/probe.html), which reports over HTTP; results in [research/compatibility/floor-results.json](../../research/compatibility/floor-results.json) include each browser's feature detections compared with BCD for that version.
- **Gaps:** Safari 17.4 and Safari iOS 17.4 are not run (no automation on this host; WebKit 27.2 in Playwright is not Safari 17.4); Chrome Android and Firefox Android floors rely on data; Edge 125 relies on Chrome 125 (same engine); screen readers and real zoom are manual M8 work; the floor run is not yet in CI.
