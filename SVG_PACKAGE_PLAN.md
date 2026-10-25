# Oddkin: Build an Extensible SVG Icon Framework and Industry Icon Collection Platform

## Objective

Design and implement a production-grade, highly performant, accessible, ergonomic, and extensible SVG icon framework for Oddkin.

The system must support multiple rendering strategies, tree-shakable icon definitions, external SVG symbol sprites, custom providers, dynamic loading, semantic icon mappings, product theming, build-time optimization, and independently distributed icon collections.

**The most important architectural requirement is that new industry-specific icon collections can be created, configured, built, tested, documented, and published without modifying the shared icon framework or duplicating collection infrastructure.**

Create three initial packages:

- `@oddkin/icons`: The shared, industry-agnostic icon framework, `<odd-icon>` component, registry, providers, renderers, collection contracts, collection tooling, and compiler.
- `@oddkin/icons-healthcare`: An independently distributed healthcare icon collection using the shared framework.
- `@oddkin/icons-gis`: An independently distributed geographic information systems icon collection using the shared framework.

Healthcare and GIS are the first two collections, not special cases in the architecture.

The platform must support adding any number of future collections, including finance, manufacturing, industrial, education, transportation, energy, agriculture, science, public safety, and other domains.

Future collection packages should be first-class citizens from the moment they are created, with the same capabilities, conventions, and workbench integration as the initial collections.

The healthcare and GIS icons are original artwork already designed for Oddkin. Locate and inspect the existing source assets, preserve their visual designs and metadata, and integrate them using the new collection infrastructure. Do not substitute generic third-party icons.

Draw architectural inspiration from Lucide, Iconify, Material Symbols, Shoelace, and similar systems, while prioritizing Oddkin's existing design philosophy: framework independence, composability, accessibility, performance, strong contracts, reusable primitives, multi-product flexibility, and exceptional developer ergonomics.

**This is a net-new implementation request. Inspect the existing repository, architecture, contracts, utilities, build system, and implementation plan before introducing new code.**

Reuse existing capabilities wherever appropriate. Avoid parallel abstractions, unnecessary dependencies, and duplicated infrastructure.

Implement the system, not merely a proposal.

---

# 1. Fundamental Architecture

Separate the system into four responsibilities:

1. **Core infrastructure:** Domain-agnostic web component and lifecycle capabilities.
2. **Icon framework:** Icon definitions, rendering, resolution, loading, accessibility, and shared APIs.
3. **Icon collections:** Independently distributed artwork and metadata packages.
4. **Product configuration:** Semantic mappings, selected icon collections, and visual preferences.

These responsibilities must remain independent.

The fundamental model is:

```text
@oddkin/core
    │
    ▼
@oddkin/icons
    │
    ├── <odd-icon>
    ├── Icon definition contracts
    ├── Registry and provider system
    ├── Rendering strategies
    ├── Loading and caching
    ├── Accessibility
    ├── Collection SDK
    ├── Collection compiler
    └── Collection scaffolding tools

Independent collection packages:

@oddkin/icons-healthcare
@oddkin/icons-gis
@oddkin/icons-finance
@oddkin/icons-industrial
@oddkin/icons-education
@oddkin/icons-{any-industry}
```

`@oddkin/icons` must never import healthcare, GIS, or any other industry collection directly.

Collection packages depend only on the public contracts and tooling they need from `@oddkin/icons`.

The framework must support third-party collections developed outside the Oddkin monorepo.

Adding a collection must not require:

- Changing `<odd-icon>`.
- Adding new renderer implementations.
- Adding special cases to the registry.
- Editing the core package.
- Editing a central hardcoded collection list.
- Creating custom build scripts.
- Creating custom TypeScript generation scripts.
- Writing new workbench pages manually.
- Reimplementing registration or caching.
- Releasing a new version of the runtime, unless the public collection contract itself changes.

This is a strict architectural requirement.

---

# 2. Package Ownership

## 2.1 `@oddkin/core`

Core owns only reusable, domain-agnostic functionality.

Relevant existing functionality may include:

- Custom element base classes.
- Connection and disconnection lifecycles.
- Attribute and property reflection.
- Update scheduling.
- Resource disposal and cancellation.
- DOM and event utilities.
- Reactive primitives.
- Context and scope infrastructure.
- Metadata and contract systems.

Use these facilities where appropriate.

