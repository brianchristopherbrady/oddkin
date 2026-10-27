import { css } from '@oddkin/core/styles';
import { token } from '@oddkin/tokens/refs';

/**
 * Oddkin's default stat: Figma `stat` (the card surface: `card.padding`, `card.radius`, a
 * `color.border.default` border; the label in the secondary UI role, the value in the display
 * role, the context small and secondary; `space.xs` apart; the loading placeholder on the sunken
 * surface, one line of the value tall).
 */
export const statStyles = css`
  .base {
    padding: ${token('card.padding')};
    border: ${token('border.width.default')} solid ${token('color.border.default')};
    border-radius: ${token('card.radius')};
    background: ${token('color.surface.default')};
  }
  .label {
    color: ${token('color.text.secondary')};
    font-family: ${token('type.ui.family')};
    font-size: ${token('type.ui.size')};
    font-weight: ${token('type.ui.weight')};
    line-height: ${token('type.ui.line-height')};
  }
  .value {
    color: ${token('color.text.primary')};
    font-family: ${token('type.display.family')};
    font-size: ${token('type.display.size')};
    font-weight: ${token('type.display.weight')};
    line-height: ${token('type.display.line-height')};
    letter-spacing: ${token('type.display.letter-spacing')};
  }
  .context {
    color: ${token('color.text.secondary')};
    font-family: ${token('type.small.family')};
    font-size: ${token('type.small.size')};
    font-weight: ${token('type.small.weight')};
    line-height: ${token('type.small.line-height')};
  }
  .glyph {
    font-size: ${token('icon.size.sm')};
  }
  .placeholder {
    --odd-skeleton-color: ${token('color.surface.sunken')};
    block-size: calc(${token('type.display.size')} * ${token('type.display.line-height')});
  }
`;
