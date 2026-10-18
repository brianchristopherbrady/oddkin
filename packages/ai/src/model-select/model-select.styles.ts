import { css } from '@oddkin/core/styles';
import { token } from '@oddkin/tokens/refs';

export const modelSelectStyles = css`
  :host {
    display: inline-grid;
    gap: ${token('space.2xs')};
  }
  .label {
    font-size: ${token('font.size.sm')};
    font-weight: ${token('font.weight.medium')};
  }
  .select {
    min-block-size: ${token('target.min')};
    padding-inline: ${token('space.xs')};
    border: ${token('border.width.default')} solid ${token('color.border.default')};
    border-radius: ${token('control.radius')};
    background: ${token('color.surface.default')};
    color: inherit;
    font: inherit;
  }
  .details {
    display: grid;
    max-inline-size: 32rem;
  }
`;
