import { css } from '@oddkin/core/styles';
import { token } from '@oddkin/tokens/refs';
import { questionRecipeStyles } from './question.recipe.styles.js';

/** The arrangement is the layout recipe in `question.recipe.ts`. */
export const questionStyles = css`
  ${questionRecipeStyles}
  .form {
    padding: ${token('space.sm')};
    border: ${token('border.width.default')} solid ${token('color.border.strong')};
    border-radius: ${token('radius.md')};
    background: ${token('color.surface.raised')};
  }
  fieldset {
    /* Not a grid: WebKit keeps a grid fieldset's legend at its old width after the container shrinks. */
    display: flex;
    flex-direction: column;
    gap: ${token('space.xs')};
    margin: 0;
    padding: 0;
    border: 0;
  }
  .prompt {
    padding: 0;
    font-weight: ${token('font.weight.semibold')};
  }
  p {
    margin: 0;
  }
  .option {
    min-block-size: ${token('target.min')};
  }
  :is(input:not([type='radio'], [type='checkbox']), textarea, select) {
    min-block-size: ${token('target.min')};
    padding: ${token('space.2xs')} ${token('space.xs')};
    border: ${token('border.width.default')} solid ${token('color.border.default')};
    border-radius: ${token('control.radius')};
    background: ${token('color.surface.default')};
    color: inherit;
    font: inherit;
  }
  .state {
    font-size: ${token('font.size.sm')};
    color: ${token('color.text.secondary')};
  }
  .state[data-status='failed'] {
    color: ${token('color.danger.foreground')};
  }
`;
