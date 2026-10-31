# Support policy

What Oddkin's packages are tested with, and what is not. It covers the `1.0.0-beta.N` releases (owner decision D-4, 2026-10-30). A range is claimed only when CI or a recorded run checks it; anything else is listed as a limitation. Release notes announce changes to this page.

## Browsers

Chrome and Edge 130, Firefox 132, Safari 18.2, and later, on desktop ([ADR 0009](./architecture/decisions/0009-browser-support-baseline.md)).

- **Evidence:** every browser test runs in Chromium, Firefox, and WebKit in CI. The floor probe (`e2e/floor-probe.spec.ts`) passed in Chrome 130 and Firefox 132 on 2026-10-27. The [compatibility matrix](./compatibility/matrix.md) checks every shipped stylesheet against the floor.
- **Limitations:**
  - Safari is tested through Playwright's WebKit on Linux and Windows, not on Apple hardware.
  - Mobile browsers are not tested. At the floor, Safari on iOS lacks three features and Firefox for Android one; the matrix lists what each affects.

## Accessibility

- **Evidence:**
  - Browser and e2e tests drive the elements by keyboard (Tab order, arrow keys, Enter, Escape) in Chromium, Firefox, and WebKit.
  - axe-core (WCAG 2.2 A and AA rules) audits the button, input, badge, card, and display elements in light and dark mode, and the example pages: components-only, forms, presentation, the AI demos, and Workbench.
- **Limitations:** screen readers are not yet verified, and no conformance level is claimed.

## Node.js

- The command-line tools (`oddkin` in `@oddkin/workbench`, `oddkin-tokens`, and `oddkin-analyze`, `oddkin-impact`, and `oddkin-kit` in `@oddkin/analyzer`) need Node.js 24.12 or newer, as their `engines` field says. CI runs Node 24.
- The other packages are browser libraries and declare no Node version. Every export imports in Node 24 (`npm run verify:packs`), but server-side rendering is not supported.
- Node.js below 24 is not tested.

## TypeScript

5.9 or newer. The published declarations compile with TypeScript 5.9.3 (vue-tsc), 6.0.3 (the Angular app), and 7.0.2 (the Vite and React apps), with `skipLibCheck: false` in the fresh apps (`e2e/fresh-consumers.spec.ts`).

## Frameworks

React 19.3, Vue 3.5, Svelte 5.57, and Angular 22.2, in three engines ([release-process.md §4](./release-process.md#4-verified-frameworks)). Other versions are not claimed.

## Package managers and bundlers

- **Tested:**
  - npm 11: every install in CI, the published-package checks (`npm run verify:packs`, `e2e/packed-consumers.spec.ts`), and the fresh apps.
  - Vite 8.3, esbuild, the Angular CLI's builder, and import maps without a bundler: the fresh apps and the examples.
- **Not tested:** pnpm, Yarn, webpack, and Rspack. Yarn does not install peer dependencies, so add them yourself ([release-process.md §1](./release-process.md#1-proposed-v1-versioning)).

## Copies and versions on one page

- One copy of `@oddkin/core` per install is the supported setup (`tests/architecture/single-core.test.ts`).
- Two copies of core on one page keep working, including the published 1.0.0-beta.0 beside the current packages (`e2e/duplicate-core.spec.ts`; [core-contracts.md §5.1](./architecture/core-contracts.md)).
- Each element name registers once per page ([release-process.md §2](./release-process.md#2-tag-name-conflicts-an-honest-note)).

## Fixes

During the betas, fixes ship in the next beta. To report a security problem, see [SECURITY.md](../SECURITY.md).
