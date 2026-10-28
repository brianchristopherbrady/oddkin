# @oddkin/docs (private)

Oddkin's product documentation application. Browser imports are resolved from workspace package
`exports`; the app imports `@oddkin/app/app` and `@oddkin/app/router` through public entries. It
reads the published Components Custom Elements Manifest, `oddkin.metadata.json`, and Tokens
inspection JSON. The docs runtime does not import the analyzer or component registration modules.

## Development

After `npm run build`, run `npm run dev` at the workspace root. The Node server binds to
`127.0.0.1:4177`, serves `/` and client-side routes, and generates an import map only from
published JavaScript exports. Public JSON and CSS assets use the same export map. It uses a strict
CSP with Trusted Types enforcement.

## Static and rendering boundary

Authored pages are data in `src/pages/` (blocks of text, lists, tables, and code). The docs server
renders each into `index.html`, with the navigation and the facts `facts.mjs` generates from the
published files (package manifests, component metadata, `docs/compatibility/features.json`, the
framework versions the typing fixtures use), so every authored page is readable before any script
runs. The client keeps a page the server rendered and loads a page's document when its router
reaches one. Metadata-backed routes (components, foundations, the layout guide, search) are
rendered in the browser and need JavaScript and the published metadata/token JSON assets. There is
no server-rendering of components, streaming, or hydration. A deployment must serve the rendered
pages and a history-route fallback to the shell for the client routes.

Component, foundation, and catalog references are the public Workbench panels
(`@oddkin/workbench/panels/{component,foundation,catalog}`), in open shadow roots. The docs app
builds their data in the browser with `buildWorkbenchData` from `@oddkin/workbench/data`, from the
same three published files, and passes `index`, `page`, and `href` (the router's `href`, so panel
links navigate in the docs router). Each route loads only the panel it renders. `frameUrl` is left
empty, so detail pages show "Preview unavailable" and load no component module. The catalog's search
and category are mirrored in the URL (`/components?q=…&category=…`) without new history entries; it
renders its cards with `odd-card`, the only component module the docs load.

## Snippets

`snippets/verify.mjs` packs `@oddkin/core`, `@oddkin/tokens`, `@oddkin/components`, `@oddkin/state`,
and `@oddkin/app` into an isolated consumer and checks the copied registration and token snippets
and every code sample of the authored pages: imports name published entries, TypeScript samples
type-check, JavaScript samples parse, markup uses published elements and attributes, import maps
and stylesheet links name published files, and CSS reads published tokens. Run after
`npm run build`. `tests/docs/pages.test.ts` checks the pages' links, facts, and escaping.