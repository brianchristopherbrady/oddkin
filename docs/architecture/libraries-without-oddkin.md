# Libraries not built with Oddkin

Status: 2026-10-30 (CF.3 in IMPLEMENTATION_PLAN.md; Workstream B in the [technical plan](../../future_plans/TECHNICAL_COMMERCIALIZATION_PLAN.md)). The decisions are in [ADR 0048](./decisions/0048-libraries-not-built-with-oddkin.md).

This page describes what Workbench, change impact (`oddkin-impact`), and agent kits (`oddkin-kit`) do with a component library described only by a standard [Custom Elements Manifest](https://github.com/webcomponents/custom-elements-manifest). It also lists what each layer of Oddkin enrichment adds, and what is not built yet. Each claim names its test.

## 1. The input

The input is a package whose `package.json` names its manifest in `customElements` and publishes its modules. The manifest can come from any generator; the [standard analyzer](https://custom-elements-manifest.open-wc.org/) writes one for Lit, Stencil, FAST, and plain custom elements. No tool here executes the library's code, except Workbench's preview frames, which load the published modules as a browser would.

The kits read a package only when it declares `exports`. Workbench and change impact also read a package without `exports`, where every file is reachable.

## 2. What works from the manifest alone

| | Workbench | Change impact | Agent kits |
| --- | --- | --- | --- |
| Components | A catalog card and a page for each tag | `component`, `class`, and member items for each tag | A reference for each tag, listed in `GUIDE.md` |
| API | Properties, attributes, methods, events, slots, parts, CSS custom properties, and custom states, from the manifest | The same as items with their types. A removal or a narrowed union is incompatible | The same in each reference |
| Registration | The preview imports the entry; the snippet names it | A `registration` item: the module with the definition | The "Register" line, and the guide's registration entries |
| Sources | Previews run the published modules | Each class's module is hashed, so an edit the manifest does not show still changes the class item | Not read |
| Interaction | Live previews, controls typed from the manifest, the events log, CSS custom property editing, snippets, and Reset | | |
| Missing facts | "Not documented", naming the input that would supply each item | No metadata artifact is claimed. Each affected component that nothing checks is a coverage gap | The guide and each reference say what is unknown |

The registration entry follows one rule in Workbench and the kits:

1. Take the module whose manifest exports hold the tag's `custom-element-definition`.
2. Find the package export that reaches it, as Node resolves `exports`: exact subpaths first, then patterns, under the conditions `development`, `browser`, `import`, and `default`, with `null` exclusions. Without `exports`, any file is reachable.
3. Else take the shortest export of a module that re-exports from it, since an ES re-export loads the module.
4. Else there is none. Workbench then shows no preview, and the kit says that no export loads the module.

Change impact records the module path itself.

Evidence:

- Workbench: `e2e/workbench-packed.spec.ts` documents `@plain/widgets` from packed tarballs: the preview, every control, the events log, snippets, and Reset. `packages/workbench/test/data.test.ts` checks the pages of a manifest-only library and the "Not documented" items with their sources. `packages/workbench/test/node-inputs.test.ts` checks the registration rule, the re-export fallback included.
- Change impact: `packages/analyzer/test/impact.test.ts`, "a library described by a standard CEM alone".
- Kits: `tests/agent-kit/standard-cem.test.ts`, which also checks that the kits name the same registration entries as Workbench.

## 3. What each enrichment layer adds

Enrichment is optional, and every layer is keyed by stable ids (`component:<tag>`, `example:<tag>/<name>`), so a layer joins a library's manifest by tag.

| Layer | What it adds | Where it comes from | For a library not built with Oddkin |
| --- | --- | --- | --- |
| Examples (`examples.v1`, `defineExamples`) | Workbench presets and examples. The checks change impact selects. The examples each kit reference lists | `examples` in `oddkin.metadata.json`. `oddkin-analyze` reads `*.examples.ts` files by parsing them | Not available yet. Example files exist apart from the authoring library, but the analyzer warns on tags it did not extract (`analyzer.examples.unknownComponent`) and writes its own manifest. With no examples, change impact selects no checks for such a library ([ADR 0048](./decisions/0048-libraries-not-built-with-oddkin.md) §3) |
| Authored pages (`oddkin.docs.ts`, `docs-content.v1`) | Titles, summaries, guidance, intended use, and section order on Workbench pages | The workspace's `oddkin.docs.ts`, keyed by page id | Works today in Workbench. The kits record the file as an input, but they do not show its content |
| Component guidance (`@useFor`, `@notFor`, `@a11y`, `@keyboard`, limitations) | Workbench's guidance and accessibility sections. Kits' guidance and choosing references | JSDoc tags read by the Oddkin analyzer | Not available. Authored pages cover Workbench's intended use |
| Definitions, templates, styles, and token reads | Change impact's edges from tokens and shared styles to components. Workbench's token sections | The analyzer's reading of `compose()` definitions | Not available. Token and style changes are seen only through the class module's hash |
| Property-only values, event intents, sync pairs, customization levels | The kits' rules, Workbench's control kinds, and snippets that assign properties | The Oddkin analyzer | Unknown, and said to be unknown |
| Tokens and themes | Theme Studio generation, token references, and token items in change impact | `@oddkin/tokens` and a theme configuration | Theme Studio edits the CSS custom properties the manifest declares. Adapting DTCG token files is planned (ADR 0048 §4) |
| Products (`product.v1`) | Product contexts in change impact and Workbench | Product manifests, which apply by tag | Works with a manifest's tags, but selects no checks without examples |
| Conformance suites | Suite checks in change impact; `runConformance` | Suites target tags | A suite can target any tag whose behavior it describes. Only the button suite exists |

## 4. Fixtures

- `@plain/widgets` (`tests/consumers/workbench/plain-widgets`): plain custom elements without a framework, with a hand-written manifest. It is used by Workbench (packed), change impact, and the kits.
- Inline manifests in the tests cover subpath patterns, exclusions, packages without `exports`, and an index that only re-exports.

Not built yet: a library made with another authoring library, and a bundled package whose manifest names sources it does not publish (Workstream B task 7). For such a package, change impact reports "source of … not supplied; edits inside it are not detected", and the kit says that no export loads the module. Neither shape has a fixture yet.
