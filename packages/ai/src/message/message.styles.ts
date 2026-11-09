import { css } from '@oddkin/core/styles';
import { token } from '@oddkin/tokens/refs';
import { messageRecipeStyles } from './message.recipe.styles.js';

/**
 * The arrangement is the layout recipe in `message.recipe.ts`. Reasoning sits in an
 * `odd-disclosure`, which draws the surface; its text reads as secondary content, in prose weight.
 */
export const messageStyles = css`
  ${messageRecipeStyles}
  .role {
    font-size: ${token('type.ui.size')};
    font-weight: ${token('type.ui.weight')};
    line-height: ${token('type.ui.line-height')};
    letter-spacing: ${token('type.ui.letter-spacing')};
    color: ${token('color.text.secondary')};
  }
  .base[data-role='user'] .content {
    align-self: start;
    max-inline-size: 100%;
    padding: ${token('space.xs')} ${token('space.sm')};
    border-radius: ${token('radius.lg')};
    background: ${token('color.surface.sunken')};
  }
  .plain-text {
    margin: 0;
    white-space: pre-wrap;
  }
  .reasoning odd-response {
    color: ${token('color.text.secondary')};
    font-weight: ${token('font.weight.regular')};
  }
  .file {
    margin: 0;
    font-size: ${token('font.size.sm')};
  }
  .file a {
    color: ${token('color.link')};
  }
  .fallback {
    margin: 0;
    padding: ${token('space.xs')} ${token('space.sm')};
    border: ${token('border.width.default')} dashed ${token('color.border.default')};
    border-radius: ${token('radius.sm')};
    color: ${token('color.text.secondary')};
    font-size: ${token('font.size.sm')};
  }
  .edit textarea {
    inline-size: 100%;
    padding: ${token('space.xs')};
    border: ${token('border.width.default')} solid ${token('color.border.strong')};
    border-radius: ${token('control.radius')};
    background: ${token('color.surface.default')};
    color: inherit;
    font: inherit;
  }
  .versions {
    min-block-size: ${token('control.height.sm')};
  }
  .position {
    font-variant-numeric: tabular-nums;
  }
`;
