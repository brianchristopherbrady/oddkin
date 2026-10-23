import { css } from '@oddkin/core/styles';
import { token } from '@oddkin/tokens/refs';

/**
 * The overlay look (Figma `popover`, `tooltip`, `Menu`, `ListboxSurface`, and the open `select`,
 * `combobox`, and `multiselect`): the raised surface, the default border, `control.radius`, and
 * `elevation.md`. `.sheet` is the modal look of `dialog`, `alertDialog`, and `drawer`: the default
 * surface, `card.radius`, `elevation.xl`, and the scrim behind it. Spacing is the consumer's.
 */
export const overlaySurfaceStyles = css`
  .overlay-surface,
  :host([popover]) {
    border-width: ${token('border.width.default')};
    border-color: ${token('color.border.default')};
    border-radius: ${token('control.radius')};
    background: ${token('color.surface.raised')};
    color: ${token('color.text.primary')};
    box-shadow: ${token('elevation.md')};
    font-family: ${token('type.body.family')};
    font-size: ${token('type.body.size')};
    line-height: ${token('type.body.line-height')};
  }
  .overlay-surface.sheet {
    border-radius: ${token('card.radius')};
    background: ${token('color.surface.default')};
    box-shadow: ${token('elevation.xl')};
  }
  .overlay-surface.sheet::backdrop {
    background: ${token('color.scrim')};
  }
`;