Do not place SVG-specific code, icon registries, symbol resolution, collection management, or SVG compilation inside core.

Introduce new core utilities only when genuinely reusable beyond the icon framework.

## 2.2 `@oddkin/icons`

This package owns the icon platform.

Responsibilities include:

- `<odd-icon>` web component.
- Shared icon definitions and types.
- `IconCollectionManifest` contract.
- Collection registration.
- Registry and provider infrastructure.
- Icon namespace resolution.
- Semantic aliases.
- Multiple SVG rendering strategies.
- Dynamic loading and caching.
- Accessibility.
- Design token integration.
- SVG validation and normalization.
- Build-time SVG compilation.
- Sprite and subset generation.
- Collection development tooling.
- Collection scaffolding.
- Collection validation.
- Testing utilities.
- Benchmark infrastructure.

It should use `@oddkin/core` where appropriate.

It must not depend on `@oddkin/components`, `@oddkin/state`, or `@oddkin/workbench`.

Other components may consume the icon framework.

The runtime must not include compiler-only dependencies or industry artwork.

## 2.3 Independent Collection Packages

Each industry icon collection is a separate npm package.

Examples:

```text
@oddkin/icons-healthcare
@oddkin/icons-gis
@oddkin/icons-finance
@oddkin/icons-industrial
@oddkin/icons-education
```

Each collection owns:

- Original SVG source artwork.
- Collection-specific metadata.
- Icon categories and search keywords.
- Visual variants.
- Attribution and licensing.
- Generated definitions.
- Generated sprite assets.
- Generated TypeScript types.
- Collection manifest.
- Optional semantic recommendations.
- Collection-specific documentation.

A collection must not contain custom implementations of the shared registry, rendering strategies, loader, or web component.

Collections should be independently publishable and versionable, subject to existing monorepo release conventions.

Avoid runtime circular dependencies.

Preserve original artwork separately from generated output.

---

# 3. Reusable Icon Collection SDK

**This is a primary requirement. Design the collection authoring system before implementing the initial healthcare and GIS packages.**

The system must provide a reusable collection SDK that makes all industry packages follow the same contracts and workflows.

The SDK should cover:

- Collection configuration.
- Manifest generation.
- Icon discovery.
- Artwork validation.
- SVG normalization.
- Icon naming.
- Variant definitions.
- Metadata processing.
- TypeScript generation.
- Sprite generation.
- Asset optimization.
- Package export generation.
- Registration utilities.
- Testing.
- Documentation generation.
- Workbench integration.
- Publishing preparation.

The SDK should be implemented as reusable functionality exposed through appropriate `@oddkin/icons` entry points.

For example:

```text
@oddkin/icons/collections
@oddkin/icons/build
@oddkin/icons/testing
```

If a separate build-tooling package eventually becomes justified, retain the same public collection contracts and a stable developer workflow. Do not prematurely split packages without a concrete dependency or maintenance benefit.

## 3.1 Declarative Collection Configuration

A new collection should primarily require configuration and source artwork.

Illustrative example:

```ts
import { defineIconCollection } from "@oddkin/icons/build";

export default defineIconCollection({
  name: "finance",
  namespace: "finance",
  packageName: "@oddkin/icons-finance",

  source: "./src/icons",
  output: "./generated",

  metadata: {
    displayName: "Oddkin Finance Icons",
    description: "Financial and banking icon collection",
    author: "Oddkin"
  },

  variants: ["outlined", "filled"],

  build: {
    formats: [
      "modules",
      "sprite",
      "svg",
      "manifest"
    ],
    optimize: true,
    generateTypes: true,
    generateExports: true
  }
});
```

Treat this as a conceptual API. Refine it to align with existing Oddkin conventions.

The important requirement is that collection configuration remains declarative, typed, and consistent.

The framework should derive as much as possible from the configuration and source assets.

Do not require authors to maintain redundant icon lists in several files.

## 3.2 Collection Scaffolding

Implement a generator for new icon collection packages.

Conceptual command:

```bash
pnpm oddkin icons create finance
```

The command syntax may be adapted to the repository's existing CLI conventions.

The generator should create a valid collection workspace package containing:

```text
icons-finance/
  package.json
  tsconfig.json
  oddkin.icons.config.ts
  src/
    icons/
    metadata/
    index.ts
  generated/
  tests/
  docs/
  README.md
```

