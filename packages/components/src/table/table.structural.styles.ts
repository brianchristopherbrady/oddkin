import { css } from '@oddkin/core/styles';
import { tableRecipeStyles } from './table.recipe.styles.js';

/**
 * What the table's behaviour depends on: a block host whose base scrolls a wider table inline, a
 * full-width native table with collapsed spacing, aligned cells, sort buttons reset to their
 * header's text, and the selection column as narrow as its control. No visual tokens.
 */
export const tableStructuralStyles = css`
  ${tableRecipeStyles}
  :host {
    display: block;
  }
  .root {
    overflow-x: auto;
  }
  .table {
    inline-size: 100%;
    border-collapse: separate;
    border-spacing: 0;
  }
  th,
  td {
    text-align: start;
    vertical-align: middle;
    overflow-wrap: anywhere;
  }
  .align-center {
    text-align: center;
  }
  .align-end {
    text-align: end;
  }
  .sort {
    inline-size: 100%;
    margin: 0;
    padding: 0;
    border: 0;
    background: none;
    color: inherit;
    font: inherit;
    text-align: inherit;
    cursor: pointer;
  }
  .align-center .sort {
    justify-content: center;
  }
  .align-end .sort {
    justify-content: flex-end;
  }
  .sort-mark {
    display: inline-flex;
    inline-size: 1em;
  }
  .selection {
    inline-size: 1%;
    white-space: nowrap;
  }
`;
