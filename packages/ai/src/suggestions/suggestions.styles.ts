import { css } from '@oddkin/core/styles';
import { token } from '@oddkin/tokens/refs';
import { suggestionsRecipeStyles } from './suggestions.recipe.styles.js';

/** The arrangement is the layout recipe in `suggestions.recipe.ts`. */
export const suggestionsStyles = css`
  ${suggestionsRecipeStyles}
  .list {
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .item {
    display: inline-flex;
    gap: ${token('space.xs')};
    border: ${token('border.width.default')} solid ${token('color.border.default')};
    border-radius: ${token('radius.full')};
    background: ${token('color.surface.default')};
  }
  button {
    min-block-size: ${token('target.min')};
    min-inline-size: ${token('target.min')};
    padding-block: 0;
    padding-inline: ${token('space.xs')};
    border: 0;
    border-radius: ${token('control.radius')};
    background: transparent;
    color: inherit;
    font: inherit;
    font-size: ${token('font.size.sm')};
    cursor: pointer;
  }
  button:disabled {
    color: ${token('color.text.disabled')};
    cursor: not-allowed;
  }
  @media (hover: hover) {
    button:not(:disabled):hover {
      background: ${token('color.surface.hover')};
    }
  }
  @media (forced-colors: active) {
    .item {
      border-color: ButtonText;
    }
  }
`;
