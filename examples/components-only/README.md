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

## From packed tarballs

```sh
npm run build
node scripts/packed-consumers.mjs --port 4174
# open http://127.0.0.1:4174/components-only/ (the first request packs and installs, a few seconds)
```

`scripts/packed-consumers.mjs` packs `@oddkin/core`, `@oddkin/tokens`, and `@oddkin/components` with `npm pack`, installs the three tarballs into a consumer in the system temporary directory (outside the workspace), and copies this page there. It generates the import map by walking the installed modules through each package's `exports` (the default conditions, so core's production build), so the map lists exactly the specifiers the components import. It points the token stylesheet at the installed package, failing for a file the package does not publish, and recomputes the CSP hash. `/components-only/__ready` reports the installed packages, the import map, and every module file the page loads. The same server packs the core-only, CSS-only, and full-application consumers (`e2e/packed-consumers.spec.ts`). The Playwright configuration starts it; packing happens only when a test requests a packed page.

Verified by `e2e/components-only.spec.ts` in Chromium, Firefox, and WebKit, against both the workspace build and the packed tarballs: the form flows, axe-core (WCAG 2.0–2.2 A and AA) in light and dark mode and after a blocked submission, Playwright's ARIA snapshot (names across shadow boundaries and the invalid state; computed by Playwright from the DOM, so it cannot show `ElementInternals` regions), and, in Chromium only, the browser's own accessibility tree through the DevTools protocol (regions, names, the field's description, `required`, `invalid`). For the packed page it also checks that only the three packages are installed and that every request is for the page's own files or published files of those packages. Native accessibility trees in Firefox and WebKit and screen readers are not verified.
