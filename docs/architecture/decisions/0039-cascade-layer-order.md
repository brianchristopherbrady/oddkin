# 0039. Cascade layer order for document-level styles

- **Status:** Accepted
- **Date:** 2026-10-17
- **Area:** Platform
- **Detailed contract:** [css-architecture.md](../css-architecture.md) §5; [theming-and-styling.md](../theming-and-styling.md) §6
- **Related:** 0010 (recipe layers), 0037 (naming), 0038 (compatibility policy)

## Context

Generated token CSS was unlayered. An application override of a semantic role then depended on specificity and stylesheet order: an override loaded before the token stylesheet, or with equal specificity to a scope selector such as `[data-odd-mode="light"]`, lost. Future document-level assets (opt-in reset, page defaults, page-author layout classes, light-DOM component styles, utilities) need a predictable place relative to each other and to application CSS, independent of import and registration order.

## Decision

Every Oddkin document-level stylesheet that declares layers first states the canonical order:

```css
@layer odd.reset, odd.tokens, odd.base, odd.layout, odd.components, odd.utilities;
```

Generated token CSS is emitted inside `odd.tokens` by default. Application overrides are unlayered (or in layers the application orders after `odd`, e.g. `@layer odd, app;`). Shadow-root styles keep their own encapsulation context; recipe layers inside components are unchanged (ADR 0010). Page-author recipes from `@oddkin/components/layout` use the `odd.layout` prefix (implemented in M4 with `layout.css`). Emission stays configurable: `generate(config, { css: { layer } })`, `buildTheme(config, { cssLayer })`, `oddkin-tokens build --css-layer <name|none>`.

## Alternatives considered

- **Unlayered tokens** (previous output): overrides depend on order and specificity; kept as `--css-layer none`.
- **One `odd` layer without sublayers**: no room for future assets without re-ordering later.
- **Layering only when requested**: makes the robust behavior opt-in for the common case.

## Consequences

- Unlayered application CSS overrides generated values whatever the load order; a root override still does not cross nested scopes that re-declare a role (alias closure), so theme-wide changes belong in configuration `overrides`.
- Applications with their own layers must order `odd` first if they want to override it from a layer.
- Generated CSS grows by 59 B gzip (1,768 → 1,827 B for the default theme); all fixtures were regenerated through the generator.
- Reserved sublayers (`odd.reset`, `odd.base`, `odd.layout`, `odd.components`, `odd.utilities`) are part of the public CSS contract from now on.

## Evidence

`packages/tokens/test/layers-floor.test.ts` (output shape, identical declarations layered and unlayered, custom layers, invalid names); `packages/tokens/test/cascade.browser.test.ts` in Chromium 156, Firefox 157, WebKit 27.2 (unlayered override wins in either order; application layers ordered after `odd` win, layers declared first lose unless `@layer odd, app;`; root overrides do not cross re-declaring scopes; unlayered tokens make the same override order-dependent); floor probe `layer-order` in Chrome 125 and Firefox 126 (a zero-specificity unlayered rule loaded before the tokens wins).

## Revisit when

A reserved layer is never used by v1, a consumer integration needs a different default, or a platform change makes layering of custom properties behave differently.
