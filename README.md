# Oddkin

Oddkin is a modular frontend framework built on custom elements and browser APIs. It includes:

- **`@oddkin/core`** — authoring foundation: reactive primitives, ownership (`Scope`), templates, styles, layout recipes, collections, and models.
- **`@oddkin/tokens`** — theme configuration and a deterministic token pipeline that emits CSS, SCSS, JSON, and TypeScript. Use the tokens with plain CSS and no Oddkin JavaScript.
- **`@oddkin/components`** — accessible, themeable custom elements that work in plain HTML or in any framework.
- **`@oddkin/state`** and **`@oddkin/app`** — optional stores, context, routing, and async resources.
- **Optional tooling** — `@oddkin/analyzer` (metadata), `@oddkin/workbench` (generated documentation, interactive component pages, Theme Studio), and `@oddkin/agent` (IDE agent support).

## Names

Packages are published under `@oddkin/*`; elements use the `odd-` prefix (`<odd-button>`), CSS custom properties `--odd-*`, and theme scopes `data-odd-*`; command-line tools are `oddkin`, `oddkin-tokens`, `oddkin-analyze`, and `oddkin-agent`. See [ADR 0037](./docs/architecture/decisions/0037-naming-contract.md).

## Status

Early development. The repository holds the implementation plan, architecture records, and the M1 workspace skeleton. **No package has a public API yet**, and nothing is published. See [IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md) for milestones and current state, and [docs/verification.md](./docs/verification.md) for recorded results.

## Repository layout

| Path | Contents |
| --- | --- |
| `packages/*` | `@oddkin/core`, `@oddkin/tokens`, `@oddkin/state`, `@oddkin/app`, `@oddkin/components` |
| `apps/docs` | Oddkin's product documentation application (private) |
| `examples/` | Consumers that run without a bundler (`plain-html`) |
| `docs/architecture/` | Architecture documents and [decision records](./docs/architecture/decisions/README.md) |
| `docs/research/`, `docs/reference/` | Ecosystem research and the reference-application audit |
| `docs/schemas/` | Draft JSON Schemas (move into their packages in M3/M5) |
| `scripts/` | Boundary checks, packed-consumer verification, static server |
| `tests/`, `e2e/` | Workspace-level unit tests and browser tests |

## Requirements and commands

Node.js 24.12 or newer, npm 11.

```sh
npm install
npx playwright install chromium firefox webkit   # once, for browser tests
npm run build          # TypeScript project build (tsc -b)
npm run lint           # package boundaries (manifests, sources, built artifacts) + formatting
npm run typecheck      # packages, tests, and configs
npm test               # unit tests (Vitest)
npm run test:e2e       # browser tests in Chromium, Firefox, and WebKit (Playwright)
npm run verify:packs   # pack, install outside the workspace, verify imports and types
npm run verify         # all of the above
```

## Licence

Not yet chosen. All packages are marked `private` until the licence and npm scope ownership are confirmed (see the plan's release checklist).