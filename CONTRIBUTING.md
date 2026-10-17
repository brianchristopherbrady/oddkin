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

## Component organization (planned, M4)

Repository components will use one folder per component ([IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md) §3.3): `name.ts` (class), `name.template.ts`, `name.styles.ts`, `name.definition.ts` (`compose()`), `name.define.ts` (explicit registration), and a side-effect-free `index.ts`. Tests, examples, and fixtures for a component sit beside it where tooling allows.

- Import sibling files directly, never through the folder's own `index.ts`.
- External templates import their host class with `import type`.
- Never import a `*.define.ts` file from an ordinary barrel.

Recomposable components also have `name.structural.styles.ts` and a skin-free `foundation.ts` entry ([multi-product.md](./docs/architecture/multi-product.md) §4). Exporting a template or styles is a compatibility commitment; never export private helpers as customization API.

Until the composition API lands, new code follows the existing colocated style. Intentionally colocated demonstrations (e.g. `examples/binding-rule`) and focused inline test fixtures stay colocated so both authoring paths remain exercised.

## Agent kit and guidance (planned)

When the agent kit exists ([agent-tooling.md](./docs/architecture/agent-tooling.md), ADR 0032), changes to public APIs, tokens, recipes, examples, or authored guidance regenerate it with `mote-agent kit`, and `mote-agent kit --check` must report no stale artifacts. Authored guidance may only cite tags, properties, events, slots, parts, tokens, recipes, and imports that exist; the build rejects unknown references. Do not hand-edit generated references or the managed `AGENTS.md` section.

## Verification evidence (planned tooling)

Visual baselines are updated only through an explicit accept step that lists the differences being accepted. Conformance suites accept legitimate customizations and must reject their shipped mutants. Record results with the implementation, configuration, browser, and suite version tested ([change-impact-and-verification.md](./docs/architecture/change-impact-and-verification.md)).

## Workflow

- `npm run verify` must pass before a change is considered done. Run the smallest relevant command while iterating.
- Code is formatted with Prettier (`npm run format`). Markdown is not auto-formatted.
- Tests sit next to the code (`packages/*/test`) or at workspace level (`tests/`, `e2e/`). Browser behavior needs a Playwright test in all three engines.
- Mark a plan checkbox `[x]` only when the work is implemented **and** verified; record results in [docs/verification.md](./docs/verification.md).
- Never claim performance, accessibility, framework compatibility, or reference parity without recorded evidence.

## Commits

Use clear, imperative commit messages that reference the milestone (for example `M1: enforce package boundaries on built artifacts`).