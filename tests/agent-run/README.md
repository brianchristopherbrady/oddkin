# A coding agent builds from the packaged kit alone (2026-10-30)

The record of one run of a real coding agent against the agent kit that `@oddkin/components` ships (IMPLEMENTATION_PLAN.md P0.4; M11 "test them in at least one actual agent"; agent-tooling.md §11). `settings-app/` holds what the agent wrote, byte for byte. `e2e/agent-run.spec.ts` serves those files from the packed packages and checks them in Chromium, Firefox, and WebKit. `composition.test.ts` checks the composition document against the published JSON Schemas and `validateComposition`.

## Conditions

- **Agent:** GitHub Copilot's agent in VS Code (Claude Opus 5.5), launched as a subagent with the prompt below and no other instructions about Oddkin.
- **Starting point:** `main` at `409c5b5`. `@oddkin/core`, `@oddkin/tokens`, and `@oddkin/components` 1.0.0-beta.0 were packed from that commit (`npm pack`) and installed from the tarballs into a new project outside the repository. The project had no example files.
- **Context allowed:** the kit in `node_modules/@oddkin/components/agent/`, and the installed packages' own files (manifests, READMEs, built files, schemas). Not allowed: the repository, workspace search tools (they search the repository), and the web.
- **Limitation:** the agent environment adds the repository's `AGENTS.md` and the operator's memory notes to every agent's context. The agent reports that it used nothing from them; neither describes a component API.

## The task (as given)

Build a small "Notification settings" interface with the Oddkin components, in three parts. Pages are served as static files with the project directory as the web root. There is no bundler: an import map in each page maps every bare module specifier the pages load, the packages' own internal imports included, to files under `./node_modules/`. The theme's CSS comes from the installed `@oddkin/tokens`, and only the elements used are registered.

1. `index.html` (with `main.js` and `styles.css`): a card titled "Notification settings" with a required email field labelled "Email", a switch labelled "Weekly digest", a select labelled "Frequency" (Daily, Weekly, Monthly; Weekly selected), and a primary "Save" button. On Save, an empty or invalid email shows the components' validation feedback and nothing is saved; otherwise "Settings saved." appears in an alert.
2. `settings.composition.json`: the same card as a composition document, with Save's `click` mapped to the action `settings.save`, validated in Node with `validateComposition` until it passes.
3. `composition.html` (with `composition.js`): fetches the document, renders it with `renderComposition` into `#app` after registering its elements, with an allow-list of exactly the tags it uses, and lists each fired action in `#actions`.

## What the agent did

- **Read:** `GUIDE.md`, `kit.json`, `references/composition.md`, the references of the six components it used and of `odd-validation-summary`, two recipes, the `layout` and `base` stylesheet references, and one token reference. It also read the three packages' manifests and READMEs, the composition schemas for the document and `odd-select`, and about 30 built modules. It used the built modules to derive the import maps and to check how invalid fields show their error.
- **Ran:** node scripts it wrote in the project (`tools/`): one generates and checks the import maps by walking every module the pages load, one validates the document, and one prints an element's composition catalog entry. It also searched the installed files with `Select-String`.
- **Repaired once:** `validateComposition` refused its first document, which set `odd-select`'s `options` under `properties` (`composition.property.notPortable`). The document now sets only `value`, and `composition.js` gives the select its options after rendering.

## Results

- Both pages worked in all three engines the first time they were loaded; nothing was changed after the run. `e2e/agent-run.spec.ts` passed 9 of 9. An empty or malformed address shows the browser's message in the field and nothing is saved. A valid address shows "Settings saved." in a success alert. The composition page renders the card's six tags, the select gets its three options, and Save reports `settings.save`. There are no console errors, page errors, or failed requests.
- Each page's import map equals the map computed from the installed packages: every specifier the page loads, each mapped to the file the package's `exports` name under the `default` condition (production core, never mixed with its development build).
- The document is valid by the published JSON Schemas and by `validateComposition`. Its first draft is refused by both.
- **No invented APIs.** Every attribute, property, and slot the agent used is declared in the installed `custom-elements.json`. The one exception is `updateComplete`, which the elements inherit from `@oddkin/core`, whose `CONTRACTS.md` documents it (`contract:core/update-complete`). Every entry point it used is a package export.

## Where the kit fell short (as the agent reported)

- Loading without a bundler: the guide does not mention import maps, the packages' internal specifiers, or that core ships a `development` and a `default` build that must not be mixed.
- The theme's CSS: the guide lists tokens but not the stylesheet to link; the agent found it in the components README and the tokens package's `exports`.
- Which properties a composition may set: the reference listed `properties`, and only the validator said that `odd-select`'s `options` cannot be written from a document.
- `odd-input`'s reference says `reportValidity()` shows the error, but the field shows its visible message only through `error`; the agent copied `validationMessage` into `error`.
