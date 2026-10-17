# @mote/tokens

Theme configuration, the pure token generator, and its outputs. Browser entry points are DOM-free and use no Node APIs, so the same generator runs in the CLI, browsers, and Workers.

**Status:** M2 in progress.

| Entry | Contents |
| --- | --- |
| `@mote/tokens/theme` | `ThemeConfig` types and `defineTheme()` |
| `@mote/tokens/generate` | `generate(config)` → `{ ok, diagnostics, theme, css }`; `resolveTheme`, `resolveToken`, `emitCss`, spacing, colour, and contrast utilities |
| `@mote/tokens/schema.json` | JSON Schema (draft 2020-12) for JSON configs |
| `@mote/tokens` | Re-exports `theme` and `generate` |

```ts
import { generate } from '@mote/tokens/generate';

const { ok, css, diagnostics } = generate({ brand: { primary: '#5b46e8' } });
```

One brand colour produces a complete theme: OKLCH reference ramps (brand, neutral, danger, success), a provisional explicit `rem` spacing scale, typography, radii, control sizes, layout roles, navigation roles, and semantic colour roles chosen by measured WCAG contrast. Light, dark, and system modes; `data-mote-theme`, `data-mote-mode`, `data-mote-product`, and `data-mote-density` scopes re-declare their alias closures and nest in any order. Invalid input returns structured diagnostics (code, JSON-pointer path, message, suggestion) instead of throwing.

Design and limits: [theming-and-styling.md](../../docs/architecture/theming-and-styling.md). Not yet: the CLI and Node file I/O, typed `refs`/`values`, Sass and DTCG outputs, conditions, profiles, Worker verification, and the CSS-only example.