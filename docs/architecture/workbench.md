# Oddkin Workbench and Theme Studio

Status: **proposal**, except the DOM-free M3 entries `@oddkin/workbench/examples` and `./config`, which are implemented ([packages/workbench](../../packages/workbench/README.md)). `@oddkin/workbench` is optional tooling: a reusable, metadata-driven documentation application with integrated interactive examples that teams point at their own component library. Related: [workbench-pages.md](./workbench-pages.md), [metadata-and-analyzer.md](./metadata-and-analyzer.md), [theming-and-styling.md](./theming-and-styling.md), [layout-recipes.md](./layout-recipes.md), [data-composition.md](./data-composition.md), [core-contracts.md](./core-contracts.md).

## 1. Product scope

A generated Workbench provides (information architecture and page contracts: [workbench-pages.md](./workbench-pages.md)):
- A Design System Lab–style shell: persistent primary navigation, contextual sidebars, eyebrow/title/summary headers, "On this page" navigation, card-based overviews — populated from the library's own data and branding.
- **Foundations** overview and generated detail pages (token architecture, color, typography, spacing, borders and radii, elevation, motion, themes, responsive behavior) — only where the library supplies contracts.
- **Components** catalog (search, category filter, counts, URL state) and component detail pages that combine documentation with the interactive example and an editable API table. There is no separate Playground destination.
- **Theme Studio** as its own primary destination.
- Optional **Products and modes** page (disabled by default).
- Interactive property, attribute, slot, and CSS-custom-property controls; event inspection; reproducible plain HTML/JS snippets.
- Token search, alias chains, provenance, and computed-value inspection.
- Previews across components, compositions, theme, density, direction, viewport, and container sizes.
- Docs for recipes, variants, responsive profiles, and data models.
- A publishable static application.

Basic API exploration needs no authored story files. Meaningful examples, workflows, fixtures, accessibility guidance, and behavior contracts are authored once (§7) and reused by docs, tests, Theme Studio, and agents.

## 2. Architecture

```text
library source ──► @oddkin/analyzer ──► custom-elements.json + oddkin.metadata.json + indexes
                                           │
oddkin.config.ts (workbench + themeStudio) ──┤
theme config (oddkin.theme.ts / .json) ──────┤
authored examples (*.examples.ts) ─────────┤
                                           ▼
                           @oddkin/workbench (shell, panels, Theme Studio)
                                           │  loads at runtime in preview iframes
                                           ▼
                      the library's real browser modules, registration entries, themes, fonts, assets
```

- **One reusable shell**, configured by metadata and `oddkin.config.*`. No forked app per library. Generated artifacts (`.oddkin/` in dev, build output) are separate from authored config/examples.
- The shell is built with Oddkin and has zero third-party runtime dependencies. Phasing: M3 ships only DOM-free `./examples` and `./config`; the M5 shell uses `@oddkin/core`, `@oddkin/tokens`, and `@oddkin/components` and runs without state/app; `@oddkin/state`/`@oddkin/app` are integrated from M6–M7. Reusable panels never require consumers to create an app root or router.
- Build order: runtime components → analyzer metadata → example typechecks/tests → Workbench shell; no production dependency from components to tooling.
- **Module resolution**: the analyzer emits a module map (tag → registration entry, dependency entries, package `exports`), plus required stylesheets, fonts, and assets declared in config. Workbench builds an import map per preview frame. Source analysis stays DOM-free; implementations load only in preview frames.
- **Branding and prefixes**: any tag prefix; project name, logo, colours (via its own theme), and links from config.

### Support levels

| Level | Input | Experience |
| --- | --- | --- |
| **Full Oddkin** | Oddkin-authored library + analyzer enrichment + theme config | Everything: typed controls, models, recipes, profiles, Theme Studio with generation, token provenance, examples |
| **Standard CEM** | Any library with a valid `custom-elements.json` and loadable modules | API docs, controls for CEM-typed properties/attributes, slots, events log, CSS custom property editing, parts listing, snippets. Theme Studio limited to editing CSS custom properties the library declares (no generator) unless an Oddkin theme config is supplied |
| **Missing enrichment** | Any field not provided | Shown as "Not documented" / "Unknown default" / "No adapter" — never invented |

