import { css } from '@oddkin/core/styles';
import { radioGroupRecipeStyles } from './radio-group.recipe.styles.js';

/**
 * The group is a block; its legend, description, and error use the shared field layout. The
 * options stack, or line up and wrap (`orientation="horizontal"`); a group of options stacks its
 * heading and options (the layout recipe in `radio-group.recipe.ts`). The radio's dot is centred in
 * the round box and shows when checked. No brand tokens.
 */
export const radioGroupStructuralStyles = css`
  ${radioGroupRecipeStyles}
  :host {
    display: block;
  }
  .indicator-dot {
    inline-size: 40%;
    block-size: 40%;
  }
  .indicator-box:checked ~ .indicator-dot {
    visibility: visible;
  }
`;
