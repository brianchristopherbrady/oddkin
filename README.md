# Oddkin

Oddkin is a modular frontend framework built on custom elements and browser APIs. It includes:

- **`@oddkin/core`** — authoring foundation: reactive primitives, ownership (`Scope`), templates, styles, layout recipes, collections, and models.
- **`@oddkin/tokens`** — theme configuration and a deterministic token pipeline that emits CSS, JSON, DTCG, and TypeScript (Sass output is planned). Use the tokens with plain CSS and no Oddkin JavaScript.
- **`@oddkin/components`** — accessible, themeable custom elements that work in plain HTML or in any framework.
- **`@oddkin/ai`** — optional AI interaction elements, headless controllers, and stream adapters for conversations, inline assistance, research tools, and agent workflows.
- **`@oddkin/state`** and **`@oddkin/app`** — optional stores, context, routing, and async resources.
- **Optional tooling** — `@oddkin/analyzer` (metadata) and `@oddkin/workbench` (component documentation generated from a library's metadata, served locally, with interactive pages and Theme Studio). An `@oddkin/agent` package for IDE agents is not built (skipped for now by the owner); agents use the kits that `@oddkin/components` and `@oddkin/ai` ship.

## Names

Packages are published under `@oddkin/*`; elements use the `odd-` prefix (`<odd-button>`), CSS custom properties `--odd-*`, and theme scopes `data-odd-*`; command-line tools are `oddkin`, `oddkin-tokens`, `oddkin-analyze`, and `oddkin-agent`. See [ADR 0037](./docs/architecture/decisions/0037-naming-contract.md).

## Status

Beta. The eight packages are versioned `1.0.0-beta.0` and ready to publish on the `beta` dist-tag (`npm install @oddkin/core@beta`); the owner publishes them ([release-process.md](./docs/release-process.md) §5), and contracts may still change before 1.0.0. `@oddkin/components` has 54 elements and `@oddkin/ai` 24, each with contract-test evidence in three engines. See [IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md) for milestones and current state, and [docs/verification.md](./docs/verification.md) for recorded results.

## Repository layout

| Path | Contents |
| --- | --- |
| `packages/*` | `@oddkin/core`, `@oddkin/tokens`, `@oddkin/state`, `@oddkin/app`, `@oddkin/components`, `@oddkin/ai`, `@oddkin/analyzer`, `@oddkin/workbench` |
| `apps/docs` | Oddkin's product documentation application (private) |
| `examples/` | Consumers that run without a bundler (`plain-html`, `tokens-css-only`, `core-counter`, `components-only`, `css-gallery`, `binding-rule`) and the bundled static `@oddkin/ai` demos (`ai-research`, `ai-writing`, `ai-agent`) |
| `docs/architecture/` | Architecture documents and [decision records](./docs/architecture/decisions/README.md) |
| `docs/compatibility/` | Browser floor and platform feature registry, and the generated [feature matrix](./docs/compatibility/matrix.md) |
| `docs/research/`, `docs/reference/` | Ecosystem research and the reference-application audit |
| `docs/schemas/` | Draft JSON Schemas (move into their packages in M3/M5) |
| `scripts/` | Boundary checks, CSS compatibility checks, packed-consumer verification, static server |
| `tests/`, `e2e/` | Workspace-level unit tests, the floor-browser probe, and browser tests |

## Requirements and commands

Node.js 24.12 or newer, npm 11. Supported browsers: Chrome and Edge 130, Firefox 132, Safari 18.2, and later (Baseline 2024) ([css-architecture.md](./docs/architecture/css-architecture.md)).

```sh
npm install
npx playwright install chromium firefox webkit   # once, for browser tests
npm run build          # TypeScript project build (tsc -b)
npm run lint           # package boundaries (manifests, sources, built artifacts), CSS compatibility, formatting
npm run typecheck      # packages, tests, and configs
npm test               # unit tests (Vitest)
npm run size           # bundle and stylesheet size budgets
npm run test:e2e       # browser tests in Chromium, Firefox, and WebKit (Playwright)
npm run verify:packs   # pack, install outside the workspace, verify imports and types
npm run verify         # all of the above
npm run compat         # regenerate docs/compatibility/matrix.md after editing features.json
npm run compat:floor   # install Chrome 130 and Firefox 132 outside the repo and run the floor probe
```

## Licence

MIT; see [LICENSE](./LICENSE). The eight packages publish with public access under the owner's `@oddkin` scope; the docs app and the workspace root stay private.