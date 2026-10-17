# Design System Lab — reference audit

Status: **partial audit**, rendered in Chromium at a 1440×1000 desktop viewport and at the default narrow viewport on 2026-10-17. Inspected pages: every primary route (Overview, Foundations overview and all eleven foundation pages, Components catalog, Button, Input, Card, Tabs, Playground, Patterns, Design decisions) for structure; Theme Studio preset/shape interactions and URL state; dark mode; skip link and `aria-current`. Not yet inspected: the remaining component pages in detail, Patterns/Decisions content, full keyboard traversal of composite widgets, screen-reader output, forced colors, and zoom/reflow. Recording these remains an M0 task in [IMPLEMENTATION_PLAN.md](../../IMPLEMENTATION_PLAN.md).

**Screenshots:** an attempt to save screenshots from the embedded browser produced images that did not match the rendered page, so none are committed. Reproducible screenshots are a scripted Playwright task once M1 test tooling exists.

This document records **presentation and structure** that Mote Workbench reproduces with each consuming library's own data. Everything here that is specific to Design System Lab — its name, author, component inventory, token names and values, taxonomy, verification statements, React snippets, and design decisions — is reference material only and must never be hardcoded into generated applications. See [workbench-pages.md](../architecture/workbench-pages.md).

Browser console showed a 404 for one asset on every route (not investigated; no visible effect). Each route shows a "Loading page…" status before content renders, so automated checks must wait for `main h1`.

## Shell (all pages)

| Element | Observed |
| --- | --- |
| Skip link | "Skip to main content" → `#main` |
| Header | Logo + wordmark (home link); primary nav: Overview · Foundations · Components · Playground · Patterns · Design decisions; active item underlined; Theme select (System / Light / Dark) at the right |
| Contextual sidebar | Left column listing the current section's pages; active page marked with a dot. Components sidebar is grouped (Layout / Primitive / Composite) with small uppercase group labels |
| Narrow layout | Header items stack; the sidebar collapses to a "Show foundations →" style button |
| Page header | Small uppercase eyebrow ("DESIGN SYSTEM", "FOUNDATIONS", "COMPONENTS · PRIMITIVE"), large light-weight H1, muted summary paragraph, then a back link ("All foundations", "All components") on detail pages |
| On this page | Right-hand column on detail pages: "ON THIS PAGE" label + section links |
| Surfaces | Light grey page background, white cards with thin borders and small radius, generous whitespace, restrained colour; accent colour used sparingly (active nav underline, sidebar dot) |
| Footer | Author attribution and links (reference-only; not reproduced) |
| Shell appearance | Theme select writes `data-theme` on `<html>` and persists to `localStorage`; survives reload. Previews have separate settings (see Playground) |
| Keyboard basics | First Tab focuses the skip link; activating it focuses `<main id="main">`. Active primary nav item carries `aria-current` |

## Foundation detail pages — structure observed

| Page | On this page | Tables (column headers) | Interactive controls |
| --- | --- | --- | --- |
| Token architecture | Three tiers · Pipeline · Trace a token · Dependency policy · Every token · Source | Selector / Resolves to · Declaration / Allows · Scale / Reads / In the design system / Files · Token and CSS variable / Tier / Authored value / Resolves to | Token tracer (token select), filter by name, tier filter, "Show values for" context |
| Color | Palettes · Semantic roles · Tones · Contrast | Token / Light / Dark (×3) · Foreground on background / Light / Dark / Minimum | — |
| Typography | Families and scale · Typefaces by product · Text styles | Token / Value / Sample · Token / Value | — |
| Spacing | Space scale · Gap vocabulary · Precedence | (see below) | — |
| Borders and radii | Borders · Radii | Token / Value · Token / Value / Sample | — |
| Elevation | Levels · Usage | Token / Light / Dark | — |
| Motion | Durations and easing · Try a duration · Reduced motion | Token / Value | Duration picker demo |
| Themes | Mappings · Scoping | — (prose and specimens) | — |
| Responsive behavior | Which query · Resize a container · Every query · Reflow | Target / Condition / Why / Where | Container width slider, show toggle |
| Products and modes | Modifiers · Compose a mode · What a product changes · Nested scopes · Dependency-minimal CSS · Products × themes · Density · Adding a product · Source | Modifier / Contexts / Changes · Token / Value / Declared under · Token / per-product columns · Depends on / Tokens / Emitted under · Selector / Authored / Resolves to · Token / Comfortable / Compact / Change | Theme, product, and density radio groups with live specimen |

Pattern across pages: tables pair a dotted token name with its CSS custom property; colour-bearing tables show light and dark side by side; each page closes with source references where relevant.

## Other routes

- **Overview** (`/`): eyebrow "Overview"; sections Review the work · About this project · From a design decision to a working interface · How this site is built · Principles · Implementation architecture · Contributing; a product-profile select. Portfolio framing is reference-only; Mote's optional home page is generated from project content.
- **Patterns** (`/patterns`): Resource directory · Resource detail · Activity dashboard · Form validation (maps to Mote recipes in apps/docs).
- **Design decisions** (`/decisions`): eyebrow "Reasoning"; decision list and labels (maps to Mote architecture/decision docs, not Workbench).
- **Other component pages** (Input, Card, Tabs): identical section structure to Button (Overview · Examples · Props · Tokens · Behavior and accessibility · Guidance · Source); Input's Props section uses examples rather than a props table.

## Foundations overview (`/foundations/`)

