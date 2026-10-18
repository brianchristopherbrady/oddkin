import { css } from '@oddkin/core/styles';

/** Layout the field depends on: stacked label, help, control, and error. No brand tokens. */
export const inputStructuralStyles = css`
  :host {
    display: block;
  }
  .field {
    display: flex;
    flex-direction: column;
    min-inline-size: 0;
    /* Long labels, help, and errors wrap instead of widening the field. */
    overflow-wrap: anywhere;
  }
  .control {
    box-sizing: border-box;
    inline-size: 100%;
    margin: 0;
    font: inherit;
  }
  @media (forced-colors: active) {
    .control {
      border: 1px solid FieldText;
    }
    .control[aria-invalid='true'] {
      border-width: 2px;
    }
  }
`;
