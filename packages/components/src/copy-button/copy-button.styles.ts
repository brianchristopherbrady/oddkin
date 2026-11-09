import { css } from '@oddkin/core/styles';
import { token } from '@oddkin/tokens/refs';

/**
 * Oddkin's default copy button: Figma `copyButton` (the small secondary button with the copy or
 * check glyph; the outcome in the small role, secondary when copied and in the danger colour when
 * it failed). A failure sits `space.xs` from the button; the confirmation is a small overlay
 * surface `space.2xs` from it, whose `row-gap` carries that distance to the placement.
 */
export const copyButtonStyles = css`
  .base {
    gap: ${token('space.xs')};
  }
  .odd-button .glyph {
    font-size: ${token('icon.size.sm')};
  }
  .status,
  .confirmation {
    color: ${token('color.danger.foreground')};
    font-family: ${token('type.small.family')};
    font-size: ${token('type.small.size')};
    font-weight: ${token('type.small.weight')};
    line-height: ${token('type.small.line-height')};
  }
  .confirmation {
    row-gap: ${token('space.2xs')};
    padding: ${token('space.2xs')} ${token('space.xs')};
    color: ${token('color.text.secondary')};
  }
  .fallback {
    padding: ${token('space.2xs')} ${token('space.xs')};
    border: ${token('border.width.default')} solid ${token('color.border.strong')};
    border-radius: ${token('control.radius')};
    background: ${token('color.surface.default')};
    color: ${token('color.text.primary')};
    font-family: ${token('type.code.family')};
  }
`;
