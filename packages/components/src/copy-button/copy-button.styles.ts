import { css } from '@oddkin/core/styles';
import { token } from '@oddkin/tokens/refs';

/**
 * Oddkin's default copy button: Figma `copyButton` (the small secondary button with the copy or
 * check glyph; the outcome `space.xs` away in the small role, secondary when copied and in the
 * danger colour when it failed).
 */
export const copyButtonStyles = css`
  .base {
    gap: ${token('space.xs')};
  }
  .odd-button .glyph {
    font-size: ${token('icon.size.sm')};
  }
  .status {
    color: ${token('color.text.secondary')};
    font-family: ${token('type.small.family')};
    font-size: ${token('type.small.size')};
    font-weight: ${token('type.small.weight')};
    line-height: ${token('type.small.line-height')};
  }
  .status[data-status='failed'] {
    color: ${token('color.danger.foreground')};
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
