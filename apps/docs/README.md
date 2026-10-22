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

The initial Getting started guide and navigation are readable from `index.html` before the client
boots. Client-side routes, search results, and metadata-backed references require JavaScript and
the published metadata/token JSON assets. This slice has no server-rendering engine, streaming, or
hydration; it does not claim route content is server-rendered. A deployment must provide a
history-route fallback to the app shell (or use a separate static router strategy) for direct
navigation and refresh on nested routes.

Foundations and component references render basic content from the published metadata. The local
`<oddkin-doc-panel>` placeholder has an open shadow root and `pageData`, `index`, and `href(route)`
properties, so public Workbench panels can replace it when those exports are available. Until then,
detail pages link to the Workbench package. No component modules are imported for catalog or detail
discovery.

## Snippets

`snippets/verify.mjs` packs `@oddkin/core`, `@oddkin/tokens`, and `@oddkin/components` into an
isolated consumer, validates the copied registration and token snippets against the packed exports
and metadata, and syntax-checks each generated JavaScript snippet. Run after `npm run build`.