import { css } from '@oddkin/core/styles';
import { token } from '@oddkin/tokens/refs';

/** Oddkin's default checkbox row: Figma `checkbox` (`space.sm` between box and label, the target size). */
export const checkboxStyles = css`
  .choice {
    gap: ${token('space.sm')};
    min-block-size: ${token('target.min')};
    padding-inline: ${token('space.2xs')};
  }
  .field:has(.indicator-box:disabled) .label {
    color: ${token('color.text.disabled')};
  }
`;
