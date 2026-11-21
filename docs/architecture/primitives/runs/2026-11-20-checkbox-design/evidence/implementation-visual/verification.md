# Checkbox visual fidelity verification

The Oddkin fidelity bench rendered the active workspace package in Playwright Chromium 156.0.8078.4 at device scale 2. The visual reviewer used the four native Figma exports at parent grants of 320px and 176px, light and dark, with an unchecked, enabled medium Checkbox. The sixteen browser images comprise four isolated rendered fixtures and their side-by-side, 50% overlay, and difference views. The twelve comparison views were visually inspected.

- Indicator geometry, paint, and first-line alignment verified in all four fixtures. The 20 × 20px indicator starts at x4/y2 with a 4px radius. Its center aligns with the first line of the label and the row has a 24px minimum target.
- Wrapping and legibility verified in the two 176px fixtures. The complete source label appears across four lines, within its allocated width.
- Light and dark color roles verified. Browser raster samples match the Figma specimen surface, default control fill, and strong border in each mode.
- Platform typography and Figma export rounding accounted for in the [comparison ledger](diff.md).

All 19 computed token checks passed in each fixture. The [browser record](implementation.json) records the checks, the SHA-256 of each image, and the match between 44 HTTP-served assets and the workspace build files. The [Figma record](design-spec.json) identifies the four exact source frames. Separate browser behavior evidence covers the other variants, interaction, and engines.
