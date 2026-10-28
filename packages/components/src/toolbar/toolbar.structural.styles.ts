import { css } from '@oddkin/core/styles';
import { toolbarRecipeStyles } from './toolbar.recipe.styles.js';

/**
 * Controls in a wrapping row (a column when vertical: the layout recipe in `toolbar.recipe.ts`);
 * an `<hr>` child is a line across the row. No brand or visual tokens.
 */
export const toolbarStructuralStyles = css`
  ${toolbarRecipeStyles}
  :host {
    display: block;
  }
  ::slotted(hr) {
    align-self: stretch;
    margin: 0;
    border: 0;
  }
  @media (forced-colors: active) {
    .toolbar {
      border-color: CanvasText;
    }
    /* Above the skin's separator colour. */
    :host ::slotted(hr) {
      background: CanvasText;
    }
  }
`;
