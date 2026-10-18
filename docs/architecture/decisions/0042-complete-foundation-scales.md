# 0042. Complete foundation scales: radius, elevation, motion, stacking, and type

- **Status:** Accepted
- **Date:** 2026-10-18
- **Area:** Tokens
- **Detailed contract:** [theming-and-styling.md](../theming-and-styling.md) §10.2–§10.3
- **Related:** 0006 (colour generation), 0007 (alias re-declaration), 0012 (token categories), 0038 (compatibility policy), 0039 (layer order), 0041 (palette and roles)

## Context

The provisional preset covered colour, spacing, a partial type scale, three radii, and control sizing. Elevation, motion, and stacking were planned for M9, yet the card already shipped a literal shadow, AI elements a literal one, and Workbench foundation pages (Borders and radii, Elevation, Motion) need complete scales to document. ADR 0041 had also copied some non-colour values from the design file (13 px/15 px type, 7 px radius, one hover shadow, brand typefaces). The project owner decided that only the colour palette comes from the design; every other value is an Oddkin token, and the designs will be updated to use those tokens.

## Decision

1. **Ownership.** The colour palette follows the approved design (ADR 0041). Every other value is defined by Oddkin's scales; designs adopt them.
2. **Scales.** Spacing gains `3xs` (0.125rem) and `4xl` (6rem). Radius: `none, xs, sm, md, lg, xl, 2xl, full`; `control.radius` = `radius.md`, `card.radius` = `radius.lg`. Font sizes `xs`–`4xl` (0.75–2.25rem). Line heights `none, tight, snug, normal, relaxed`. Letter spacing `tight, normal, wide`. Font families are system stacks; `font.family.display` aliases `font.family.sans`. Icon sizes `sm, md, lg`. The text-style roles alias these scales and always declare all five properties.
3. **Elevation.** `elevation.{none,sm,md,lg,xl}` (type `shadow`), mode-dependent: dark mode uses stronger shadows so they remain visible. `md` is the previous card shadow; `odd-card variant="elevated"` and the AI jump-to-latest button use `md`.
4. **Motion.** `motion.duration.{fast,normal,slow,slower}` (type `duration`) and `motion.easing.{standard,enter,exit,linear}` (type `cubicBezier`). Tokens may carry a `reducedMotion` literal; the generator re-declares those inside `@media (prefers-reduced-motion: reduce)` on the base selectors (`:root` and `[data-odd-theme]`). Durations reduce to `0ms`.
5. **Stacking.** `z-index.{base,raised,sticky,overlay}` for in-flow layers only; overlays use the top layer.
6. **Validation.** `duration` values are non-negative `ms`/`s` times; `cubicBezier` values are `cubic-bezier()` with x in [0, 1]; `z-index.*` values are integers; `icon.size.*` warns on `px` like other relative sizes.
7. **Values output.** Literal values of aliases are emitted per mode when the resolved light and dark values differ (previously only direct mode values were split, so `color.selection.*` showed the light value only).

## Alternatives considered

- **Take every value from the design file**: the design's values are one-off (13 px, 15 px, 7 px) rather than a scale; the owner chose tokens as the source for non-colour values.
- **Reduced motion only in component CSS** (`@media (prefers-reduced-motion: no-preference)` around transitions): every component and consumer must remember it; token-level values make reading a duration enough. Component-level gates remain allowed for `@starting-style` and discrete transitions (css-architecture.md §11).
- **A `data-odd-motion` scope** for an in-page reduced-motion toggle: useful for docs demos but not needed by components yet; can be added like modes.
- **Mode-independent shadows**: black shadows at light-mode alpha disappear on dark surfaces.
- **An `easing` type accepting keywords**: DTCG's `cubicBezier` type keeps export (M9) lossless; `linear` is `cubic-bezier(0, 0, 1, 1)`.

## Consequences

- Values reverted from ADR 0041: `font.size.sm` 0.8125 → 0.875rem, `md` 0.9375 → 1rem, `2xl` 1.625 → 1.5rem, `3xl` 3 → 1.875rem; `font.size.2xs` removed; `control.radius` 7 px → `radius.md` (8 px); `card.radius` back to `radius.lg`; brand typefaces removed from the default stacks; `elevation.hover` replaced by the scale.
- Default token CSS is 2,764 B gzip (1,827 B before ADRs 0041–0042); the budget is 3,072 B.
- `@media (prefers-reduced-motion: reduce)` now appears in generated token CSS (at the browser floor).
- Opacity and scrim tokens are not added: no component needs them, and disabled states use colour roles. Fluid type, font-metric fallbacks, and a reduced-motion scope stay in M9.

## Evidence

`packages/tokens/test/generate.test.ts` (reduced-motion block on the base selectors with every duration at `0ms`, overrides keep the reduced value), `conditions-profiles.test.ts` (unit policy for durations, easings, z-index), `outputs.test.ts` (per-mode literals for aliases), regenerated fixtures and generated modules; `card.browser.test.ts` in three engines; `npm run verify`.

## Revisit when

A component needs opacity, scrim, or additional stacking levels; M9 introduces fluid type or a reduced-motion scope; DTCG export shows a lossy mapping for these types.
