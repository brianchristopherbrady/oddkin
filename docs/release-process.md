# Release process

Status: **beta settled by the owner (2026-10-27)**: all eight packages publish as `1.0.0-beta.0` on the `beta` dist-tag under the owner's `@oddkin` npm scope (§5); `main` carries those versions, caret internal ranges, and public access, and no package is `private` any more. **Published 2026-10-28** by the owner (npm account `poisonsushi`): all eight at `1.0.0-beta.0` ([verification.md](./verification.md)). Publishing needs the owner's npm two-factor approval, and deployment is the owner's action. The final 1.0.0 versions below are still a proposal.

## 1. Proposed v1 versioning

Each package has its own version and changelog (semantic versioning). The v1 cut ([IMPLEMENTATION_PLAN.md](../IMPLEMENTATION_PLAN.md) §11) decides which contracts are frozen; the versions follow it:

| Package | First version | Why |
| --- | --- | --- |
| `@oddkin/tokens` | 1.0.0 | Token names, the theme schema (`theme-config.v1`), CSS custom properties, and the CLI are the CSS-only path's contract |
| `@oddkin/core` | 1.0.0 | The authoring contracts published in `CONTRACTS.md` (stable ids) |
| `@oddkin/components` | 1.0.0 | Tag names, attributes, properties, events, slots, parts, CSS properties, custom states, and the `define/*` entries in `custom-elements.json` |
| `@oddkin/ai` | 1.0.0 | As components, for the AI elements |
| `@oddkin/state`, `@oddkin/app` | 1.0.0 | Stores, context, persistence, resources, commands, router, and app roots (core-contracts.md §7–§9) |
| `@oddkin/analyzer`, `@oddkin/workbench` | 1.0.0 (beta: `1.0.0-beta.0`, owner) | The first proposal was 0.1.0, because their completion (plan M11, §5c, §5d) follows v1; the owner put them on `1.0.0-beta.0` with the rest, so a later 0.x would sort below the beta. Their config, frame protocol, and page contracts are not frozen by the candidate list (ADR 0047) and say so in their READMEs before 1.0.0 |

- **Internal ranges.** Workspace packages depend on each other with caret ranges of the released version (`"@oddkin/core": "^1.0.0-beta.0"`, which also accepts later betas and every `1.x`), never `*` or an exact pin. `scripts/release/set-versions.mjs` sets them with the versions (§5).
- **One copy per install.** A package whose copies must not differ on a page is a peer dependency of the packages built on it: `@oddkin/core` of `components`, `state`, `app`, and `ai`; `@oddkin/state` of `app`; `@oddkin/components` of `ai`. npm (7 and later) and pnpm install peers themselves, so an install has one copy of each, and a version that does not satisfy a range stops the install instead of nesting a second copy. Yarn does not install peers: add them (`yarn add @oddkin/components @oddkin/core`). `@oddkin/tokens` stays a dependency; its copies share nothing. *(2026-10-28, plan P0.2; `tests/architecture/single-core.test.ts`.)*
- **Compatible versions.** Any `1.x` runtime packages work together; a minor adds, a patch fixes, and only a major removes or changes a frozen contract (ADR 0029). Two copies of `@oddkin/core` on one page, at any versions, follow core-contracts.md §5.1: DOM protocols and the external-store contract cross copies; readables, scopes, and error handlers do not; the second copy's development build warns once (`[core.copies]`).
- **Schemas and metadata.** `oddkin-metadata.v1`, `theme-config.v1`, the composition schema, `examples.v1`, and the agent kit's `kit.json` carry their own version; an additive field is a minor change of the package that emits it; a breaking change is a new schema version, with the previous one still read for one major (ADR 0029).
- **Workbench's frame protocol and share links** are Workbench contracts, not frozen by 1.0.0 (ADR 0047). The frame protocol (version 1) must match exactly: a host refuses a frame of another version (`frame.version.incompatible`), so a site serves the frame files of the same `@oddkin/workbench` version as its panels. A share link carries `share-payload.v1`: a later Workbench opens a v1 link and drops, with a note, each name the component no longer declares; a link of another version is refused.
- **Deprecation.** A deprecated API keeps working for at least one minor release, reports a development-only diagnostic naming its replacement, and is removed only in the next major, with a migration note in the changelog.
- **Changelogs.** One `CHANGELOG.md` per package, newest first, with *Added*, *Changed*, *Fixed*, *Deprecated*, and *Removed* sections; entries come from the release's rows in [progress-log.md](./progress-log.md) and name the contract id or element they change. The first entry of each package is its first version. No changelog is written for the betas; the first entries come with 1.0.0. Each beta after the first has release notes instead (owner, 2026-10-29): `docs/releases/<version>.md`, what changed since the previous beta for people who install it, from the same progress-log rows.

