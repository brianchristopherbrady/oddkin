# @oddkin/docs (private)

Oddkin's documentation site, published at https://oddkin.dev. Browser imports are resolved from
workspace package `exports`; the app imports `@oddkin/app/app` and `@oddkin/app/router` through
public entries. It reads the published Components Custom Elements Manifest, `oddkin.metadata.json`,
and Tokens inspection JSON. The docs runtime does not import the analyzer.

## Design

The visual design is the Figma file "Oddkin Docs Website" (`zF87qftdRznmJJezxy23gd`): its website
map is the information architecture, and its shared patterns are the shell (header, sidebar, footer,
code blocks, resource cards). Every word on the site comes from the project (pages, manifests,
metadata, the compatibility registry, the README), never from the Figma placeholder text. The shell
is built with Oddkin: tokens, the `@oddkin/components` CSS recipes (layout, button, link, table),
and `odd-side-nav`, `odd-copy-button`, `odd-card`, and `odd-command-palette` (search, Ctrl K).

## Development

After `npm run build`, run `npm run dev` at the workspace root. The Node server binds to
`127.0.0.1:4177` (`--port` changes it), serves `/` and client-side routes, and generates an import
map only from published JavaScript exports. Public JSON and CSS assets use the same export map. It
uses a strict CSP with Trusted Types enforcement.

## Static site and deployment

`node apps/docs/build.mjs [--out <dir>]` (default `.oddkin/docs-site`) writes the static site: one
document per route (authored pages in full, every component and foundation route as the shell the
client fills), `404.html` for any other path, and the browser files of the packages the pages load.
Each document carries its Content-Security-Policy as a meta element that allows the import map by
its hash. `.github/workflows/docs.yml` builds it on every push to `main` and deploys it to GitHub
Pages; the repository's Pages settings name the source (GitHub Actions) and the custom domain.

## Static and rendering boundary

Authored pages are data in `src/pages/` (blocks of text, lists, tables, code, and cards);
`src/pages/site.ts` is the information architecture and `src/pages/document.ts` renders the shell.
The dev server and the static build render each page into `index.html`, with the facts `facts.mjs`
generates from the published files (package manifests, component metadata,
`docs/compatibility/features.json`, the framework versions the typing fixtures use), so every
authored page is readable before any script runs. `src/shell.ts` adds the dark mode switch, the
narrow-screen menu, and search; the client keeps a page the server rendered and loads a page's
document when its router reaches one. Metadata-backed routes (components, foundations, the layout
guide, search) are rendered in the browser and need JavaScript and the published metadata/token
JSON assets. There is no server-rendering of components, streaming, or hydration.

Component, foundation, and catalog references are the public Workbench panels
(`@oddkin/workbench/panels/{component,foundation,catalog}`), in open shadow roots. The docs app
builds their data in the browser with `buildWorkbenchData` from `@oddkin/workbench/data`, from the
same three published files, and passes `index`, `page`, and `href` (the router's `href`, so panel
links navigate in the docs router). Each route loads only the panel it renders. `frameUrl` is left
empty, so detail pages show "Preview unavailable". The catalog's search and category are mirrored in
the URL (`/components?q=…&category=…`) without new history entries.

## Snippets

`snippets/verify.mjs` packs `@oddkin/core`, `@oddkin/tokens`, `@oddkin/components`, `@oddkin/state`,
and `@oddkin/app` into an isolated consumer and checks the copied registration and token snippets
and every code sample of the authored pages: imports name published entries, TypeScript samples
type-check, JavaScript samples parse, markup uses published elements and attributes, import maps
and stylesheet links name published files, and CSS reads published tokens. Run after
`npm run build`. `tests/docs/pages.test.ts` checks the pages' links, facts, escaping, and the shell;
`tests/docs/site.test.ts` checks the static build; `e2e/docs.spec.ts` and `e2e/docs-site.spec.ts`
run both in three engines.
