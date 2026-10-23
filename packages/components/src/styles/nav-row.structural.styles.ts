import { css } from '@oddkin/core/styles';

/**
 * Navigation rows (component-catalog.md §6 "nav-row"), shared by `odd-side-nav` and `odd-tree`:
 * full-width `.entry` rows (a link, a button, or a treeitem) with a `.label` that wraps long text.
 * Structural rules here; the look is `navRowStyles`. The forced-colours markers are prefixed with
 * `.root` (the element's container) to outrank a skin's state rules, which load later.
 */
export const navRowStructuralStyles = css`
  .entry {
    box-sizing: border-box;
    display: flex;
    align-items: center;
    inline-size: 100%;
    margin: 0;
    border: 0;
    background: transparent;
    color: inherit;
    font: inherit;
    text-align: start;
    text-decoration: none;
    cursor: pointer;
  }
  .label {
    flex: 1 1 auto;
    min-inline-size: 0;
    /* Long labels and translations wrap instead of widening the element. */
    overflow-wrap: anywhere;
  }
  .entry:disabled,
  .entry[aria-disabled='true'] {
    cursor: not-allowed;
  }
  @media (forced-colors: active) {
    .root .entry[aria-current='page'],
    .root .entry[aria-selected='true'] {
      border-inline-start-color: Highlight;
    }
    .root .entry:disabled,
    .root .entry[aria-disabled='true'] {
      color: GrayText;
    }
  }
`;
