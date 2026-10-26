import { css } from '@oddkin/core/styles';
import { listboxRecipeStyles } from './listbox.recipe.styles.js';

/**
 * What the listbox's behaviour depends on beyond the field layout and the option rows: the surface
 * stacking the listbox and its states, the listbox scrolling within `--odd-listbox-max-height`
 * (so the active option can be scrolled into view), and groups as columns. No visual tokens.
 */
export const listboxStructuralStyles = css`
  ${listboxRecipeStyles}
  :host {
    display: block;
  }
  .surface,
  .listbox,
  .group {
    display: flex;
    flex-direction: column;
  }
  .listbox {
    max-block-size: var(--odd-listbox-max-height, none);
    overflow-y: auto;
  }
`;
