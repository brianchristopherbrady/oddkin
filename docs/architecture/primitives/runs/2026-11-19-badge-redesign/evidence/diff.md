# Badge visual comparison

The installed Oddkin fidelity bench compared six 2× Figma exports with the current Agent 1 build in headless Chromium at device scale 2. Each fixture used the same badge text, tone, marker setting, density, and inline allocation. A flex-start parent matched the Figma auto-layout origin. Pane backgrounds matched the Figma canvases in both themes.

| ID | Figma layer and live target | Expected | Observed | Disposition |
| --- | --- | --- | --- | --- |
| B-F1 | Badge surface and label → `base`, `.label` | Five-tone system, with neutral, warning and info sampled in both themes. Insets 2px by 8px, gap 4px with marker, radius 4px, 12px/18px text at weight 500. | All sampled live values agree with their resolved tokens. Figma raster interior fills match live fills in both themes. | Match |
| B-F2 | Wrapped warning label and first-line marker → `.label`, `marker svg` | 112 × 58px, three 18px lines, marker 16 × 16px at (8, 3), label at (28, 2). | Same surface, offsets, words on each line and glyph box in both modes. The marker center is 0px from the center of the first line. | Match |
| B-F3 | Markerless info label → `.label` | 112 × 40px, two 18px lines, label at (8, 2), no marker reservation. | Same dimensions, origin and text split in both modes. The marker is hidden and occupies zero area. | Match |
| B-F4 | Natural neutral badge → host, `base`, `.label`, `marker svg` | 63 × 22px in Figma, 27px label width. | 64.016 × 22px in Chromium, with a 28.016px label. Insets, label origin, height, glyph box and paints match. | Intentional platform-font difference |
| B-F5 | Text and artwork rasterization | Editable Figma Status text uses Roboto Medium. | Chromium resolves the existing Oddkin system stack to Segoe UI Semibold on Windows. Text shapes and antialiasing differ in the overlay. The artwork shares the same 16px box and visibly equivalent strokes, with small raster edge residuals. | Existing type and rendering differences |

Figma references, raw live captures, and the 50% overlay and difference views are listed in [the measurements](implementation.json). The difference view uses CSS difference blending. Visual judgments here come from the comparison images and scoped measurements.
