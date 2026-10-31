# Oddkin

Oddkin is a modular frontend framework built on custom elements and browser APIs. It includes:

- **`@oddkin/core`** — authoring foundation: reactive primitives, ownership (`Scope`), templates, styles, layout recipes, collections, and models.
- **`@oddkin/tokens`** — theme configuration and a deterministic token pipeline that emits CSS, JSON, DTCG, and TypeScript (Sass output is planned). Use the tokens with plain CSS and no Oddkin JavaScript.
- **`@oddkin/components`** — themeable custom elements that work in plain HTML or in any framework, tested with keyboard checks and axe-core in three browser engines (screen readers not yet verified).
- **`@oddkin/workbench`** — tooling preview: component documentation generated from a library's metadata, with interactive pages and Theme Studio, served locally (`oddkin workbench dev`) or built as a static site (`oddkin workbench build`).
- **`@oddkin/analyzer`** — tooling preview: the metadata Workbench reads (`oddkin-analyze` writes a Custom Elements Manifest and `oddkin.metadata.json` without running the code), and the change-impact tools (`oddkin-impact` snapshots a library's contracts and reports what changed between two snapshots, what it affects, and which checks cover it).
- **`@oddkin/ai`** — an optional add-on to the components: AI interaction elements, headless controllers, and stream adapters for conversations, inline assistance, research tools, and agent workflows.
- **`@oddkin/state`** and **`@oddkin/app`** — optional stores, context, routing, and async resources.

Workbench's and the analyzer's own contracts (configuration, page registry, frame protocol, impact formats) are not frozen by 1.0.0 ([ADR 0047](./docs/architecture/decisions/0047-m8-checkpoint-candidate-v1-contracts.md)). An `@oddkin/agent` package for IDE agents is not built (skipped for now by the owner); agents use the kits that `@oddkin/components` and `@oddkin/ai` ship.

## Names

Packages are published under `@oddkin/*`; elements use the `odd-` prefix (`<odd-button>`), CSS custom properties `--odd-*`, and theme scopes `data-odd-*`; command-line tools are `oddkin` (Workbench), `oddkin-tokens`, `oddkin-analyze`, and `oddkin-impact`. See [ADR 0037](./docs/architecture/decisions/0037-naming-contract.md).

## Status

Beta. The eight packages are published on npm under the `beta` tag (`npm install @oddkin/core@beta`; [release-process.md](./docs/release-process.md) §5), and contracts may still change before 1.0.0. `@oddkin/components` has 54 elements and `@oddkin/ai` 24, each with contract-test evidence in three engines. See [IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md) for milestones and current state, and [docs/verification.md](./docs/verification.md) for recorded results.

## Repository layout

| Path | Contents |
| --- | --- |
| `packages/*` | `@oddkin/core`, `@oddkin/tokens`, `@oddkin/state`, `@oddkin/app`, `@oddkin/components`, `@oddkin/ai`, `@oddkin/analyzer`, `@oddkin/workbench` |
| `apps/docs` | Oddkin's product documentation application (private) |
| `examples/` | Runnable consumers. Through an import map, with no bundler: `plain-html`, `core-counter`, `components-only`, `css-gallery`, `binding-rule`, `autoload`, `composite-roles`, `editable-list`, `forms`, `full-app`, `lifecycle`, `router`, `side-nav`, and `app-header`; with no script: `tokens-css-only`; bundled: the static `@oddkin/ai` demos (`ai-research`, `ai-writing`, `ai-agent`) and `duplicate-core` (two consumers, each with its own copy of core); with its own server: `ai-stream` (answers streamed over HTTP) |
| `docs/architecture/` | Architecture documents and [decision records](./docs/architecture/decisions/README.md) |
| `docs/compatibility/` | Browser floor and platform feature registry, and the generated [feature matrix](./docs/compatibility/matrix.md) |
| `docs/releases/` | Release notes, one file per beta |
| `docs/research/` | Ecosystem research |
| `docs/schemas/` | Draft v1 JSON Schemas for the metadata, examples, diagnostics, impact reports, the agent kit, and Workbench's configuration, page registry, and share links; `@oddkin/components` and `@oddkin/ai` ship their own schemas in `schemas/` |
| `scripts/` | Builds (token assets, CSS, metadata, schemas, AI demos, agent kits), boundary, CSS compatibility, and page-layout checks, packed-consumer verification, release scripts, and a static server |
| `tests/`, `e2e/` | Workspace-level unit tests, the floor-browser probe, and browser tests |

## Requirements and commands

Node.js 24.12 or newer, npm 11. Supported browsers: Chrome and Edge 130, Firefox 132, Safari 18.2, and later (Baseline 2024). The [support policy](./docs/support.md) lists what each package is tested with and what is not.

```sh
npm install
npx playwright install chromium firefox webkit   # once, for browser tests
npm run build          # tsc -b, then token assets, production builds, component CSS, metadata, schemas, AI demos, and agent kits
npm run lint           # contracts, package boundaries (manifests, sources, built artifacts), CSS compatibility, page layout, formatting
npm run typecheck      # packages, tests, JSX, and framework types
npm test               # build, then Vitest: node tests, and browser tests in Chromium, Firefox, and WebKit
npm run verify:metadata  # attach contract-test evidence to the metadata (after npm test), check the API vocabulary, write the agent kits
npm run size           # bundle and stylesheet size budgets
npm run test:e2e       # browser tests in Chromium, Firefox, and WebKit (Playwright)
npm run verify:packs   # pack, install outside the workspace, verify imports and types
npm run verify         # all of the above
npm run compat         # regenerate docs/compatibility/matrix.md after editing features.json
npm run compat:floor   # install Chrome 130 and Firefox 132 outside the repo and run the floor probe
```

Browser test files are verified one engine at a time, without file parallelism (`npx vitest run --project "browser (chromium)" --no-file-parallelism`, then `firefox` and `webkit`); the full parallel run is deferred ([release-process.md](./docs/release-process.md) §3).

## Licence

MIT; see [LICENSE](./LICENSE). The eight packages publish with public access under the owner's `@oddkin` scope; the docs app and the workspace root stay private.