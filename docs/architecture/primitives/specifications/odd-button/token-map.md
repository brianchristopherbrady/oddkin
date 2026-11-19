# odd-button — authored token map

Source authority: the lane’s authored token preset and default theme. The runtime skin reads `token()` from `@oddkin/tokens/refs`. The v2 table below records observed Figma bindings and resolved values. [Preset](../../../../../packages/tokens/src/generate/preset.ts) · [Default theme](../../../../../packages/tokens/themes/default.theme.json)

| Property/state | Existing source token | Default resolved value / use |
| --- | --- | --- |
| sm/md/lg minimum height | `control.height.sm/md/lg`, clamped by `target.min` | 2rem /2.5rem /3rem; default root16px gives32/40/48px. Compact density0.75 scales eligible control heights to24/30/36px, never below target.min. |
| Interactive target floor | `target.min` | 1.5rem. The element and native recipe clamp their icon-only inline and block minima. Fixture size is not a new token. |
| sm/md/lg inline padding | `control.padding.inline.sm/md/lg` | space.xs/sm/md =0.5/0.75/1rem. |
| Adornment gap | `control.gap` | space.xs=0.5rem. |
| Block padding | `space.none` |0. Natural text height can exceed minimum; never fix multiline height to the single-line token. |
| Control corner | `control.radius` | radius.md=0.5rem; existing `--odd-button-radius` override. |
| Border | `border.width.default` |1px; secondary uses color.border.strong, primary/ghost transparent unless overridden. |
| UI type family/size/weight/leading/tracking | `type.ui.family/size/weight/line-height/letter-spacing` | System sans stack;0.875rem;500;1.375;0. Default root16px yields14px type,19.25px line box. Use actual available equivalent system font/Figma source style, document any font resolution difference. |
| lg type size | `type.body.size` |1rem; other UI role properties remain from ui in current skin. Do not silently change lg weight/leading to complete body style. |
| Primary rest/hover/down fill | `color.action.default/hover/pressed` | Light#6250e8/#5140cc/#4333ad; dark#b4a8ff/#c5bcff/#9b8cf0. |
| Primary text | `color.text.on-action` | Light#fff alias neutral0; dark#23252b. |
| Secondary fill/text/border | `color.surface.default`, `color.text.primary`, `color.border.strong` | Light#fff/#23252b/#868997; dark#242631/#f5f3fd/#858395. |
| Secondary/ghost hover and down fill | `color.surface.hover`, `color.surface.sunken` | Light#f0eff5/#f0eff3; dark#30323f/#111219. |
| Ghost rest | Transparent fill; `color.text.primary` | Host canvas/actual resolved background must be visible in theme review. |
| Pressed toggle fill/text | `color.selection.background/foreground` | Aliases action.default/text.on-action. Selected remains solid iris in all appearances. Proposed selected-loading consistency reuses these existing values. |
| Focus outline | `focus.width`, `focus.offset`, `color.focus.ring` |2px width+2px outward offset; focus.ring aliases action.default. Outside layout; host must allow space and avoid clipping. |
| Disabled | Existing whole-control opacity0.5, no new gray token | Retains appearance/selection underneath; current forced-colors branch uses system GrayText and opacity1. |
| Loading | Shared spinner currentColor,1em ring with0.15em border,50% radius | Intrinsic structural dimensions, not spacing tokens. Existing module spins0.8s and slows3s under reduced motion. Static Figma states do not prove animation/AT behavior. |
| State paint transitions | `motion.duration.fast`, `motion.easing.standard` |100ms/cubic-bezier(0.4,0,0.2,1); token reduced-motion duration0ms. |
| Parent action-row gap/inset/status spacing | Existing `space.sm/md/lg` as appropriate to host anatomy |0.75/1/1.5rem. Root author selects actual composition role; no new button-private gap for siblings. |
| Review canvas/stage | `color.canvas`, optional `color.surface.specimen` | Canvas light#f6f5f1/dark#171821. Specimen surface is documentation-only, never selected-control paint. |

No new semantic token is required. Border transparency, opacity0.5, percentages, CSS100% fullWidth, spinner ems and document fixture allocations are explicitly structural/behavioral values rather than invented tokens. The retained-content loading proposal can reuse all existing color/type/spacing values.

Figma binding audit must show per-property exact variable/style IDs, light/dark resolved values, standard/compact density values and actual specimen nodes; names alone are insufficient. Unsupported font/effect/numeric binding fields must be recorded, not represented as bound. Contrast is evaluated against actual resolved themed hosts and active states separately from intentional disabled states.

## v2 additions (2026-11-18)

Values resolved from the shipped theme in headless Chromium (`.tmp/pa-button/tokens.mjs` in the implementation tree), comfortable / compact.

| Property/state | Source token → CSS | Figma variable (ID) | Resolved value |
| --- | --- | --- | --- |
| Icon beside text, sm and md | `icon.size.sm` → `--odd-icon-size` on the control | `icon/size/sm` (`VariableID:158:83`) on the icon's width/height | 16 / 16 px |
| Icon beside text, lg | `icon.size.md` | `icon/size/md` (`VariableID:158:84`) | 20 / 20 px |
| Icon alone, sm and md | `icon.size.md` | `icon/size/md` | 20 / 20 px |
| Icon alone, lg | `icon.size.lg` | `icon/size/lg` (`VariableID:158:85`) | 24 / 24 px |
| Icon-only square | `control.height.sm/md/lg` (≥ `target.min`) as inline and block size; inline padding `space.none` | `control/height/*` bound to the inner frame's `minWidth` and `minHeight`; padding `space/none` | 32/40/48, compact 24/30/36 px |
| Icon colour | `currentColor` (inherits the control's `color`: text primary, on-action, selection foreground) | `content/current` (`VariableID:1460:3`) in collection `Oddkin · Content colour` (`VariableCollectionId:1460:2`); modes Text → `color/text/primary`, On action → `color/text/on-action`, Selection → `color/selection/foreground`; code syntax `currentColor`. Each button variant's inner frame sets the mode; all 1,723 icon components' strokes bind it | Light #23252b / #fff / #fff; dark #f5f3fd / #23252b / #23252b |
| Loading icon retention | Content `opacity: 0` | Icons in variant-owned "slot" frames with opacity 0, visibility tied to `Show icon` / `Show end icon` | Footprint equal to the resting state |
| Focus review row clearance | `space.xs` on block edges | `space/xs` (`VariableID:158:53`) on both themed fixture rows | 8 px above and below a 40 px button. A 4 px outline extends into that space. |
| Link recipe | `text-decoration: none`; hover/active fills from the existing `color.action.*` and `color.surface.*` tokens | — (recipe specimen documented, not a Figma variant) | — |

No new code token. `content/current` is a Figma-only alias layer that plays the role of CSS `currentColor`; it aliases existing role variables and publishes no new value. Compact density keeps icon sizes, so a compact sm icon-only button is a 24 px square around a 20 px icon (Fluent's small icon button has the same proportions).
