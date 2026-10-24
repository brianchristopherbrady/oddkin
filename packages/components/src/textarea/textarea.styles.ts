import { css } from '@oddkin/core/styles';
import { token } from '@oddkin/tokens/refs';

/**
 * Oddkin's default textarea beyond the shared control module (Figma `textarea`): the text inset
 * on every side; while it follows its content, at least `rows` lines and at most
 * `--odd-textarea-max-height`.
 */
export const textareaStyles = css`
  .control {
    padding-block: ${token('space.sm')};
  }
  :host([resize='auto']) .control {
    min-block-size: calc(
      var(--_rows) * 1lh + 2 * ${token('space.sm')} + 2 * ${token('border.width.default')}
    );
    max-block-size: var(--odd-textarea-max-height, 40vh);
  }
`;
