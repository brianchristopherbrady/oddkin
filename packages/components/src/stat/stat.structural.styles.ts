import { css } from '@oddkin/core/styles';
import { statRecipeStyles } from './stat.recipe.styles.js';

/** A column: label, value, context; the arrow points down for a decrease. No tokens. */
export const statStructuralStyles = css`
  ${statRecipeStyles}
  :host {
    display: block;
  }
  .value {
    overflow-wrap: anywhere;
  }
  :host([trend='decrease']) .glyph {
    rotate: 180deg;
  }
  .placeholder {
    inline-size: 50%;
  }
`;
