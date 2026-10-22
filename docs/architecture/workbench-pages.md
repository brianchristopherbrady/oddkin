# Workbench pages, navigation, and content

Status: **proposal**, except the page registry (§2), which is implemented as the DOM-free `@oddkin/workbench/pages` entry in M3 ([packages/workbench](../../packages/workbench/README.md)); the shell and pages are later work. Defines the information architecture and page contracts of a generated Oddkin Workbench. Detailed control, preview, and Theme Studio behavior: [workbench.md](./workbench.md). Metadata inputs: [metadata-and-analyzer.md](./metadata-and-analyzer.md). Reference observations: [design-system-lab-audit.md](../reference/design-system-lab-audit.md).

## 1. Principles

- **Reference structure, project facts.** Workbench reproduces Design System Lab's presentation patterns (§3) with the consuming library's own data and branding. It never hardcodes Design System Lab's name, author, component inventory, taxonomy, token names, values, verification statements, or design decisions.
- **One reusable application.** Pages are reusable Workbench routes and panels configured by metadata and `oddkin.config.*` — not a generated application fork per project.
- **Generated facts are authoritative.** Values and contracts come from the canonical token pipeline (`@oddkin/tokens/generate` + inspection output) and normalized metadata. Workbench has no second token engine and no separate foundation parser.
- **Honest absence.** A section, card, or page appears only when the library supplies its contracts. Unknown data stays unknown ("Not documented", "No foundation data supplied"); palettes, scales, dates, and claims are never invented.

## 2. Page registry

One registry is the single source for routes, primary navigation, contextual sidebars, overview cards, search entries, page visibility, and legacy redirects. Navigation, cards, routes, and search can never drift apart because they are all projections of it.

```ts
interface PageEntry {
  id: string;                          // stable: 'foundations/spacing', 'components/odd-button', 'theme-studio'
  route: string;                       // relative to base path: '/foundations/spacing'
  section: 'home' | 'foundations' | 'components' | 'theme-studio' | 'products' | 'guides' | string;
  kind: 'overview' | 'foundation' | 'component' | 'tool' | 'guide';
  title: Fact<string>; summary?: Fact<string>; eyebrow?: string;
  group?: string;                      // sidebar/catalog group (component category)
  tags?: string[]; updated?: Fact<string>;   // ISO date; omitted when unknown
  order?: number;
  visible: boolean;                    // computed from data availability + config
  nav: { primary?: boolean; sidebar?: boolean; card?: boolean; search?: boolean };
  sections: SectionEntry[];            // drives "On this page"
  legacyRoutes?: string[];             // redirect sources
  availability: 'full' | 'partial' | 'unavailable';
}
interface SectionEntry { id: string; title: string; visible: boolean; source: 'generated' | 'built-in' | 'authored' }
```

- Built at build/dev time from metadata, token inspection output, examples, config, and authored content (§10). Serialized into the Workbench index; the shell renders from it.
- Stable `id`s survive route changes; authored overrides key off ids, not routes.
- Visibility is computed: a foundation page with no supplied contracts is hidden; Products and modes is hidden unless enabled (§9).
- `legacyRoutes` produce redirects. Static builds emit redirect stubs (meta-refresh + canonical link) at old paths in history mode, and in-app redirects in hash mode. Default legacy routes: `/playground` → `/components` (or `/components/<tag>` when a component parameter is present, preserving valid share state); `/foundations/theme-studio` → `/theme-studio`; `/foundations/products` → products route when enabled, otherwise a "not enabled" notice.

## 3. Shell and page layout

| Element | Contract |
| --- | --- |
| Skip link | First focusable element → `#main` |
| Header | Project logo/wordmark (from config), primary navigation from the registry, shell appearance control (System / Light / Dark) |
| Primary navigation | Home/Overview (optional) · Foundations · Components · Theme Studio · Products and modes (only when enabled; placement configurable) · Guides and other registry sections. **No separate Playground destination.** |
| Contextual sidebar | Current section's pages; grouped where the section has groups (component categories); active marker. At narrow widths collapses to a labelled disclosure button ("Show foundations") |
| Page header | Eyebrow (section, or `section · group`), H1 title, muted summary, back link on detail pages ("All foundations", "All components") |
| On this page | Right column on detail pages, generated from visible `sections`; hidden when there are fewer than two sections; becomes an in-flow list at narrow widths |
| Content column | Readable measure for prose; wide tables and specimens may span the content area; restrained borders and surfaces |
| Overview grids | Card grids via container queries: 3 columns wide, 2 medium, 1 narrow |