### 2.1 Shell, data, and serving (proposal, M5)

- **Entries.** DOM-free: `./config`, `./pages`, `./examples` (implemented), `./content` (built-in copy), `./data` (analyzer outputs, configuration, authored content, and token inspection → the Workbench index and per-page data), `./protocol` (frame protocol types and validators, §5.1). Browser: `./app` (the shell), `./panels/*`, `./frame` (the runtime inside preview frames), `./preview` (implemented). Node: `./node` and the `oddkin` bin.
- **Generated data.** `index.json` stays small: the page registry, branding, search entries (pages, components, tokens, recipes, models), catalog summaries, and diagnostics. Each page's detail (a component's API from CEM plus enrichment, with provenance; a foundation's facts from metadata plus token inspection; examples) is a separate `pages/<page id>.json`, loaded with its panel module when the route is entered. No build time enters any file.
- **Serving.** `workbench dev` and `workbench build` share one URL layout: the shell at the base path; data, the frame document, and package files under `<base>_oddkin/`. Package files are served or copied exactly as published (no bundler, no third-party runtime code). The shell and each frame resolve bare specifiers through import maps generated from the packages' `exports`, `development` condition first so diagnostics stay on. A frame's import map covers the documented library's dependency closure; the shell's covers Workbench's own.
- **Shell.** `<oddkin-workbench>` renders into the light DOM, because it owns the document's landmarks, the skip-link target `#main`, and fragments. It runs on `@oddkin/app`: `createApp` and `createRouter`, with the base path and history or hash mode from `hosting`, routes generated from the registry, and legacy routes as router redirects. Panels are shadow-DOM elements whose inputs are properties (their data and an `href` function), so `apps/docs` can embed them without an application or router.
- **Element names.** Workbench's own elements use the `oddkin-` prefix (`oddkin-workbench`, `oddkin-catalog`, …). Documented libraries load only in frames, so any library prefix, `odd-` included, is safe.
- **Live updates (dev).** The dev server watches the configuration, authored content, published metadata, theme configuration, and the library's built modules. It rebuilds the data and sends an `update` event over Server-Sent Events that names what changed: the index, pages, modules, or the shell page. The shell refetches what changed; frames follow the remount policy (§5): metadata, documentation, CSS, and theme changes update in place, and changed modules get a fresh frame.
- **Generated directory.** Workbench writes into `.oddkin/workbench/`, which carries a marker file (`oddkin-generated.json`). Workbench writes and deletes only inside a directory that carries the marker, refuses an existing unmarked directory, and writes nowhere else: authored configuration, content, examples, sources, and published metadata are never touched. Other tools may use their own directories below `.oddkin/`.
- **Inputs.** Published metadata by default: each package's `customElements` manifest and `oddkin.metadata.json`. `--analyze` reruns `@oddkin/analyzer` on workspace sources for live documentation and writes its outputs into `.oddkin/` only.
- **Bounded work.** A page mounts a few frames at most and none for catalog cards; event logs and histories are capped; panels load lazily. Shell startup and selected-preview latency are measured.
- *(Implemented, M5: the data files and import maps (`@oddkin/workbench/data`); in `@oddkin/workbench/node`, configuration and content loading, package graphs, the marked generated directory, one-shot builds, the dev server with live updates, and the `oddkin` bin. Package URLs carry the version (`_oddkin/m/<name>@<version>/…`), so the shell and frames never share a URL for different copies of a package. An `update` event with `ok: false` and diagnostics reports an invalid edit while the last valid data stays served; hosting changes need a restart. Planned: the shell, panels, frames, `--analyze`, and `workbench build`.)*

## 3. Component documentation

Rendered on the component detail page (section order, editable API table, slots, tokens, layout: [workbench-pages.md §7](./workbench-pages.md)). Generated per component from available facts (with provenance labels):
- Import paths, registration entry, description, intended use, related components.
- Properties and attributes: types, defaults (known/unknown), allowed values, constraints, reflection.
- Methods: signature and authored invocation examples only. **Methods are never invoked during discovery.**
- Events: detail schema, `bubbles` / `composed` / `cancelable`.
- Slots, parts, CSS custom properties, custom states, styling contract (inherited roles, component variables, parts).
- Accessibility and keyboard guidance when authored; recipes, variants, data models, deprecations, source links.

