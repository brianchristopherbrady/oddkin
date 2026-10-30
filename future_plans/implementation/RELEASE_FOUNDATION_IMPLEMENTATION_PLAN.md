# Release foundation implementation plan

Status: proposed (Agent 1, 2026-10-29). Planning only: nothing here is implemented by this document, and no version, `private` flag, license, or publish state changes because of it.

Scope: [TECHNICAL_COMMERCIALIZATION_PLAN.md](../TECHNICAL_COMMERCIALIZATION_PLAN.md) Workstream A, "Release foundation", and Milestone T0's release items; [COMMERCIAL_READINESS_SCORECARD.md](../COMMERCIAL_READINESS_SCORECARD.md) Gate A, "Public technical preview".

Evidence base: `main` on 2026-10-29 (the commit that adds this file), the eight package manifests and READMEs, `docs/release-process.md`, `docs/verification.md`, `docs/progress-log.md`, `IMPLEMENTATION_PLAN.md`, the npm registry (`npm view @oddkin/core dist-tags`: `beta` and `latest` are `1.0.0-beta.0`), and GitHub CI run 40945402821 at `6486921`.

**Classes used throughout:**

- **Verified:** implemented and currently verified.
- **Verify:** implemented, with verification remaining.
- **Partial:** partially implemented.
- **Planned:** not started.
- **Owner:** blocked by an owner decision.
- **Stale:** stale documentation.
- **Unknown:** requires investigation.

## Where this plan departs from its sources

The owner's original commercialization documents (commit `cdad50c`) were written against an older state. They said the packages "remain private and versioned `0.0.0`" and asked that "preview versions replace `0.0.0`" (Gate A). In fact all eight packages have been public on npm at `1.0.0-beta.0` since 2026-10-28, by the owner's decision of 2026-10-27 ([release-process.md](../../docs/release-process.md) §5). This plan therefore starts from a published beta, not from private packages. The technical documents in `future_plans/` have since been rewritten to match the repository (Appendix A). Two consequences remain:

