# components-only example

`@mote/components` used from plain HTML and JavaScript with only `@mote/core` and `@mote/tokens`: no state, app, analyzer, Workbench, or agent packages, and no build step for the page.

- `mote-card` with `label` is a named region; the second card has no name and adds no landmark.
- `mote-button` elements in the card footer belong to the form through the native `form` attribute (form-associated custom elements). Save submits `intent=save` with the form data; Reset restores the field.
- Theme values come from `@mote/tokens/css/default.css`; the page runs under a strict CSP with Trusted Types required (constructed stylesheets need no inline styles).

## Run

```sh
npm run build
node scripts/serve-static.mjs
# open http://localhost:4173/examples/components-only/
```

Verified by `e2e/components-only.spec.ts` in Chromium, Firefox, and WebKit. In Chromium the test also reads the browser's accessibility tree (DevTools protocol) to confirm the card's region name and the button's name; Firefox and WebKit are not verified at that level.