## 4. Controls

These contracts govern the **Current value** column of the editable API table on each component detail page ([workbench-pages.md §7.2](./workbench-pages.md)); there is no separate controls table.

| Contract | Control behavior |
| --- | --- |
| Boolean property | Checkbox writes `el.prop = true/false` |
| Boolean attribute | Toggles presence (`setAttribute(name, '')` / `removeAttribute`) — distinct from the property |
| String | Text field; distinguishes empty string `''` from **unset** (explicit "unset" affordance removes the attribute / deletes the assignment) |
| Number (constrained) | Number field with min/max/step from metadata; `0` is a value, not unset |
| Enum / literal union | Select or segmented control |
| Optional / nullable | Explicit `undefined` (unset) vs `null` options when the contract allows each |
| Read-only | Inspect only; displayed live, never editable |
| Array / object with model | Model-generated editor (data-composition.md §5) with validation |
| Function, DOM node, class instance, template result | Not editable generically; requires a fixture or adapter (§7) — shown as "requires fixture" |
| Default / named slots | Text or limited-markup slot editors producing light-DOM children; complex children via fixtures |
| CSS custom properties | Value field with token-reference picker |

Rules:
- Assign properties or serialize attributes exactly per contract (property vs attribute, converter). One write per change; reflected attributes are not written back by the control (no reflection loops).
- **Reset** recreates a clean instance (or applies an explicitly declared baseline); it never "un-sets" by guessing defaults.
- Interactive controls stay in sync with the component only through declared state/event contracts (e.g. `value` + `input` event declared as a sync pair in metadata) or explicit adapters. Update behavior is never inferred from event names.

### Event log and snippets
- Event log: name, time, `bubbles`/`composed`, target path summary, detail serialized safely (cycles, DOM nodes, functions, `Map`/`Set`, errors summarized; size-capped).
- Snippets (plain HTML + JS) reproduce the current configuration: the library's public imports, registration entry, attributes, property assignments for objects (by script), slot content, listeners, theme/scope attributes, styling. No framework-specific snippets or private workspace aliases. Snippets are verified in an independent consumer (§12).

## 5. Isolated previews

- Each preview runs in an **iframe** with its own realm: own custom-element registry, module graph (import map), styles, theme scopes, and app context. The shell is never affected by preview styles, themes, registrations, or errors.
- Independent viewport and container sizes; multiple simultaneous previews with different themes/densities/directions; real CSS container queries (container resizing is a CSS size change, not a script reflow).
- Error isolation: a throwing component or example shows an error panel for that frame; reset reloads the frame.
- A host-side `Scope` per preview owns the frame, message channel, observers, timers, fixture setup, and resources; a frame-side `Scope` per mounted example owns listeners, subscriptions, and cleanup. Switching component/example/composition disposes the previous scopes.
- Theme-value edits preserve preview component instances. This includes density, profile, and condition-threshold changes, which update the relevant preview-owned stylesheets without recreating components.
- Replacement is permitted when component identity, example composition, adapter/fixture setup, or registration identity changes, or when the user explicitly resets the preview. Replace the smallest necessary region and dispose its owned resources. Registration replacement uses a fresh frame where required.
- Resetting theme configuration, applying a value-only preset, and undo/redo do not reset the preview.

| Edit | Remount policy |
| --- | --- |
| Colours, spacing, radius, typography, borders, elevation, motion | Preserve instances |
| Theme/mode, density, profiles, condition thresholds | Preserve instances; update generated CSS as needed |
| Theme presets, undo/redo, "Reset theme" | Preserve instances |
| Invalid intermediate configuration | Preserve instances and the last valid theme |
| Component selection, example selection, specimen composition, role mapped to a different component | May remount the affected region |
| Adapter, fixture, or provider setup changes | May recreate affected setup and instances |
| Implementation/registration replacement, including component-code HMR | Fresh frame when replacing an existing registration |
| CSS, token, documentation, or compatible metadata HMR | Update in place |
| Explicit "Reset preview/example" | May recreate the preview instance |

