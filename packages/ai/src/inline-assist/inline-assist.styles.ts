import { css } from '@oddkin/core/styles';
import { token } from '@oddkin/tokens/refs';
import { inlineAssistRecipeStyles } from './inline-assist.recipe.styles.js';

/**
 * The arrangement is the layout recipe in `inline-assist.recipe.ts`. The language select is
 * never wider than its row (narrow containers, wide fonts).
 */
export const inlineAssistStyles = css`
  ${inlineAssistRecipeStyles}
  .toolbar [aria-disabled='true'] {
    color: ${token('color.text.disabled')};
    cursor: not-allowed;
  }
  select {
    max-inline-size: 100%;
    min-block-size: ${token('target.min')};
    border: ${token('border.width.default')} solid ${token('color.border.default')};
    border-radius: ${token('control.radius')};
    background: ${token('color.surface.default')};
    color: inherit;
    font: inherit;
  }
  p {
    margin: 0;
  }
  .message {
    font-size: ${token('font.size.sm')};
    color: ${token('color.text.secondary')};
  }
  .message:is([data-status='failed'], [data-status='blocked']) {
    color: ${token('color.danger.foreground')};
  }
  .result {
    padding: ${token('space.sm')};
    border-radius: ${token('radius.md')};
    background: ${token('color.surface.sunken')};
  }
  .content > :first-child {
    margin-block-start: 0;
  }
  .content > :last-child {
    margin-block-end: 0;
  }
`;