It should configure:

- Package identity and namespace.
- Public exports.
- Build scripts.
- TypeScript configuration.
- Collection manifest.
- Shared compiler.
- Validation.
- Testing.
- Documentation generation.
- Existing monorepo workspace integration.
- Existing publication conventions.

The generated package must work without manually copying implementation files from healthcare or GIS.

The generator should handle workspace registration and related configuration where appropriate.

Support using the same SDK in independently maintained external packages, not just monorepo workspaces.

## 3.3 Collection Lifecycle Commands

Provide standardized operations for all collections.

Conceptual commands:

```bash
pnpm oddkin icons create finance
pnpm oddkin icons build finance
pnpm oddkin icons validate finance
pnpm oddkin icons test finance
pnpm oddkin icons preview finance
```

Prefer integration with existing workspace scripts rather than creating unnecessary new command infrastructure.

Every collection should support the same build, validation, testing, and preview workflows.

## 3.4 No Collection-Specific Build Implementations

Healthcare, GIS, and future collections should not each contain their own implementations of:

- SVG optimization.
- Sprite compilation.
- Type generation.
- Manifest generation.
- Package export generation.
- Preview generation.
- Collection validation.

These belong to the shared SDK.

Collection packages should contain source artwork, configuration, metadata, and generated output.

---

# 4. Icon Collection Contracts

Define a stable, typed `IconCollectionManifest` contract.

The contract should support arbitrary collection packages.

Example structure:

```ts
interface IconCollectionManifest {
  id: string;
  namespace: string;
  name: string;
  version: string;
  description?: string;

  author?: string;
  license?: string;

  icons: IconManifestEntry[];

  variants?: string[];
  categories?: string[];

  assets?: {
    sprite?: string;
    individual?: string;
  };

  // Additional supported metadata
}
```

This is illustrative, not a requirement to copy exactly.

The manifest should describe:

- Collection identity.
- Namespace.
- Version.
- Author.
- License and attribution.
- Icons.
- Categories.
- Search terms.
- Supported variants.
- Default rendering characteristics.
- ViewBox information where relevant.
- RTL mirroring metadata.
- Renderer capabilities.
- Asset references.
- Optional semantic recommendations.

Manifests must be usable without loading every icon's geometry.

Use them for documentation, search, registry integration, and workbench discovery.

## 4.1 Contract Versioning

Define a collection manifest schema version independent of individual collection versions.

The framework should:

- Validate schema compatibility.
- Reject unsupported breaking schema changes clearly.
- Support additive optional metadata.
- Provide migration guidance when schema versions change.
- Avoid forcing collection releases for unrelated runtime changes.

Use existing Oddkin metadata and contract conventions where possible.

## 4.2 Collection Validation

Create a reusable conformance validator.

Validate:

- Namespace uniqueness.
- Icon name uniqueness.
- Required metadata.
- Supported variants.
- SVG validity.
- Unsafe SVG features.
- Internal ID collisions.
- Invalid references.
- Manifest structure.
- Asset references.
- Export maps.
- Type declarations.
- Package build outputs.

Collection authors should receive useful, source-specific diagnostics.

The validator must work for healthcare, GIS, and arbitrary future collections without source changes.

---

# 5. Public `<odd-icon>` Component

Provide a small, ergonomic component API.

Basic usage:

```html
<odd-icon name="search"></odd-icon>
```

Collections:

```html
<odd-icon name="healthcare:stethoscope"></odd-icon>
<odd-icon name="gis:layers"></odd-icon>
<odd-icon name="finance:transaction"></odd-icon>
```

These names are examples. Use actual registered icon names.

Support:

```html
<odd-icon name="search" size="lg"></odd-icon>

<odd-icon
  name="settings"
  color="var(--odd-color-primary)"
></odd-icon>

<odd-icon
  name="warning"
  label="Warning"
></odd-icon>

<odd-icon
  name="healthcare:heart"
  variant="filled"
></odd-icon>

<odd-icon
  name="chevron-down"
  rotate="90"
></odd-icon>

<odd-icon
  name="search"
  render-mode="sprite"
></odd-icon>
```

Evaluate:

- `name`
- `size`
- `color`
- `stroke-width`
- `variant`
- `rotate`
- `flip`
- `label`
- `render-mode`
- `loading`, if beneficial.

