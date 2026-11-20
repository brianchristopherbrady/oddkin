# Badge visual audit corrections

The source changes that preceded the audit keep the label in one wrapping flow and give its decorative marker a first-line lane. The changes sit in the Badge template and styles. Shared icon assets, tokens and public Badge inputs carry forward from the established implementation.

The first diagnostic overlay placed a short inline Badge 3px lower than the Figma image. A normal line box inside the unstyled bench cell caused the offset. Matching the Figma auto-layout parent with a flex-start bench fixture put both specimens at the same origin without changing the rendered component or its CSS. The captured setup and measured origin are in [implementation.json](implementation.json).

The package-wide freshness warning came from a regenerated composition catalog with identical tracked content and a newer timestamp. The final bench refresh followed a rebuild of the TypeScript output and verified the served Badge, theme and runtime bytes against disk.

The final comparison found no additional product code correction. The Badge and selected parity assertions were also run in Chromium, Firefox and WebKit, with results recorded in the overall run.
