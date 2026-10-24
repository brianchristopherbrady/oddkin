import { css } from '@oddkin/core/styles';
import { token } from '@oddkin/tokens/refs';

/**
 * Oddkin's default split-button look beyond the button look of both halves (Figma `splitAction`):
 * two separate buttons a small gap apart.
 */
export const splitButtonStyles = css`
  :host {
    gap: ${token('space.2xs')};
  }
`;
