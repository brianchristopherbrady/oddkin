import { css } from '@oddkin/core/styles';
import { fileInputRecipeStyles } from './file-input.recipe.styles.js';

/**
 * The drop zone under the label: the glyph and title in a row, then the description, the picker
 * button, and the file rows, indented under the title; each row a glyph, the name over the size,
 * and the remove button (the layout recipe in `file-input.recipe.ts`). The native input shows
 * only its button: its own file-count text is
 * sized out, since the rows list the files. No brand or visual tokens.
 */
export const fileInputStructuralStyles = css`
  ${fileInputRecipeStyles}
  :host {
    display: block;
  }
  .header,
  .file {
    align-self: stretch;
  }
  .header-glyph,
  .file-glyph {
    display: inline-flex;
  }
  .title,
  .file-text {
    flex: 1 1 auto;
    min-inline-size: 0;
  }
  .picker {
    margin: 0;
    font-size: 0;
  }
  .picker::file-selector-button {
    font-size: initial;
  }
  .files {
    align-self: stretch;
    margin: 0;
    padding: 0;
  }
  .remove {
    display: inline-flex;
    flex: none;
    align-items: center;
    justify-content: center;
    margin: 0;
    padding: 0;
    border: 0;
    font: inherit;
    cursor: pointer;
  }
`;
