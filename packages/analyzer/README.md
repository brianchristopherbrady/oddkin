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

## Stability

The analyzer is versioned `1.0.0` with the other Oddkin packages, but only its outputs follow candidate v1 contracts: Custom Elements Manifest 2.1.0, `oddkin-metadata.v1`, and `diagnostic.v1`. Its own contracts are **not frozen by 1.0.0** ([ADR 0047](../../docs/architecture/decisions/0047-m8-checkpoint-candidate-v1-contracts.md)): the impact snapshot and report (`comparison-snapshot.v1`, `impact-report.v1`) and the `product.v1` input `oddkin-impact` reads. Until they are frozen they can change in a minor release; only frozen contracts wait for a major ([release-process.md](../../docs/release-process.md) §1).