# 0041. Approved default palette, role vocabulary, and text-style roles

- **Status:** Accepted
- **Date:** 2026-10-18
- **Area:** Tokens
- **Detailed contract:** [theming-and-styling.md](../theming-and-styling.md) §10.1–§10.3
- **Related:** 0006 (colour generation), 0007 (alias re-declaration), 0012 (token categories), 0037 (naming), 0039 (layer order)

## Context

The provisional preset (M2) named colour roles by the property they were first used for (`color.text.danger`, `color.surface.danger`, `color.border.danger`, `color.action.active`, `color.surface.selected`). The approved design source (Figma file `E7LfRysny8V3qU24tv082i`, frames 8:29 "Oddkin · UI kit" and 31:441 "Shared default theme / Palette approval") defines a different vocabulary: status roles grouped by status (`danger.foreground`, `danger.surface`), `action.pressed`, `link`, `canvas`, a pale-iris `surface.specimen` that is reserved for documentation specimen stages, `selection.*`, a `warning` status, a decorative citron accent, eight text styles in two families (Jost and Inter, plus JetBrains Mono for code), a 7 px control radius, an 8 px card radius, and one hover elevation. Components and documentation must use the same names as the design so a role in Figma and a role in CSS are the same thing. Renaming is cheap now (before the M8 checkpoint, ADR 0029) and expensive later.

## Decision

1. **Role vocabulary.** The preset adopts the design's names: `color.canvas`, `color.surface.{default,raised,sunken,hover,specimen}`, `color.text.{primary,secondary,disabled,on-action}`, `color.action.{default,hover,pressed}`, `color.link`, `color.focus.ring`, `color.border.{default,strong}`, `color.selection.{background,foreground}`, `color.{danger,success,warning}.{foreground,surface}`, `color.accent.decorative`. Removed: `color.text.link`, `color.text.danger`, `color.text.success`, `color.text.inverse`, `color.surface.danger`, `color.surface.success`, `color.surface.selected`, `color.border.danger`, `color.action.active`. Danger borders use `color.danger.foreground` (it already meets 3:1 against surfaces).
2. **Warning status.** `status.warning` joins `danger` and `success` in `ThemeConfig`, the schema, and the generator; it produces a `ref.warning.*` ramp and a contrast-selected `color.warning.foreground`.
3. **Specimen and selection.** Pale iris (`surface.specimen`) belongs only around documentation specimens. Selected controls use `selection.background`/`selection.foreground` (solid action colour, also signalled by state such as `aria-pressed`); transient highlights (drag targets, a revealed source) use `surface.hover`.
4. **Text styles.** `type.<style>.{family,size,weight,line-height}` (plus `letter-spacing` for `display` and `eyebrow`) for `display`, `section`, `title`, `body`, `ui`, `small`, `eyebrow`, `code`, built from foundation scales. `font.family.display` is new; `font.family.sans` and `font.family.mono` lead with Inter and JetBrains Mono and fall back to system fonts. Oddkin does not ship font files.
5. **Elevation.** A `shadow` token type and `elevation.hover` (`0 4px 12px rgb(36 31 71 / 0.09)`, both modes). `odd-card variant="elevated"` uses it.
6. **Default theme.** `themes/default.theme.json` sets `brand.primary` to Electric iris `#6250e8` and pins every approved light/dark value as an explicit override. The generic preset keeps contrast-selected and ramp-step roles so any other brand still gets a complete, checked theme.

## Alternatives considered

- **Keep the old names and map them in documentation**: two vocabularies for the same thing; designers and agents would keep translating.
- **Change preset ramp steps to approximate the approved hex values**: the approved palette is hand-tuned, not a ramp; approximations would drift and still need overrides.
- **One `font` shorthand token per text style**: smaller CSS, but resets unrelated font properties and cannot be partially overridden or inspected per property.
- **Pale iris for selected states**: rejected by the design's surface rule (pale iris is for specimen stages only).

## Consequences

- Public token names changed before M8; examples, components, AI styles, fixtures, and generated names were migrated in the same change. Consumers of the removed names get a TypeScript error from `token()` and a missing custom property in CSS.
- Default token CSS grows from 1,827 to 2,380 B gzip (text-style roles, warning ramp, new roles, elevation); the budget moves to 2,560 B.
- Overriding secondary text now reports two contrast pairs (default surface and canvas).
- Font loading, font-metric fallbacks, a fluid type scale, motion, and stacking remain M9 work. Navigation item height (34 px in the design) is decided with the side navigation.
- Components still need to adopt the text-style roles (button and input use `ui`, card titles use `title`); that is the next design-alignment slice.

## Evidence

Figma variables read with `get_variable_defs` on 31:472, 8:29, and 49:579 (colours, text styles, radii, spacing 4–48, elevation); `packages/tokens/test/*` (generator, fixtures regenerated through the generator, contrast diagnostics); the default theme resolves with `ok: true` and no diagnostics, so every approved light/dark pair in `CONTRAST_PAIRS` meets its WCAG minimum; `npm run verify` (1,011 unit and browser tests in three engines, 79 e2e including axe-core on the AI demos, size budgets, pack verification).

## Revisit when

The design source changes a role or adds one (for example info status or additional elevations), a consumer needs a role the vocabulary lacks, or M9 typography work replaces the static scale.
