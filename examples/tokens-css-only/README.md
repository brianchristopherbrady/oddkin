# Tokens, CSS only

A page styled only by a generated token stylesheet and ordinary CSS — **no script**. It shows the root following the system colour scheme, an explicit dark subtree, a product scope nested in dark mode, light mode nested inside that product, a compact density scope, and a profile with a compact density nested inside it.

`generated/harbor.css` is produced from `theme.json` by the `mote-tokens` CLI during `npm run build` (see `scripts/build-token-assets.mjs`):

```sh
mote-tokens build examples/tokens-css-only/theme.json --out examples/tokens-css-only/generated --format css --strict
```

`e2e/tokens-css-only.spec.ts` checks, in Chromium, Firefox, and WebKit, that the page has no scripts, that computed colours and sizes in every scope equal the generator's resolved values, and that the first render follows an emulated light or dark system preference.

