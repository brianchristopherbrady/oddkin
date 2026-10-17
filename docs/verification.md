# Verification log

Recorded results of checks. Each entry states the date, environment, command, and outcome. Never record a result that was not observed.

## 2026-10-17 — M1 workspace skeleton

**Environment:** Windows, Node 24.19.0, npm 11.17.0, TypeScript 7.0.2, Vitest 5.0.5, Playwright 1.64.1 (Chrome for Testing 156.0.8078.4, Firefox 157.0, WebKit 27.2), Prettier 3.9.10, es-module-lexer 3.0.4, Ajv 8 + ajv-formats 3.

| Check | Command | Result |
| --- | --- | --- |
| Build | `npm run build` | Pass — 5 packages + `apps/docs` built with `tsc -b` (ESM + declarations + maps) |
| Boundaries | `npm run lint:boundaries` | Pass — 6 packages, 6 source files, 10 imports; manifests, sources, built artifacts, and the DOM-free `@mote/tokens` entry checked |
| Deliberate violation | Added `import '@mote/state'` to `packages/components/src/index.ts`, ran the checker, reverted | Fails as intended: `✖ [boundary.import.forbidden] @mote/components may not import @mote/state.` with file and fix |
| Formatting | `npm run format:check` | Pass |
| Typecheck | `npm run typecheck` | Pass — packages, tests, e2e, and configs |
| Unit tests | `npm test` | Pass — 29 tests: 5 package skeleton tests, 11 boundary-checker tests (temporary fixture workspaces), 13 schema tests |
| Full pipeline | `npm run verify` | Pass — lint, typecheck, unit tests, browser tests, packed consumers in one run |
| Browser tests | `npm run test:e2e` | Pass — plain-HTML consumer loads every package through an import map in Chromium, Firefox, and WebKit with no page errors |
| Packed consumers | `npm run verify:packs` | Pass — 5 tarballs installed into a temporary project outside the workspace; runtime imports and declarations resolve; no third-party runtime dependencies installed |

**Finding during M1:** the first boundary run reported "OK" while scanning zero imports, because es-module-lexer 3 renamed the import field (`n` → `specifier`). Fixed; the checker now reports scan counts and fails if source files yield no imports, and a test asserts side-effect and type-only imports are counted.

**Not yet verified:** the CI workflow (`.github/workflows/ci.yml`) has not run (no remote configured). Minimum browser versions from ADR 0009 are not yet tested; only current Playwright builds were used.