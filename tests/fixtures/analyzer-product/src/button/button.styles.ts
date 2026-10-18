import { css } from '@oddkin/core/styles';
import { token } from '@oddkin/tokens/refs';

export const studioButtonStyles = css`
  [part='control'] {
    border-radius: var(--studio-button-radius, 2px);
    background: ${token('color.action.default')};
  }
`;