"Structural" means a change to the preview's component identity, composition, or fixture-owned setup — not its visual geometry. Changing a role's props or appearance preset without changing its component or setup is a value update.

- Never derive component keys or frame identity from a theme configuration hash.
- Instance preservation does not freeze internal DOM: components may perform their normal updates. State, focus, and selection are preserved where the relevant elements remain present.
- Shell ↔ frame communication uses a typed, versioned `postMessage` protocol (same-origin by default); no shared object references.
- An arbitrary executable code editor is **out of scope** for the initial Workbench; if added later it needs its own design (sandbox origin, CSP).

### 5.1 Frame protocol (proposal, M5)

- **Identity.** The host gives each frame an id and a generation. A fresh document in the same slot (reset frame, registration replacement) increments the generation. The frame URL carries both.
- **Handshake.** The frame posts `hello` to its parent with its own origin as the target. The host accepts it only when `event.source` is that frame's window, `event.origin` is the preview origin (same origin by default), and protocol, version, frame id, and generation match the live frame. The host then transfers a dedicated `MessagePort` (`connect`), and everything else travels on that port. A version mismatch shows an "incompatible frame" error instead of a preview.
- **Envelope.** `{ protocol: 'oddkin.frame', version: 1, frame, generation, kind, id?, replyTo?, payload?, error? }`. Requests carry increasing `id`s; replies carry `replyTo` and either a `payload` or `error: { code, message }`. Payloads are plain JSON (objects, arrays, strings, finite numbers, booleans, `null`), checked before sending and on receipt. Malformed messages, stale generations, and messages after disposal are dropped and counted, never applied.
- **Requests (host → frame).** `mount` (component, registration entry, example, properties, attributes, slots, settings); `set` (one property or attribute write, or unset); `slot` (text content); `reset` (a clean instance); `theme` (replace the preview-owned theme sheet); `settings` (mode, density, direction, width); `dispose`. Reserved: `inspect`, for `inspectPreview` ([agent-tooling.md](./agent-tooling.md) §9.2; types in M5, implementation in M11).
- **Notifications (frame → host).** `event` (name, time, `bubbles`/`composed`/`cancelable`, a target summary, and the detail serialized safely and capped); `error` (phase and message); `state` (values reported through declared sync contracts only); `size` (content block size).
- **Ownership.** A host `Scope` per preview owns the iframe, port, listeners, and timers; a frame `Scope` per mount owns listeners, fixtures, and observers. Disposal closes the port before removing the iframe.
- **Registrations.** A frame registers the library once. A `mount` whose registration differs from the one already defined for that tag fails with `frame.registration.incompatible`, and the host replaces the frame with a new generation; nothing is redefined in place.
- **Trust.** Frames isolate registries, styles, and errors; they are not a sandbox for untrusted code. Local modules and examples are trusted project code.

## 6. Theme Studio

Every fully configured Workbench includes Theme Studio, generated from the library's theme contracts, metadata, and preview configuration. It is a **primary navigation destination** (default route `/theme-studio`), not a Foundations card or sidebar entry; the Themes foundation page links to it. Page structure and the baseline-vs-draft rule for foundation pages: [workbench-pages.md §5.1, §8](./workbench-pages.md).

