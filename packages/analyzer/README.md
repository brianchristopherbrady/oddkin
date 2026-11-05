# @oddkin/analyzer

Node-only static analysis for Oddkin component libraries. Produces a standard Custom Elements Manifest (`custom-elements.json`, schema 2.1.0) and the Oddkin enrichment manifest (`oddkin.metadata.json`) **without importing or executing** the analyzed code. Development tooling: it depends on the TypeScript 5.9 compiler, and on `@oddkin/core`'s DOM-free model for the composition schemas, and is never part of a browser bundle.

```sh
oddkin-analyze tsconfig.json --out . [--name my-lib --version 1.0.0] [--composition] [--strict] [--json]
```

```ts
import { analyze, writeOutputs } from '@oddkin/analyzer';

const result = analyze({ project: 'tsconfig.json' });
await writeOutputs(result, '.');
```

Module paths in the outputs are the published paths (`rootDir` → `outDir`). Dynamic definitions are reported as `analyzer.dynamic.*` diagnostics with source locations instead of being guessed.

A library not built with Oddkin keeps its own manifest and can still publish examples ([ADR 0048](../../docs/architecture/decisions/0048-libraries-not-built-with-oddkin.md) §3):

```sh
oddkin-analyze --manifest custom-elements.json --out . [--strict] [--json]
```

It reads the `defineExamples` files under the package by parsing them, checks each tag against the manifest, and writes only `oddkin.metadata.json`, which describes no components. Export it as `./oddkin.metadata.json`: Workbench then shows presets and examples, change impact selects the examples as checks, and the kits list them. `analyzeManifest({ manifest })` is the same in code.

Workbench, change impact, and the kits read a package's metadata beside its manifest through `checkMetadata(metadata, manifest)` from `@oddkin/analyzer/metadata`. The manifest says which elements exist, so the enrichment and examples of a tag it does not declare are left out with a warning (`metadata.component.undeclared`, `metadata.example.undeclared`), and metadata of a schema other than `oddkin-metadata.v1` is not read (`metadata.schema.unsupported`, an error). Details: [metadata-and-analyzer.md](../../docs/architecture/metadata-and-analyzer.md) §8.

## Composition catalog

`--composition`, in either mode, also writes what a composition document ([data-composition.md](../../docs/architecture/data-composition.md) §8) may use of the library's elements, generated from its manifest: `oddkin.composition.json` (`{ "version": 1, "catalog": … }`) and its JSON Schemas in `schemas/composition/` (one per element, and `composition.v1.json` for the document). Pass the catalog to `validateComposition(document, { catalog })` and `renderComposition(document, target, { catalog, allow })` from `@oddkin/components/composition`; agents write documents against the schemas. Attributes typed as string, number, boolean, or a union of string literals are writable; an attribute of another type, or a boolean attribute that is on by default, is left out with a warning (`analyzer.composition.*`). Writable properties without an attribute are written as JSON when their type allows it; the others are listed as not portable. `@oddkin/analyzer/composition` exports `compositionCatalog(manifest, { modelTypes, events })`, `compositionSchemas(catalog, manifest, { base, modelSchemas, title, description })`, and `compositionFiles`, without loading TypeScript; `@oddkin/components` builds its own catalog with them.

Contract and limits: [metadata-and-analyzer.md](../../docs/architecture/metadata-and-analyzer.md) §8; front-end decision: ADR 0018.

## Agent kits

`oddkin-kit` writes agent kits from the metadata the analyzer publishes ([agent-tooling.md](../../docs/architecture/agent-tooling.md) §4–5): an entry guide (`GUIDE.md`, within 8 KiB), a reference for each component, token category, recipe, stylesheet, and model, `kit.json` with a fingerprint of its inputs, and `llms.txt`. Run it in the workspace root:

```sh
# The kit each component package ships, in <package>/agent/ (list "agent" in the package's "files").
oddkin-kit package
# Check every shipped kit against the installed package's metadata: the packages named, or the workspace's own.
oddkin-kit package --check --package @oddkin/components
# A kit for the repository itself, in .oddkin/agent-kit/<name>/; --check names the inputs that changed.
oddkin-kit [--package <name>]... [--out <dir>] [--theme-config <file>] [--check]
# The managed section of AGENTS.md; text outside its markers is kept.
oddkin-kit agents-md [--write | --check]
# A documentation site's llms.txt (llmstxt.org) and the kit files it links, in <dir>/agent/<name>/.
oddkin-kit llms --base https://docs.example/ --out <dir> [--title <text>] [--summary <text>]
```

Exit codes: 0 success; 1 a stale, missing, or over-budget kit, or a stale `AGENTS.md` section; 2 usage error. The same functions are exported from `@oddkin/analyzer/kit` (`resolveProjectContext`, `generateKit`, `checkKit`, `packageKit`, `siteLlmsText`, `renderSection`, `updateAgentsMd`, and `main`). A kit a package ships depends only on what the package publishes, so a project that installs it regenerates the same files.

A library not built with Oddkin gets a kit from its standard Custom Elements Manifest alone (the package's `customElements` field). Each component reference lists the API the manifest states and the registration entry: the package export that loads the module with the tag's `custom-element-definition`. The guide says that property-only values, event intents, guidance, examples, and verification are unknown. When the package also exports the `oddkin.metadata.json` that `oddkin-analyze --manifest` writes, each reference lists its examples too.

## Schemas

`@oddkin/analyzer/schemas/*.json` holds the JSON Schemas of the files change impact reads and writes: `product.v1.schema.json` (`oddkin-impact snapshot --product`), and `comparison-snapshot.v1.schema.json` and `impact-report.v1.schema.json` (what `snapshot` and `compare --json` write), so an editor or a CI step can validate them.

## What runs your code

Analysis, the composition catalog, change impact, and project kits read a library's sources, examples, manifests, and builds as text and JSON; none of them imports or executes them. One command does: `oddkin-kit package` imports the package's built `./composition` entry, when it has one, to check the kit's composition example with the package's own validator. Like the package's build, run it only on packages you trust. `oddkin-analyze` (for page dates, unless `--no-history`) and `oddkin-impact snapshot --source` run `git` in the directory they are given. Details: [metadata-and-analyzer.md](../../docs/architecture/metadata-and-analyzer.md) §7.

## Stability

The analyzer shares the other Oddkin packages' version, but only its outputs follow candidate v1 contracts: Custom Elements Manifest 2.1.0, `oddkin-metadata.v1`, `diagnostic.v1`, and the agent kits' `agent-kit.v1` and `project-context.v1`. Its own contracts are **not frozen by 1.0.0** ([ADR 0047](../../docs/architecture/decisions/0047-m8-checkpoint-candidate-v1-contracts.md)): the impact snapshot and report (`comparison-snapshot.v1`, `impact-report.v1`) and the `product.v1` input `oddkin-impact` reads. Until they are frozen they can change in a minor release; only frozen contracts wait for a major ([release-process.md](../../docs/release-process.md) §1).