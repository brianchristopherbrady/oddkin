import { css } from '@oddkin/core/styles';
import { token } from '@oddkin/tokens/refs';

export const responseFeedbackStyles = css`
  .base {
    display: grid;
    gap: ${token('space.xs')};
  }
  .form {
    display: grid;
    gap: ${token('space.xs')};
    max-inline-size: 36rem;
  }
  fieldset {
    display: grid;
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
    display: flex;
    align-items: center;
    gap: ${token('space.xs')};
    min-block-size: ${token('target.min')};
  }
  .field {
    display: grid;
    gap: ${token('space.2xs')};
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
    color: ${token('color.text.danger')};
  }
  .outcome[data-status='submitted'] {
    color: ${token('color.text.success')};
  }
`;