### 6.1 Reference
The Design System Lab Theme Studio (https://brianchristopherbrady.github.io/design-system-lab/foundations/theme-studio) is the functional and visual reference. Its structure was inspected in a browser on 2026-10-17 ([design-system-lab-audit.md](../reference/design-system-lab-audit.md)); interaction details, exports, and accessibility remain to be audited. No parity is claimed without verification. The original React runtime is neither imported nor reimplemented line-for-line.

### 6.2 One configuration and generator
- Uses the **same** `ThemeConfig` schema, validation, alias resolution, and pure generator (`@oddkin/tokens/generate`) as config files and the CLI. There is no separate browser token engine.
- TS/JS theme configs are loaded by dev tooling (Node) and converted to the browser-editable JSON-compatible model; the published app never executes pasted TS/JS.
- Form editor and schema-aware JSON editor operate on the **same draft**.

### 6.3 Controls by category
Base and additional brand colours · neutral and status colours · spacing (strategy-specific fields only: unit + multipliers, base + ratio + steps, or explicit scale) · typography (size, scale, line height, weights) · control sizing and padding · radius, borders, elevation, motion · modes, density, products, responsive conditions and profiles.

- Only controls relevant to the selected strategy are shown; contradictory combinations are impossible in the form and diagnosed in JSON.
- Every value is labelled **foundation input**, **generated**, **semantic alias**, or **explicit override**. Token names, units, and generation semantics are preserved. Density, typography preference, and target size stay distinct (theming §11.4).

### 6.4 Live editing
- Edits are debounced, generated off the main thread where practical (Worker running the same pure generator), and applied as a preview-owned theme stylesheet / scoped custom properties in each frame.
- **Latest generation wins**: each run carries a generation id; stale results are discarded.
- **Invalid drafts** keep the last valid preview and show diagnostics with config paths and guidance.
- Theme-value edits preserve instances and never rebuild component static styles (remount policy: §5); component state and focus persist where elements remain present.
- Explicit overrides are respected; roles unrelated to the edit stay unchanged (verified by diffing generated outputs).
- Container-responsive specimens use real container dimensions.

### 6.5 Specimens and the user's components
- A replaceable **specimen recipe** (default `theme-specimen`) renders paired light and dark panels with roles: surface/card, heading, body text, link, badge, labelled text input, checkbox, switch, primary and secondary actions, navigation, and composed layouts.
- Roles map to the library's components through declared preview capabilities, known contracts, examples, or explicit adapters — **never by tag name alone**.

```ts
// oddkin.config.ts (illustrative)
export default defineWorkbenchConfig({
  library: { packages: ['@acme/ui'] },
  themeStudio: {
    enabled: true,
    themeConfig: './oddkin.theme.ts',
    preview: {
      recipe: 'theme-specimen',
      roles: {
        surface: 'acme-card',
        badge: 'acme-badge',
        textInput: { component: 'acme-input', example: 'labelled' },
        checkbox: 'acme-checkbox',
        switch: 'acme-switch',
        primaryAction: { component: 'acme-button', example: 'primary' },
        secondaryAction: { component: 'acme-button', example: 'secondary' },
      },
    },
  },
});
```

- Automatic mapping only when unambiguous (a component declares `@previewRole primaryAction` or an adapter claims the role). Otherwise a picker with compatibility diagnostics (missing slot, unknown property, no label path).
- Adapters connect public properties, slots, events, fixtures, and `Scope` ownership — no second rendering or example framework.
- Saved compositions (role mappings + specimen layout) are serializable and versioned. Generic fallback specimens (plain HTML styled with roles) are clearly labelled when a real component is unavailable.
- States: rest, hover, pressed, focus-visible, disabled, invalid, and declared custom states — shown through real interaction or explicitly supported fixtures. Where simultaneous pseudo-states can't be rendered, labelled token specimens are shown without claiming they verify component behavior.

## 7. Authored examples (`defineExamples`)

```ts
// button.examples.ts — colocated, typed from the component's metadata
import { defineExamples } from '@oddkin/workbench/examples';

export default defineExamples('odd-button', {
  default: { slots: { default: 'Save' } },
  loading: { props: { loading: true }, slots: { default: 'Saving' } },
  primary: { props: { appearance: 'primary' }, slots: { default: 'Continue' }, previewRoles: ['primaryAction'] },
  inForm: {
    fixture: ({ scope, mount }) => {                 // owned setup/cleanup through Scope
      const form = mount(html`<form><odd-button type="submit">Send</odd-button></form>`);
      scope.listen(form, 'submit', e => e.preventDefault());
    },
    guidance: 'Submits the outer form; Enter in an input submits too.',
  },
});
```

- Types come from the analyzed component contract (`props`, `slots`, `events` keys are checked), so examples inherit API information instead of duplicating it.
- Optional: fixtures, compositions (multiple components), interactions (scripted steps), supplemental guidance, preview roles.
- `defineExamples` is a DOM-free definition in a dev-only entry; fixtures run only inside preview frames and tests.
- *(Implemented, M4.)* `@oddkin/components` has examples for `odd-button`, `odd-input`, `odd-card`, and `odd-side-nav`. Colocated example files are development-only sources: excluded from the package build, type-checked through the tests, and kept out of shipped code by the boundary tool (ADR 0021). `mountExample(set, name, container?)` in `@oddkin/workbench/testing` creates the registered element, applies attributes, properties, and plain-text slots, connects it, then runs the fixture with an owned `Scope`; `dispose()` releases the scope and fixture templates. Fixtures assume the page registers every element they use.
- Reused by Workbench, `apps/docs`, browser tests (`runExample` helper), visual tests, Theme Studio, and agents.
- *(Planned, [change-impact-and-verification.md](./change-impact-and-verification.md).)* Examples link to their source metadata, token inspection, conformance results (with suite version, implementation, configuration, and browser), and impact reports. **Explain** on a selected element or part shows the shared `explanation.v1` record. **Copy example link** (settings only) stays distinct from **Export reproduction** (a runnable project with declared dependencies). Visual baselines change only through an explicit accept step.
- Basic previews are generated from metadata when sufficient. Missing providers, services, fixtures, or complex children are reported explicitly. No automatic enumeration of every property combination.
- *(Planned.)* Explained **incorrect** examples for common mistakes (attribute vs property, boolean removal, registration, event names, binding paths, reconnect) declare the diagnostic they should produce. They feed agent-kit references and `validateUsage` tests and are never rendered as recommended presets ([agent-tooling.md](./agent-tooling.md) §7).

## 8. Token inspection and visualizations

- Search across components, recipes, roles, tokens, models.
- Per token: type, configured value, generated value, overrides, alias chain, provenance, variations by theme/product/density/profile, **computed value in a selected preview context** (observed), and references: *declared* (metadata), *potential* (static style references), *observed* (computed style in a frame). A static reference is never presented as proof the token affects rendered styling.
- Visualizations: brand/neutral ramps; light/dark semantic roles; foreground/background contrast pairs (WCAG 2.x normative, unknown contexts labelled, never presented as accessibility certification); proportional spacing; typography and line height; radius/border/elevation; control sizing and density; alias graph; baseline-vs-draft diff.
- Specimens link to config fields, token names, aliases, and known consumers.
- Configured, generated, and observed values are visually distinct.
- Docs cover CSS, SCSS, and CSS-in-TS consumption equally; CSS-only consumption needs no Oddkin JS.

## 9. Comparison, sharing, export

- Simultaneous light/dark; baseline vs draft; multiple independent and nested scopes; viewport and container resizing; product/density/direction/profile selectors; reset, undo/redo, presets.
- **Sharing**: serializable settings (config draft, selections, mappings) encoded in a versioned, validated URL or file; non-serializable fixtures and values are excluded with a visible note.
- **Import/export**: config (JSON, TS module text) and outputs (CSS, SCSS, JSON/DTCG, TS refs) produced by the canonical generator only.
- Browser edits never overwrite source files. In dev mode, an explicit "Save to file" action (confirmation + diff) writes through the dev server.
- Published static apps retain editing, generation, previews, comparison, and export with no Node.js or analyzer backend.

## 10. Commands

```sh
oddkin analyze                # analyzer one-shot (diagnostics, outputs)
oddkin workbench dev          # analyze + watch + validate + dev server with live preview updates
oddkin workbench build        # validate metadata, emit static app (assets, lazy imports, deep links, base path, legacy redirects)
oddkin workbench products --discover   # report suggested product mappings (never enables or publishes a page)
oddkin impact <base> <head>   # planned: impact report + selected verification (delegates to @oddkin/analyzer)
oddkin workbench repro export <example|share-link> --out <dir>   # planned: runnable reproduction; writes only to <dir>
```

- Bin `oddkin` (in `@oddkin/workbench`, delegating `analyze` to `@oddkin/analyzer`). Builds never publish or deploy.
- Deterministic output; stale generated files removed only in marked generated directories; authored config, examples, and guidance preserved.
- Base path configurable; deep links work via history routing with fallback or hash mode (same policy as `@oddkin/app` router).
- *(Implemented, M5: `oddkin analyze` runs the analyzer's own command with the same arguments and exit code; `oddkin workbench dev [--config] [--port] [--host] [--no-watch]` binds `localhost` by default (port 4175), writes `.oddkin/workbench/`, serves the shell for page paths in history mode and only at the entry in hash mode, as a static host without rewrites would, and stops on SIGINT or SIGTERM. Exit codes: 0 success, 1 errors, 2 usage. Planned: `workbench build`, `products --discover`, `repro export`, and `impact` delegation.)*

## 11. Relationship to `apps/docs` and `@oddkin/agent`

- `apps/docs` is Oddkin's product documentation (tutorials, migrations, architecture, learning). It **consumes public Workbench panels** (foundation pages, component catalog and detail pages, previews, token inspector, Theme Studio) through `@oddkin/workbench` exports instead of maintaining duplicate foundation or component explorers or token engines. Oddkin's own Workbench (pointed at `@oddkin/components`) can be linked from or embedded in the docs.
- *(Planned, [multi-product.md](./multi-product.md) §10.)* Product implementations are compared with shared examples and interaction fixtures. Product selection is searchable and scales to many products; only the chosen products are previewed, their assets load on demand, and deselected previews are disposed. Changing a component family or implementation is structural (remount policy, §5).
- `@oddkin/agent` uses the same contracts (metadata, examples, preview roles, Theme Studio config schema) to explain configuration, identify compatible components for roles, guide migrations, validate proposed changes, and verify exported results.
- *(Planned, ADR 0032.)* Agent-kit generation reads the same inputs but never requires building or serving Workbench. Static docs builds may include the kit's clean Markdown references and an `llms.txt` index.
- *(Planned.)* `inspectPreview` ([agent-tooling.md](./agent-tooling.md) §9.2) drives these preview frames through the same protocol and `Scope` ownership, under the same remount policy and trust model, and returns bounded structured results with browser and configuration conditions.
- Standard CEM alone cannot describe token generation, theme configuration, or preview-role compatibility; those live in the Oddkin enrichment schema or adapters. The CEM baseline is preserved.

## 12. Vertical slice and acceptance

First slice with real `odd-button`, `odd-input`, `odd-card`, and `odd-side-nav`, plus the Foundations overview and Spacing detail page, before expanding. Page-level acceptance: [workbench-pages.md §12](./workbench-pages.md).

- [ ] Analyzer emits CEM that validates and is consumed by an independent CEM tool; enrichment manifest validates; references resolve against `exports`
- [ ] Workbench renders documentation and the integrated interactive example for all four with no authored stories; no Playground destination exists
- [ ] Property vs attribute, nullable, falsy (`''`, `0`, `false`), read-only, unset, and reset behave per §4
- [ ] `odd-side-nav` items edited through its model editor; specimen roles via examples/adapters only
- [ ] Preview registries, failures, styles, and scopes isolated; switching components disposes scopes (instrumented)
- [ ] Base-colour, spacing, sizing, typography, and radius edits update palettes and the real components; overrides and unrelated roles unchanged
- [ ] Invalid draft keeps last valid preview; rapid edits → latest wins; focus and component state preserved through theme edits
- [ ] Light/dark, nested scopes, density, direction (`dir=rtl`), container resizing, 200%/400% zoom, keyboard
- [ ] Library components replace specimen roles with useful compatibility diagnostics; fallback specimens labelled
- [ ] Token provenance, computed values, state specimens, and verification labels accurate
- [ ] CLI and browser generation byte-identical for the same config
- [ ] Copied snippets and exported themes work in an independent consumer project
- [ ] Shared examples drive at least one docs page and one browser test
- [ ] Watch mode and builds deterministic; authored files preserved
- [ ] Static build under a hosting subpath with Theme Studio editing intact
- [ ] Standard-CEM-only library (fixture outside Oddkin) gets the documented baseline with missing enrichment labelled
- [ ] Ordinary component consumers contain no analyzer, Workbench, or agent code

## Open questions

- Iframe per preview vs a pooled frame with per-example realms (performance experiment).
- Worker-based generation vs main-thread generation for typical config sizes.
- Whether `defineExamples` lives in `@oddkin/workbench/examples` or a tiny shared dev package used by tests without Workbench.
- How much of the Design System Lab Theme Studio layout to reproduce vs redesign (structure recorded in the audit; decide after the interaction/accessibility audit).
- Page-level open questions: [workbench-pages.md](./workbench-pages.md).
