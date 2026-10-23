import { css } from '@oddkin/core/styles';

/** Inline layout of the ring and its text. No brand or visual tokens. */
export const spinnerStructuralStyles = css`
  :host {
    display: inline-block;
    vertical-align: middle;
  }
  .base {
    display: inline-flex;
    align-items: center;
  }
  .text {
    overflow-wrap: anywhere;
  }
`;
