import { css } from '@oddkin/core/styles';
import { token } from '@oddkin/tokens/refs';

export const questionStyles = css`
  .form {
    display: grid;
    gap: ${token('space.xs')};
    padding: ${token('space.sm')};
    border: ${token('border.width.default')} solid ${token('color.border.strong')};
    border-radius: ${token('radius.md')};
    background: ${token('color.surface.raised')};
  }
  fieldset {
    display: grid;
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
  .options {
    display: grid;
    gap: ${token('space.2xs')};
  }
  .option {
    display: flex;
    align-items: center;
    gap: ${token('space.xs')};
    min-block-size: ${token('target.min')};
  }
  .field {
    display: grid;
    gap: ${token('space.2xs')};
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
    color: ${token('color.text.danger')};
  }
`;
