# Checkbox Figma and browser comparison

Compared the four authored unchecked, medium Checkbox frames at 320px and 176px in light and dark. The [Figma measurements](design-spec.json), [browser measurements](implementation.json), and [comparison captures](../comparison/) identify each fixture.

| Finding | Figma | Chromium | Disposition |
| --- | --- | --- | --- |
| Indicator geometry, all fixtures | 20 × 20px at x4/y2, 4px corners, 1px stroke | Same | Match |
| Parent and first-line alignment | Label starts at x36 after a 12px gap. The indicator center sits on the 24px first-line lane. | Same. Measured first-line center delta is 0px. | Match |
| Wrapping at 176px | Four complete label lines, first line begins at y2.375. | Same words on each line, first line begins at y2.375. Host and field scroll width equal client width. | Match |
| Color and token roles | Specimen surface, indicator fill and strong border, primary label color. | Same computed token roles. Solid raster samples match in both themes. | Match |
| Frame height | Short 24px. Wrapped 78.375px. | Short 24px. Wrapped 79.375px. | The 1px increase comes from preserving the browser's 19.25px line height over four lines. Figma's text node is 76px tall over four lines. |
| Text rasterization | Figma Roboto Medium, 14px with the shared 137.5% type style. | Chromium resolves the Oddkin system font stack to Segoe UI Semibold at 14px and computed weight 500. | Platform typeface difference. Wrapping, first-line alignment, and legibility match in both themes. |
| Fractional Figma export edge | The 176px dark export contains a lighter pixel row at the bottom edge. The same edge is faint in light. | The specimen surface continues beyond the label. | Raster boundary of the fractional-height Figma PNG. The row is present in the original Figma export. |

Inspect the [light short](../comparison/checkbox-short-light-side.png), [dark short](../comparison/checkbox-short-dark-side.png), [light wrapped](../comparison/checkbox-wrap-light-side.png), and [dark wrapped](../comparison/checkbox-wrap-dark-side.png) comparisons. Their corresponding 50% overlays and difference captures are in the same folder.
