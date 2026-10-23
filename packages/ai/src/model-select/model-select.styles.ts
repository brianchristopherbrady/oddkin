import { css } from '@oddkin/core/styles';

/** Layout only: the field look is the shared control module (`controlStyles`). */
export const modelSelectStyles = css`
  :host {
    display: inline-grid;
    /* A fixed 0 minimum lets the select shrink below its longest option (narrow containers, wide fonts). */
    grid-template-columns: minmax(0, auto);
  }
  .details {
    display: grid;
    max-inline-size: 32rem;
  }
`;
