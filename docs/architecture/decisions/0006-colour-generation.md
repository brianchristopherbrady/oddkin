# 0006. OKLCH colour generation, gamut mapping, contrast

- **Status:** Proposed
- **Date:** 2026-10-17
- **Area:** Tokens
- **Detailed contract:** [theming-and-styling.md §10](../theming-and-styling.md)

## Context
Theme generation from a brand colour needs perceptual ramps, sRGB output, and honest contrast reporting.

## Decision
- Original OKLCH generator: lightness fixed per step; chroma reduced only as far as sRGB requires (chroma-reduction gamut mapping), keeping hue and lightness.
- Roles chosen by measured contrast against the system's real surfaces, not by step number.
- WCAG 2.x ratios are normative pass/fail. APCA and colour-vision simulations are supplementary and labelled.
- CVD simulation method to be verified before adoption; the reference application states it uses Machado, Oliveira and Fernandes (2009) at full severity.

## Alternatives considered
- HSL ramps — not perceptually uniform.
- CSS gamut-mapping algorithm (CSS Color 4 binary search) — candidate; compare in M2/M9.

## Consequences
Generated brand colours may need explicit role overrides; diagnostics must say so instead of silently changing inputs.

## Evidence
CSS Color 4 (§12.3); reference audit ([design-system-lab-audit.md](../../reference/design-system-lab-audit.md)) for stated methods. BCD 8.1.6: `oklch()` Chrome/Edge 111, Firefox 113, Safari 15.4. Pending: M2 generator tests with reference values; CVD source verification.

## Revisit when
Visual review or test vectors show unacceptable hue shifts or failing roles for common brand colours.