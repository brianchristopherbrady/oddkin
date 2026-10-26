# CSS compatibility gallery

A static page that shows Oddkin's tokens and components under the conditions the CSS architecture must handle: light, dark, and system modes; nested opposite-mode surfaces; density and profiles; direction; a container whose width changes independently of the viewport; long and localized content; disabled, loading, and invalid states; and the baseline with and without the enhancement stylesheet. It also lists feature detection for every registered feature in the current browser and prints the emitted CSS.

Plain HTML and JavaScript, no build step, under a strict Content Security Policy with Trusted Types required. Served from the repository root:

```sh
npm run build
node scripts/serve-static.mjs
# open http://localhost:4173/examples/css-gallery/
```

- `gallery.css` uses only features every floor browser supports (Chrome and Edge 130, Firefox 132, Safari 18.2).
- `enhancements.css` contains only gated enhancements or literal parse-time fallbacks. Untick **Load the enhancement stylesheet** to see the baseline: nothing on the page depends on it.
- Overlays, motion between states, and AI interfaces are not covered yet; they arrive with their components (M10).

Contracts: [css-architecture.md](../../docs/architecture/css-architecture.md), [platform feature matrix](../../docs/compatibility/matrix.md). Checks: `e2e/css-compat.spec.ts`, `npm run lint:css`.
