# @oddkin/tokens

Theme configuration, the pure token generator, and its outputs. Browser entry points are DOM-free and use no Node APIs, so the same generator runs in the CLI, browsers, and Workers.

**Status:** beta, published under npm's `beta` tag. The theme configuration, the generator, the `oddkin-tokens` command, and the outputs below ship.

| Entry | Contents |
| --- | --- |
| `@oddkin/tokens/theme` | `ThemeConfig` types and `defineTheme()` |
| `@oddkin/tokens/generate` | `generate(config, { css })` → `{ ok, diagnostics, theme, css }`; `resolveTheme`, `resolveToken`, `emitCss`, `LAYER_ORDER`, `BROWSER_FLOOR`, `ABOVE_FLOOR_SYNTAX`, spacing, colour, and contrast utilities; `ROLE_CONTRACTS` and `contrastReport(theme)` (semantic colour contracts) |
| `@oddkin/tokens/refs` | `token('space.md')` → `'var(--odd-space-md)'`, `tokenVariable()`, `TokenName` (default theme) |
| `@oddkin/tokens/conditions` | Named conditions as `{ kind, query, atRule }` literal container/media queries |
| `@oddkin/tokens/values` | Literal values of the default theme (`{ light, dark }` for mode-dependent tokens) |
| `@oddkin/tokens/css/default.css` | The default theme as CSS custom properties |
| `@oddkin/tokens/node` | `loadConfig` (JSON, JS, or TS → the JSON-compatible model), `buildTheme`, `formatDiagnostics` (Node only) |
| `@oddkin/tokens/schema.json` | JSON Schema (draft 2020-12) for JSON configs |
| `@oddkin/tokens` | Re-exports `theme` and `generate` |

```ts
import { generate } from '@oddkin/tokens/generate';

const { ok, css, diagnostics } = generate({ brand: { primary: '#5b46e8' } });
```

One brand colour produces a complete theme: OKLCH reference ramps (brand, neutral, danger, success, warning, info), a provisional explicit `rem` spacing scale, typography scales with eight text-style roles (`type.display` … `type.code`), radius and border scales, elevation, motion durations and easings (durations drop to `0ms` under `prefers-reduced-motion: reduce`, and inside `data-odd-motion="reduce"` for an in-page setting), stacking levels, icon sizes, control sizes, layout roles, navigation roles, and semantic colour roles chosen by measured WCAG contrast, including `color.<tone>.{foreground,surface,border}` for the tones `neutral`, `info`, `success`, `warning`, and `danger`, `color.selection.surface`, and a translucent `color.scrim`. Light, dark, and system modes; `data-odd-theme`, `data-odd-mode`, `data-odd-product`, and `data-odd-density` scopes re-declare their alias closures and nest in any order. Invalid input returns structured diagnostics (code, JSON-pointer path, message, suggestion) instead of throwing. A path points where the configuration wrote the value (`/overrides/radius.md`), or names a preset role (`/tokens/<name>`), and an explicit `null` is rejected wherever the schema rejects it.

`@oddkin/tokens/css/default.css` is built from `themes/default.theme.json`: Electric iris (`#6250e8`) with the approved light and dark palette pinned as overrides (role table: docs/architecture/theming-and-styling.md §10.1, ADR 0041). All non-colour values are Oddkin's own scales (§10.2–§10.3, ADR 0042); font families are system stacks, and the package does not ship font files.

## CLI

```sh
oddkin-tokens init                                   # writes oddkin.theme.json
oddkin-tokens check oddkin.theme.json [--strict] [--json]
oddkin-tokens build oddkin.theme.json --out tokens [--format css,ts,json,dtcg] [--css-layer <name|none>]
```

`build` writes `<name>.css`, `<name>.refs.ts`, `<name>.values.ts`, `<name>.conditions.ts` (typed for that theme's token names), `<name>.inspect.json`, `<name>.contrast.json` (every declared role pair measured in each mode and product, with a stable `id` per pair; `@oddkin/tokens/inspect/default.contrast.json` for the default theme; a measurement, not an accessibility certification), and one DTCG Format Module 2025.10 document per mode, `<name>.<mode>.tokens.json` (`emitDtcg` in `./generate`; lossless, lossy, and unsupported mappings are listed in theming-and-styling.md §6.1; no DTCG Resolver support is claimed). Exit codes: 0 success, 1 diagnostics, 2 usage. Configs may be JSON, ESM JS, or `.ts` via Node's type stripping (erasable syntax only; type-check separately). JS and TS configs are executed: treat them as trusted code. A loaded config must be JSON data: functions, class instances, non-finite numbers, and cycles are `config.notJson` errors with their paths, so the CLI generates from the same model Theme Studio edits.

## In a browser or Worker

`@oddkin/tokens/generate` uses no Node APIs and no DOM. In a module Worker, as Theme Studio uses it:

```ts
import { emitInspectJson, generate } from '@oddkin/tokens/generate';

self.onmessage = ({ data: { id, draft } }) => {
  const result = generate(draft); // never throws; `ok: false` means no CSS
  self.postMessage({
    id,
    ok: result.ok,
    diagnostics: result.diagnostics,
    css: result.css,
    inspection: result.theme && emitInspectJson(result.theme, result.diagnostics),
  });
};
```

For the same configuration, `css` is byte-identical to what `oddkin-tokens build` writes (`--css-layer x` is `generate(config, { css: { layer: 'x' } })`). In a page or preview frame, construct the sheet with that document's `CSSStyleSheet`, adopt it once, and update it with `replaceSync(css)`.

Generated CSS starts with Oddkin's layer order (`@layer odd.reset, odd.tokens, odd.base, odd.layout, odd.components, odd.utilities;`) and places every declaration in `odd.tokens`, so unlayered page CSS overrides any generated value regardless of stylesheet order. `--css-layer vendor.theme` emits a different layer; `--css-layer none` emits unlayered CSS (ADR 0039).

Token values must parse in every supported browser (Chrome and Edge 130, Firefox 132, Safari 18.2): a value such as `progress(…)` or `anchor-size(…)` gets a `value.syntax.aboveFloor` warning, because declarations that read the token would be dropped at computed-value time in browsers without that syntax. Put enhancements in your own CSS behind `@supports` instead.

The generated ramp step nearest a brand colour is used for its roles; the brand colour itself appears only if it falls on a step. Override `ref.brand.<step>` to pin an exact value. Custom spacing scales must define the steps the preset's roles use (`xs`, `sm`, `md`, `lg`) or override those roles.

Profiles (`data-odd-profile="navigation.compact"`) override layout and component roles with their alias closure and keep applying inside nested scopes; where two profiles set the same role on one element, the later one in the configuration wins. Conditions compile to literal queries; changing a threshold means regenerating.

Design and limits: [theming-and-styling.md](../../docs/architecture/theming-and-styling.md). Not yet: Sass outputs, DTCG Resolver documents, and DTCG import.