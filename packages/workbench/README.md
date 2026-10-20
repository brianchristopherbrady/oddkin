# @oddkin/workbench

Metadata-driven documentation tooling for any custom-element library. **Status:** the DOM-free contract entries, the data files, and the Node tooling (`oddkin analyze`, `oddkin workbench dev`) exist; the M5 shell is being built on them (design: [workbench.md](../../docs/architecture/workbench.md) §2.1 and §5.1). Panels, previews, Theme Studio, and the static build follow.

| Entry | Contents |
| --- | --- |
| `@oddkin/workbench/examples` | `defineExamples(tag, examples)`, typed from `HTMLElementTagNameMap` (unknown property keys and wrong value types are compile errors); `toExamplesJSON` (the `examples.v1` serializable layer, with fixtures reduced to `hasFixture`); `checkExamples(set, contract)` for plain-JavaScript authors; `exampleId` |
| `@oddkin/workbench/config` | `defineWorkbenchConfig`, `resolveWorkbenchConfig` (defaults and diagnostics matching `workbench-config.v1`), `defineDocs` (`docs-content.v1`) |
| `@oddkin/workbench/pages` | `buildPageRegistry({ config, cem, metadata?, docs? })` producing `page-registry.v1`, plus the projections every navigation surface uses: `primaryNavigation`, `sidebar`, `cards`, `searchEntries`, `onThisPage`, `href`, `resolveLegacyRoute`, `staticRedirects` |
| `@oddkin/workbench/data` | `buildWorkbenchData({ config, libraries, docs?, tokens?, diagnostics? })`: one or more packages' CEM and enrichment, authored content, and a token inspection → a small index (registry, branding, libraries, diagnostics) and one data file per visible page (`pageFile(id)`), serialized byte-stably with `serializeData`; `createImportMap(packages, { base, versioned?, conditions? })` builds import maps from package `exports`, and `resolveExport` resolves one subpath to its file |
| `@oddkin/workbench/node` | Node only. `buildWorkbench({ config?, events? })` loads `oddkin.config.*` (TypeScript through Node's type stripping), the documented packages and their dependencies, their manifests, enrichment, and referenced token inspection, and authored `oddkin.docs.*`, and returns the data files, both import maps, and the shell page; `startDevServer`, `writeGenerated` (the marked `.oddkin/workbench/`), `loadWorkbenchConfig`, `loadInputs`, `packageGraph`, and `run` (the command) |
| `@oddkin/workbench/testing` | `mountExample(set, name, container?)` runs an authored example and its fixture in a browser test; `runConformance` runs a conformance suite with the project's own `expect` |

The examples, config, pages, and data entries import without a DOM and have no runtime dependencies (`@oddkin/core` is used for types only). Shipped component code never imports them; colocated `*.examples.ts` files may, because they are development-only sources excluded from the package build (ADR 0021).

## The `oddkin` command

```sh
oddkin analyze <tsconfig.json> [options]     # @oddkin/analyzer's own command, same options and exit codes
oddkin workbench dev [--config <file or directory>] [--port <number>] [--host <name>] [--no-watch]
```

`workbench dev` serves the Workbench at `http://localhost:4175/` (the configured base path): the shell for page paths (history mode; in hash mode only at the entry, like a static host without rewrites), the data under `_oddkin/`, and package files under `_oddkin/m/<name>@<version>/`. It writes the same data into `.oddkin/workbench/`, a directory it marks and owns, watches the configuration, content, manifests, metadata, and the packages' files, and pushes an `update` event over Server-Sent Events (`_oddkin/events`) after each rebuild. An invalid edit keeps the last valid data and reports diagnostics. The shell page itself arrives with the next M5 slice. Exit codes: 0 success, 1 errors, 2 usage.

## Registry rules

- **Inputs:** standard CEM is enough for the Components baseline. `oddkin.metadata.json` enrichment adds foundations, categories, examples, products, and `docs` facts. Authored content (`defineDocs`) overrides prose and presentation only; generated facts win.
- **Stable ids:** `foundations/<slug>`, `components/<tag>`, `theme-studio`, `products`. Routes and the base path can change without changing ids.
- **Honest absence:** a foundation page appears only when enrichment declares it and at least one section has data. Foundations stays as a destination with `availability: 'unavailable'` when no foundation data exists. Components without enrichment are `partial`. Authored `visible: true` cannot show a page or section whose data is missing.
- **Theme Studio** is a primary destination and never a Foundations card or sidebar entry. **Products and modes** is absent unless enabled, and hidden with `pages.products.empty` when no products resolve.
- **Dates** come only from authored content or enrichment facts (authored or source history); unknown dates are omitted and build time is never used.
- **Legacy routes:** `/playground` → `/components` (or `/components/<tag>` from `?component=`, keeping other parameters); `/foundations/theme-studio` → Theme Studio; `/foundations/products` → Products, or a `products.disabled` notice.

Tests: `test/pages.test.ts` (real analyzer output for `examples/core-counter` plus an independent fixture library, validated against `page-registry.v1` and `oddkin-metadata.v1`), `test/data.test.ts` (the published outputs of `@oddkin/components` and `@oddkin/ai`, the default theme's token inspection, the Acme fixture, and import maps from real package `exports`), `test/node-*.test.ts` (throwaway projects with an Acme library, the real components through `tests/fixtures/workbench-oddkin`, the dev server over HTTP and Server-Sent Events, and the built command in a real Node process), `test/config.test.ts`, `test/examples.test.ts`, and the type-level `test/examples.types.ts`.
