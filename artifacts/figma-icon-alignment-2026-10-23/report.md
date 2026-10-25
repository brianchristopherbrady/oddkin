# Icon size and alignment — 2026-10-23

The shared SVG import wrapper stayed 20 px inside 16 px instances. That left oversized, offset artwork even where a row's icon box was centered. All 1,723 original icon sources now scale their Artwork wrappers on both axes. Canonical SVGs, strokes, canvas size and component IDs are retained.

Chip and multiselect close marks now fit their 16 px canvases and center with selected-item text. Badge markers scale and center correctly. Chip and badge strokes use the label's foreground variable, preserving selected, disabled and semantic status colors.

The broader audit checked 1,290 visible shared icon instances across Primitives and Composed components, including 459 close-icon instances. It found no remaining artwork/canvas size mismatch or inline-center candidate after repair. The 48 AI definitions use text glyphs; those controls were inspected separately.

Seventeen centered rows and two icon holders repair file-upload headers/status, alert/toast headers, popover and alert-dialog headers, a drawer field, and table sort headings. The old 12 px table carets now use the 16 px small icon role. New frames use existing spacing and radius variables. Main components and consumer instance links remain intact.

Eight compositions were rendered and visually reviewed. The snapshot refresh changes nine affected families, retaining all other family data and all component IDs. `design/figma/icon-layouts.json` records the measured scaling contract and row geometry, since the general component snapshot does not serialize these fields. The import helper now establishes its 20 px canvas before applying Scale constraints and audits transparent fills and scaling.

Primary verification: 13 file runs; 343 passed and 9 skipped, including browser parity in Chromium, Firefox and WebKit. The new import helper regression and icon baseline checks were run separately. No runtime component styles or SVG artwork files changed.
