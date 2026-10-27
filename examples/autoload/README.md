# Autoload

The optional autoloader of `@oddkin/components` (ADR 0046 D9) beside the same markup with explicit `define/*` imports, the recommended production path.

- `index.html` imports `@oddkin/components/autoload` (`autoload.js`); every `odd-*` element registers on its first appearance.
- `explicit.html` imports one `define/<name>` entry per element (`explicit.js`).

Both run under a strict CSP with Trusted Types. Their import maps cover every `define/*` entry's graph, because the autoloader imports definitions by URL: `node scripts/packed-consumers.mjs --import-map examples/autoload --html <page>`, then `node scripts/update-csp-hash.mjs examples/autoload/<page>`. `e2e/autoload.spec.ts` runs them from the workspace build and from packed tarballs and records requests and time to defined.
