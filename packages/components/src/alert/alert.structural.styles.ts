import { css } from '@oddkin/core/styles';
import { alertRecipeStyles } from './alert.recipe.styles.js';

/**
 * Glyph, text column, and actions in a row that wraps the actions under the text when narrow.
 * No brand or visual tokens.
 */
export const alertStructuralStyles = css`
  ${alertRecipeStyles}
  :host {
    display: block;
  }
  .marker {
    display: inline-flex;
    flex: none;
  }
  .content {
    flex: 1 1 12rem;
    min-inline-size: 0;
    overflow-wrap: anywhere;
  }
  .label {
    margin: 0;
  }
  @media (forced-colors: active) {
    .alert {
      border: 1px solid CanvasText;
    }
  }
`;