Prefer standard CSS properties and Oddkin tokens where they provide a better interface.

Avoid unnecessary attributes.

## Component Requirements

- Decorative by default.
- `currentColor` inheritance.
- Stable dimensions.
- Efficient updates.
- Minimal DOM.
- No unnecessary event listeners.
- No unnecessary observers.
- Lifecycle-safe asynchronous loading.
- Correct custom element semantics.
- Compatibility with shadow DOM.
- Consistent behavior regardless of collection.

Changing color or size should not rebuild SVG geometry.

Changing name should reuse DOM nodes where possible.

Use existing Oddkin lifecycle and update infrastructure.

---

# 6. Unified Icon Definition Model

Define a renderer-independent representation of SVG artwork.

Preserve:

- Paths.
- Groups.
- Basic SVG shapes.
- Stroke and fill.
- Transforms.
- ViewBox.
- Clip paths.
- Masks.
- Gradients.
- Internal definitions.
- Multicolor artwork.

Do not reduce every SVG to a single path string if that prevents advanced artwork from working.

The same icon definition should support compatible rendering strategies.

Icon geometry, metadata, registration state, and rendered DOM must remain distinct concepts.

Individual definitions must be usable without instantiating the web component.

---

# 7. Multiple Rendering Strategies

Implement the following rendering strategies behind one shared interface.

## 7.1 External SVG Symbol Sprites

Support:

```html
<svg aria-hidden="true">
  <use href="/assets/icons.svg#odd-search"></use>
</svg>
```

Requirements:

- Browser-native caching.
- Multiple sprite assets.
- Collection namespaces.
- Stable symbol identifiers.
- Arbitrary viewBoxes.
- Correct shadow DOM behavior.
- Configurable asset URLs.
- Same-origin compatibility.
- Content-hashed assets.
- No unnecessary JavaScript sprite fetching.

Every collection should automatically be able to generate its own sprite.

Support full collection sprites and smaller subsets.

Do not assume that larger combined sprites are always more efficient.

## 7.2 Inline SVG

Support direct SVG rendering for:

- Path-level styling.
- Animation.
- Multicolor artwork.
- Gradients.
- Masks.
- Advanced SVG definitions.

Use safe DOM APIs or validated compiled definitions.

Ensure internal SVG IDs cannot collide across repeated instances.

## 7.3 Static Tree-Shakable Definitions

Support imports such as:

```ts
import { stethoscope } from
  "@oddkin/icons-healthcare/icons/stethoscope";

import { layers } from
  "@oddkin/icons-gis/icons/layers";
```

Do not include an entire collection simply to import one icon.

Avoid eager lookup registries that defeat tree-shaking.

No registration side effects from importing artwork.

## 7.4 CSS Masks

Support monochrome icons through CSS masks where appropriate.

Requirements:

- `currentColor`.
- Efficient asset reuse.
- Minimal markup.
- Correct sizing.
- Deterministic fallback behavior.

Do not use masks when multicolor rendering or SVG-specific styling is required.

## 7.5 Renderer Selection

A provider should describe which strategies its assets support.

The registry or provider should define the default rendering strategy.

Explicit overrides should be possible.

Do not silently degrade advanced artwork.

Prefer predictable rendering over speculative automatic heuristics.

---

# 8. Generic Registry and Provider Architecture

Implement a collection-independent registry.

Example:

```ts
registerIconCollection(healthcareCollection);
registerIconCollection(gisCollection);
```

A future finance package must use the same API:

```ts
registerIconCollection(financeCollection);
```

No changes to the registry implementation should be required.

Support:

- Namespaces.
- Default collections.
- Multiple registered collections.
- Scoped registries.
- Custom providers.
- Static providers.
- Sprite providers.
- Dynamic providers.
- Provider replacement.
- Unregistration.
- Lazy loading.
- Preloading.
- Request deduplication.
- Shared caching.
- Cache invalidation.
- Missing-icon diagnostics.

Collections should not require a separate registry implementation.

Avoid relying exclusively on a global singleton.

Multiple applications and product scopes must be able to coexist.

Integrate with Oddkin's existing context and scope conventions.

---

# 9. Collection Registration and Consumer Ergonomics

Support three primary consumption models.

## 9.1 Complete Collection Registration

```ts
import "@oddkin/icons/register";

import { registerHealthcareIcons } from
  "@oddkin/icons-healthcare";

registerHealthcareIcons();
```

