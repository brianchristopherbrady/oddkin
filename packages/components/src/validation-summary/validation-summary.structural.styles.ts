import { css } from '@oddkin/core/styles';
import { validationSummaryRecipeStyles } from './validation-summary.recipe.styles.js';

/**
 * The heading row (glyph and heading) above the list, in one column that wraps long text (the
 * layout recipe in `validation-summary.recipe.ts`). No brand or visual tokens.
 */
export const validationSummaryStructuralStyles = css`
  ${validationSummaryRecipeStyles}
  :host {
    display: block;
  }
  .summary {
    overflow-wrap: anywhere;
  }
  .marker {
    display: inline-flex;
    flex: none;
  }
  .label {
    margin: 0;
  }
  .list {
    margin: 0;
    padding: 0;
    list-style: none;
  }
`;
