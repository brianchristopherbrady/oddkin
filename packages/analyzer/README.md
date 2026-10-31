# @oddkin/analyzer

Node-only static analysis for Oddkin component libraries. Produces a standard Custom Elements Manifest (`custom-elements.json`, schema 2.1.0) and the Oddkin enrichment manifest (`oddkin.metadata.json`) **without importing or executing** the analyzed code. Development tooling: it depends on the TypeScript 5.9 compiler and is never part of a browser bundle.

```sh
oddkin-analyze tsconfig.json --out . [--name my-lib --version 1.0.0] [--strict] [--json]
```

```ts
import { analyze, writeOutputs } from '@oddkin/analyzer';

const result = analyze({ project: 'tsconfig.json' });
await writeOutputs(result, '.');
```

Module paths in the outputs are the published paths (`rootDir` → `outDir`). Dynamic definitions are reported as `analyzer.dynamic.*` diagnostics with source locations instead of being guessed.

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
```

Exit codes: 0 success; 1 a stale, missing, or over-budget kit, or a stale `AGENTS.md` section; 2 usage error. The same functions are exported from `@oddkin/analyzer/kit` (`resolveProjectContext`, `generateKit`, `checkKit`, `packageKit`, `renderSection`, `updateAgentsMd`, and `main`). A kit a package ships depends only on what the package publishes, so a project that installs it regenerates the same files.

## Stability

The analyzer is versioned `1.0.0` with the other Oddkin packages, but only its outputs follow candidate v1 contracts: Custom Elements Manifest 2.1.0, `oddkin-metadata.v1`, `diagnostic.v1`, and the agent kits' `agent-kit.v1` and `project-context.v1`. Its own contracts are **not frozen by 1.0.0** ([ADR 0047](../../docs/architecture/decisions/0047-m8-checkpoint-candidate-v1-contracts.md)): the impact snapshot and report (`comparison-snapshot.v1`, `impact-report.v1`) and the `product.v1` input `oddkin-impact` reads. Until they are frozen they can change in a minor release; only frozen contracts wait for a major ([release-process.md](../../docs/release-process.md) §1).