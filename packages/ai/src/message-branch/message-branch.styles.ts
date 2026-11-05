import { css } from '@oddkin/core/styles';
import { token } from '@oddkin/tokens/refs';

export const messageBranchStyles = css`
  :host {
    display: inline-block;
  }
  .base {
    min-block-size: ${token('control.height.sm')};
  }
  .position {
    font-variant-numeric: tabular-nums;
  }
`;
