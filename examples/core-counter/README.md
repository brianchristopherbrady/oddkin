# core-counter example

Two elements authored with `@oddkin/core` only — no tokens, components, state, or app packages — with their own visual identity.

Each element follows Oddkin's component-folder convention (ADR 0036): a behavior class, an external template, styles, a `compose()` definition, an explicit `*.define.ts` registration entry, and a side-effect-free `index.ts`. `src/index.ts` registers nothing; `src/define.ts` (imported by `main.ts`) registers both elements.

```text
src/demo-counter/
  demo-counter.ts             class: properties, events, local state, lifecycle
  demo-counter.template.ts    template (type-only import of the class)
  demo-counter.styles.ts      styles
  demo-counter.definition.ts  compose({ name, element, template, styles })
  demo-counter.define.ts      define(demoCounterDefinition)
  index.ts                    exports only
```

- `demo-counter`: local signal with a direct text binding (clicks do not re-run the template), a typed `count-change` event, a custom state (`:state(positive)`), and a scoped `keydown` listener (Escape resets).
- `demo-greeting`: typed public properties from `OddkinElement.with()` — `string`, `boolean` (reflected), `enum` (reflected), and a property-only `array`.

The page runs under a strict Content Security Policy: `default-src 'none'`, `style-src 'self'` (no inline styles; components use constructed stylesheets), the import map allowed by hash, and Trusted Types required (`trusted-types oddkin-template`). `tests/examples/csp.test.ts` fails if the import map changes without updating its hash; run `node scripts/update-csp-hash.mjs examples/core-counter/index.html` after editing it. The greeting's tone colour uses `styleMap` from `@oddkin/core/helpers/style-map`, which writes through the CSSOM and so works where inline `style` attributes are blocked.

## Run

```sh
npm run build
node scripts/serve-static.mjs
# open http://localhost:4173/examples/core-counter/
```

Verified by `e2e/core-counter.spec.ts` and `tests/examples/core-counter-migration.browser.test.ts` (Chromium, Firefox, WebKit); the migration test checks that the barrel registers nothing, that a click writes only inside `<output>` with stable nodes, and that scope counts return to baseline. Its emitted declarations are type-checked by `tests/examples/core-counter.types.test.ts`, and `scripts/experiments/analyzability-probe.mjs` extracts its property metadata without running it.