- All shell styling comes from Oddkin tokens and the Workbench's own theme; project branding (name, logo, accent, fonts) is configurable.
- **Shell appearance is separate from preview appearance.** The header appearance control themes the shell only. Previews have their own settings (theme, mode, product, density, direction, width) and never restyle the shell; the shell never restyles previews except when a preview is explicitly set to "Same as site".
- Accessibility: landmarks, one H1 per page, logical heading order, visible focus, `aria-current` on active nav items, keyboard-operable disclosures, frame titles, reduced motion, forced colors, 200%/400% zoom, narrow reflow.

## 4. Foundations overview

- Header: eyebrow (configurable, default "Design system"), H1 "Foundations", summary (built-in default, overridable).
- Card grid (§3). Each card: linked title, short description, metadata line `Updated <date> · <tags>`; the date part is omitted when unknown, and tags when empty. Cards carry no specimens.
- Categories, in default order, each shown only when supported: **Token architecture · Color · Typography · Spacing · Borders and radii · Elevation · Motion · Themes · Responsive behavior**.
- Titles, summaries, tags, ordering, and visibility come from generated foundation metadata plus authored overrides (§10).
- **Dates** come only from declared metadata (`updated` in authored content or enrichment) or source history (the last commit touching the foundation's declared source files, when the build has repository history). Build time is never used as an updated date. If neither is available, the date is omitted.
- **Theme Studio is not a Foundations card or sidebar entry.** **Products and modes** appears in Foundations only when enabled and configured to be placed there (§9).

## 5. Foundation detail pages

### 5.1 Template

Eyebrow "Foundations", title, summary, "All foundations" link, contextual sidebar, On this page, then the sections the library supports. Each section combines three content layers (§10): built-in explanation, generated facts, and optional authored guidance.

**Context label.** Every value-bearing section states which configuration it shows: by default the **saved/generated baseline** (the theme outputs built from source config). A Theme Studio draft can be viewed on foundation pages only through an explicit "View draft" toggle, which shows a persistent "Showing draft: <name>" banner and labels every value as draft. Baseline and draft values are never mixed on one page.

**Units.** Values show the source unit (`0.75rem`). Computed pixels appear only next to an explicit preview context ("12px at 16px root in Light · Comfortable").

### 5.2 Pages and generated sections

| Page | Generated from | Sections (each only when supplied) |
| --- | --- | --- |
| Token architecture | Token categories, tiers, naming, alias graph, overrides, output formats, dependency policies | Tiers and naming · Source-to-output pipeline · Trace a token (interactive: pick a token and context, see each alias step to the resolved value) · Consumption (CSS / SCSS / TS / JSON) · Aliases and overrides · Dependency policy and direct reads · Every token (filterable by name and tier) · Source |
| Color | Palettes, ramps, semantic roles, interactive states, theme variations, contrast pairs | Palettes and ramps · Semantic roles (light and dark columns side by side) · Interactive states · Product variations · Contrast pairs (WCAG normative; supplementary metrics labelled) |
| Typography | Families, sizes, weights, line heights, letter spacing, scale, composite styles, roles | Families · Scale · Composite styles · Semantic roles · Specimens |
| Spacing | Strategy and inputs, scale steps, CSS custom properties, units, semantic vocabulary, aliases, declared layout/precedence contracts | Scale · Semantic vocabulary · Precedence and layout behavior (§5.3) |
| Borders and radii | Widths, styles, colour roles, radii, component mappings | Border widths and styles · Border colour roles · Radii · Component mappings · Samples |
| Elevation | Shadow definitions, levels/roles, theme variations | Levels · Theme variations · Surface specimens |
| Motion | Durations, easings, semantic roles, reduced-motion behavior | Durations and easing · Roles · Try a duration (interactive demo honoring reduced motion) · Reduced motion |
| Themes | Themes and modes, scope contracts, composition/override rules | Available themes and modes · Scope contract (`data-odd-*`) · Composition and precedence · Comparisons · Usage snippets · Link to Theme Studio |
| Responsive behavior | Conditions, thresholds, profiles, responsive roles, recipes | Which query to use · Conditions and thresholds (Target · Condition · Why · Where) · Profiles · Responsive roles · Recipes · Resize a container (interactive) · Reflow and overflow |

### 5.3 Spacing — reference vertical slice

Built first, from the library's actual spacing contracts:

- **Scale.** An introduction generated from data: strategy (multiples / ratio / explicit) and its inputs, step count, minimum and maximum values ("N steps from <min> to <max>"), and any declared density behavior or direct-read dependency policy. Then a table: **Token** (dotted name plus `--css-custom-property`) · **Value** (source unit) · **Sample** (proportional bar sized by the value in a declared preview context) · optional **Origin** (generated / preset / configured / override).
- **Semantic vocabulary.** Only when the library declares semantic spacing roles: **Semantic token · Reference step · Value**, plus a component-facing value column when a component contract maps public option values to these roles (e.g. a `gap` property's allowed values).
- **Precedence and layout behavior.** Only when declared (recipe or component contracts): rules rendered from metadata, plus an authored or example-backed live layout demonstration.
- Nothing is copied from the reference: step counts, names, vocabularies, density behavior, and precedence rules all come from the consuming library.

## 6. Components catalog

- Header with built-in summary (overridable). Any testing, accessibility, or compatibility statement appears only when backed by project evidence (`verified` provenance or an authored statement linked to a check); the reference's verification paragraph is never copied.
- **Search** by name, tag name, summary, and tags. **Category filter** from the library's configured categories ("All categories" default). **Result count** ("Showing N of M").
- Groups: heading with count, optional group description, card grid (title, summary, `Updated · tags`). Categories come from metadata/config (`@category` tag, enrichment, or config mapping). Components without a category go to a configurable fallback group (default "Other components"). No forced Layout / Primitive / Composite taxonomy.
- Filter and search state live in the URL (`?q=&category=`) and are shareable.
- Lightweight: no live previews or iframes in cards; component modules are not loaded on the catalog.

## 7. Component detail page — documentation and interactive example combined

Each component's documentation and interactive controls live on its detail page. There is no "Open in playground" hand-off and no separate Playground destination.

The current shell mounts a basic registration-backed frame in the "Interactive example" section when the page publishes a registration entry. It starts the component's default state; editable properties, authored example controls, fixture/provider setup, and event logs are not part of this initial preview.

### 7.1 Section order (default; each only when supplied)

1. **Overview** — description, intended use ("Use it for" / "Not for" when authored), imports, registration entry, related components.
2. **Interactive example** — preview, preset selector (from `defineExamples`), Reset, Copy example link, preview settings, generated code.
3. **API** — the editable API table (§7.2), followed by slots, events, methods, parts, CSS custom properties, and custom states.
4. **Examples** — authored examples rendered in isolated previews (lazy).
5. **Tokens** — "From property to token" trace and "Every token read" table (§7.5).
6. **Behavior and accessibility** — states, keyboard, accessibility contract, responsive behavior, form participation.
7. **Guidance** — composition, common mistakes, tradeoffs (authored).
8. **Source** — source references and package exports.
9. **Known limitations** — always shown when any are declared; otherwise "None documented".

### 7.2 Editable API table

The primary control surface; there is no second controls table or duplicate props reference.

| Column | Content |
| --- | --- |
| Name | Property name; attribute name and reflection shown beneath ("attr `appearance`, reflects") |
| Type | Declared type (unions expanded to allowed values) |
| Default | Known default, or "Unknown" / "Unset: <behavior>" when declared |
| Current value | Contract-correct control (workbench.md §4); read-only values displayed, not editable; non-serializable values show "Requires fixture" with the fixture picker |
| Description | From metadata, with provenance marker |

- At narrow widths, rows become stacked cards with the same fields.
- All workbench.md §4 control contracts apply unchanged: property vs attribute, boolean presence, `''` / `0` / `false` / `null` / unset / unknown, optional/nullable/read-only, schema-backed arrays and objects, fixtures/adapters, no reflection loops, sync only via declared contracts.

### 7.3 Slots and composition

- Default and named slots listed from the component's real contract, each with a text editor for simple content and a fixture picker for richer compositions (from `defineExamples`).
- No invented `children`-style properties: React `children`/`ReactNode` concepts from the reference become the component's actual slots, properties, and fixtures.

### 7.4 Preview, settings, code, and layout

- **Preview settings** (preview-only): mode, theme/product (if any), density, direction, profile, and width (Narrow / Medium / Wide / Fill plus a numeric width) with a summary line and a "Same as site" option. These never restyle the shell (§3).
- **Presets** from authored examples; **Reset** recreates a clean instance; **Copy example link** encodes a versioned, validated share payload (component, preset, values, slots, preview settings).
- *(Planned.)* **Export reproduction** produces a runnable project (`reproduction.v1`) and is distinct from the share link. A **Verification** section lists conformance and example results with their states and conditions (`passed`, `failed`, `reused` with baseline conditions, `not-executed`, `unresolved`), never presenting untested results as passing ([change-impact-and-verification.md](./change-impact-and-verification.md)).
- **Generated code**: plain HTML and JavaScript using the library's actual public imports, registration entry, attributes, properties (object properties set by script), slot content, event listeners, and theme/scope attributes. No React snippets or private workspace aliases. Copied code is verified in an independent consumer.
- **Layout**: wide screens show the preview in a column adjacent to the API table, sticky within the interactive section so it stays visible while editing (experiment: adjacent vs sticky-top); narrow screens stack preview, settings, table, and code.
- Isolated preview realms, lifecycle ownership, deterministic reset, state preservation, and remount rules follow workbench.md §5.

### 7.5 Tokens

- **From property to token:** rows of `property="value" (state)` → CSS property → token, generated from analyzer-extracted style mappings and recipe/role metadata; rows whose mapping is not declared are not invented.
- **Every token read:** caption with context ("N tokens read · resolved for <product> · <mode> · <density>"); columns **Token · Tier · Read through** (stylesheet, recipe, role) **· In this context** (resolved value + `{alias}`). Alias chains show only declared steps.
- Reference types are labelled: *declared* (metadata), *potential* (static style reference), *observed* (computed in the current preview). A static reference is never presented as proof the token affects the current preview.

### 7.6 Rich documentation preserved

Examples, behavior, accessibility and keyboard contracts, methods, events, slots, parts, custom states, styling, source, and limitations remain full sections; the page is never reduced to a control panel. Missing guidance is shown as "Not documented" with the authored-content key that would supply it.

## 8. Theme Studio destination

- Primary navigation entry and route `/theme-studio` (configurable). Not in Foundations cards or sidebar; the Themes foundation page links to it.
- Page structure follows the reference's documentation pattern: header, On this page, then sections generated from capabilities: **Generate** (presets, base inputs) · **Ramps and roles** · **Live preview** (paired light/dark specimens using the library's components) · **Contrast** · **Color vision** (supplementary, labelled) · **Comparison** (baseline vs draft) · **Inspection** · **Exports** · **Method and limits**. A sticky live-result summary may stay visible while editing.
- All previously planned capabilities are unchanged (workbench.md §6–§9): canonical config editing, live generation, specimen role mapping, light/dark and baseline/draft comparison, inspection, visualizations, presets, undo/redo, sharing, exports, static client-side operation.
- Drafts live in Theme Studio's state (and share URLs); foundation pages show the baseline unless the user explicitly opts into viewing a draft (§5.1).

## 9. Products and modes (optional)

- **Disabled and absent by default.** When disabled, no route, navigation entry, card, search entry, or product-comparison content exists. A single-product library looks complete.
- When enabled, placement is configurable: Foundations card + sidebar entry, a primary navigation destination, or both.
- **Product identity is distinct** from mode (light/dark), theme, density, and responsive profiles. The page shows each product's overrides relative to the base, composed with selectable mode/density/profile, using the canonical generator and isolated previews.

```ts
// oddkin.config.ts (illustrative)
export default defineWorkbenchConfig({
  products: {
    enabled: true,
    placement: ['foundations'],
    sources: [
      { id: 'clinic', from: { theme: './oddkin.theme.ts', product: 'clinic' } },                // product defined in the local theme config
      { id: 'portal', from: { package: '@acme/portal-theme' } },                               // installed package exporting an Oddkin product manifest
      { id: 'kiosk', from: { manifest: 'https://cdn.acme.dev/kiosk/oddkin.product.v2.json', version: '2.x' } }, // versioned manifest, fetched at build time
    ],
    discovery: { workspace: true },     // produce suggestions only
  },
});
```

- **Product definition**: id, label, description, theme/config reference, token overrides, density/profile defaults, applicable components, examples, authored comparison guidance — validated against a versioned product schema.
- **Sources**: local workspace package, installed package, or an explicitly configured versioned manifest/config file (local path or URL). Other product repositories need not be checked out. Remote manifests are fetched at **build time** and snapshotted into the static build; published apps make no runtime cross-origin fetches. Unavailable, invalid, or incompatible sources produce diagnostics and are omitted, not guessed.
- **Workspace discovery** (Node): inspects workspace declarations, dependency relationships, and explicit Oddkin metadata (`oddkin.product` in a package's manifest/enrichment, or a product entry in theme config) and reports **suggested** product mappings with reasons. Tooling, documentation apps, tests, examples, and internal packages are excluded by default; no package becomes a product without explicit configuration. Discovery never publishes a page.
- Reuses existing generation, scope, and preview contracts; works in static deployment.
- **Any number of products** (planned, [multi-product.md](./multi-product.md) §3, §10): no fixed comparison slots or product-count assumptions. The product picker is searchable, and the user chooses which products to compare. Only chosen previews mount, and implementation assets load per product on demand. The page remains absent unless enabled, whether there is one product or many. Products may name their design language, component family, and foundation compatibility (additive `product.v1` fields, M9).

## 10. Content layers and customization

| Layer | Source | Role |
| --- | --- | --- |
| 1. Built-in copy | `@oddkin/workbench/content` (localizable message catalog) | Generic explanations of recurring concepts (semantic tokens, spacing scales, typography, elevation, motion, themes, responsive layout). Phrased conditionally and never asserting facts about the library |
| 2. Generated facts | Normalized metadata + token inspection output | Values, names, counts, ranges, tables, aliases, contracts — authoritative |
| 3. Authored guidance | Typed `oddkin.docs.ts` and/or Markdown files with front matter keyed by page/section id | Titles, summaries, introductions, section guidance, examples, tags, ordering, visibility, updated dates |

- **Precedence**: authored overrides built-in copy for prose and presentation (titles, summaries, intros, ordering, visibility, tags); generated facts always win for values and contracts. Prose cannot redefine spacing, colours, or component APIs. Authored text that references a generated fact uses an interpolation token (e.g. `{{spacing.stepCount}}`) rather than a literal copy.
- **Stability**: authored content is keyed by stable page/section ids and is never overwritten by regeneration. Unknown ids produce diagnostics (`content.page.unknown`, `content.section.unknown`); renamed ids are handled by declared aliases/migrations in the content schema.
- **Validation**: content files are validated against a versioned schema (typed in TS; JSON Schema for Markdown front matter).
- **Localization**: built-in copy is a message catalog keyed by stable ids; authored content may supply per-locale variants. Generated facts are locale-formatted via `Intl` where appropriate.
- Basic documentation works with no authored files.

## 11. Standard-CEM-only libraries

- Components catalog and component detail pages work at the documented baseline.
- Foundations shows only what a supplied Oddkin theme config, token files, or explicit adapter provides; otherwise the Foundations destination shows a single explanatory "No foundation data supplied" page with setup guidance, not empty tables. Unknown foundation data is never invented.

## 12. Acceptance (Workbench pages)

- [ ] Foundations overview matches the reference's card/navigation hierarchy (eyebrow, title, summary, 3/2/1 card grid, contextual sidebar) using the library's own data
- [ ] Foundation detail pages include applicable tables, specimens, aliases, explanations, anchors, and examples; unsupported sections are absent
- [ ] Two different library configurations (fixtures) produce different, correct content without editing application templates
- [ ] Card dates, tags, counts, and verification statements are accurate or omitted; build time is never shown as an updated date
- [ ] Configuration changes regenerate relevant content without overwriting authored guidance
- [ ] Components catalog keeps search, category filter, counts, grouping, fallback group, and URL state; no previews in cards
- [ ] Each component detail page combines documentation, editable API table, slots, preview settings, presets, reset, sharing, and reproducible plain HTML/JS code
- [ ] No standalone Playground destination; legacy routes redirect where configured
- [ ] Theme Studio is a primary destination and absent from Foundations cards and sidebar; the Themes page links to it
- [ ] Foundation pages show the baseline unless a draft is explicitly selected and labelled
- [ ] Products and modes is absent by default; workspace discovery suggests but never invents products; explicit local, installed, and versioned-manifest sources work and are snapshotted into static builds
- [ ] Navigation, routes, cards, search, and visibility stay synchronized through the page registry
- [ ] Static builds, deep links, assets, redirects, and share links work under a hosting base path
- [ ] Missing metadata produces honest unavailable/unknown states
- [ ] Shell vs preview appearance separation verified; Workbench accessible, responsive, lazy-loaded, isolated
- [ ] `apps/docs` reuses these public panels rather than duplicating foundation and component explorers

## Open questions

- Sticky adjacent preview vs sticky-top preview on wide screens (usability experiment).
- Source-history dates: which VCS facts the analyzer may read in CI shallow clones; fallback when history is shallow (omit).
- Exact built-in copy tone and length; localization of built-in copy beyond English at launch.
- Whether Overview/home is generated by default or opt-in.
