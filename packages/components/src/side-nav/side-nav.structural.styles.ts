import { css } from '@oddkin/core/styles';

/**
 * What the navigation's behavior depends on: list resets, full-width entries that wrap long
 * labels, the hidden state of collapsed groups, and forced-colors markers. No visual tokens;
 * the arrangement comes from the `side-nav` recipe. The forced-colors markers are prefixed with
 * `.root` to outrank a skin's state rules, which load later with equal specificity.
 */
export const sideNavStructuralStyles = css`
  .content,
  .group-items {
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .group-items {
    display: flex;
    flex-direction: column;
  }
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
    /* Long labels and translations wrap instead of widening the navigation. */
    overflow-wrap: anywhere;
  }
  .entry:disabled,
  .entry[aria-disabled='true'] {
    cursor: not-allowed;
  }
  ::slotted(a) {
    box-sizing: border-box;
    display: flex;
    align-items: center;
    color: inherit;
    text-decoration: none;
    overflow-wrap: anywhere;
  }
  @media (forced-colors: active) {
    .root .entry[aria-current='page'],
    .root ::slotted(a[aria-current='page']) {
      border-inline-start-color: Highlight;
    }
    .root .entry:disabled,
    .root .entry[aria-disabled='true'] {
      color: GrayText;
    }
  }
`;
