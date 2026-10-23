import { css } from '@oddkin/core/styles';

/**
 * What the tree's behaviour depends on beyond the navigation rows (`navRowStructuralStyles`):
 * a column of rows indented by their level, the chevron box (also the leaf rows' spacer, so labels
 * at one level line up), and the state rows. No visual tokens; the skin sets `--_indent`.
 */
export const treeStructuralStyles = css`
  :host {
    display: block;
  }
  .root,
  .tree {
    display: flex;
    flex-direction: column;
  }
  .entry {
    inline-size: auto;
    margin-inline-start: calc(var(--_level, 0) * var(--_indent, 1em));
  }
  .toggle {
    display: inline-flex;
    flex: none;
    align-items: center;
    justify-content: center;
    inline-size: 1.25em;
    block-size: 1.25em;
  }
  .state {
    display: flex;
    align-items: center;
  }
`;
