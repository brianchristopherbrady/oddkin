import { css } from '@oddkin/core/styles';
import { emptyStateRecipeStyles } from './empty-state.recipe.styles.js';

/** A centred column; the media circle centres its content. No brand or visual tokens. */
export const emptyStateStructuralStyles = css`
  ${emptyStateRecipeStyles}
  :host {
    display: block;
  }
  .empty {
    text-align: center;
    overflow-wrap: anywhere;
  }
  .media:not([hidden]) {
    display: grid;
    place-items: center;
    border-radius: 50%;
  }
  .label {
    margin: 0;
  }
`;
