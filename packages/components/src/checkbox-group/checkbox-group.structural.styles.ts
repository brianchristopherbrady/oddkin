import { css } from '@oddkin/core/styles';
import { checkboxGroupRecipeStyles } from './checkbox-group.recipe.styles.js';

/**
 * The group is a block; its legend, description, and error use the shared field layout. The
 * choices stack, or line up and wrap (`orientation="horizontal"`): the layout recipe in
 * `checkbox-group.recipe.ts`. No brand tokens.
 */
export const checkboxGroupStructuralStyles = css`
  ${checkboxGroupRecipeStyles}
  :host {
    display: block;
  }
`;
