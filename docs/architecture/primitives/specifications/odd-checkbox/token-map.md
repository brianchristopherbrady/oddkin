# Checkbox token map

| Property | Existing role | Default and binding intent |
| --- | --- | --- |
| Box size | `icon.size.sm/md/lg` | 16/20/24px. |
| Check and minus | `icon.size.sm` for sm/md, `icon.size.md` for lg | 16/16/20px. Reuse existing glyphs. |
| Choice gap and inline padding | `space.sm`, `space.2xs` | 12/4px; theme density scopes scale spacing. |
| First-line lane | `target.min`, icon size, and current line height | Geometric maximum keeps the target floor and centers the indicator with the first line. |
| Typography | `type.ui.*` | Existing 14px medium label. The Figma library uses Roboto and browser uses the theme's system stack. |
| Rest, hover, disabled | `color.surface.default/hover/sunken`, `color.border.strong` | Existing visual states. |
| Selected and mixed | `color.selection.background/foreground` | Existing roles with distinct marks. |
| Invalid and focus | `color.danger.foreground`, `border.width.default/strong`, `color.focus.ring`, `focus.width/offset` | Existing color, border and focus rules. |
| Shape and motion | `radius.sm`, `motion.duration.fast` and existing easing | Existing indicator shape and reduced-motion behavior. |

Fixture grants of 320 and 176 CSS pixels are review inputs. See the run for exact variable IDs and matched geometry. CSS keeps runtime token references and the existing scope behavior.