## 2. Tag-name conflicts (an honest note)

Custom element names are global per registry. Oddkin registers `odd-*` names in the page's global registry:

- Loading two copies of `@oddkin/components` (or two applications that each bundle it) on one page registers each name once: the second `define()` throws `registry.collision` and the first registration stays (core-contracts.md §5.1; `e2e/duplicate-core.spec.ts`). Deduplicate the install, or isolate the second copy in a frame.
- Renaming tags does not avoid the conflict: an element's internal dependencies keep their names.
- Scoped custom element registries are not used or tested; they are not a supported workaround until they are.
- Workbench previews run in frames, each with its own registry, and reject incompatible registrations (`frame.registration.incompatible`).

## 3. Release checklist

Package hygiene, checked by `npm run verify:packs` on the tarballs:

- [x] `license` (MIT) in every manifest and a `LICENSE` file in every tarball.
- [x] `README.md` in every tarball; `type: "module"`; `sideEffects` declared (`false`, or the `define` entries that register).
- [x] Every JavaScript export has its declarations (`types`); `customElements` points at the manifest in the element packages.
- [x] No `src/` or `test/` file in a tarball, and no `dist` module whose source is gone; no third-party runtime dependency outside Node-only tooling.
- [x] Beta versions and internal caret ranges (`1.0.0-beta.0`, owner 2026-10-27; `scripts/release/set-versions.mjs --check`). Changelogs start at 1.0.0.
- [x] `private: true` removed from the eight packages and `publishConfig` with public access (the owner owns `@oddkin`); the docs app and the workspace root stay private.

Verification (results recorded in [verification.md](./verification.md), by owner of each failure):

- [x] `npm run build`, `npm run lint`, `npm run typecheck`, and the node project (beta, 2026-10-28: pass).
- [x] The browser project per engine with `--no-file-parallelism` (the full parallel run is deferred by the owner, 2026-10-27), and `npm run test:e2e` (beta, 2026-10-28: every browser file passes in three engines after one order-dependent router test was fixed; e2e 948 passed, one stale Theme Studio expectation open with Agent 2).
- [x] `npm run verify:metadata`, `npm run size`, `npm run verify:packs`, the packed consumers (`e2e/packed-consumers.spec.ts`, `e2e/components-only.spec.ts`, `e2e/autoload.spec.ts`), and `npm run compat` with the floor probe (`npm run compat:floor`) (beta, 2026-10-28; the floor probe on 2026-10-27, 16/16 in Chrome 130 and Firefox 132).
- [ ] The browser floor re-resolved and the matrix regenerated ([compatibility/matrix.md](./compatibility/matrix.md)); Safari 18.2 and screen-reader evidence recorded as limitations until a macOS host and assistive technology are available. (For the beta: the floor resolved on 2026-10-26 and the matrix regenerated on 2026-10-28 stand; re-resolve before 1.0.0.)
- [ ] `oddkin-impact` against the previous release once there is one, with the semver impact reviewed.
- [x] The framework fixtures pass in three engines and §4 names the versions they ran against (2026-10-27; again in the beta browser runs).
- [ ] The release evidence (§5) for the release commit: the CI run's `release-evidence-<attempt>` artifact, and `node scripts/release/evidence.mjs` from the clean checkout. After the publish, each package's `integrity` in `evidence.json` matches `npm view <name>@<version> dist.integrity`.

Then the owner tags, publishes, and deploys.

## 4. Verified frameworks