- Eyebrow "DESIGN SYSTEM", H1 "Foundations", one-sentence summary.
- Three-column card grid at 1440px. Each card: linked H2 title, one- or two-line description, then a metadata line `Updated <date> · <tag>, <tag>`.
- Cards observed: Token architecture, Color, Typography, Spacing, Borders and radii, Elevation, Motion, Themes, Responsive behavior, Products and modes, Theme studio. (In Mote, the last two are moved: Theme Studio becomes a primary destination; Products and modes is optional and off by default.)
- No specimens or illustrations inside cards.

## Foundation detail — Spacing (`/foundations/spacing`)

- Header: eyebrow "FOUNDATIONS", H1, summary, "All foundations" link. On this page: Space scale · Gap vocabulary · Precedence.
- **Space scale:** explanatory paragraph that states facts derived from data (step count, min/max values, density behavior, dependency policy) and links to Token architecture. Table captioned "REFERENCE SPACE TOKENS" with columns **Token** (dotted name plus `--css-custom-property` underneath) · **Value** (source unit, e.g. `0.25rem`) · **Sample** (proportional bar).
- **Gap vocabulary:** prose, then table **Prop value · Semantic token · Reference · Size**.
- **Precedence:** bullet rules, then a live layout example labelled "Recommended usage".

## Components catalog (`/components`)

- Grouped sidebar (see Shell).
- Header + summary noting that filters are stored in the URL. A verification statement paragraph (reference-only; Mote shows only evidence-backed claims).
- **Search** ("Name, summary or tag") and **Component layer** select ("All layers"); result count ("Showing 29 of 29").
- Groups: heading with count ("Layout (7)"), one-sentence group description, three-column grid of cards (title, description, `Updated <date> · tags`). No live previews in cards.

## Component detail — Button (`/components/button`)

- Header: eyebrow "COMPONENTS · PRIMITIVE", H1, summary, "All components". On this page: Overview · Examples · Props · Tokens · Behavior and accessibility · Guidance · Source.
- **Overview:** "Open in playground →" link (removed in Mote: interaction is integrated), explanatory paragraph, two columns "Use it for" / "Not for".
- **Examples:** cards with title, a "RECOMMENDED USAGE" badge, description, live example grids (appearances × states; sizes, borders and radii; icons, loading and full width).
- **Props:** table **Prop · Type · Default · Description**; sub-section "Defaults, combinations and precedence".
- **Tokens:** "From prop to token" list (`prop="value" (state)` → CSS property → token), then "Every token read" table with a context caption ("N TOKENS READ, RESOLVED FOR <product> · <mode> · <density>") and columns **Token · Tier · Read through · In this context** (resolved value plus `{alias}`).
- **Behavior and accessibility:** States · Accessibility and keyboard · Responsive behavior.
- **Guidance:** Composition · Common mistakes · Tradeoffs.
- **Source:** source references.

## Playground (`/playground`) — merged into component detail pages in Mote

- Header + summary noting that the header theme applies site-wide while preview settings apply only to the example.
- Controls row: **Component** select, **Preset** select (e.g. Starting values, Primary action, Destructive, Toolbar, Loading, Pill), **Reset component props**, plus links "<Component> documentation →" and "Source →". A short contextual note about the component's token behavior.
- **Preview** panel with "Copy example link".
- **Preview settings** disclosure summarising `<product> · <mode> · <density> · <width>` and "Same as site"; width presets Narrow (320px) · Medium (600px) · Wide (960px) · Fill.
- **Component props** table: **Prop · Control**, with description, default ("Default \"secondary\"") or unset semantics ("Unset: button.radius token") under the prop name. React-specific types (`children`, `ReactNode`) appear here; Mote uses real slots and properties instead.
- Generated usage code with **Copy code**.

## Theme studio (`/foundations/theme-studio`) — becomes the primary `/theme-studio` destination in Mote

- Same detail-page header and On this page: Generate · Ramp and roles · Live preview · Contrast · Color vision · Token files · Method and limits.
- **Generate:** explanatory paragraph (settings kept in the URL), "START FROM A PRESET" chips, **Brand color** (swatch + hex input; "Any sRGB color as hex. Hue and chroma are kept; lightness is rebuilt."), **Product id**, **Shape** radio group (Machined / Tight / Pill).
- A sticky **Live result** strip: summary text, 12-step ramp swatches, and paired light/dark mini specimens (buttons, badge, link).
- **Live preview:** paired light and dark panels showing a small composed form ("Quarterly report": input, checkbox, switch, actions).
- **Contrast**, **Status colors and color vision** (light/dark toggle), **Token files** (generated sources), **Method and limits** (explains methods and limitations).
- **Interactions verified:** choosing a preset updates brand colour and product id and writes them to the URL (`?brand=c026d3&id=europa`); choosing a shape adds `&shape=pill`. Settings are therefore shareable by URL.
- **Token files:** generated per product as one new DTCG-style token file plus objects to merge into existing sources (ramp, light roles, dark roles, resolver, profile), each with Copy and Download. Reference-only file paths and names.
- **Method and limits (as stated by the reference):** lightness fixed per OKLCH step with chroma reduced only as far as sRGB requires; roles chosen by contrast, not step number; WCAG 2 ratios decide pass/fail; APCA Lc shown for comparison only; colour-vision simulation uses the Machado, Oliveira and Fernandes (2009) model at full severity, labelled an approximation; a 0.1 ΔEOK status-distance threshold is a review heuristic, not a standard. These are the reference's stated methods; Mote must verify its own implementation independently.

## Implications for Mote (summary)

Recorded as requirements in [workbench-pages.md](../architecture/workbench-pages.md) and the implementation plan: keep the shell, header, card, table-of-contents, and table patterns; generate all facts from the consuming library; merge Playground into component detail pages; promote Theme Studio to a primary destination; make Products and modes optional; replace React-specific content with real slots, properties, and plain HTML/JS snippets.
