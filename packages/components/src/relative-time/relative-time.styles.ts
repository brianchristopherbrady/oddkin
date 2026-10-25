import { css } from '@oddkin/core/styles';
import { token } from '@oddkin/tokens/refs';

/**
 * Oddkin's default relative time: Figma `relativeTime` (the small type role; the relative text in
 * the secondary colour, the absolute one in the primary colour; `space.xs` apart).
 */
export const relativeTimeStyles = css`
  .base {
    gap: ${token('space.xs')};
    font-family: ${token('type.small.family')};
    font-size: ${token('type.small.size')};
    font-weight: ${token('type.small.weight')};
    line-height: ${token('type.small.line-height')};
    letter-spacing: ${token('type.small.letter-spacing')};
  }
  .relative {
    gap: ${token('space.xs')};
    color: ${token('color.text.secondary')};
  }
  .glyph {
    font-size: ${token('icon.size.sm')};
  }
  .detail {
    color: ${token('color.text.primary')};
  }
`;