The framework fixtures render Oddkin elements through each framework in Chromium, Firefox, and WebKit: properties arrive as values (never attributes), events reach the framework's handlers, form controls bind, and elements defined after the framework rendered upgrade in place. Last verified 2026-10-27 (Chromium 156, Firefox 157, WebKit 27.2; 20 tests per engine):

| Framework | Version | Runtime fixtures | Type checks |
| --- | --- | --- | --- |
| React | 19.3.1 (`react`, `react-dom`) | `packages/components/test/frameworks.browser.test.ts`, `frameworks-forms`, `frameworks-late`; `packages/ai/test/frameworks.browser.test.ts` | `@oddkin/components/frameworks/react` JSX types: `tests/frameworks/react/react.types.tsx` (TypeScript 7.0.2) |
| Vue | 3.5.44 | the same three components files and the AI file | `@oddkin/components/frameworks/vue`: `tests/frameworks/vue/Shell.vue` with vue-tsc 3.3.13 (`strictTemplates`, TypeScript 5.9.3) |
| Svelte | 5.57.2 (runes; `@sveltejs/vite-plugin-svelte` 7.3.1) | `frameworks-svelte`, `frameworks-forms`, `frameworks-late` | `@oddkin/components/frameworks/svelte`: `tests/frameworks/svelte` with svelte-check 4.7.7 |
| Angular | 22.2.3 (JIT, zoneless, `CUSTOM_ELEMENTS_SCHEMA`) | `frameworks-angular`, `frameworks-forms`, `frameworks-late` | Templates: none (`CUSTOM_ELEMENTS_SCHEMA`). The fresh Angular app below compiles the packages' declarations with TypeScript 6.0.3 |

Other versions are not claimed. The fixtures live beside the packages' tests rather than in a separate `integration/` folder; `scripts/check-size.mjs` fails if any measured entry pulls in one of these frameworks.

The fresh apps (`tests/consumers/`, `e2e/fresh-consumers.spec.ts`, 2026-10-29) install the packed packages into new projects and build them with each framework's own tools: Vite 8.3.4 with TypeScript 7.0.2 and Sass, React, Vue, and Svelte through their Vite plugins, and the Angular CLI 22.2.3 (AOT, `strictTemplates`, TypeScript 6.0.3, as Angular 22.2 requires). The TypeScript apps check library declarations too (`skipLibCheck: false`).

## 5. Beta release

Settled by the owner (2026-10-27): all eight packages publish as `1.0.0-beta.0` on the `beta` dist-tag under the owner's `@oddkin` scope. Users opt in with `npm install @oddkin/core@beta`. The first publish of a new package also points `latest` at it, so on 2026-10-28 `latest` and `beta` both name `1.0.0-beta.0`. Until a package has a stable version, `publish.mjs` keeps `latest` on the newest prerelease (`npm dist-tag add <name>@<version> latest` after each publish; owner's choice, 2026-10-28): npm resolves a range to the `latest` version whenever it fits (`npm-pick-manifest`), so a `latest` left on `1.0.0-beta.0` would hold every `^1.0.0-beta.0` install and update there, and a newer package next to it would bring a second `@oddkin/core`. From 1.0.0 on, a prerelease leaves `latest` alone. The registry also lists a `0.0.0-stage` version in each package, "Temporary package placeholder for staged publishing", created with the package; no range used here matches it. A prerelease promises no stability: the freeze (ADR 0029, ADR 0047) starts at 1.0.0. On `main` the versions, the caret internal ranges, and `publishConfig` (`access: public`, `tag: beta`) are set (`node scripts/release/set-versions.mjs --runtime 1.0.0-beta.0 --tools 1.0.0-beta.0 --public`; `--check` confirms them), and the eight packages are no longer `private`.

