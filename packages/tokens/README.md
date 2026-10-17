# @mote/tokens

Theme configuration, the pure token generator, and its outputs. Browser entry points are DOM-free and use no Node APIs, so the same generator runs in the CLI, browsers, and Workers.

**Status:** M2 in progress.

| Entry | Contents |
| --- | --- |
| `@mote/tokens/theme` | `ThemeConfig` types and `defineTheme()` |
| `@mote/tokens/generate` | `generate(config)` → `{ ok, diagnostics, theme, css }`; `resolveTheme`, `resolveToken`, `emitCss`, spacing, colour, and contrast utilities |
| `@mote/tokens/refs` | `token('space.md')` → `'var(--mote-space-md)'`, `tokenVariable()`, `TokenName` (default theme) |
| `@mote/tokens/values` | Literal values of the default theme (`{ light, dark }` for mode-dependent tokens) |
| `@mote/tokens/css/default.css` | The default theme as CSS custom properties |
| `@mote/tokens/node` | `loadConfig`, `buildTheme`, `formatDiagnostics` (Node only) |
| `@mote/tokens/schema.json` | JSON Schema (draft 2020-12) for JSON configs |
| `@mote/tokens` | Re-exports `theme` and `generate` |

```ts
import { generate } from '@mote/tokens/generate';

const { ok, css, diagnostics } = generate({ brand: { primary: '#5b46e8' } });
```

One brand colour produces a complete theme: OKLCH reference ramps (brand, neutral, danger, success), a provisional explicit `rem` spacing scale, typography, radii, control sizes, layout roles, navigation roles, and semantic colour roles chosen by measured WCAG contrast. Light, dark, and system modes; `data-mote-theme`, `data-mote-mode`, `data-mote-product`, and `data-mote-density` scopes re-declare their alias closures and nest in any order. Invalid input returns structured diagnostics (code, JSON-pointer path, message, suggestion) instead of throwing.

## CLI

```sh
mote-tokens init                                   # writes mote.theme.json
mote-tokens check mote.theme.json [--strict] [--json]
mote-tokens build mote.theme.json --out tokens [--format css,ts,json]
```

`build` writes `<name>.css`, `<name>.refs.ts`, `<name>.values.ts` (typed for that theme's token names), and `<name>.inspect.json`. Exit codes: 0 success, 1 diagnostics, 2 usage. Configs may be JSON, ESM JS, or `.ts` via Node's type stripping (erasable syntax only; type-check separately). JS and TS configs are executed: treat them as trusted code.

The generated ramp step nearest a brand colour is used for its roles; the brand colour itself appears only if it falls on a step. Override `ref.brand.<step>` to pin an exact value. Custom spacing scales must define the steps the preset's roles use (`xs`, `sm`, `md`, `lg`) or override those roles.

Design and limits: [theming-and-styling.md](../../docs/architecture/theming-and-styling.md). Not yet: Sass and DTCG outputs, conditions, profiles.