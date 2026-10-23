import { css } from '@oddkin/core/styles';

/** The checkbox is a block holding one clickable row: the box beside its label. No brand tokens. */
export const checkboxStructuralStyles = css`
  :host {
    display: block;
  }
  .choice {
    display: inline-flex;
    align-items: center;
    max-inline-size: 100%;
    cursor: pointer;
  }
  .label {
    min-inline-size: 0;
  }
  .choice:has(.indicator-box:disabled) {
    cursor: not-allowed;
  }
`;
