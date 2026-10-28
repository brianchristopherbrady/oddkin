# Release process

Status: **proposed for the owner to settle** (plan M12; Agent 3, 2026-10-27). Nothing is published. Every package is version `0.0.0` and `private: true`. Publishing, the npm scope, and deployment are the owner's decisions and actions; agents prepare and verify, and never publish.

## 1. Proposed v1 versioning

Each package has its own version and changelog (semantic versioning). The v1 cut ([IMPLEMENTATION_PLAN.md](../IMPLEMENTATION_PLAN.md) §11) decides which contracts are frozen; the versions follow it:

| Package | First version | Why |
| --- | --- | --- |
| `@oddkin/tokens` | 1.0.0 | Token names, the theme schema (`theme-config.v1`), CSS custom properties, and the CLI are the CSS-only path's contract |
| `@oddkin/core` | 1.0.0 | The authoring contracts published in `CONTRACTS.md` (stable ids) |
| `@oddkin/components` | 1.0.0 | Tag names, attributes, properties, events, slots, parts, CSS properties, custom states, and the `define/*` entries in `custom-elements.json` |
| `@oddkin/ai` | 1.0.0 | As components, for the AI elements |
| `@oddkin/state`, `@oddkin/app` | 1.0.0 | Stores, context, persistence, resources, commands, router, and app roots (core-contracts.md §7–§9) |
| `@oddkin/analyzer`, `@oddkin/workbench` | 0.1.0 | Their completion (plan M11, §5c, §5d) follows v1; their config, frame protocol, and page contracts are still moving, so a 0.x minor may break them |

- **Internal ranges.** Workspace packages depend on each other with caret ranges of the released version (`"@oddkin/core": "^1.0.0"`), never `*` or an exact pin. Today every internal dependency is the exact `0.0.0`; the release step replaces them (`scripts/release/set-versions.mjs`, §5).
- **Compatible versions.** Any `1.x` runtime packages work together; a minor adds, a patch fixes, and only a major removes or changes a frozen contract (ADR 0029). Two copies of `@oddkin/core` on one page, at any versions, follow core-contracts.md §5.1: DOM protocols and the external-store contract cross copies; readables, scopes, and error handlers do not; nothing compares versions at run time.
- **Schemas and metadata.** `oddkin-metadata.v1`, `theme-config.v1`, the composition schema, `examples.v1`, and the agent kit's `kit.json` carry their own version; an additive field is a minor change of the package that emits it; a breaking change is a new schema version, with the previous one still read for one major (ADR 0029).
- **Deprecation.** A deprecated API keeps working for at least one minor release, reports a development-only diagnostic naming its replacement, and is removed only in the next major, with a migration note in the changelog.
- **Changelogs.** One `CHANGELOG.md` per package, newest first, with *Added*, *Changed*, *Fixed*, *Deprecated*, and *Removed* sections; entries come from the release's rows in [progress-log.md](./progress-log.md) and name the contract id or element they change. The first entry of each package is its first version. No changelog is written before the owner settles the versions.

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
- [x] No `src/` or `test/` file in a tarball; no third-party runtime dependency outside Node-only tooling.
- [ ] Versions, internal caret ranges, and changelogs as in §1, after the owner settles them (`scripts/release/set-versions.mjs` sets the versions and ranges, §5).
- [ ] `private: true` removed from the published packages, after the owner confirms the `@oddkin` npm scope.

Verification (results recorded in [verification.md](./verification.md), by owner of each failure):

- [ ] `npm run build`, `npm run lint`, `npm run typecheck`, and the node project.
- [ ] The browser project per engine with `--no-file-parallelism` (the full parallel run is deferred by the owner, 2026-10-27), and `npm run test:e2e`.
- [ ] `npm run verify:metadata`, `npm run size`, `npm run verify:packs`, the packed consumers (`e2e/packed-consumers.spec.ts`, `e2e/components-only.spec.ts`, `e2e/autoload.spec.ts`), and `npm run compat` with the floor probe (`npm run compat:floor`).
- [ ] The browser floor re-resolved and the matrix regenerated ([compatibility/matrix.md](./compatibility/matrix.md)); Safari 18.2 and screen-reader evidence recorded as limitations until a macOS host and assistive technology are available.
- [ ] `oddkin-impact` against the previous release once there is one, with the semver impact reviewed.
- [ ] The framework fixtures pass in three engines and §4 names the versions they ran against.

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

The owner's direction (2026-10-27) puts a published beta first. Proposed: §1's versions as prereleases, `1.0.0-beta.0` for the runtime packages and `0.1.0-beta.0` for the analyzer and Workbench, published under the `beta` dist-tag. Publishing with `--tag beta` leaves `latest` alone, so users opt in with `npm install @oddkin/core@beta`. A prerelease promises no stability: the freeze (ADR 0029, ADR 0047) starts at 1.0.0.

The owner publishes; agents prepare and verify:

1. Set the versions: `node scripts/release/set-versions.mjs --runtime 1.0.0-beta.0 --tools 0.1.0-beta.0`, then `npm install` for the lockfile. Internal dependencies become caret ranges (`^1.0.0-beta.0` accepts later betas and every `1.x`), and each manifest gets `publishConfig` with public access. `--check` reports a package that is not at the requested versions.
2. Build from nothing: `node scripts/release/clean.mjs` (every package's `dist` and TypeScript build info), then `npm run build` and the §3 verification. `npm run verify:packs` installs the tarballs with their real versions and rejects one that would publish a `dist` module whose source is gone; the agent kits and metadata carry the package version.
3. The owner confirms the `@oddkin` scope and removes `private: true` from the eight packages.
4. Publish in dependency order, each with `--dry-run` first: `npm publish --workspace packages/<name> --tag beta` for `tokens`, `core`, `state`, `app`, `components`, `ai`, `analyzer`, `workbench`. The `--tag` is required: npm 11.19 ignores a `tag` in `publishConfig` and would publish the beta as `latest` (seen in the dry run, below); `publishConfig` supplies the public access.
5. Tag the commit (`v1.0.0-beta.0`) and announce the install line (`@beta`). Later betas repeat steps 1–5 with the next prerelease number; 1.0.0 drops the suffix, publishes under `latest`, and starts the changelogs (§1).

**Trial (2026-10-27, in a worktree, then reverted):** steps 1, 2, and 4 as dry runs with `1.0.0-beta.0` / `0.1.0-beta.0`. The clean build, `verify:packs`, and the kit check pass, and all eight packages would publish (27–732 kB each; [verification.md](./verification.md)). Before step 1 lands on `main`: five Workbench and agent-kit tests that expect `0.0.0` read the manifests instead, and the metadata's `oddkinVersion` follows the analyzer's version (Agent 2). The owner's `npm login` (with two-factor authentication, if enabled on the account) is needed for step 4.