Then:

```html
<odd-icon name="healthcare:stethoscope"></odd-icon>
```

Collection-specific registration helpers should be generated from the shared tooling, not individually hand-implemented.

Document when complete registration eagerly loads icon definitions.

## 9.2 Individual Icon Imports

```ts
import { stethoscope } from
  "@oddkin/icons-healthcare/icons/stethoscope";

registerIcons({
  "healthcare:stethoscope": stethoscope
});
```

Support small application bundles.

## 9.3 Sprite-Backed Registration

```ts
registerIconSet("healthcare", {
  type: "sprite",
  url: "/assets/healthcare-icons.svg"
});
```

This should not require importing all icon geometry into JavaScript.

All collection packages should expose compatible entry points and registration patterns through the same generated conventions.

---

# 10. Collection Independence and Variants

Do not conflate collections, variants, and semantic roles.

Collections:

```text
healthcare
gis
finance
industrial
education
```

Variants:

```text
outlined
filled
rounded
duotone
```

Semantic roles:

```text
action:delete
action:close
navigation:back
status:warning
```

Each collection may support different variants.

The framework must not assume every collection provides every visual style.

A collection can be valid with only one style.

Adding a new variant must not require modifying the runtime.

Use metadata to expose supported variants and renderer capabilities.

---

# 11. Semantic Mapping and Multi-Product Theming

Support explicit artwork identifiers:

```html
<odd-icon name="gis:layers"></odd-icon>
```

And semantic identifiers:

```html
<odd-icon name="action:delete"></odd-icon>
```

Allow product-level configuration:

```ts
registerIconAliases({
  "action:delete": "lucide:trash-2",
  "action:close": "lucide:x",
  "status:warning": "healthcare:warning"
});
```

Support:

- Product-specific mappings.
- Scoped overrides.
- Theme-aware selection.
- Cross-collection aliases.
- Deterministic fallback.
- Efficient updates.

Shared components must not need to know which underlying artwork a product selects.

Adding new industry collections must not require changing shared semantic resolution logic.

---

# 12. Accessibility

Accessibility is a required contract across every collection and renderer.

## Decorative Icons

Default:

```html
<odd-icon name="search"></odd-icon>
```

Decorative icons should be excluded from the accessibility tree.

## Meaningful Icons

```html
<odd-icon
  name="warning"
  label="Warning"
></odd-icon>
```

Expose exactly one meaningful accessible image representation.

Account for shadow DOM and custom element semantics.

Avoid duplicate announcements.

## Icons Inside Controls

```html
<odd-button aria-label="Delete item">
  <odd-icon name="action:delete"></odd-icon>
</odd-button>
```

The parent control provides the accessible name.

Do not make `<odd-icon>` keyboard-interactive by default.

Additional requirements:

- Correct ARIA semantics.
- No unintended focus targets.
- Forced-colors support.
- High-contrast support.
- Reduced-motion behavior.
- RTL-aware mirroring.
- Color-independent meaning.
- Accessible dynamic updates.

Provide automated accessibility tests and real assistive technology validation guidance.

---

# 13. Styling and Design Tokens

Integrate with existing Oddkin design tokens.

Support:

- `currentColor`.
- Semantic icon sizes.
- Native CSS sizing.
- Line icons.
- Filled icons.
- Multicolor icons.
- Mixed stroke and fill.
- Arbitrary viewBoxes.
- Transforms.
- RTL mirroring.
- Appropriate stroke customization.

Example:

```css
odd-icon {
  color: var(--odd-color-primary);
  width: 1.25rem;
  height: 1.25rem;
}
```

Evaluate useful properties:

```css
--odd-icon-size
--odd-icon-color
--odd-icon-stroke-width
```

Do not create a competing token system.

Collections must not be required to define their own sizing infrastructure.

---

# 14. Dynamic Loading and Caching

Implement a shared loader used by every collection.

Requirements:

- Deduplicated requests.
- Shared resolved-definition caching.
- Predictable retry behavior.
- Cache invalidation.
- Optional preloading.
- Lifecycle cancellation.
- Stale-response prevention.
- Memory-conscious cleanup.

If an icon changes before a request completes, stale results must not replace the current icon.

Avoid per-instance observers when unnecessary.

