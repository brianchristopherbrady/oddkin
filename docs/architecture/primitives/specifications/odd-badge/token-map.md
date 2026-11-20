# Badge tokens and anatomy mapping

| Design layer | Source token or mapping | Default fixture behavior |
| --- | --- | --- |
| Base fill and text | `color.<tone>.surface`, `color.<tone>.foreground` through shared tone styles | Neutral, info, success, warning and danger resolve in the active theme. |
| Gap | `space.2xs` | 4 px at the default 16 px root. |
| Insets | `space.3xs` block, `space.xs` inline | 2 px and 8 px respectively at the default root. Logical inline sides permit RTL. |
| Corners | `--odd-badge-radius` with `radius.sm` fallback | 4 px default. |
| Text | Sans family, `font.size.xs`, `font.weight.medium`, `line-height.normal`, `letter-spacing.normal` | 12 px / 500 / 18 px line box at the default root. |
| Marker | `icon.size.sm` | 16 px decorative SVG in a lane at least one line high. Neutral/info use information, success uses check-circle, warning/danger use warning. |
| Forced colors | System `CanvasText` boundary | 1 CSS px in the existing forced-colors rule. |
| Figma Show marker boolean | Inverse of `noMarker` | Toggling it hides the entire marker lane. |
| Figma Label property | Default text slot | Width follows content or the parent grant, with automatic height. |

The default single-line surface is 22 px high. The difference between its 18 px first line and 16 px marker yields a 1 px centering offset in the default fixture. That derived geometry is neither an added public token nor a fixed label height. Compact density is an explicit inherited scope and remains independent of width. The live Figma audit records current binding IDs and the screenshot comparisons document renderer or font differences. [Contract](./contract.md)
