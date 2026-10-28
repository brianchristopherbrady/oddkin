import { css } from '@oddkin/core/styles';
import { token } from '@oddkin/tokens/refs';
import { changeReviewRecipeStyles } from './change-review.recipe.styles.js';

/** The arrangement is the layout recipe in `change-review.recipe.ts`. */
export const changeReviewStyles = css`
  ${changeReviewRecipeStyles}
  .list {
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .proposal {
    padding: ${token('space.sm')};
    border: ${token('border.width.default')} solid ${token('color.border.default')};
    border-radius: ${token('radius.md')};
    background: ${token('color.surface.default')};
  }
  .proposal[data-status='stale'],
  .proposal[data-status='failed'] {
    border-color: ${token('color.danger.foreground')};
  }
  p {
    margin: 0;
  }
  .label {
    font-weight: ${token('font.weight.semibold')};
  }
  /* Only the diff segments preserve whitespace; template whitespace around them collapses. */
  .segments {
    white-space: pre-wrap;
  }
  .code {
    padding: ${token('space.xs')};
    border-radius: ${token('radius.sm')};
    background: ${token('color.surface.sunken')};
    font-family: ${token('font.family.mono')};
    font-size: ${token('font.size.sm')};
    overflow-x: auto;
  }
  del {
    background: ${token('color.danger.surface')};
    color: ${token('color.danger.foreground')};
  }
  ins {
    background: ${token('color.success.surface')};
    color: ${token('color.success.foreground')};
    text-decoration: underline;
  }
  .split > div {
    min-inline-size: 0;
  }
  .state {
    font-size: ${token('font.size.sm')};
    color: ${token('color.text.secondary')};
  }
  .state:is([data-status='stale'], [data-status='failed']) {
    color: ${token('color.danger.foreground')};
  }
  .state[data-status='applied'] {
    color: ${token('color.success.foreground')};
  }
  @media (forced-colors: active) {
    del {
      text-decoration: line-through;
    }
  }
`;