**Owner commands** (the publish needs the owner's npm account and its two-factor approval; run from a clean checkout of `main`):

```sh
npm ci
node scripts/release/clean.mjs        # every package's dist and TypeScript build info
npm run build
npm run verify:packs                  # tarballs installed outside the workspace; no stale dist module
node scripts/agent-kit/package-kits.mjs --check
node scripts/release/evidence.mjs --out release-evidence/1.0.0-beta.0   # what would be published, with its hashes
node scripts/release/publish.mjs      # dry run of all eight, in dependency order, with --tag beta
npm login                             # with the account's two-factor authentication
node scripts/release/publish.mjs --publish
npm dist-tag ls @oddkin/core          # beta and latest: the new version
git tag v1.0.0-beta.0
git push origin v1.0.0-beta.0
```

`scripts/release/publish.mjs` publishes `tokens`, `core`, `state`, `app`, `components`, `ai`, `analyzer`, and `workbench` in that order (each package's dependencies first), each as `npm publish --workspace packages/<name> --tag beta`, and refuses a package that is private or not public. The `--tag` is passed on the command line because npm 11.19 ignores `publishConfig.tag`: a dry run without it reported "Publishing … with tag latest" (verification.md, 2026-10-27). Then the owner checks a fresh install (`npm install @oddkin/core@beta @oddkin/components@beta` in an empty directory) and announces the `@beta` install line.

`scripts/release/evidence.mjs` records what the checkout would publish in `release-evidence.v0`, an internal format: `evidence.json` and a readable `EVIDENCE.md`. They hold the commit, Node, npm, and the OS; each package's version, tarball integrity, file count, and sizes from one `npm pack --dry-run`; and the SHA-256 of each package's `custom-elements.json`, `oddkin.metadata.json`, `contracts.json`, and `agent/kit.json`. The command makes no network request of its own. It stops when the tree has uncommitted changes; `--allow-dirty` records them instead. A local run lists the checks as not run. CI writes the same files on every run and keeps them as the artifact `release-evidence-<attempt>` for 30 days, together with the Vitest results of the node project and of each engine, the Playwright results, the outcome and time of each step before it, and the change-impact report against the previous commit (`scripts/ci/impact-summary.mjs`). The evidence and the impact report also appear on the run's summary page, and each step adds a one-line annotation there that is readable without signing in.

npm's two-factor check comes once per package: npm prints "Authenticate your account at:" with a link and "Press ENTER to open in the browser...", then waits for the approval on npmjs.com. An approval not given within about 5 minutes ends that publish with `E404 Not Found - GET https://registry.npmjs.org/-/v1/done?authId=***`; both attempts on 2026-10-28 ended that way at the first package, and nothing was published; the owner's own run then published all eight (19:18 to 19:24 UTC). So the owner stays at the browser: eight approvals for the first publish, sixteen for a later beta (each package's publish and its `latest` move, which also needs the check). `publish.mjs` skips a package already on npm at its version only when its packed contents are identical (`npm view <name>@<version> dist.integrity` against `npm pack --dry-run --json`), and a `latest` already moved, so rerunning it after an expired prompt resumes where it stopped. A published version with other contents, or nothing left to do, stops the run, dry run included, with the next step: the versions were not stepped. `npm dist-tag` has no dry run, so a dry run only lists the `latest` moves.

Bin paths are plain `dist/...` paths. npm 11.19 publish rewrites a bin written as `./dist/...` and drops it from the published manifest (`npm warn publish "bin[oddkin-tokens]" script name dist/node/bin.js was invalid and removed`); `verify:packs` fails on such a bin, and the dry run must show no "auto-corrected" or "invalid" line.

Rehearsed on 2026-10-28 from a clean checkout of main (2cc56d3) up to the dry run: `npm ci`, the clean build, `verify:packs`, the kit check, and `publish.mjs` all pass ([verification.md](./verification.md)). Repeated at be7c66d after the bin fix, with `npm run verify:metadata`: all pass, and the dry run shows no npm rewrite.

Later betas: `node scripts/release/set-versions.mjs --next` steps both lines' prerelease number (`1.0.0-beta.0` to `1.0.0-beta.1`; `--next rc` gives `1.0.0-rc.0`; a release version is named with `--runtime` and `--tools`). Then `npm install`, `npm test` (the contract records include the version, so `npm run verify:metadata` fails until the contract tests run again), the §3 checks, the release notes (§1), and the same commands. After the publish, `RELEASED` in `e2e/duplicate-core.spec.ts` names the new version, so a copy of core from the last release keeps running beside the current one. 1.0.0 drops the suffix, publishes under `latest`, and starts the changelogs (§1).
