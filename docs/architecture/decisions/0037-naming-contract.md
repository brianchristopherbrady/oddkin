# 0037. Naming contract: Oddkin, `odd-`, and `oddkin`

- **Status:** Accepted
- **Date:** 2026-10-17
- **Area:** Process / Distribution
- **Related:** 0007 (alias scope generation), 0012 (token categories), 0036 (composition API)

## Context
The project needs one product name and a consistent rule for which public surfaces use a short prefix and which use the full name. Markup and CSS are written often and appear in every theme and component stylesheet; package, JavaScript, command-line, and file names must be unambiguous in shared namespaces such as npm and a developer's `PATH`. The two-letter prefix `ok-` is already used by another design-system component library.

## Decision

| Surface | Name | Examples |
| --- | --- | --- |
| Product and library | Oddkin | "Oddkin components" |
| npm scope | `@oddkin/*` | `@oddkin/core`, `@oddkin/components` |
| Custom-element tags | `odd-` | `<odd-button>`, `<odd-card>`, `<odd-input>` |
| CSS custom properties (design tokens and component variables, one namespace) | `--odd-*` | `--odd-color-action-default`, `--odd-button-radius`, `--odd-ref-brand-600` |
| Theme-scope attributes | `data-odd-*` | `data-odd-theme`, `data-odd-mode`, `data-odd-product`, `data-odd-density`, `data-odd-profile` |
| Page-author layout classes, keyframes, element events | `odd-` | `odd-stack`, `odd-button-spin`, `odd-action` |
| JavaScript classes and types | `Oddkin*` | `OddkinElement`, `OddkinError`, `OddkinStyles`, `OddkinButton` (registered as `<odd-button>`) |
| JavaScript identifiers | `oddkin*` | `oddkinVersion` |
| Constants and environment variables | `ODDKIN_*` | `ODDKIN_CORE` |
| Command-line tools | `oddkin`, `oddkin-*` | `oddkin` (Workbench), `oddkin-tokens`, `oddkin-analyze`, `oddkin-agent`, `oddkin-layout` (planned) |
| Files and generated directories | `oddkin.*`, `.oddkin/` | `oddkin.metadata.json`, `oddkin.config.ts`, `oddkin.docs.ts`, `oddkin.theme.ts` |
| Schema identifiers and domain | `https://oddkin.dev/schemas/…` | `oddkin-metadata/v1.json`, `conformance/v1.json` |
| Library protocol identifiers | `oddkin` | Trusted Types policy `oddkin-template`, preset `oddkin-default`, `Symbol.for('oddkin.readable')`, model `oddkin.navigation-item`, suite `oddkin.button`, Sass namespace `oddkin.token()` and `$oddkin-conditions` |

Rule of thumb: anything written in HTML or CSS uses `odd`; packages, JavaScript, command-line tools, configuration, files, and protocol identifiers use `oddkin`. Ordinary semantic names (`disabled`, `change`, slots, parts, ARIA attributes) carry no prefix.

## Alternatives considered
- **`ok-` / `--ok-*`** — two characters shorter, but already used by another design-system library, so tags and custom properties could collide on the same page.
- **`--oddkin-*` for CSS** — unambiguous but longer in every declaration of every theme and component stylesheet, and it would split markup (`odd-`) from CSS naming.
- **`--oddkin-*` for tokens and `--odd-*` for component variables** — two CSS namespaces would break the single tier model (reference → semantic → component) and the analyzer's rule that a documented `@cssprop` is a component variable and any other `var(--odd-…)` read is a token.
- **Short command-line names (`odd`, `odd-tokens`)** — too generic for a shared `PATH` and unrelated to the npm package names.

## Consequences
- Class names and tag names differ (`OddkinButton` ↔ `<odd-button>`); documentation shows both.
- The token generator, `token()`, the analyzer, Workbench defaults, and published metadata emit these names; generated outputs are regenerated, never edited.
- `odd` is a common English word; searches for the prefix should include the hyphen (`odd-`, `--odd-`, `data-odd-`).
- Publishing requires ownership of the `@oddkin` npm scope and of `oddkin.dev` (release process).

## Evidence
Renaming applied repository-wide on 2026-10-17; generated token, analyzer, and component metadata outputs regenerated and identical to the renamed sources; full verification recorded in [verification.md](../../verification.md).

## Revisit when
A collision with another library's `odd-` tags or `--odd-` properties is reported, or before the M12 freeze if npm scope or domain ownership changes.
