# Badge visual fidelity verification

**PASS for the six paired specimens.** The implementation is served from the current Agent 1 build at source baseline `72204976`, with 35 served JavaScript and CSS assets hashed against the worktree's built bytes. The installed Oddkin fidelity bench reported ready with zero warnings or errors. The captures use the same default density, 2× image scale, canvas colors, inline grants and text in both renderers. [Build, reproduction URLs and measurements](implementation.json)

| ID | Result | Evidence |
| --- | --- | --- |
| B-F1 | Verified | Neutral, warning and info surfaces agree with the Figma fills. Insets, gap, radius, foreground and typography follow the live theme tokens. [Light comparison](comparison/wrapped-light-side.png) · [Dark comparison](comparison/wrapped-dark-side.png) |
| B-F2 | Verified | Glyph centered on the first 18px line with a 0px measured offset. All three lines fit the 112px grant with the same text split and no scroll overflow. [Light overlay](comparison/wrapped-light-overlay.png) · [Dark difference](comparison/wrapped-dark-diff.png) |
| B-F3 | Verified | Both 112 × 40px surfaces show both lines with all characters preserved. The hidden marker releases its lane and the label starts at 8px. [Light overlay](comparison/markerless-light-overlay.png) · [Dark comparison](comparison/markerless-dark-side.png) |
| B-F4 | Verified | Single-line height remains 22px and the 16px marker retains its position. The live surface naturally sizes to 64.016px compared with 63px in Figma. [Light comparison](comparison/short-light-side.png) · [Dark overlay](comparison/short-dark-overlay.png) |
| B-F5 | Verified with platform variation | The natural-width delta follows Segoe UI Semibold in the built Windows browser and Roboto Medium in the editable Figma typography. The overlay and difference views retain differences along text strokes and fine glyph edges. [Light difference](comparison/short-light-diff.png) · [Dark difference](comparison/short-dark-diff.png) |

The fidelity reviewer inspected the side, overlay and difference evidence after aligning both capture origins. A separate reviewer (`badge_records_full`) inspected six complementary final views and confirmed legible content, the wrapped first-line marker, the markerless label, and the absence of actionable visual differences. Every exported reference and captured comparison is linked to its specimen in [the Figma fixture record](design-spec.json) and [the implementation record](implementation.json).

The bench verdict covers three visual fixtures in Chromium and is based on observed geometry, paint and legibility. The other semantic tones, localized and RTL layout, explicit density, focus continuity and browser-specific behavior live in the separate three-engine acceptance evidence. Actual screen-reader speech is outside this visual audit.