Do not repeatedly fetch resources already managed by browser-native caching.

No collection should implement its own loading or caching mechanisms.

---

# 15. SVG Security and Validation

Provide a shared validation and sanitization boundary.

Reject or safely handle:

- Executable SVG content.
- Event handlers.
- Dangerous URL schemes.
- Unsafe external references.
- Embedded scripting.
- Unsupported foreign content.
- Malicious namespace usage.

Preserve valid:

- Gradients.
- Masks.
- Clip paths.
- ViewBoxes.
- Internal references.
- Multicolor artwork.

Use safe internal ID handling.

Prefer established sanitization and optimization tooling rather than incomplete custom blacklists.

The same validation rules must apply to healthcare, GIS, and future collections.

---

# 16. Shared Collection Compiler

Expose reusable build tooling through:

```text
@oddkin/icons/build
```

The compiler must work with arbitrary collection configurations.

Generate:

1. Optimized individual SVG files.
2. SVG symbol sprites.
3. Tree-shakable TypeScript definitions.
4. Generated icon name types.
5. Collection manifests.
6. Collection metadata.
7. Optional subset sprites.
8. Content-hashed assets.
9. Package export mappings.
10. Workbench discovery metadata.

Requirements:

- Deterministic output.
- Stable symbol IDs.
- Namespace isolation.
- Configurable optimization.
- ViewBox preservation.
- Safe internal SVG references.
- Clear validation errors.
- Source asset traceability.
- Licensing metadata preservation.
- Independent collection builds.

Investigate SVGO or equivalent established tooling.

Do not implement separate compilers for different industries.

Do not ship compiler dependencies to the browser.

---

# 17. Workbench Collection Discovery

The Oddkin workbench must support arbitrary registered collections.

Do not hardcode healthcare and GIS into the icon explorer.

Instead, discover collections through registered manifests or an explicitly generated build-time collection catalog.

The workbench should automatically support a newly added collection's:

- Name.
- Description.
- Namespace.
- Icons.
- Categories.
- Tags.
- Variants.
- Asset previews.
- Metadata.
- Import paths.
- Usage examples.

Create a dedicated icon explorer with:

- Collection selection.
- Search.
- Category filtering.
- Tag filtering.
- Variant controls.
- Size controls.
- Color controls.
- Stroke controls where supported.
- Rendering strategy controls.
- Semantic alias inspection.
- Product theme previews.
- Copyable markup.
- Copyable imports.
- Accessibility inspection.
- Performance experimentation.

When `@oddkin/icons-finance` is created and registered, it must appear in the explorer without writing new finance-specific explorer components.

The explorer must use production registry and provider infrastructure.

Do not load every SVG merely to display collection metadata.

---

# 18. Performance Engineering

Optimize for high-volume interfaces including:

- Data grids.
- GIS applications.
- Tree views.
- Menus.
- Navigation.
- Virtualized lists.
- Complex application shells.

Avoid:

- Repeated SVG parsing.
- Unnecessary DOM wrappers.
- Per-instance duplicate requests.
- Eager loading of unrelated collections.
- Unnecessary observers.
- Rebuilding unchanged geometry.
- Repeated provider resolution.
- Runtime inclusion of compiler dependencies.

Performance should be verified, not assumed.

External sprites may outperform inline rendering for some workloads, but not universally.

## Benchmark Suite

Use the initial workload:

```text
Rendered instances: 1,000
Available icons: 50
Reuse pattern: High repetition
```

Compare:

- External SVG sprites.
- Inline SVG.
- Static imported definitions.
- CSS masks.

Use identical geometry wherever possible.

Measure:

- JavaScript bundle size.
- SVG asset transfer size.
- Total transferred bytes.
- Request counts.
- Cold-cache performance.
- Warm-cache performance.
- Initial render.
- Visual readiness.
- DOM element counts.
- Memory.
- Name-change updates.
- Size and color updates.
- Mount/unmount costs.
- Cache effectiveness.

Use Playwright or existing browser automation.

Produce JSON and human-readable reports with environment details, multiple iterations, medians, and variability.

Clearly identify browser-specific limitations.

---

# 19. Collection Isolation and Bundle Validation

Independently distributed collections must not accidentally inflate unrelated applications.

Create a minimal test application importing one healthcare icon.

Verify that its JavaScript bundle does not include:

- GIS artwork.
- Unused healthcare artwork.
- Compiler dependencies.
- Entire icon catalogs.
- Unnecessary registration modules.

Then repeat with GIS.

Also verify sprite workflows, documenting that a complete sprite may include unused symbols unless a subset is generated.

These checks must be generic.

A newly scaffolded collection must be eligible for the same package and bundle tests without modifying test infrastructure.

---

# 20. Testing and Collection Conformance

Provide shared tests for both the runtime and collection packages.

## Runtime Tests

- Custom element registration.
- Properties and attributes.
- Registry resolution.
- Provider changes.
- Namespaces.
- Aliases.
- Dynamic loading.
- Cache behavior.
- Rendering strategies.
- Lifecycle cleanup.
- Transformations.
- Styling.

## Collection Conformance Tests

Every collection must pass the same suite covering:

- Manifest validity.
- Namespace correctness.
- Icon uniqueness.
- Valid SVG artwork.
- Generated sprite validity.
- Generated type declarations.
- Export map correctness.
- Tree-shaking.
- Metadata consistency.
- License metadata.
- Independent package build.
- Registration.
- Cross-collection isolation.
- Compatibility with the icon runtime.

## Accessibility Tests

- Decorative semantics.
- Meaningful labels.
- No duplicate announcements.
- Icon-only controls.
- Forced-colors.
- Reduced-motion.
- RTL behavior.
- Dynamic updates.

## Security Tests

- Unsafe SVG elements.
- Event handlers.
- Dangerous URLs.
- External references.
- Internal ID collisions.
- Sanitization behavior.

## Performance Tests

- Initial rendering.
- Bulk instantiation.
- High repetition.
- Icon switching.
- Style-only updates.
- Provider changes.
- Concurrent loading.
- Memory cleanup.

The same conformance suite should work for both internal and externally maintained collection packages.

---

# 21. SSR and Framework Compatibility

The system must remain framework-agnostic.

Support or validate integration with:

- Plain HTML.
- React.
- Vue.
- Angular.
- Svelte.

Evaluate:

- SSR.
- Declarative shadow DOM.
- Hydration.
- Static sprite references.
- Asset URL resolution.
- Multiple registries.
- Shadow DOM nesting.
- Product-specific contexts.

Avoid hydration mismatches and layout shifts.

Do not introduce framework dependencies into the icon runtime.

---

# 22. Documentation and Collection Authoring Guide

Document both icon consumption and collection development.

Consumer documentation should cover:

- Basic `<odd-icon>` usage.
- Collection installation.
- Registration.
- Individual imports.
- Full collection imports.
- Sprite-backed collections.
- Dynamic loading.
- Semantic aliases.
- Styling.
- Accessibility.
- Performance.

Collection author documentation should cover:

- Creating a new collection.
- Required folder structure.
- Adding SVG assets.
- Naming conventions.
- Authoring variants.
- Configuring metadata.
- Manifest generation.
- Building assets.
- Testing collections.
- Workbench integration.
- Publishing packages.
- Updating versions.
- Migrating collection contracts.

Include an end-to-end tutorial for creating a hypothetical third collection from scratch.

Do not reuse healthcare or GIS implementation-specific steps as prerequisites.

The tutorial must demonstrate the actual supported workflow.

---

# 23. Implementation Process

Proceed in this order.

### Phase 1: Repository Discovery

Inspect the existing monorepo, core infrastructure, token system, contracts, component conventions, build tooling, original icon assets, workbench, tests, and implementation plan.

### Phase 2: Shared Contracts

Define icon definitions, collection manifests, schema versioning, renderer capabilities, registry contracts, provider contracts, and semantic resolution.

### Phase 3: Collection SDK and Scaffolding

Build the reusable collection configuration API, generator, validation tools, and shared package conventions.

Design these before implementing healthcare and GIS so the first two collections do not become architectural special cases.

### Phase 4: Runtime Implementation

Create `@oddkin/icons` and implement `<odd-icon>`, static definitions, registry resolution, accessibility, styling, and rendering strategies.

### Phase 5: Providers and Loading

Implement sprite, static, and dynamic providers, caching, namespacing, aliases, scoping, and lifecycle handling.

### Phase 6: Shared Compiler

Implement SVG validation, optimization, type generation, sprites, manifests, export generation, subset generation, and asset hashing.

### Phase 7: Initial Collections

