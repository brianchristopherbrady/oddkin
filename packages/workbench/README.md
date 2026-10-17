# @mote/workbench

Metadata-driven documentation tooling for any custom-element library. **M3 status:** only the DOM-free contract entries exist. The shell, panels, previews, Theme Studio, and the `mote` CLI arrive from M5 ([workbench.md](../../docs/architecture/workbench.md)).

| Entry | Contents |
| --- | --- |
| `@mote/workbench/examples` | `defineExamples(tag, examples)`, typed from `HTMLElementTagNameMap` (unknown property keys and wrong value types are compile errors); `toExamplesJSON` (the `examples.v1` serializable layer, with fixtures reduced to `hasFixture`); `checkExamples(set, contract)` for plain-JavaScript authors; `exampleId` |
| `@mote/workbench/config` | `defineWorkbenchConfig`, `resolveWorkbenchConfig` (defaults and diagnostics matching `workbench-config.v1`), `defineDocs` (`docs-content.v1`) |
| `@mote/workbench/pages` | `buildPageRegistry({ config, cem, metadata?, docs? })` producing `page-registry.v1`, plus the projections every navigation surface uses: `primaryNavigation`, `sidebar`, `cards`, `searchEntries`, `onThisPage`, `href`, `resolveLegacyRoute`, `staticRedirects` |

All three import without a DOM and have no runtime dependencies (`@mote/core` is used for types only). Component packages never import them.

## Registry rules

- **Inputs:** standard CEM is enough for the Components baseline. `mote.metadata.json` enrichment adds foundations, categories, examples, products, and `docs` facts. Authored content (`defineDocs`) overrides prose and presentation only; generated facts win.
- **Stable ids:** `foundations/<slug>`, `components/<tag>`, `theme-studio`, `products`. Routes and the base path can change without changing ids.
- **Honest absence:** a foundation page appears only when enrichment declares it and at least one section has data. Foundations stays as a destination with `availability: 'unavailable'` when no foundation data exists. Components without enrichment are `partial`. Authored `visible: true` cannot show a page or section whose data is missing.
- **Theme Studio** is a primary destination and never a Foundations card or sidebar entry. **Products and modes** is absent unless enabled, and hidden with `pages.products.empty` when no products resolve.
- **Dates** come only from authored content or enrichment facts (authored or source history); unknown dates are omitted and build time is never used.
- **Legacy routes:** `/playground` → `/components` (or `/components/<tag>` from `?component=`, keeping other parameters); `/foundations/theme-studio` → Theme Studio; `/foundations/products` → Products, or a `products.disabled` notice.

Tests: `test/pages.test.ts` (real analyzer output for `examples/core-counter` plus an independent fixture library, validated against `page-registry.v1` and `mote-metadata.v1`), `test/config.test.ts`, `test/examples.test.ts`, and the type-level `test/examples.types.ts`.
