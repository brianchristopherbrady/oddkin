# Release process

Status: **beta settled by the owner (2026-10-27)**: all eight packages publish as `1.0.0-beta.0` on the `beta` dist-tag under the owner's `@oddkin` npm scope (§5); `main` carries those versions, caret internal ranges, and public access, and no package is `private` any more. Nothing is published yet. Publishing and deployment are the owner's actions; agents prepare and verify, and never publish. The final 1.0.0 versions below are still a proposal.

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
- **Compatible versions.** Any `1.x` runtime packages work together; a minor adds, a patch fixes, and only a major removes or changes a frozen contract (ADR 0029). Two copies of `@oddkin/core` on one page, at any versions, follow core-contracts.md §5.1: DOM protocols and the external-store contract cross copies; readables, scopes, and error handlers do not; nothing compares versions at run time.
- **Schemas and metadata.** `oddkin-metadata.v1`, `theme-config.v1`, the composition schema, `examples.v1`, and the agent kit's `kit.json` carry their own version; an additive field is a minor change of the package that emits it; a breaking change is a new schema version, with the previous one still read for one major (ADR 0029).
- **Deprecation.** A deprecated API keeps working for at least one minor release, reports a development-only diagnostic naming its replacement, and is removed only in the next major, with a migration note in the changelog.
- **Changelogs.** One `CHANGELOG.md` per package, newest first, with *Added*, *Changed*, *Fixed*, *Deprecated*, and *Removed* sections; entries come from the release's rows in [progress-log.md](./progress-log.md) and name the contract id or element they change. The first entry of each package is its first version. No changelog is written for the betas; the first entries come with 1.0.0.

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

Then the owner tags, publishes, and deploys.

## 4. Verified frameworks

The framework fixtures render Oddkin elements through each framework in Chromium, Firefox, and WebKit: properties arrive as values (never attributes), events reach the framework's handlers, form controls bind, and elements defined after the framework rendered upgrade in place. Last verified 2026-10-27 (Chromium 156, Firefox 157, WebKit 27.2; 20 tests per engine):

| Framework | Version | Runtime fixtures | Type checks |
| --- | --- | --- | --- |
| React | 19.3.1 (`react`, `react-dom`) | `packages/components/test/frameworks.browser.test.ts`, `frameworks-forms`, `frameworks-late`; `packages/ai/test/frameworks.browser.test.ts` | `@oddkin/components/frameworks/react` JSX types: `tests/frameworks/react/react.types.tsx` (TypeScript 7.0.2) |
| Vue | 3.5.44 | the same three components files and the AI file | `@oddkin/components/frameworks/vue`: `tests/frameworks/vue/Shell.vue` with vue-tsc 3.3.13 (`strictTemplates`, TypeScript 5.9.3) |
| Svelte | 5.57.2 (runes; `@sveltejs/vite-plugin-svelte` 7.3.1) | `frameworks-svelte`, `frameworks-forms`, `frameworks-late` | `@oddkin/components/frameworks/svelte`: `tests/frameworks/svelte` with svelte-check 4.7.7 |
| Angular | 22.2.3 (JIT, zoneless, `CUSTOM_ELEMENTS_SCHEMA`) | `frameworks-angular`, `frameworks-forms`, `frameworks-late` | None: Angular templates are not type-checked against the elements |

Other versions are not claimed. The fixtures live beside the packages' tests rather than in a separate `integration/` folder; `scripts/check-size.mjs` fails if any measured entry pulls in one of these frameworks.

## 5. Beta release

Settled by the owner (2026-10-27): all eight packages publish as `1.0.0-beta.0` on the `beta` dist-tag under the owner's `@oddkin` scope. `--tag beta` leaves `latest` alone, so users opt in with `npm install @oddkin/core@beta`. A prerelease promises no stability: the freeze (ADR 0029, ADR 0047) starts at 1.0.0. On `main` the versions, the caret internal ranges, and `publishConfig` (`access: public`, `tag: beta`) are set (`node scripts/release/set-versions.mjs --runtime 1.0.0-beta.0 --tools 1.0.0-beta.0 --public`; `--check` confirms them), and the eight packages are no longer `private`.

**Owner commands** (the publish needs the owner's npm account and its two-factor approval; run from a clean checkout of `main`):

```sh
npm ci
node scripts/release/clean.mjs        # every package's dist and TypeScript build info
npm run build
npm run verify:packs                  # tarballs installed outside the workspace; no stale dist module
node scripts/agent-kit/package-kits.mjs --check
node scripts/release/publish.mjs      # dry run of all eight, in dependency order, with --tag beta
npm login                             # with the account's two-factor authentication
node scripts/release/publish.mjs --publish
npm dist-tag ls @oddkin/core          # beta: 1.0.0-beta.0
git tag v1.0.0-beta.0
git push origin v1.0.0-beta.0
```

`scripts/release/publish.mjs` publishes `tokens`, `core`, `state`, `app`, `components`, `ai`, `analyzer`, and `workbench` in that order (each package's dependencies first), each as `npm publish --workspace packages/<name> --tag beta`, and refuses a package that is private or not public. The `--tag` is passed on the command line because npm 11.19 ignores `publishConfig.tag`: a dry run without it reported "Publishing … with tag latest" (verification.md, 2026-10-27). Then the owner checks a fresh install (`npm install @oddkin/core@beta @oddkin/components@beta` in an empty directory) and announces the `@beta` install line.

npm's two-factor check comes once per package: npm prints "Authenticate your account at:" with a link and "Press ENTER to open in the browser...", then waits for the approval on npmjs.com. An approval not given within about 5 minutes ends that publish with `E404 Not Found - GET https://registry.npmjs.org/-/v1/done?authId=***`; both attempts on 2026-10-28 ended that way at the first package, and nothing was published. So the owner stays at the browser for eight approvals. `publish.mjs` skips a package already on the registry at its version, so rerunning it after an expired prompt resumes where it stopped.

Bin paths are plain `dist/...` paths. npm 11.19 publish rewrites a bin written as `./dist/...` and drops it from the published manifest (`npm warn publish "bin[oddkin-tokens]" script name dist/node/bin.js was invalid and removed`); `verify:packs` fails on such a bin, and the dry run must show no "auto-corrected" or "invalid" line.

Rehearsed on 2026-10-28 from a clean checkout of main (2cc56d3) up to the dry run: `npm ci`, the clean build, `verify:packs`, the kit check, and `publish.mjs` all pass ([verification.md](./verification.md)). Repeated at be7c66d after the bin fix, with `npm run verify:metadata`: all pass, and the dry run shows no npm rewrite.

Later betas: `set-versions.mjs` with the next prerelease number (`1.0.0-beta.1`), `npm install`, the §3 checks, and the same commands. 1.0.0 drops the suffix, publishes under `latest`, and starts the changelogs (§1).
