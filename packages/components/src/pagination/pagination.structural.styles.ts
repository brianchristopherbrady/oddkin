import { css } from '@oddkin/core/styles';

/**
 * The position text at the start and the controls at the end of one row, wrapping when narrow.
 * No brand or visual tokens.
 */
export const paginationStructuralStyles = css`
  :host {
    display: block;
  }
  .pagination {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    min-inline-size: 0;
  }
  .status {
    margin: 0;
  }
  .list {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .tile {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    box-sizing: border-box;
    margin: 0;
    border-style: solid;
    font: inherit;
    text-decoration: none;
    cursor: pointer;
  }
  .tile:disabled,
  .tile[aria-disabled='true'] {
    cursor: not-allowed;
  }
  .ellipsis {
    display: inline-flex;
  }
  @media (forced-colors: active) {
    .tile {
      border-color: ButtonText;
    }
    .pagination .tile[aria-current='page'] {
      border-color: Highlight;
      background: Highlight;
      color: HighlightText;
    }
    .pagination .tile:disabled,
    .pagination .tile[aria-disabled='true'] {
      border-color: GrayText;
      color: GrayText;
    }
  }
`;
