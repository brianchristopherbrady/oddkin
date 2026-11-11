import { css } from '@oddkin/core/styles';
import { token } from '@oddkin/tokens/refs';
import { questionRecipeStyles } from './question.recipe.styles.js';

/**
 * The arrangement is the layout recipe in `question.recipe.ts`. The fieldset is a flex column,
 * not a grid: WebKit keeps a grid fieldset's legend at its old width after the container shrinks.
 * Its native min-content minimum must yield to the form's allocated width. Other's field shows
 * only while Other is chosen and keeps its text (ADR 0049, page 13); the rule asks the options,
 * not Other's sibling, because WebKit does not update `:has()` before `+` in a shadow root when a
 * radio is checked.
 */
export const questionStyles = css`
  ${questionRecipeStyles}
  .form {
    padding: ${token('space.sm')};
    border: ${token('border.width.default')} solid ${token('color.border.strong')};
    border-radius: ${token('radius.md')};
    background: ${token('color.surface.raised')};
  }
  fieldset {
    display: flex;
    flex-direction: column;
    gap: ${token('space.xs')};
    min-inline-size: 0;
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
  .options:not(:has(input[value='__other']:checked)) > .field {
    display: none;
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
`;
