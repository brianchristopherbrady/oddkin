# Declarative shadow DOM for first paint (ADR 0046 D10)

[ADR 0046](../../../docs/architecture/decisions/0046-plan-audit-2026-10-26.md) D10 asks whether pages should ship their Oddkin elements' first render as declarative shadow roots, so a page shows its final layout before any module loads. Elements still replace the root when they upgrade (core-contracts.md §6.1: "Declarative shadow DOM content is replaced on first render; hydration is not supported"). The rule: adopt it for the docs, and document the pattern, if it improves largest contentful paint (LCP).

```sh
npm run build
node research/experiments/dsd-first-paint/run.mjs [--samples 9]
```

`run.mjs` serves the workspace through Playwright routes (no port, no e2e lock) and, in Chromium (the engine that reports `largest-contentful-paint` and `layout-shift` entries):

1. loads each page, waits for every element, and serializes its body with `getHTML({ shadowRoots })`, every Oddkin shadow root as a `<template shadowrootmode="open">`;
2. gives each prerendered root its element's styles: a same-origin stylesheet `<link>` per element (allowed by the pages' strict `style-src 'self'`), or, for comparison only, an inline `<style>` (which needs `'unsafe-inline'`);
3. measures nine loads of each variant, alternating, with module scripts served at once and delayed by 800 ms each (a slow network: every element is defined after about six seconds): first and largest contentful paint, cumulative layout shift, the moment every element is defined, and Chromium's script, layout, and style-recalculation totals; and checks that every shadow root ends identical to the upgrade-only page's.

Pages (agreed with Agent 2): `examples/components-only` (three `odd-card`s around `odd-input` and `odd-button`s), and `content.html` here, a release-notes article made of display elements (`odd-alert`, `odd-badge`, `odd-status-marker`, `odd-stat`, `odd-card`, `odd-avatar`, `odd-empty-state`). The docs app's pages are rendered by its server before any script and contain no Oddkin elements, so they would measure nothing.

## Result (2026-10-27): no LCP gain; layout shift removed. Not adopted

Medians of nine loads, Chromium 156, Windows, other agents' test runs on the same machine (`research/benchmarks/results/dsd-first-paint-2026-10-28.json`):

| Page, module delay | Variant | FCP | LCP | CLS | Style recalc | HTML |
| --- | --- | --- | --- | --- | --- | --- |
| components-only, 0 ms | upgrade only | 124 ms | 124 ms | 0.040 | 4.8 ms | 3,877 B |
| | prerendered, stylesheet links | 120 ms | 120 ms | 0 | 10.1 ms | 7,056 B |
| | prerendered, inline styles | 148 ms | 148 ms | 0 | 7.5 ms | 31,444 B |
| components-only, 800 ms | upgrade only | 132 ms | 132 ms | 0.040 | 5.5 ms | |
| | prerendered, stylesheet links | 144 ms | 144 ms | 0 | 8.8 ms | |
| | prerendered, inline styles | 184 ms | 184 ms | 0 | 7.6 ms | |
| content page, 0 ms | upgrade only | 124 ms | 124 ms | 0.138 | 5.4 ms | 3,830 B |
| | prerendered, stylesheet links | 116 ms | 324 ms | 0 | 12.5 ms | 8,036 B |
| | prerendered, inline styles | 168 ms | 168 ms | 0 | 8.1 ms | 30,099 B |
| content page, 800 ms | upgrade only | 132 ms | 132 ms | 0.138 | 6.2 ms | |
| | prerendered, stylesheet links | 132 ms | 236 ms | 0 | 13.8 ms | |
| | prerendered, inline styles | 228 ms | 228 ms | 0 | 9.0 ms | |

- **LCP does not improve.** The text these pages lead with is light-DOM content, which the browser paints at once whether or not the elements are defined, so the upgrade-only pages' LCP is their first paint. Prerendering moves the same text into its final layout but not earlier: with stylesheet links, content inside a shadow root waits for its element's stylesheet (LCP +100–200 ms on the content page); inline styles avoid the fetch but put 26–28 KB of repeated CSS in the HTML and still paint later (+24–96 ms).
- **Layout shift goes away.** Upgrading moves content once on each page (CLS 0.040, and 0.138 on the content page, above the 0.1 that counts as good); every prerendered variant shows the final layout from its first paint (CLS 0).
- **The replacement is correct and cheap.** Every shadow root ends identical to the upgrade-only page's (template markers aside); defining takes as long; style recalculation grows by 2–8 ms.
- **CSP.** Prerendered styles need either one more same-origin request per element type or `'unsafe-inline'` styles; the pages' strict CSP rules out the second.

Decision: not adopted for the docs or the examples, and no prerender pattern is published (the revisit condition, "the experiment shows no LCP gain", is met). The layout shift it removes has a cheaper fix that pages control: reserve each undefined element's box in page CSS (`odd-card:not(:defined) { display: block; … }`), which css-architecture.md and the docs can describe without a build step. Revisit when an element's own content is a page's LCP (an image or heading inside a shadow root), or when declarative shadow roots can share constructed stylesheets without a fetch per element type.
