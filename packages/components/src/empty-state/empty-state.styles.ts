import { css } from '@oddkin/core/styles';
import { token } from '@oddkin/tokens/refs';

/** Oddkin's default empty state: Figma `emptyState` (sunken media circle, title, Body text). */
export const emptyStateStyles = css`
  .empty {
    gap: ${token('space.sm')};
    padding: ${token('space.lg')};
    color: ${token('color.text.secondary')};
    font-family: ${token('type.body.family')};
    font-size: ${token('type.body.size')};
    font-weight: ${token('type.body.weight')};
    line-height: ${token('type.body.line-height')};
  }
  .media {
    inline-size: ${token('space.3xl')};
    block-size: ${token('space.3xl')};
    background: ${token('color.surface.sunken')};
    color: ${token('color.text.secondary')};
    font-size: ${token('icon.size.lg')};
  }
  .label {
    color: ${token('color.text.primary')};
    font-family: ${token('type.title.family')};
    font-size: ${token('type.title.size')};
    font-weight: ${token('type.title.weight')};
    line-height: ${token('type.title.line-height')};
    letter-spacing: ${token('type.title.letter-spacing')};
  }
  .footer {
    gap: ${token('space.xs')};
    margin-block-start: ${token('space.xs')};
  }
`;
