# 0003. Typed property definitions via `MoteElement.with()`

- **Status:** Accepted
- **Date:** 2026-10-17
- **Area:** Core
- **Detailed contract:** [core-contracts.md §2](../core-contracts.md)

## Context
Public properties need types, attribute conversion, reflection, defaults, and metadata, without mandatory decorators or a compiler, and must be statically analyzable.

## Decision
`class X extends MoteElement.with({ name: prop.string({...}) })` is the single primary property API (chainable on subclasses: `Base.with({...})`). Kinds: `string`, `number`, `boolean` (presence), `enum`, `object` and `array` (property-only, factory defaults), `custom`. Attributes default to kebab-case; reflection is opt-in and happens on commit. Invalid attribute or property values report `element.attribute.invalid` / `element.prop.invalid` and fall back to the default. One definition infers instance types, installs DOM accessors, validates conversion, and feeds metadata.

## Alternatives considered
- Decorators — require a transform or the newest decorator semantics; analyzability varies.
- `static properties = {...}` — weaker type inference; kept only as fallback if the prototype fails.

## Consequences
The prototype must prove declaration emit, subclassing, per-instance object defaults, pre-upgrade replay, reserved-name diagnostics, class-field compatibility, and analyzability before M4.

## Evidence
R04, R08 (synthesis). M3 prototype (`packages/core/src/element`), verified 2026-10-17 — see [verification.md](../../verification.md):

- Declaration emit and downstream types: `tests/examples/core-counter.types.test.ts` type-checks against the emitted `.d.ts` of `examples/core-counter` (string, boolean, enum union, `string[]`, event detail, tag-name map).
- Subclassing, per-instance object/array defaults, pre-upgrade replay, reserved and duplicate names, reserved attributes, class-field shadowing (`element.prop.shadowed`, value applied through the accessor): `element.browser.test.ts` in Chromium, Firefox, WebKit.
- Static analyzability: `scripts/experiments/analyzability-probe.mjs` recovers kind, attribute, reflection, enum values, literal defaults, descriptions, and checker types from source without executing modules (`tests/experiments/analyzability.test.ts`); spreads, computed keys, and non-literal options yield `analyzer.dynamic.*` diagnostics.
- Limitation: a `.d.ts`-only consumer sees property types but not attribute names or reflection; those come from the generated manifest (ADR 0016/0017).

## Revisit when
Any of the listed prototype checks fails; then record the failure and accept the static-definition fallback in a superseding ADR.