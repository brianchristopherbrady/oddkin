# Oddkin

Oddkin is a modular frontend framework built on custom elements and browser APIs. It includes:

- **`@oddkin/core`** — authoring foundation: reactive primitives, ownership (`Scope`), templates, styles, layout recipes, collections, and models.
- **`@oddkin/tokens`** — theme configuration and a deterministic token pipeline that emits CSS, SCSS, JSON, and TypeScript. Use the tokens with plain CSS and no Oddkin JavaScript.
- **`@oddkin/components`** — accessible, themeable custom elements that work in plain HTML or in any framework.
- **`@oddkin/ai`** — optional AI interaction elements, headless controllers, and stream adapters for conversations, inline assistance, research tools, and agent workflows.
- **`@oddkin/state`** and **`@oddkin/app`** — optional stores, context, routing, and async resources.
- **Optional tooling** — `@oddkin/analyzer` (metadata), `@oddkin/workbench` (generated documentation, interactive component pages, Theme Studio), and `@oddkin/agent` (IDE agent support).

## Names

Packages are published under `@oddkin/*`; elements use the `odd-` prefix (`<odd-button>`), CSS custom properties `--odd-*`, and theme scopes `data-odd-*`; command-line tools are `oddkin`, `oddkin-tokens`, `oddkin-analyze`, and `oddkin-agent`. See [ADR 0037](./docs/architecture/decisions/0037-naming-contract.md).

## Status

Early development; nothing is published. `@oddkin/core`, `@oddkin/tokens`, and `@oddkin/analyzer` have implemented, tested public APIs; `@oddkin/components` has its first three elements (M4 in progress); `@oddkin/ai` is implemented with 24 elements, controllers, adapters, and three simulated demos. See [IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md) for milestones and current state, and [docs/verification.md](./docs/verification.md) for recorded results.

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

MIT; see [LICENSE](./LICENSE). All packages stay marked `private` until npm scope ownership is confirmed (see the plan's release checklist).