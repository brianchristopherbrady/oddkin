import { css } from '@oddkin/core/styles';
import { token } from '@oddkin/tokens/refs';
import { sourcesRecipeStyles } from './sources.recipe.styles.js';

/** The arrangement is the layout recipe in `sources.recipe.ts`. */
export const sourcesStyles = css`
  ${sourcesRecipeStyles}
  .base {
    padding: ${token('space.md')};
    border: ${token('border.width.default')} solid ${token('color.border.default')};
    border-radius: ${token('radius.md')};
    background: ${token('color.surface.default')};
  }
  .heading {
    margin: 0;
    font-size: ${token('font.size.sm')};
    font-weight: ${token('font.weight.medium')};
  }
  .list {
    margin: 0;
    padding: 0;
    font-size: ${token('font.size.sm')};
  }
  .item {
    padding: ${token('space.2xs')} ${token('space.xs')};
    border-radius: ${token('radius.sm')};
  }
  .number {
    white-space: nowrap;
    color: ${token('color.text.secondary')};
  }
  .item[data-revealed='true'] {
    background: ${token('color.surface.hover')};
  }
  .title {
    color: ${token('color.link')};
    font-weight: ${token('font.weight.medium')};
  }
  span.title {
    color: inherit;
  }
  .line .muted {
    font-size: ${token('font.size.xs')};
  }
`;
