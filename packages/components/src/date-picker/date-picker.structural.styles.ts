import { css } from '@oddkin/core/styles';

/**
 * The date picker is a block with the shared field layout; its calendar button sits among the
 * field's end adornments, which ignore the pointer, and takes clicks. The popup is the shared
 * overlay surface holding the calendar. No brand tokens.
 */
export const datePickerStructuralStyles = css`
  :host {
    display: block;
  }
  .button {
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
  .button:disabled {
    cursor: not-allowed;
  }
`;
