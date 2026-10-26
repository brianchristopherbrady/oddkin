import { css } from '@oddkin/core/styles';
import { commandPaletteRecipeStyles } from './command-palette.recipe.styles.js';

/**
 * What the command palette depends on beyond the overlay surface and the option rows: the dialog
 * placed in the upper part of the viewport at `--odd-command-palette-inline-size`, the search
 * field's row (glyph, input, hint), the results scrolling below it, and the hints in a row. No
 * brand tokens.
 */
export const commandPaletteStructuralStyles = css`
  ${commandPaletteRecipeStyles}
  :host {
    display: contents;
  }
  .palette {
    inline-size: min(var(--odd-command-palette-inline-size, 40rem), 100% - 2rem);
    max-block-size: min(36rem, 100% - 4rem);
    margin-block-start: 12vh;
  }
  .palette[open] {
    display: flex;
    flex-direction: column;
  }
  .search {
    flex: none;
  }
  .search-glyph {
    display: inline-flex;
  }
  .input {
    flex: 1 1 auto;
    min-inline-size: 0;
    margin: 0;
    padding: 0;
    border: 0;
    background: none;
    color: inherit;
    font: inherit;
  }
  .input:focus-visible {
    outline: none;
  }
  .results {
    flex: 1 1 auto;
    min-block-size: 0;
    overflow-y: auto;
  }
  .listbox,
  .group {
    display: flex;
    flex-direction: column;
  }
  .option:not([aria-disabled='true']) {
    cursor: pointer;
  }
  .footer {
    flex: none;
  }
  @media (forced-colors: active) {
    :host .listbox .option.active {
      background: Highlight;
      color: HighlightText;
    }
  }
`;
