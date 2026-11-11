import { css } from '@oddkin/core/styles';

/**
 * The code is a block; its label, description, and error use the shared field layout. The
 * native input covers the row of cells, takes the pointer and the keys, and is transparent
 * (`opacity: 0`, which also paints it above the cells). Its intrinsic text-field width does not
 * size the row. The row keeps its preferred width where it fits and its cells shrink to their
 * content minimum within a narrower allocation. Each cell is at least a digit wide and a line
 * tall without the theme's sizes, so the input it covers stays a target for the pointer: the
 * interaction never depends on the visual sheet. Each cell centres its digit and, after the last
 * digit, the caret. While focused, the active cell carries the focus ring. No brand tokens.
 */
export const oneTimeCodeStructuralStyles = css`
  :host {
    display: block;
  }
  .box {
    position: relative;
    inline-size: fit-content;
    min-inline-size: 0;
    max-inline-size: 100%;
  }
  .code {
    position: absolute;
    inset: 0;
    min-inline-size: 0;
    block-size: 100%;
    min-block-size: 0;
    opacity: 0;
  }
  .cells {
    display: flex;
  }
  .cell {
    display: flex;
    box-sizing: border-box;
    min-inline-size: 1ch;
    min-block-size: 1lh;
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
  .status {
    display: flex;
    align-items: center;
  }
`;
