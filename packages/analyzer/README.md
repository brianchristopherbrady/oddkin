# @mote/analyzer

Node-only static analysis for Mote component libraries. Produces a standard Custom Elements Manifest (`custom-elements.json`, schema 2.1.0) and the Mote enrichment manifest (`mote.metadata.json`) **without importing or executing** the analyzed code. Development tooling: it depends on the TypeScript 5.9 compiler and is never part of a browser bundle.

```sh
mote-analyze tsconfig.json --out . [--name my-lib --version 1.0.0] [--strict] [--json]
```

```ts
import { analyze, writeOutputs } from '@mote/analyzer';

const result = analyze({ project: 'tsconfig.json' });
await writeOutputs(result, '.');
```

Module paths in the outputs are the published paths (`rootDir` → `outDir`). Dynamic definitions are reported as `analyzer.dynamic.*` diagnostics with source locations instead of being guessed.

Contract and limits: [metadata-and-analyzer.md](../../docs/architecture/metadata-and-analyzer.md) §8; front-end decision: ADR 0018.