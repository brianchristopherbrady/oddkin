# components-only example

`@oddkin/components` used from plain HTML and JavaScript with only `@oddkin/core` and `@oddkin/tokens`: no state, app, analyzer, Workbench, or agent packages, and no build step for the page.

- `odd-card` with `label` is a named region; the "Plan" card is a region named by its slotted heading; the last card has no name and adds no landmark.
- `odd-input` is a form-associated field: its label and description live in its shadow root, it submits `email`, and Reset restores its default value.
- `odd-button` elements in the card footer belong to the form through the native `form` attribute (form-associated custom elements). Save submits `intent=save` with the form data; Reset restores the field; the icon-only help button is named by `label`.
- Theme values come from `@oddkin/tokens/css/default.css`; the page runs under a strict CSP with Trusted Types required (constructed stylesheets need no inline styles).

## Run

```sh
npm run build
node scripts/serve-static.mjs
# open http://localhost:4173/examples/components-only/
```

Verified by `e2e/components-only.spec.ts` in Chromium, Firefox, and WebKit: the form flows, Playwright's ARIA snapshot (names across shadow boundaries and the invalid state; computed by Playwright from the DOM, so it cannot show `ElementInternals` regions), and, in Chromium only, the browser's own accessibility tree through the DevTools protocol (regions, names, the field's description, `required`, `invalid`). Native accessibility trees in Firefox and WebKit and screen readers are not verified.
