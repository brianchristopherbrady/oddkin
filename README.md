# Mote

Mote is a modular frontend framework built on custom elements and browser APIs. It includes:

- **`@mote/core`** — authoring foundation: reactive primitives, ownership (`Scope`), templates, styles, layout recipes, collections, and models.
- **`@mote/tokens`** — theme configuration and a deterministic token pipeline that emits CSS, SCSS, JSON, and TypeScript. Use the tokens with plain CSS and no Mote JavaScript.
- **`@mote/components`** — accessible, themeable custom elements that work in plain HTML or in any framework.
- **`@mote/state`** and **`@mote/app`** — optional stores, context, routing, and async resources.
- **Optional tooling** — `@mote/analyzer` (metadata), `@mote/workbench` (generated documentation, interactive component pages, Theme Studio), and `@mote/agent` (IDE agent support).

## Status

Early development. The repository holds the implementation plan, architecture records, and the M1 workspace skeleton. **No package has a public API yet**, and nothing is published. See [IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md) for milestones and current state, and [docs/verification.md](./docs/verification.md) for recorded results.

## Repository layout

| Path | Contents |
| --- | --- |
| `packages/*` | `@mote/core`, `@mote/tokens`, `@mote/state`, `@mote/app`, `@mote/components` |
| `apps/docs` | Mote's product documentation application (private) |
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