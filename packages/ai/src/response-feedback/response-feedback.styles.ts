import { css } from '@oddkin/core/styles';
import { token } from '@oddkin/tokens/refs';
import { responseFeedbackRecipeStyles } from './response-feedback.recipe.styles.js';

/** The arrangement is the layout recipe in `response-feedback.recipe.ts`. */
export const responseFeedbackStyles = css`
  ${responseFeedbackRecipeStyles}
  .form {
    max-inline-size: 36rem;
  }
  fieldset {
    /* Not a grid: WebKit keeps a grid fieldset's legend at its old width after the container shrinks. */
    display: flex;
    flex-direction: column;
    gap: ${token('space.2xs')};
    margin: 0;
    padding: ${token('space.xs')};
    border: ${token('border.width.default')} solid ${token('color.border.default')};
    border-radius: ${token('radius.sm')};
  }
  legend,
  .field span {
    font-size: ${token('font.size.sm')};
  }
  .check {
    min-block-size: ${token('target.min')};
  }
  textarea {
    padding: ${token('space.2xs')} ${token('space.xs')};
    border: ${token('border.width.default')} solid ${token('color.border.default')};
    border-radius: ${token('control.radius')};
    font: inherit;
    color: inherit;
    background: ${token('color.surface.default')};
  }
  .outcome[data-status='failed'] {
    color: ${token('color.danger.foreground')};
  }
  .outcome[data-status='submitted'] {
    color: ${token('color.success.foreground')};
  }
`;