- The "public package cut" is no longer about what is installable: all eight are published. npm allows unpublishing a version within 72 hours (beta.0's window closes on 2026-10-31), and later only under narrow conditions, and unpublishing working packages would break installs. The cut is now about support tiers and messaging (§4).
- The original technical plan recommended `@oddkin/workbench` "as `0.x`". It is published as `1.0.0-beta.0`, and every `0.x` version sorts below that, so the version line is an owner decision (§5, D-2).

Appendix A records the audit of the original documents and what replaced them.

## 1. Executive objective

Make the published Oddkin packages safe and honest to evaluate outside this repository. That means:

- statuses, support statements, and limitations that match the shipped artifacts;
- one reproducible release procedure that ends in a downloadable evidence bundle;
- installation proven from the registry by a repository that knows nothing about this one;
- a publishing path that does not depend on one person approving sixteen prompts.

The work stops at Gate A. It adds no components, no product-pattern contracts, and no hosted infrastructure.

## 2. Current-state audit

| Capability | Class | Evidence | Gap |
| --- | --- | --- | --- |
| Eight packages published, public, `1.0.0-beta.0` | Verified | Manifests (no `private`, `publishConfig` `{access: public, tag: beta}`); `npm view @oddkin/core dist-tags` 2026-10-29 | None |
| Public package cut and messaging | Owner | Owner decision 2026-10-27 (all eight); the original technical plan recommended a narrower set and Workbench as `0.x` | Support tiers and messaging (D-1, D-2) |
| Version stepping (`set-versions --next`, `--check`) | Verify | Rehearsed and reverted on 2026-10-29 (plan P0.8); beta.1 not cut | A real cut (RF-15) |
| `latest` follows betas | Verified | `publish.mjs` moves `latest`; registry shows `latest` = `1.0.0-beta.0` | None |
| Manifest hygiene: exports, `types`, `files`, `sideEffects`, license, `customElements`, bins | Verified | `npm run verify:packs` passed in CI run 40945402821 (2026-10-29); rules in `scripts/verify-packs.mjs` lines 53–93, 216–224 | `homepage`, `bugs`, and `keywords` are absent (RF-06) |
| Every export imports in Node | Verified | `verify-packs.mjs` imports every specifier, including `define/*`, in Node 24 | Only Node 24 is tested (RF-05) |
| No third-party runtime dependency; no lifecycle scripts | Verified | `verify-packs.mjs` "unexpected runtime dependencies"; no `install`/`prepare` scripts in any manifest | None |
| Packed-consumer matrix from tarballs | Verified | CI e2e at `6486921`: 1,014 passed, 12 skipped (fresh Vite, React, Vue, Svelte, and Angular apps, the golden path, and the packed consumers) | §11 gaps |
| Installation from the registry | Verify | `ODDKIN_CONSUMERS_FROM=beta`: fresh apps 15/15 and golden path 15/15, locally, 2026-10-29; `registry-smoke.yml` exists | No GitHub run yet (weekly, Mondays) |
| Independent external repository | Planned | Every consumer lives in this repository | RF-11 |
| Changelogs | Planned | Policy: per-package changelogs from 1.0.0 (release-process §1) | Intentional until 1.0.0 |
| Release notes for betas | Partial | Owner decision 2026-10-29; [docs/releases/1.0.0-beta.1.md](../../docs/releases/1.0.0-beta.1.md) is a draft | Known issues, upgrade steps (RF-08) |
| Root README status | Verify | Says eight packages at `1.0.0-beta.0`, 54 + 24 elements; metadata agrees (54, 24) | Other root README lines are stale (§7) |
| Package README statuses | Stale | `tokens` "M2 in progress", `components` "M4 in progress … four elements", `state` "M6 in progress", `ai` "Depends on … core … components" (now peers) | RF-01, RF-02 |
| Browser support statement | Verify | README floor (Chrome/Edge 130, Firefox 132, Safari 18.2); matrix checked 2026-10-26 | Safari on hardware and screen readers unverified; floor re-resolve before 1.0.0 (release-process §3) |
| Node support statement | Partial | `engines: node >=24.12` on `tokens`, `analyzer`, `workbench`, and the root; README "Node.js 24.12 or newer" | Runtime packages state nothing; only Node 24 tested (RF-04, RF-05) |
| Framework support | Verified | release-process §4 (React 19.3.1, Vue 3.5.44, Svelte 5.57.2, Angular 22.2.3), fresh apps (2026-10-29) | Version ranges beyond those pins are not claimed |
| TypeScript versions | Partial | Declarations compile under 7.0.2 (vite-ts, React), 6.0.3 (Angular app), 5.9.3 (vue-tsc, §4) | No stated range (RF-04) |
| Package managers | Partial | npm 11 tested everywhere; release-process §1 tells Yarn users to add peers | pnpm and Yarn untested (RF-05) |
| Duplicate core and versions | Verified | `e2e/duplicate-core.spec.ts` with consumer A on the published `1.0.0-beta.0`, 30/30 (2026-10-29); core-contracts.md §5.1 | The `[core.copies]` warning starts with beta.1 (beta.0 predates it) |
| Tag-name collisions | Verified | release-process §2; `registry.collision` in the same spec | Scoped registries unsupported (documented) |
| Realms (same-origin frames) | Verified | `e2e/realms.spec.ts` 12/12 (2026-10-29) | `window.open` windows untested |
| Upgrade and deprecation policy | Partial | release-process §1 (written as a proposal); ADR 0047 status "Proposed" | Owner approval (D-3); beta-to-beta upgrade notes |
| Workbench frame protocol and share links | Verify | release-process §1 (2026-10-29) states the code's rules | A released share link opened by the current Workbench (Agent 2) |
| Metadata current | Verified | `npm run verify:metadata` in CI run 40945402821 | None |
| Agent kits current and matching the tarball | Verified | `package-kits.mjs --check` current (2026-10-29); `verify-packs` checks each kit's version and metadata hash | Kits exist for `components` and `ai` only (by design); no consumer kit command (P0.5 step 5) |
| Size budgets | Verified | `npm run size` in CI run 40945402821 | None |
| Compatibility matrix | Verified | `lint:css` enforces it; regenerated with each CSS change (last 2026-10-29) | Re-resolve the floor before 1.0.0 |
| Serial per-engine browser runs | Verify | CI runs the browser project per engine with `--no-file-parallelism`; at `6486921` they fail only on `packages/workbench/test/coverage.browser.test.ts` (HTTP 404, Agent 2) | A green run (P0.6) |
| Parallel-run limitation documented | Verified | release-process §3 ("the full parallel run is deferred by the owner, 2026-10-27") | The README's `npm test` line does not say so (§7) |
| Release evidence bundle | Planned | CI uploads Playwright reports only on failure; `verification.md` is written by hand | RF-09, RF-10 |
| Impact report against the previous release | Planned | `oddkin-impact snapshot` and `compare` exist; release-process §3 leaves this unticked "once there is one", and there is one now | RF-07 |
| Accessibility claims | Stale | The components manifest says "Accessible, themed custom elements"; screen-reader evidence is absent (release-process §3, ADR 0047); the owner runs their own accessibility flow (plan P1.4) | RF-03 |
| Error messages with a corrective action | Unknown | Analyzer diagnostics carry a suggestion; core and Workbench codes have messages; never audited | RF-19 |
| Docs distinguish implemented from planned | Unknown | The docs site has a Roadmap page from milestone counts; no hosted capability exists | RF-17 |
| npm trusted publishing and provenance | Planned | `publish.mjs` runs on the owner's machine with npm's web 2FA prompt per package (16 per beta) | RF-12 |
| Security policy and supply-chain hygiene | Partial | Workflow `permissions: contents: read`; no `SECURITY.md`, no Dependabot, actions pinned by tag, not by commit | RF-13 |

## 3. Package-by-package readiness matrix

The contract column comes from ADR 0047 (proposed). Every package has `MIT`, a `LICENSE`, a README, `type: module`, and `repository.directory`. Each row's hygiene is checked by `verify-packs` on the tarball.

| Package | Published | Exports | `sideEffects` | `customElements` / metadata | Kit | Candidate v1 contract (ADR 0047) | README status | Main gaps | Proposed tier (§4) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `@oddkin/core` | `1.0.0-beta.0` | 29 (`types`, `development`, `default`) | `false` | `CONTRACTS.md`, `contracts.json` | — | Yes: 16 contract sections | Current | — | Primary |
| `@oddkin/tokens` | `1.0.0-beta.0` | 12, bin `oddkin-tokens` | `false` | inspection JSON, schema | — | Yes: `theme-config.v1`, token names, layers | **Stale** ("M2 in progress") | `engines` only on this tooling side | Primary |
| `@oddkin/components` | `1.0.0-beta.0` | 192 (`types`, `default`) | `define` entries | `custom-elements.json`, `oddkin.metadata.json` (54 elements) | `agent/` | Yes: elements per CEM | **Stale** ("M4 in progress", four elements) | Accessibility wording | Primary |
| `@oddkin/ai` | `1.0.0-beta.0` | 62 | `define` entries | CEM and metadata (24 elements) | `agent/` | Yes (as components) | **Stale** dependency sentence | Real-endpoint streaming example (P0.4) | Primary, optional |
| `@oddkin/state` | `1.0.0-beta.0` | 6 | `false` | — | — | Yes: core-contracts §7 | **Stale** ("M6 in progress") | Independent adoption story | Optional |
| `@oddkin/app` | `1.0.0-beta.0` | 7 | `false` | — | — | Yes: core-contracts §8–§9 | Lists milestones per entry | Independent adoption story | Optional |
| `@oddkin/analyzer` | `1.0.0-beta.0` | 3 (`.`, `./impact`), bins `oddkin-analyze`, `oddkin-impact` | `false` | — | — | Outputs only (CEM 2.1.0, `oddkin-metadata.v1`, `diagnostic.v1`); CLI and impact formats not frozen | Current (states what is not frozen) | Bundles TypeScript 5.9.3 exactly | Tooling preview |
| `@oddkin/workbench` | `1.0.0-beta.0` | 20, bin `oddkin` | five registration files | — | — | No: configuration, page registry, frame protocol, share payload not frozen | Current (states not frozen) | Consumer path, fixtures, Theme Studio flow, watch mode (P0.3); depends on runtime packages as `dependencies`, not peers | Tooling preview |
| `@oddkin/docs` (app) | private `0.0.0` | — | — | — | — | — | — | — | Private |

## 4. Proposed public preview package cut

All eight stay published; the cut assigns a support tier and a place in the messaging. This needs the owner's decision (D-1).

- **Primary, preview-supported:** `@oddkin/core`, `@oddkin/tokens`, `@oddkin/components`. These are the CSS-only path, the authoring model, and the elements. The quick start and README lead with them.
- **Primary, optional:** `@oddkin/ai`, presented as an add-on to components, not as the entry point.
- **Tooling preview:** `@oddkin/analyzer` and `@oddkin/workbench`. Their outputs and documentation are evaluable, but their own contracts are not frozen. Their READMEs already say so (ADR 0047).
- **Optional, secondary in messaging:** `@oddkin/state` and `@oddkin/app`. They stay published (consumers already install them) but are not featured until an independent adoption path is documented, as the technical plan asks.
- **Private:** the docs app and the workspace root.

Why not narrow by unpublishing: installs already resolve these versions, and npm's 72-hour unpublish window for beta.0 closes on 2026-10-31. Deprecating packages that work would confuse more than it clarifies.

## 5. Versioning and prerelease strategy

- **Keep one beta line for all eight** (`1.0.0-beta.N`). `set-versions.mjs` already keeps a runtime line and a tools line and steps both with `--next`. Recommended answer to D-2: Workbench and the analyzer stay on this line. Their READMEs and the release notes state that their contracts are not frozen.
- **Why not `0.x` for Workbench:** `0.x` sorts below `1.0.0-beta.0`. Moving `latest` backwards and deprecating the beta would make `npm install @oddkin/workbench` resolve an older-looking version. The docs app and the golden-path site depend on `^1.0.0-beta.0`.
- **Sequence:** `1.0.0-beta.1` (P0.8), further betas while Gate A closes, then `1.0.0-rc.0` once the owner settles ADR 0047, then `1.0.0`. Contracts freeze at 1.0.0 (ADR 0029, 0047).
- **Dist-tags:** `beta` and `latest` both move to each beta until a package has a stable version (owner, 2026-10-28; `publish.mjs`).
- **Betas promise no stability,** but every breaking change between betas is named in the release notes with its upgrade step (RF-08). The impact report (RF-07) lists the contract changes.
- **This plan changes no version.** RF-15 prepares the cut; the owner runs it.

## 6. Manifest, export, files, side-effect, license, and `customElements` requirements

| Requirement | Current | Enforced by | Class | Task |
| --- | --- | --- | --- | --- |
| `license: MIT` and a `LICENSE` file in each tarball | All eight | `verify-packs.mjs` (line 78, hygiene loop) | Verified | — |
| `README.md` in each tarball | All eight | `verify-packs.mjs` | Verified | RF-01 for content |
| `type: module` | All eight | `verify-packs.mjs` line 80 | Verified | — |
| `sideEffects` declared (`false` or the registering files) | All eight | `verify-packs.mjs` line 81 | Verified | — |
| Every JavaScript export has `types` | All eight | `verify-packs.mjs` lines 87–89 | Verified | — |
| Every export imports from the installed tarball | All eight, in Node 24 | `verify-packs.mjs` (`runtime.mjs`) | Verified | — |
| `files` excludes `src/` and `test/`; no stale `dist` module | All eight | `verify-packs.mjs` lines 53–65 | Verified | — |
| `customElements` names a manifest that resolves | `components`, `ai` | `verify-packs.mjs` lines 216–224 | Verified | — |
| `repository.directory` | All eight | `verify-packs.mjs` lines 82–83 | Verified | — |
| `bin` paths without `./` (npm 11 drops them) | `tokens`, `analyzer`, `workbench` | `verify-packs.mjs` lines 90–93 | Verified | — |
| `engines` | Tools only | none | Partial | RF-04 decides whether runtime packages state one |
| Peer dependencies keep one core per install | `components`, `state`, `app`, `ai` | `tests/architecture/single-core.test.ts` | Verified | — |
| `homepage`, `bugs`, `keywords` | Absent | none | Planned | RF-06 |
| `publishConfig` `{access: public, tag: beta}` | All eight | `set-versions.mjs --check` | Verified | — |
| Provenance on published versions | None | — | Planned | RF-12 |

## 7. Documentation and status reconciliation

Corrections come from generated or verified facts: manifests, metadata, `bin` maps, and CI. Owners: Agent 3 for README accuracy, Agent 1 for release and core lines.

| File | Statement | Fact | Class |
| --- | --- | --- | --- |
| `packages/tokens/README.md` | "**Status:** M2 in progress." | Published beta; the generator, CLI, and outputs ship | Stale |
| `packages/components/README.md` | "**Status:** M4 in progress. Implemented: `odd-button`, `odd-card`, `odd-input`, `odd-side-nav`." | 54 elements in `oddkin.metadata.json` | Stale |
| `packages/state/README.md` | "**Status:** M6 in progress." | Published beta | Stale |
| `packages/ai/README.md` | "Depends on `@oddkin/core`, `@oddkin/tokens`, and `@oddkin/components`." | `core` and `components` are peers (P0.2); `tokens` a dependency | Stale |
| `README.md` | Command-line tools include "`oddkin-agent`" | No package has that `bin` (`@oddkin/agent` is skipped) | Stale |
| `README.md` | Examples: `plain-html`, `tokens-css-only`, `core-counter`, `components-only`, `css-gallery`, `binding-rule` | `examples/` holds 19 directories (also `full-app`, `autoload`, `router`, `forms`, `side-nav`, …) | Stale |
| `README.md` | "`npm run build` # TypeScript project build (`tsc -b`)" | The build also writes metadata, CSS, contracts, and kits | Stale |
| `README.md` | "`docs/schemas/` Draft JSON Schemas (move into their packages in M3/M5)" | `docs/schemas/` still holds the v1 schemas (agent kit, diagnostics, examples, impact, …); `components` and `ai` have their own `schemas/`. Whether the rest move is undecided | Unknown |
| `README.md` | `npm test` without the parallel-run limitation | release-process §3 records it | Partial |
| ADR 0047 | "released versions side by side wait for a release" | Done 2026-10-29 (`duplicate-core.spec.ts`, consumer A on beta.0) | Stale |
| `future_plans/*` | See Appendix A | — | Stale |

Mechanism: RF-01 corrects the text once, and RF-02 adds a lint check so the drift cannot return.

## 8. Changelog and release-note plan

- **Betas:** release notes, decided by the owner on 2026-10-29: `docs/releases/<version>.md`, from the progress-log rows since the previous release. The beta.1 draft exists. RF-08 adds "Known issues", "Upgrading", and the impact report's summary.
- **1.0.0:** one `CHANGELOG.md` per package with Added, Changed, Fixed, Deprecated, and Removed sections, per release-process §1. Entries come from the same rows and name the contract id or element they change.
- **GitHub Releases:** the owner pastes each release's notes into a GitHub Release with the evidence bundle attached (RF-10; D-11 decides whether release assets are used).
- **Helper (optional):** `scripts/release/notes.mjs` lists the progress-log rows and commits since the last tag, so the notes start from facts.

## 9. Compatibility, upgrade, and deprecation policies

- **Written:** release-process §1 covers compatible `1.x` runtime packages, internal caret ranges, one copy of core per install, schema versioning (the previous schema read for one major), deprecation (one minor at least, a development diagnostic, removal in a major), and since 2026-10-29 the Workbench frame-protocol and share-link rules. Class: Partial, because §1 is titled "Proposed v1 versioning" and ADR 0047 is "Proposed" (D-3).
- **Verified across versions:** core copies at different versions (`duplicate-core.spec.ts` with the published beta.0) and frames as other realms.
- **To add:** a beta upgrade section in each release note (RF-08). The impact report against the previous release (RF-07) is the evidence that a change is or is not breaking. `RELEASED` in `e2e/duplicate-core.spec.ts` moves with each publish (release-process §5).
- **Not in scope:** freezing Workbench or analyzer contracts. They stay outside the 1.0.0 freeze (ADR 0047).

## 10. Browser, Node, framework, duplicate-version, and tag-collision support

| Area | Statement today | Evidence | Limitation to publish | Class |
| --- | --- | --- | --- | --- |
| Browsers | Chrome and Edge 130, Firefox 132, Safari 18.2 and later (README; ADR 0009) | Matrix checked 2026-10-26; floor probe 16/16 in Chrome 130 and Firefox 132 (2026-10-27); every browser test in Chromium, Firefox, and WebKit | Safari tested through Playwright WebKit only; no screen-reader evidence | Verify |
| Node (tools) | 24.12 or newer (`engines`) | CI and local runs on Node 24 | Older Node untested | Verified for 24 |
| Node (runtime packages) | Not stated | Every export imports in Node 24 (`verify-packs`) | No statement for server-side rendering or DOM-free use | Partial |
| TypeScript | Not stated | 7.0.2, 6.0.3, and 5.9.3 compile the declarations (§2) | No range promised | Partial |
| Frameworks | release-process §4 versions | Framework fixtures in three engines; fresh apps 2026-10-29 | Only the pinned versions | Verified |
| Package managers | npm; Yarn advice | npm 11 | pnpm and Yarn untested | Partial |
| Bundlers | Not stated | Vite 8.3, esbuild, the Angular CLI's builder, import maps | webpack and Rspack untested | Partial |
| Duplicate versions | core-contracts §5.1 | `duplicate-core.spec.ts` (one version twice; beta.0 beside current) | The copy list starts with beta.1 | Verified |
| Tag collisions | release-process §2 | `registry.collision` tests | Scoped registries unsupported | Verified |

RF-04 gathers these into one public support policy with each limitation stated. RF-05 adds evidence for any range the owner wants to claim beyond what is tested.

## 11. Packed-consumer and external-installation matrix

| Consumer | What it proves | Tarballs | Registry (`ODDKIN_CONSUMERS_FROM`) | Where |
| --- | --- | --- | --- | --- |
| `css-only` | the installed `oddkin-tokens` CLI builds a theme | CI e2e | Not recorded | `scripts/packed-consumers.mjs` |
| `css-recipes` | theme and recipe CSS, no script | CI e2e | Not recorded | same |
| `core-only` | core alone | CI e2e | Not recorded | same |
| `components-only` | components under a strict CSP | CI e2e | Not recorded | same |
| `full-app` | router, state, form, AI element | CI e2e | Not recorded | same |
| `autoload` | the optional autoloader | CI e2e | Not recorded | same |
| `vite-ts`, `react`, `vue`, `svelte` | fresh projects with their own build tools and type checks | CI e2e | 15/15 local, 2026-10-29 | `tests/consumers/` |
| `angular` | Angular CLI, AOT, TypeScript 6.0.3 | CI e2e | 15/15 local, 2026-10-29 | `tests/consumers/angular` |
| `golden-path` | a library through theme, analysis, Workbench site, and an app | CI e2e | 15/15 local, 2026-10-29 | `tests/golden-path/` |
| `verify-packs` consumer | every export, types, framework typings, CLIs | CI | — | `scripts/verify-packs.mjs` |
| duplicate core, released | published beta.0 beside the current packages | CI e2e (from `952b74b`) | always registry for consumer A | `examples/duplicate-core` |

Gaps, all Planned or Unknown:

- the GitHub registry-smoke run (Unknown until its first run);
- pnpm and Yarn, webpack, Rspack, Next.js, and other SSR hosts (Planned only if the support policy claims them);
- Windows and macOS CI hosts (Unknown: CI is Linux and local runs are Windows);
- Safari on hardware (Planned: needs a macOS host);
- an independent repository (§12).

## 12. Independent external fixture repository

- **Why:** Workstream A's exit asks that "an unrelated repository can install packed or preview packages and complete the documented quick start" with "no workspace aliases or unpublished sources". Every fixture today lives in this repository and is written by the people who wrote the packages.
- **Proposal:** a small public repository owned by the owner (D-6), for example `oddkin-quickstart`. It holds:
  - the documented quick starts copied verbatim from the docs site: CSS only, plain HTML with an import map, Vite and TypeScript;
  - one framework app;
  - a CI workflow that installs `@oddkin/*@beta` (or a version passed in) and builds and tests in three engines with Playwright.
  - It runs weekly, and after each publish through a manual dispatch from this repository's release step.
- **Rules:** no file copied from this repository except what the docs tell a user to copy; no reference to workspace paths; failures go to the owner and Agent 1.
- **Interim:** the registry smoke (`registry-smoke.yml`) runs the in-repository fixtures against the registry.

## 13. Generated metadata and agent-kit release synchronization

Order at a release cut (release-process §5, with the 2026-10-29 additions):

1. `set-versions.mjs --next` (owner-approved cut).
2. `npm install` (lockfile).
3. `npm run build`, which regenerates metadata, contracts, and both packages' kits with the version.
4. `npm test`: the contract records carry the version, so `verify:metadata` fails until they are rerun.
5. `npm run verify:metadata`.
6. `node scripts/agent-kit/package-kits.mjs --check`.
7. `npm run verify:packs`, which checks each kit's library version and the packed metadata's hash.

Gaps:

- No consumer-facing kit command (P0.5 step 5, Agent 2). A team cannot regenerate a kit for its own library from installed packages.
- `llms.txt` ships inside `agent/` of `components` and `ai`. Whether the docs site also serves one is Agent 2's P0.4 item.

The evidence bundle (§14) records each package's metadata and kit hashes, so the published artifacts can be compared with what was verified.

## 14. Release evidence bundle

One directory per release candidate, generated, never edited by hand.

| File | Contents | Source |
| --- | --- | --- |
| `evidence.json` | Schema id (`release-evidence.v0`, internal until Workstream C); commit and dirty state; Node, npm, and OS; each package's name, version, tarball integrity (sha512), file count, unpacked size, metadata and kit hashes | `git`, `npm pack --dry-run --json`, manifests |
| `EVIDENCE.md` | A readable summary of the same, with the verification results and known limitations | generated |
| `results/` | Per-step outcomes: build, lint, typecheck, node project, browser project per engine (counts), e2e (counts, skips), `verify:metadata`, size, `verify:packs`, registry smoke | JUnit or JSON reporters (RF-10) |
| `impact-report.md`, `.json` | Changes against the previous release | `oddkin-impact` (RF-07) |
| `sbom.json` | CycloneDX or SPDX SBOM | `npm sbom` (npm 11) |
| `release-notes.md` | The release's notes | `docs/releases/<version>.md` |

Where:

- locally, under `release-evidence/<version>/` (git-ignored);
- in CI, as an artifact of the run that verified the candidate (RF-10);
- with the owner's approval, as GitHub Release assets (D-11).

Version 0 (2026-10-29) writes `evidence.json` and `EVIDENCE.md`; in CI, also `results/` (the Vitest and Playwright JSON reports) and `impact/` (the report against the previous commit, not yet against the previous release). The other steps' outcomes and times come from the GitHub API rather than from `results/`. Not yet: the SBOM, the release notes, and the registry smoke.

## 15. npm scope and trusted-publishing setup

- **Today:**
  - The owner owns the `@oddkin` scope.
  - `scripts/release/publish.mjs` publishes in dependency order with `--tag beta` from a clean checkout on the owner's machine, and moves `latest`.
  - npm's web two-factor prompt comes once per publish and once per `latest` move: 16 approvals for a later beta. An approval not given within about five minutes ends that publish (release-process §5).
  - Nothing carries provenance.
- **Plan (RF-12, D-5):** npm trusted publishing, where GitHub Actions authenticates through OIDC and npm records provenance. The work:
  - configure each package's trusted publisher on npmjs.com (owner);
  - add a `release.yml` workflow with `id-token: write`, started by the owner (workflow dispatch, or a pushed tag);
  - give `publish.mjs` a CI mode.
- **Open question:** trusted publishing covers `npm publish`, but moving `latest` with `npm dist-tag add` may still need an authenticated token. Keep the manual `latest` step until that is verified.
- **Rollback:** the local `publish.mjs` path stays documented and working.

## 16. CI and verification sequence

**Every push to `main` (exists, `ci.yml`):** `npm ci`, Playwright install, lint, typecheck, build, node project, browser project per engine with `--no-file-parallelism`, `verify:metadata`, size, e2e, `verify:packs`, the change-impact report against the previous commit (CF.2), and the evidence artifact (RF-10). To add:

- an `npm audit --omit=dev` report, kept informational at first (RF-13).

**Release candidate, from a clean checkout:**

1. `npm ci`
2. `node scripts/release/clean.mjs`
3. `npm run build`
4. `npm run lint`
5. `npm run typecheck`
6. `npx vitest run --project node`
7. `npx vitest run --project browser --browser.name=<engine> --no-file-parallelism` for each engine
8. `npm run verify:metadata`
9. `npm run size`
10. `npm run test:e2e`
11. `npm run verify:packs`
12. `node scripts/agent-kit/package-kits.mjs --check`
13. `node scripts/release/set-versions.mjs --check`
14. `node scripts/release/publish.mjs` (dry run)
15. the impact report (RF-07)
16. the evidence bundle (RF-09)

**After the publish:**

- the registry smoke (`registry-smoke.yml`, dispatched with the new version);
- the external repository's workflow (RF-11);
- move `RELEASED` in `e2e/duplicate-core.spec.ts`;
- check that the npm dist-tags show the new version for `beta` and `latest`.

## 17. Security and supply-chain considerations

| Topic | Current | Class | Task |
| --- | --- | --- | --- |
| Runtime dependencies | None outside `@oddkin`, enforced by `verify-packs` | Verified | — |
| Install scripts in packages | None | Verified | Add a `verify-packs` rule to keep it so (RF-13) |
| Tarball contents | No `src`, `test`, or stale files; explicit `files` | Verified | — |
| Workflow permissions | `contents: read`, and in `ci.yml` `actions: read` (the evidence reads its job's step times); Pages deploy uses `id-token: write` in its own job | Verified | — |
| Action pinning | Major tags (`@v7`), not commits | Partial | RF-13 (pin by SHA, or record the decision) |
| Dependency updates | No Dependabot or Renovate | Planned | RF-13 |
| Vulnerability reporting | No `SECURITY.md` | Planned | RF-13 (D-8) |
| Provenance and SBOM | None | Planned | RF-12, RF-09 |
| Publishing credentials | The owner's interactive 2FA; no stored token | Verified for now | RF-12 |
| Analyzer's bundled TypeScript | Exact `typescript@5.9.3`, Node-only | Verified | Track its advisories (RF-13) |
| Secrets in artifacts | Evidence bundle design excludes source and environment secrets | Planned | RF-09 test |

## 18. Dependencies and critical path

1. **CI green.** Agent 2's `coverage.browser.test.ts` fix. This blocks Gate A's "serial evidence is current" line and the beta.1 cut.
2. **Two independent groups, in parallel:**
   - RF-09 (evidence bundle v0, Agent 1) and RF-07 (impact report, Agent 1);
   - RF-01, RF-02, and RF-03 (documentation truth; Agent 3 with Agent 1; RF-03 needs D-7).
3. **RF-04 and RF-05 (support policy).** Need D-4.
4. **RF-08 and RF-15 (beta.1 notes and dry run).** Need D-10 (scope: wait for P0.3 and P0.4, or ship what is ready). Then the owner publishes.
5. **After the publish:** the registry smoke, RF-11 (external repository; needs D-6), RF-10 (CI evidence).
6. **RF-12 (trusted publishing).** Needs D-5, and lands before the beta after next.
7. **RF-16 to RF-19 and the Gate A review.**

External dependencies:

- Agent 2: P0.3, P0.4, P0.5 step 5, and the share-link check.
- Agent 3: README and docs content.
- The owner: decisions, npm configuration, creating the external repository, observing an installation.

## 19. Owner decisions

| Id | Decision | Recommendation | Blocks |
| --- | --- | --- | --- |
| D-1 | Support tiers and messaging for the eight published packages (§4) | Primary: core, tokens, components (+ ai optional); tooling preview: analyzer, workbench; optional: state, app | RF-01 intro text, RF-04, RF-17 |
| D-2 | Workbench and analyzer version line | Stay on `1.0.0-beta.N`; state non-frozen contracts | §5, RF-15 |
| D-3 | Accept ADR 0047 and release-process §1, or keep them proposed through the preview | Keep proposed, and say so in the release notes, until `1.0.0-rc.0` | §9 |
| D-4 | Support commitments: browser floor, Node for tools and runtime, TypeScript range, frameworks, package managers, bundlers | Claim only what §10 verifies; list the rest as limitations | RF-04, RF-05 |
| D-5 | npm trusted publishing from GitHub Actions | Yes, before the beta after next; keep the local path | RF-12 |
| D-6 | Create the external fixture repository (name, visibility) | Public, small, owner-owned | RF-11 |
| D-7 | Accessibility wording until the owner's own audit | Evidence-scoped wording ("tested with axe and keyboard checks in three engines; screen readers not yet verified") | RF-03 |
| D-8 | Security contact and disclosure policy | A `SECURITY.md` with a private reporting channel (GitHub private vulnerability reporting) | RF-13 |
| D-9 | The runtime stays MIT (technical plan §10, O-1) | Record it; no change in this plan | Gate A license line |
| D-10 | Scope and timing of beta.1 | Cut once CI is green; Agent 2's open P0 items go to beta.2 if not ready | RF-15 |
| D-11 | Publish evidence bundles as GitHub Release assets | Yes, attached to each release | RF-10 |

The technical plan's other owner decisions (§10: proprietary capabilities, ordering, the agent package, the product name, hosted timing) do not block the release foundation.

## 20. Risks and rollback

| Risk | Mitigation | Rollback |
| --- | --- | --- |
| A beta ships broken (a missing file or export) | `verify-packs`, registry smoke, and the external repository before announcing | `npm deprecate @oddkin/<pkg>@<version> "<reason>"`; move `beta` and `latest` back with `npm dist-tag add`; publish the next beta. Unpublishing is allowed only within 72 hours |
| `latest` points at a broken beta | The post-publish checks run before the announcement | Move `latest` back (owner) |
| Status text drifts again | RF-02 lint check | Fix forward |
| The evidence bundle claims more than ran | It is generated from command results only; missing results show as "not run" | Regenerate |
| Trusted publishing misconfigured | Test the workflow first with the dry run | The local `publish.mjs` path |
| Network-dependent tests (registry smoke, released duplicate-core) fail for network reasons | Messages that name the network failure; a weekly schedule, not every push, for the heaviest | Rerun; mark "not run" in evidence |
| Owner decisions wait | The plan proceeds with recommendations marked "pending" | None needed |
| Linux CI and local Windows behave differently (fonts, timing) | Serial per-engine runs; wide-font checks in tests | Fix in the owning lane |
| Analyzer's exact TypeScript pin gets an advisory | Dependabot (RF-13) | Patch release |

## 21. Milestones and execution slices

Each task lands as its own slice with its tests, a progress-log row, and verification records.

**R0 — this plan** (done when committed).

**R1 — truthful status:** RF-01, RF-02, RF-03.
**R2 — evidence:** RF-09 (first slice), RF-07, RF-10.
**R3 — policies and coverage:** RF-04, RF-05, RF-06, RF-13.
**R4 — 1.0.0-beta.1:** RF-08, RF-14, RF-15 (the owner publishes).
**R5 — outside the repository:** RF-11, RF-12.
**R6 — Gate A review:** RF-16, RF-17, RF-18, RF-19.

### RF-01 Reconcile README status statements

- **Why:** Gate A "README status matches the generated catalog"; Workstream A's documentation task.
- **Evidence:** §7's table (four package READMEs and the root README).
- **Files:** `packages/{tokens,components,state,ai}/README.md`, `README.md`, ADR 0047's duplicate-version line.
- **Dependencies:** none (Agent 3 owns README accuracy).
- **Public contract:** no; the READMEs ship in the next tarballs.
- **Tests and commands:** RF-02's check, `npm run lint`, `npm run verify:packs`.
- **Artifacts:** the corrected READMEs.
- **Done when:** no README states a milestone status, version, element count, dependency kind, or command that disagrees with the manifests, metadata, or `bin` maps.
- **Risks:** writing new claims that are not checked; keep statements to facts RF-02 can check.

### RF-02 Status-claim lint check

- **Why:** keeps RF-01 true.
- **Evidence:** `npm run lint` covers contracts, boundaries, CSS, layout, and formatting only.
- **Files:** `scripts/check-readme-status.mjs` (new), `package.json` (`lint`), `tests/release/readme-status.test.ts`.
- **Dependencies:** RF-01.
- **Public contract:** no.
- **Tests and commands:** a node test with fixture READMEs (stale phrases fail, current text passes); `npm run lint`.
- **Artifacts:** the check, run in CI through lint.
- **Done when:** lint fails on "M<n> in progress", a version that is not the manifest's, an element count that is not the metadata's, a command name no `bin` provides, or a dependency described as a dependency when it is a peer.
- **Risks:** false positives in prose; keep the rules narrow and the messages specific.

### RF-03 Accessibility wording to evidence

- **Why:** Gate A "No accessibility claim exceeds recorded evidence".
- **Evidence:** "Accessible, themed custom elements" (components manifest description); "accessible, themeable custom elements" (README); no screen-reader evidence.
- **Files:** `README.md`, `packages/components/package.json` (`description`), `packages/components/README.md`, `packages/ai/README.md`, the docs site's home copy (Agent 3).
- **Dependencies:** D-7.
- **Public contract:** no (npm description and docs).
- **Tests and commands:** an RF-02 rule for unqualified accessibility claims; `npm run verify:packs`.
- **Artifacts:** the revised descriptions and README lines.
- **Done when:** each accessibility statement names its evidence and says screen readers are not yet verified.
- **Risks:** wording disagreement; the owner decides.

### RF-04 Public support policy

- **Why:** Gate A "Browser and Node support policy is published".
- **Evidence:** §10.
- **Files:** `docs/support.md` (new; or release-process §4, whichever the owner prefers), `README.md` (link), a docs site page (Agent 3).
- **Dependencies:** D-4.
- **Public contract:** yes, a support commitment.
- **Tests and commands:** RF-02 checks the README's floor against the matrix; links resolve.
- **Artifacts:** the policy.
- **Done when:** each supported range names its evidence, and each unverified area (Safari hardware, screen readers, pnpm, Yarn, Node below 24, webpack) is a listed limitation.
- **Risks:** promising more than CI checks.

### RF-05 Coverage for claimed ranges

- **Why:** the policy may not claim untested ranges.
- **Evidence:** CI uses Node 24 and npm only.
- **Files:** `scripts/packed-consumers.mjs` (a package-manager option), `.github/workflows/registry-smoke.yml`, possibly a CI matrix entry.
- **Dependencies:** RF-04 and D-4.
- **Public contract:** no.
- **Tests and commands:** for each claim, a consumer that installs and passes. For example, `components-only` with pnpm; with Yarn and explicit peers; DOM-free entries imported on the oldest claimed Node.
- **Artifacts:** one result per claimed manager or runtime, recorded in the evidence bundle.
- **Done when:** every range in the policy has a passing consumer or is moved to limitations.
- **Risks:** CI time; run the extra managers weekly.

### RF-06 Manifest metadata completeness

- **Why:** npm pages and issue routing for external evaluators.
- **Evidence:** no `homepage`, `bugs`, or `keywords` in any manifest.
- **Files:** `packages/*/package.json`, `scripts/verify-packs.mjs` (new rules).
- **Dependencies:** the owner's OK for `homepage` (`https://www.oddkin.dev`) and `bugs` (the GitHub issues URL).
- **Public contract:** no (npm metadata).
- **Tests and commands:** `npm run verify:packs`, `node scripts/release/set-versions.mjs --check`.
- **Artifacts:** the eight manifests with the three fields, and the new `verify-packs` rules.
- **Done when:** every manifest has the three fields and `verify-packs` enforces them.
- **Risks:** none significant.

### RF-07 Impact report against the previous release

- **Why:** release-process §3's unticked item; Gate A "A sample project produces a useful impact report"; evidence for §9.
- **Evidence:** the `oddkin-impact snapshot` and `compare` commands exist; beta.0 is published.
- **Files:** `scripts/release/impact.mjs` (new): installs the previous version into a temporary project, snapshots both, compares; release-process §3 and §5.
- **Dependencies:** network access for the previous version; RF-09 to store the result.
- **Public contract:** no; it reports on contracts.
- **Tests and commands:** a node test of the script's plumbing on a fixture; `node scripts/release/impact.mjs --previous 1.0.0-beta.0` from a clean checkout.
- **Artifacts:** `impact-report.json` and `impact-report.md`.
- **Done when:** the report runs from a clean checkout, and each incompatible item is either named in the release notes or explained as expected.
- **Risks:** the snapshot format is not frozen; peer changes (P0.2) are invisible to it, so the release notes cover them.

### RF-08 Release notes completion

- **Why:** Gate A "Changelogs and release notes exist" and "Known limitations are visible".
- **Evidence:** the beta.1 draft; the owner's decision of 2026-10-29.
- **Files:** `docs/releases/1.0.0-beta.1.md`; optionally `scripts/release/notes.mjs`.
- **Dependencies:** D-10, RF-07.
- **Public contract:** no.
- **Tests and commands:** links resolve; RF-02's rules.
- **Artifacts:** the completed `docs/releases/1.0.0-beta.1.md`.
- **Done when:** the notes add "Upgrading" (for example, Yarn users add the peers) and "Known issues and limitations" (from §10 and the open P0 items).
- **Risks:** notes trailing the code; regenerate the row list at the cut.

### RF-09 Release evidence bundle v0 (the first slice)

- **Why:** Gate A "Release evidence bundle is downloadable"; Workstream A's single evidence bundle; T0's "release evidence from a clean checkout".
- **Evidence:** none exists; CI keeps Playwright artifacts only when a run fails.
- **Files:** `scripts/release/evidence.mjs` (new), `scripts/release/evidence.d.mts`, `tests/release/evidence.test.ts`, `.gitignore` (`release-evidence/`), release-process §3 and §5 (one step each).
- **Dependencies:** none.
- **Public contract:** introduces an internal format (`release-evidence.v0`), not published.
- **Tests and commands:** the node test runs the script into a temporary directory, then checks four things: the schema fields; each package's integrity against `npm pack --dry-run --json`; the dirty state recorded truthfully; no file under `src/` or the environment's values in the output. Also `npm run lint` and `npx tsc -p tsconfig.tests.json`.
- **Artifacts:** `evidence.json` and `EVIDENCE.md`.
- **Done when:** one command (`node scripts/release/evidence.mjs --out release-evidence/<label>`) writes the bundle from a clean checkout without network access, and the test passes on Windows and in CI on Linux.
- **Risks:** `npm pack --dry-run` packs all eight packages on each run; keep it out of the per-push CI until RF-10.
- **State (2026-10-29, Agent 1):** done. On Windows the command takes 16 s. The test compares integrity by packing the eight packages again, one at a time, so that comparison runs in CI and with `ODDKIN_RELEASE_TESTS=1` (97 s on Windows); the other tests stand in for `npm pack` with the manifests.

### RF-10 Evidence in CI

- **Why:** "downloadable" in Gate A.
- **Evidence:** `ci.yml` uploads only on failure.
- **Files:** `.github/workflows/ci.yml`, `vitest.config.ts` and `playwright.config.ts` (machine-readable reporters in CI), `scripts/release/evidence.mjs` (ingesting the results).
- **Dependencies:** RF-09; a green CI.
- **Public contract:** no.
- **Tests and commands:** a CI run whose artifact holds `evidence.json` with per-engine counts and step timings.
- **Artifacts:** the evidence artifact of each CI run on `main`.
- **Done when:** each run on `main` keeps a downloadable evidence artifact (with an agreed retention). The release run's artifact is attached to the GitHub Release when D-11 is yes.
- **Risks:** reporter changes affect other agents' local output; enable them only when `CI` is set.
- **State (2026-10-29, Agent 1):** in `ci.yml`. The Vitest steps add the JSON reporter beside `default` and `github-actions`, and Playwright adds its JSON reporter when `CI` is set. After `verify:packs`, CI writes the change-impact report (CF.2) and the evidence with `--ci`, which reads the job's step times from the GitHub API (`actions: read`), and uploads `release-evidence/` as `release-evidence-<attempt>`, kept 30 days, from every run that was not cancelled. Attaching it to a GitHub Release waits for D-11.

### RF-11 External fixture repository

- **Why:** Workstream A's exit; Gate A "Clean external installation completes the quick start".
- **Evidence:** §11, §12.
- **Files:** a new repository (owner); here, a dispatch step in the release procedure.
- **Dependencies:** D-6; the docs quick start (Agent 3).
- **Public contract:** no, but it tests the public quick start.
- **Tests and commands:** its own CI against `@beta`.
- **Artifacts:** the repository, its workflow, and its run history.
- **Done when:** its CI passes against the published beta with the docs' commands copied verbatim, and a failure notifies the owner and Agent 1.
- **Risks:** drift between the docs and the copies; the copies are refreshed when the docs change.

### RF-12 Trusted publishing and provenance

- **Why:** supply chain; it removes the 16-approval publish.
- **Evidence:** §15.
- **Files:** `.github/workflows/release.yml` (new), `scripts/release/publish.mjs` (CI mode), release-process §5.
- **Dependencies:** D-5, the owner's npm configuration.
- **Public contract:** no; it adds provenance to published versions.
- **Tests and commands:** the workflow's dry run on a branch; one real publish observed by the owner.
- **Artifacts:** `release.yml`; provenance attestations on npm.
- **Done when:** a beta publishes from CI with provenance shown on npm, and `latest` is moved by a verified method.
- **Risks:** the dist-tag question in §15; misconfiguration. The local path remains.

### RF-13 Security policy and dependency hygiene

- **Why:** an external evaluator's first checks; supply-chain risk.
- **Evidence:** §17.
- **Files:** `SECURITY.md`, `.github/dependabot.yml`, `ci.yml` (`npm audit --omit=dev`, informational), `scripts/verify-packs.mjs` (no lifecycle scripts rule), action pins.
- **Dependencies:** D-8.
- **Public contract:** no.
- **Tests and commands:** CI runs; `verify-packs`.
- **Artifacts:** `SECURITY.md`, `.github/dependabot.yml`, the audit report, the SBOM in the bundle.
- **Done when:** a reporting channel exists; dependency and action updates are proposed weekly; the SBOM is in the evidence bundle.
- **Risks:** update noise; group the updates.

### RF-14 Metadata and kit order at release

- **Why:** Gate A "Metadata and generated agent kits are current" at the published version.
- **Evidence:** §13.
- **Files:** release-process §5; `scripts/release/evidence.mjs` (hashes).
- **Dependencies:** RF-09.
- **Public contract:** kits are a candidate v1 contract (`agent-kit.v1`).
- **Tests and commands:** §13's sequence after a version step.
- **Artifacts:** the ordered procedure in release-process §5; metadata and kit hashes in each bundle.
- **Done when:** the release procedure lists the order, and the evidence bundle records metadata and kit hashes per package.
- **Risks:** a partial build leaves the kits stale; `package-kits --check` catches it.

### RF-15 Release dry run for 1.0.0-beta.1

- **Why:** P0.8 and T0.
- **Evidence:** release-process §3 and §5; the version-step rehearsal of 2026-10-29.
- **Files:** `docs/release-process.md`, `scripts/release/*`.
- **Dependencies:** a green CI; RF-07, RF-08, RF-09; D-10.
- **Public contract:** the version step itself (owner-approved cut).
- **Tests and commands:** §16's release-candidate sequence from a clean checkout.
- **Artifacts:** the dry run's log and its evidence bundle.
- **Done when:** the dry run passes with an evidence bundle, and the owner can publish with release-process §5's commands.
- **Risks:** open P0 items; decide their release by D-10.

### RF-16 Package cut record

- **Why:** Gate A "Public package cut is decided".
- **Evidence:** the owner decision of 2026-10-27 and §4.
- **Files:** release-process §1 (tiers), `README.md`.
- **Dependencies:** D-1, D-2.
- **Public contract:** no.
- **Tests and commands:** `npm run lint` (RF-02 checks the README's package list against the recorded tiers).
- **Artifacts:** a tier table in release-process §1.
- **Done when:** the tiers are recorded and the README's package list follows them.
- **Risks:** waits on the owner; messaging work (RF-17) waits with it.

### RF-17 Docs: implemented, planned, local, hosted

- **Why:** Gate A product-experience lines.
- **Evidence:** the docs site's Roadmap page; no hosted features exist.
- **Files:** `apps/docs` content (Agent 3).
- **Dependencies:** D-1.
- **Public contract:** no.
- **Tests and commands:** the docs e2e.
- **Artifacts:** "implemented" and "planned" labels on the docs pages; a revised home page.
- **Done when:** every docs page that names a capability marks it implemented or planned, nothing implies a hosted service, and the home page leads with the primary packages only.
- **Risks:** the content pass (P0.7) is in progress; fold it in.

### RF-18 Observed installation

- **Why:** Gate A "Installation guide takes less than 15 minutes in observation".
- **Evidence:** none.
- **Files:** none; notes go in `docs/verification.md`.
- **Dependencies:** RF-11 and the docs quick start; the owner recruits observers (T0's design partners).
- **Public contract:** no.
- **Tests and commands:** none automated; a written observation protocol (start, stop, obstacles).
- **Artifacts:** session notes and timings in `docs/verification.md`.
- **Done when:** at least two observed sessions finish under 15 minutes, or their obstacles are fixed and the session is repeated.
- **Risks:** observers not available; this item may move to T1.

### RF-19 Error-message audit

- **Why:** Gate A "Error messages identify the corrective action".
- **Evidence:** analyzer diagnostics carry suggestions; other codes are unaudited.
- **Files:** a generated list of diagnostic codes and messages (core, tokens, analyzer, workbench, components); fixes in the owning packages.
- **Dependencies:** none.
- **Public contract:** messages are not contracts; codes are.
- **Tests and commands:** a script that lists codes and flags messages without an action; package tests for changed messages.
- **Artifacts:** the code list and its audit result.
- **Done when:** every documented error code's message names what to do, or carries a link to the page that does.
- **Risks:** a long tail; prioritize the install and first-run paths.

## 22. Acceptance criteria mapped to Gate A

| Gate A line | Class now | Evidence now | Task | Passes when |
| --- | --- | --- | --- | --- |
| Public package cut is decided. | Owner | All eight public (2026-10-27); tiers undecided | RF-16 (D-1, D-2) | Tiers recorded in release-process §1 and the README |
| Preview versions replace `0.0.0`. | Verified | `1.0.0-beta.0` on npm, `beta` and `latest` | — | Already true (the line's wording is stale) |
| Package privacy flags match the release decision. | Verified | No `private` in the eight; docs app and root private | — | Already true |
| README status matches the generated catalog. | Stale | §7 | RF-01, RF-02 | The lint check passes |
| Changelogs and release notes exist. | Partial | beta.1 draft; changelogs from 1.0.0 by policy | RF-08 | Notes complete at the cut |
| License and ownership decisions are recorded. | Verify | MIT in README, manifests, `LICENSE`; the owner owns `@oddkin` | D-9 | The owner confirms MIT for the preview in writing |
| Export, declaration, files, side-effect, and `customElements` checks pass from tarballs. | Verified | `verify:packs`, CI run 40945402821 | RF-06 (extras) | Stays green in each release run |
| Clean external installation completes the quick start. | Partial | Registry runs of in-repository fixtures (local, 2026-10-29) | RF-11 | The external repository's CI passes against the published version |
| Browser and Node support policy is published. | Partial | README, matrix, release-process §4 | RF-04, RF-05 | The policy page exists with evidence and limitations |
| Known limitations are visible. | Partial | Component pages' known limitations; release-process §3 | RF-08, RF-04 | Release notes and the policy list them |
| Serial Chromium, Firefox, and WebKit evidence is current. | Verify | CI per-engine steps; one failing Workbench test | P0.6 (Agent 2), RF-10 | A green CI run on the release commit, in the evidence bundle |
| Parallel-run limitation is documented. | Verified | release-process §3 | RF-01 (README line) | Also in the README's commands |
| Packed-consumer matrix passes. | Verified | CI e2e at `6486921` (1,014 passed) | RF-05 (extensions) | Green on the release commit |
| Metadata and generated agent kits are current. | Verified | `verify:metadata`, kit check, `verify-packs` | RF-14 | Hashes in the evidence bundle match the tarballs |
| Size budgets pass. | Verified | CI `npm run size` | — | Green on the release commit |
| Compatibility matrix is current. | Verified | `lint:css`; regenerated 2026-10-29 | — | Green; floor re-resolved before 1.0.0 |
| No accessibility claim exceeds recorded evidence. | Stale | §2 | RF-03 (D-7) | Wording names its evidence |
| Release evidence bundle is downloadable. | Planned | none | RF-09, RF-10 | Attached to the run (and release) |
| Installation guide takes less than 15 minutes in observation. | Planned | none | RF-18 | Two observed sessions |
| A sample project produces a useful impact report. | Partial | Impact tests with real snapshots | RF-07 | The beta.0-to-beta.1 report in the bundle and the notes |
| Error messages identify the corrective action. | Unknown | Not audited | RF-19 | The audit's list is clean |
| The docs distinguish local, hosted, implemented, and planned capabilities. | Unknown | Roadmap page only | RF-17 | Docs e2e and review |
| The primary message does not require understanding every Oddkin package. | Owner | The README lists all eight first | RF-16, RF-17 (D-1) | The README and home page lead with the primary tier |

## Smallest safe first execution slice

**RF-09, the release evidence bundle v0, run locally.** It is entirely within Agent 1's lane and needs no owner decision and no network. It changes no version, manifest, CI workflow, or published file.

- Add `scripts/release/evidence.mjs`:
  - `--out <dir>`, plus `--allow-dirty` to proceed with a dirty tree (it records the state either way);
  - writes `evidence.json` (`release-evidence.v0`): the commit and dirty state; Node, npm, and OS versions; for each of the eight packages, the name, version, sha512 integrity, file count, and unpacked size from `npm pack --dry-run --json`; and the hashes of `oddkin.metadata.json`, `custom-elements.json`, `contracts.json`, and each `agent/kit.json` that exists;
  - writes `EVIDENCE.md`, a readable summary that lists every verification step as "not run" until RF-10 feeds results in.
- Add `tests/release/evidence.test.ts` (node project). It runs the script into a temporary directory, checks the fields, compares the integrity values with its own `npm pack --dry-run --json`, and confirms that no environment variable values or source files appear in the output.
- Add `release-evidence/` to `.gitignore`, and one line each to release-process §3 and §5 naming the command.
- Verify with `npx vitest run --project node tests/release/evidence.test.ts`, `npm run lint`, and `npx tsc -p tsconfig.tests.json`. Run `node scripts/release/evidence.mjs --out release-evidence/main` on a clean checkout. Record the results in `docs/verification.md` and a progress-log row.

## Appendix A. `future_plans/` audit (2026-10-29)

The first version of this plan audited the owner's seven original documents (commit `cdad50c`). Every relative link resolved, and the business plan's six external links answered HTTP 200. One link's text, "Customer discovery and paid pilot playbook", did not match its file name. Seven statements disagreed with the repository, all about the release state:

- packages "private and versioned `0.0.0`";
- status documentation inconsistent with the catalog (by then only four package READMEs were);
- no release or compatibility history (beta.0 is released, and a test now runs against it);
- Workbench "as `0.x`";
- preview versions still to set (in both the technical plan and the scorecard);
- packages to keep private or at `0.x`.

The same day, at the owner's direction, the folder was reduced to technical documents and rewritten against the repository:

| Original | Now |
| --- | --- |
| `TECHNICAL_COMMERCIALIZATION_PLAN.md` | Rewritten: the current foundation, the place of each workstream in the priority plan, today's state per workstream, the technical requirements from the business planning (§7), and owner decisions O-1 to O-8 |
| `COMMERCIAL_READINESS_SCORECARD.md` | Rewritten: the technical lines of gates A–D, with their classes |
| `PRODUCT_PATTERNS_AND_FLOW_CONTRACTS_IMPLEMENTATION_PLAN.md` | Corrected: the repository starting point (§1a), `odd-button`'s appearances, and the impact-graph, kit, Figma, accessibility, and priority prerequisites |
| `COMMERCIALIZATION_DOSSIER.md` | Removed; its technical principles and decisions are in the technical plan (§1, §10) |
| `ODDKIN_BUSINESS_PLAN.md`, `GO_TO_MARKET_PRICING_PLAN.md`, `CUSTOMER_DISCOVERY_AND_PAID_PRICING_PLAN.md` | Removed; the owner keeps them outside the repository. Their technical requirements are in the technical plan (§7) |

Every relative link in the folder resolves (checked by script).
