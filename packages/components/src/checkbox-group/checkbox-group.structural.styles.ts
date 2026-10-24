import { css } from '@oddkin/core/styles';

/**
 * The group is a block; its legend, description, and error use the shared field layout. The
 * choices stack, or line up and wrap (`orientation="horizontal"`). No brand tokens.
 */
export const checkboxGroupStructuralStyles = css`
  :host {
    display: block;
  }
  .options {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
  }
  :host([orientation='horizontal']) .options {
    flex-direction: row;
    flex-wrap: wrap;
  }
`;