Create the healthcare and GIS packages through the same scaffolding and collection SDK intended for future industries.

Migrate original artwork without altering its intended design.

### Phase 8: Third-Collection Extensibility Test

**Create a small temporary fixture collection using the public collection generator.**

Use a neutral namespace such as `example` or `fixture`.

Add a small set of test SVGs.

Build it, generate its manifest, import individual definitions, register its sprite, run the conformance tests, and make it discoverable in the workbench.

Do this without modifying runtime or workbench source code.

This fixture is a validation artifact, not a third production industry package.

Its purpose is to prove that future collections require configuration and artwork rather than framework changes.

### Phase 9: Tests and Benchmarks

Implement and run functional, accessibility, security, lifecycle, integration, collection conformance, and performance tests.

Run the 1,000-instance benchmark.

### Phase 10: Workbench and Documentation

Integrate the generic icon explorer, healthcare and GIS manifests, performance playground, and collection authoring documentation.

### Phase 11: Validation

Run available type checks, linters, tests, browser checks, accessibility tests, builds, export validation, bundle inspections, and performance benchmarks.

### Phase 12: Update Architecture Documentation

Update Oddkin's implementation plan and relevant contracts.

Document architectural decisions, completed work, and unresolved limitations.

Do not stop after planning. Implement the system incrementally and validate the result.

---

# 24. Acceptance Criteria

The system is complete when:

1. `@oddkin/icons` builds independently of `@oddkin/components`.
2. `<odd-icon>` renders registered icons correctly.
3. Healthcare and GIS are independent collection packages.
4. Neither industry collection is hardcoded into the runtime.
5. A shared, typed collection configuration API exists.
6. A reusable collection scaffolding workflow exists.
7. All collection packages use the same compiler and validators.
8. Collection manifests are generated and versioned.
9. Individual icon imports are tree-shakable.
10. Complete-collection registration is supported.
11. External sprite registration is supported.
12. Inline SVG and CSS mask rendering work appropriately.
13. Dynamic loading, caching, and lifecycle handling are shared.
14. Accessibility semantics are correct across rendering modes.
15. Product-specific semantic mappings are supported.
16. Original healthcare and GIS artwork is preserved.
17. Collection packages can be independently published.
18. New collections require no changes to the shared runtime.
19. New collections require no custom compilation scripts.
20. New collections require no manually written workbench pages.
21. A generated fixture collection passes the same conformance suite as healthcare and GIS.
22. The fixture collection appears in the workbench through generic manifest registration or catalog generation.
23. Bundle isolation and tree-shaking are verified.
24. SVG validation and sanitization boundaries are enforced.
25. The 1,000-instance benchmark runs reproducibly.
26. React, Vue, Angular, and Svelte integration is validated.
27. Compiler dependencies remain outside browser runtime bundles.
28. Collection authoring and publishing are documented.
29. The implementation plan and contracts are updated.
30. Builds and tests pass, with unresolved limitations reported.

---

# Final Engineering Direction

The desired result is not simply an SVG icon component or two bundled icon libraries.

It is **a reusable icon platform capable of supporting an expanding ecosystem of independently maintained, industry-specific icon collections**.

A consumer should be able to write:

```html
<odd-icon name="healthcare:stethoscope"></odd-icon>
<odd-icon name="gis:layers"></odd-icon>
<odd-icon name="finance:transaction"></odd-icon>
```

without needing to understand how the artwork was compiled or delivered.

A collection author should be able to create a package, provide SVG artwork and metadata, run the shared compiler, and obtain a fully compatible Oddkin icon collection with generated definitions, sprites, manifests, tests, documentation metadata, and package exports.

The final architecture must preserve these responsibility boundaries:

- `@oddkin/core` provides domain-agnostic infrastructure.
- `@oddkin/icons` determines how icons and collections work.
- The collection SDK determines how new icon packages are created and maintained.
- Industry packages own their artwork and metadata.
- Product themes determine which artwork fulfills semantic roles.
- The build pipeline determines how assets are optimized and distributed.
- The workbench discovers and presents collections generically.

**Healthcare and GIS must be implemented as ordinary consumers of the same collection SDK available to every future collection.**

The ultimate measure of architectural success is simple:

**Can a developer create and integrate an entirely new industry icon collection without touching the icon framework's source code?**

If not, the collection architecture is not finished.