import { css } from '@oddkin/core/styles';

/**
 * What the navigation's behavior depends on beyond the shared navigation rows
 * (`navRowStructuralStyles`): list resets, the hidden state of collapsed groups, slotted native
 * links laid out as rows, and their forced-colors marker. No visual tokens; the arrangement comes
 * from the `side-nav` recipe. The forced-colors marker is prefixed with `.root` to outrank a
 * skin's state rules, which load later with equal specificity.
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
  ::slotted(a) {
    box-sizing: border-box;
    display: flex;
    align-items: center;
    color: inherit;
    text-decoration: none;
    overflow-wrap: anywhere;
  }
  @media (forced-colors: active) {
    .root ::slotted(a[aria-current='page']) {
      border-inline-start-color: Highlight;
    }
  }
`;
