import { css } from '@oddkin/core/styles';

/** A block holding one `.choice` row (control-indicator module). No brand tokens. */
export const checkboxStructuralStyles = css`
  :host {
    display: block;
  }
  .choice {
    align-items: flex-start;
  }
  .choice > .label,
  .description,
  .error {
    white-space: normal;
    overflow-wrap: anywhere;
  }
`;
