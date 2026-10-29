import { css } from '@oddkin/core/styles';
import { token } from '@oddkin/tokens/refs';
import { contextPickerRecipeStyles } from './context-picker.recipe.styles.js';

/** The arrangement is the layout recipe in `context-picker.recipe.ts`. */
export const contextPickerStyles = css`
  ${contextPickerRecipeStyles}
  p {
    margin: 0;
  }
  .list {
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .item {
    padding: ${token('space.2xs')} ${token('space.xs')};
    border: ${token('border.width.default')} solid ${token('color.border.default')};
    border-radius: ${token('radius.sm')};
    background: ${token('color.surface.default')};
  }
  .label {
    flex: 1 1 8rem;
    min-inline-size: 0;
  }
  .kind {
    font-size: ${token('font.size.xs')};
    text-transform: uppercase;
  }
  .excerpt {
    max-block-size: 10rem;
    margin: ${token('space.2xs')} 0 0;
    overflow: auto;
    font-family: ${token('font.family.mono')};
    font-size: ${token('font.size.xs')};
    white-space: pre-wrap;
  }
  .url > label {
    min-inline-size: 0;
  }
  input[type='url'] {
    /* Its own width, but never wider than the form (narrow containers, wide fonts). */
    max-inline-size: 100%;
    min-block-size: ${token('target.min')};
    padding-inline: ${token('space.xs')};
    border: ${token('border.width.default')} solid ${token('color.border.default')};
    border-radius: ${token('control.radius')};
    background: ${token('color.surface.default')};
    color: inherit;
    font: inherit;
  }
`;
