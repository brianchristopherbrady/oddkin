# Contributing to Mote

## Before you change code

1. Read [IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md): it owns scope and sequencing. Work belongs to a milestone; do not expand scope beyond the current vertical slice.
2. Read the architecture document for the area you are touching ([docs/architecture/](./docs/architecture/)). It owns the detailed contract.
3. Check the [decision records](./docs/architecture/decisions/README.md). Changing an Accepted decision needs a superseding ADR; after the M8 checkpoint it also needs affected-consumer analysis, a migration plan, and renewed verification (ADR 0029).

## Package boundaries

The dependency map in [packages.md](./docs/architecture/packages.md) is enforced by `npm run lint:boundaries`, which checks manifests, source imports, built artifacts, and DOM-free entry points. Rules in short:

- `@mote/core` and `@mote/tokens` depend on no other Mote package; `@mote/tokens` never imports core.
- `@mote/components` depends only on core and tokens; never on state, app, or tooling.
- Shipped browser code has **zero third-party runtime dependencies** and no Node built-ins.
- Import other packages only through their public `exports`; never through `src/` or `dist/` paths.
- Node-only tooling (`@mote/analyzer`, `@mote/agent`) is never reachable from browser code.

To add a package or entry point, update `scripts/architecture/boundaries.config.mjs` and `docs/architecture/packages.md` together.

## Workflow

- `npm run verify` must pass before a change is considered done. Run the smallest relevant command while iterating.
- Code is formatted with Prettier (`npm run format`). Markdown is not auto-formatted.
- Tests sit next to the code (`packages/*/test`) or at workspace level (`tests/`, `e2e/`). Browser behavior needs a Playwright test in all three engines.
- Mark a plan checkbox `[x]` only when the work is implemented **and** verified; record results in [docs/verification.md](./docs/verification.md).
- Never claim performance, accessibility, framework compatibility, or reference parity without recorded evidence.

## Commits

Use clear, imperative commit messages that reference the milestone (for example `M1: enforce package boundaries on built artifacts`).