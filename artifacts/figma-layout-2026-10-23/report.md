# Layout primitives — 2026-10-23

Created on the existing [Primitives page](https://www.figma.com/design/E7LfRysny8V3qU24tv082i/Untitled?node-id=457-2078).

- 11 layout families and one replaceable demonstration child, 24 definitions total.
- Box, Container, Stack, Row, Cluster, Grid, AutoGrid, Split, Center, AspectRatio and ScrollRegion.
- 36 linked examples: 12 panels, each at 320, 640 and 960 px container widths.
- Main components live in Definitions; Review contains instances. Native content slots remain editable.
- Existing layout roles: gap 16 px, inset 24 px, minimum item 256 px, sidebar basis 256 px, main minimum 320 px. Existing typography, color, border, radius and spacing roles reused. No exported unbound visual literals in the new families.
- Whole-section structural audit: no sibling overlaps, children outside non-scroll containers, unexpected clipping, missing text styles or collisions with preceding page frames.
- Rendered review and definition boards inspected. ScrollRegion alone intentionally clips and scrolls its content.

Observed response: AutoGrid has 1 / 2 / 3 columns; Cluster has 3 / 5 / 6 children on its first row; Split stacks at 320 px and uses the preferred 256 px sidebar at 640 / 960 px. The constrained container caps its content at 640 px, centered in the 960 px example. Fixed Grid stays at two columns; the separate query panel demonstrates one, two and three columns using recipe-local 36rem and 52rem conditions.

Figma documents CSS query states and Split variants; it does not execute CSS queries or switch variants automatically. AutoGrid's wrapping Figma children match the six-item examples; empty tracks and incomplete rows can differ from CSS auto-fill. CSS additionally clamps the item minimum below 256 px. Split uses side/main growth 1:999 in code; Figma holds the preferred sidebar width. Supporting CSS patterns are identified separately from the shipped helpers.

Repository checks: 10 test-file runs, 61 tests passed. Includes token parity, component snapshot/reuse schemas and edges, core and Oddkin-bound layout helpers, and their browser tests in Chromium, Firefox and WebKit. No runtime component implementation changed.
