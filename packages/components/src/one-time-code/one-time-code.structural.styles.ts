import { css } from '@oddkin/core/styles';

/**
 * The code is a block; its label, description, and error use the shared field layout. The
 * native input and the row of cells share one grid cell: the input covers the cells, takes the
 * pointer and the keys, and is transparent (`opacity: 0`); each cell centres its digit and,
 * after the last digit, the caret. While focused, the active cell carries the focus ring. No
 * brand tokens.
 */
export const oneTimeCodeStructuralStyles = css`
  :host {
    display: block;
  }
  .box {
    display: inline-grid;
  }
  .box > * {
    grid-area: 1 / 1;
  }
  .code {
    block-size: 100%;
    min-block-size: 0;
    opacity: 0;
  }
  .cells {
    display: flex;
    pointer-events: none;
  }
  .cell {
    display: flex;
    box-sizing: border-box;
    align-items: center;
    justify-content: center;
    font-variant-numeric: tabular-nums;
  }
  .caret {
    display: none;
    inline-size: 1px;
    block-size: 1em;
  }
  .code:focus + .cells .caret {
    display: block;
  }
  .status:not([hidden]) {
    display: flex;
    align-items: center;
  }
`;
