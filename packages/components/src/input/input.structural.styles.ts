import { css } from '@oddkin/core/styles';

/**
 * The input is a block; its field layout is the shared `fieldStructuralStyles`. The search
 * field's clear button sits among the adornments, which ignore the pointer, and takes clicks. A
 * number field's stepper is a row of two buttons over the field's end, its full height. No brand
 * tokens.
 */
export const inputStructuralStyles = css`
  :host {
    display: block;
  }
  .clear,
  .step {
    display: grid;
    place-items: center;
    margin: 0;
    padding: 0;
    border: 0;
    background: none;
    color: inherit;
    font: inherit;
    cursor: pointer;
    pointer-events: auto;
  }
  .step:disabled {
    cursor: not-allowed;
  }
  .stepper {
    display: flex;
    justify-self: end;
    align-self: stretch;
  }
`;
