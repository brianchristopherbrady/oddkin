# odd-button — source context (v2)

- **Observed:** 2026-11-18.
- **Implementation tree:** `C:/SLT_Backup_10-21-2026/oddkin-a1-main` (Agent 1's worktree), branch `a1-main` at `e84a08e33ee5510cb86dc462ccbf9e3a7fcce7dd` before the Button v2 edits. It carries v1 (spinner centred over retained content, selected-loading paint) and the avatar/badge work of 2026-11-17.
- **Record provenance:** Copilot began the v2 research and contract in the Primitive Architect reference checkout. This portable handoff lives with the implementation on Agent 1’s lane and uses that lane’s source, contracts and verification. The reference checkout is a source of earlier design evidence.
- **v1 records:** preserved with temporary asset URLs omitted in [the v2 run](../../runs/2026-11-18-button-redesign/v1-specification-archive.json).

## Source map

| Concern | Path (implementation tree) |
| --- | --- |
| Class, properties, events, form proxy | `packages/components/src/button/button.ts` |
| Template (native button, spinner, slots) | `packages/components/src/button/button.template.ts` |
| Structural styles (layout, loading overlay, forced colours) | `packages/components/src/button/button.structural.styles.ts` |
| Visual styles (tokens) | `packages/components/src/button/button.styles.ts` |
| Native recipe (`.odd-button`, `button.css`) | `packages/components/src/button/button.native.styles.ts` |
| Definition, registration, exports | `button.definition.ts`, `button.define.ts`, `index.ts`, `foundation.ts` |
| Examples | `packages/components/src/button/button.examples.ts` |
| Icon element (`--odd-icon-size`, reflected `size`) | `packages/components/src/icon/icon.ts`, `icon.styles.ts` |
| Inventory of hand-built icon squares | `calendar/calendar.styles.ts` (`.nav`), `carousel/carousel.styles.ts` (`.step`), `file-input/file-input.styles.ts` (`.remove`), `styles/overlay-surface.styles.ts` (`.overlay-close`) |
| Tests | `packages/components/test/{button,styling,figma-parity,examples}.browser.test.ts`, consumers' tests |

## Consumers

The prior inventory identified eleven transitive `odd-button` definition consumers in `@oddkin/ai`. The reviewed direct uses with text still use their host-supplied content. Recipe consumers inspected include Calendar and Carousel, whose geometry now uses the shared recipe. File input and the overlay surface have separate native styles. Other call sites reviewed include Menu, Copy Button, AI Message version and feedback buttons (glyph text, AI lane), and three docs-site links (`<a class="odd-button">`). Figma: 2,385 button instances on 23 pages, 955 nested in other components, plus 35 instances of the legacy iconButton in the earlier usage census. Page and variant identities are tracked in [the Figma evidence](./figma-evidence.json).
