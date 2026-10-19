# 0031. Development/production builds and core size budget

- **Status:** Accepted
- **Date:** 2026-10-17
- **Area:** Core
- **Detailed contract:** [core-contracts.md §6.1](../core-contracts.md), [IMPLEMENTATION_PLAN.md §8](../../../IMPLEMENTATION_PLAN.md)

## Context
Plan §8 targets a minimal production counter (Oddkin code plus registration) at or under 8 KiB gzip and says to revise via ADR if missed. Plan §3 requires development diagnostics that explain a fix while production keeps essential failures without shipping full explanations or expensive validation. The first measurement (M3) found a single build of 11,659 B gzip for the counter, including 46 long explanatory strings and the keyed-list reconciler, which the counter never uses.

## Decision
1. **Two builds per package, selected by export condition.** `dist/` is the development build (tsc output, full messages). `dist/prod/` is produced from it by `scripts/build-production.mjs`: the `DEV` import from `internal/dev.js` is removed, `DEV` is defined as `false`, and dead branches are removed per module. Module structure, specifiers, and export names are identical. Each export maps `development` → `dist/…` and `default` → `dist/prod/…`. Vite, Vitest, and other development servers use the development build automatically. Bundlers default to production, as does Node without `--conditions=development`.
2. **What production keeps.** `OddkinError` codes (`[code] Use the development build … for details.`), every error that is thrown or reported, all security checks (binding-position rules, URL sanitization, Trusted Types), and every behavior. A development-only check never changes behavior: the field-shadowing repair runs in both builds.
3. **What is development-only.** Explanatory messages, the `:host`-in-light-DOM CSS scan, and the recipe-defined-during-render warning.
4. **Pay for use.** `repeat()` carries its own reconciler (`template/repeat.ts`). `ChildPart` only calls it, so templates without `repeat()` do not ship LIS, move, or focus-restoration code.
5. **Revised budget** (production, esbuild bundle + minify, ESM, es2022, gzip level 9), enforced by `npm run size` in `npm run verify`:

| Bundle | Budget | Measured |
| --- | --- | --- |
| Minimal counter: `OddkinElement`, `html`, `signal`, `define` | 9,728 B (9.5 KiB) | 9,280 B |
| Typical component: `with()`, props, event, `css`, `when` | 11,264 B | 10,553 B |
| Keyed list: collection + `repeat` | 11,776 B | 11,064 B |
| Reactive graph only (`@oddkin/core/reactive`) | 2,048 B | 1,892 B |

The check also fails if a component bundle pulls in `@oddkin/state`, `@oddkin/app`, or `@oddkin/tokens`. Since 2026-10-19 it also fails if any measured graph loads tooling (`@oddkin/core/model/schema`, `@oddkin/core/layout/inspect`, the analyzer, Workbench, or TypeScript). It fails too if a graph loads an optional core feature it does not import: the counter and typical component load no layout, collections, model, helpers, i18n, or controllers; the keyed list loads no layout, model, or controllers; and the registered side navigation loads no layout, collections, model, helpers, or i18n.

## Alternatives considered
- **Keep 8 KiB and golf the code.** The remaining bytes are the template parser that finds binding positions, parts with security rules, the phased scheduler, `Scope`, and constructable-stylesheet adoption. Each is required by an accepted contract (ADRs 0002, 0004, 0005, 0008). Reaching 8 KiB would mean removing a contract or obscuring the code, and was not judged worth 1.1 KiB.
- **A global `__DEV__` define left to consumers.** Breaks no-bundler use: an undefined global throws, and a missing define silently ships development code. Export conditions work in import maps (point at `dist/` or `dist/prod/`), bundlers, and Node.
- **Bundled single-file production entry points.** Smaller, but they change module identity across entry points and complicate subpath imports. Per-file transforms keep the same graph.

## Consequences
Two builds must stay equivalent. `packages/core/test/production.test.ts` checks the same modules and export names, the export conditions, stable codes without messages, and that no development text or `DEV` references remain. New packages opt in by adding `src/internal/dev.ts`. Size increases need a budget change in `research/benchmarks/size/measure.mjs` with a reason.

## Evidence
`research/benchmarks/results/2026-10-17-win32.json` (sizes, modules per bundle, runtime samples). Before the change, the single build measured 11,659 B (counter) and 12,997 B (component). Removing development messages and making `repeat` pay-for-use brought the counter to 9,280 B. The per-module breakdown of the production counter (minified bytes): template parts 6.9 K, element 5.1 K, reactive graph 4.7 K, template preparation 3.7 K, styles 2.0 K, `Scope` 1.8 K, `define` 0.9 K.

## Revisit when
Any budget is exceeded, the template parser or scheduler is redesigned, or a comparable measured baseline (for example, a minimal counter in another authoring library, measured with the same method) suggests a specific saving.
