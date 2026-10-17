# core-counter example

Two elements authored with `@mote/core` only — no tokens, components, state, or app packages — with their own visual identity.

- `demo-counter`: local signal with a direct text binding (clicks do not re-run `render()`), a typed `count-change` event, a custom state (`:state(positive)`), and a scoped `keydown` listener (Escape resets).
- `demo-greeting`: typed public properties from `MoteElement.with()` — `string`, `boolean` (reflected), `enum` (reflected), and a property-only `array`.

The page runs under a strict Content Security Policy: `default-src 'none'`, `style-src 'self'` (no inline styles; components use constructed stylesheets), the import map allowed by hash, and Trusted Types required (`trusted-types mote-template`). `tests/examples/csp.test.ts` fails if the import map changes without updating its hash; run `node scripts/update-csp-hash.mjs examples/core-counter/index.html` after editing it. The greeting's tone colour uses `styleMap` from `@mote/core/helpers/style-map`, which writes through the CSSOM and so works where inline `style` attributes are blocked.

## Run

```sh
npm run build
node scripts/serve-static.mjs
# open http://localhost:4173/examples/core-counter/
```

Verified by `e2e/core-counter.spec.ts` (Chromium, Firefox, WebKit). Its emitted declarations are type-checked by `tests/examples/core-counter.types.test.ts`, and `scripts/experiments/analyzability-probe.mjs` extracts its property metadata without running it.
