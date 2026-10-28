import { css } from '@oddkin/core/styles';
import { token } from '@oddkin/tokens/refs';
import { sourcesRecipeStyles } from './sources.recipe.styles.js';

/** The arrangement is the layout recipe in `sources.recipe.ts`. */
export const sourcesStyles = css`
  ${sourcesRecipeStyles}
  .heading {
    margin: 0 0 ${token('space.xs')};
    font-size: ${token('font.size.sm')};
    font-weight: ${token('font.weight.semibold')};
    color: ${token('color.text.secondary')};
  }
  .list {
    margin: 0;
    padding-inline-start: ${token('space.lg')};
    font-size: ${token('font.size.sm')};
  }
  .item {
    padding: ${token('space.2xs')} ${token('space.xs')};
    border-radius: ${token('radius.sm')};
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
  .excerpt {
    color: ${token('color.text.secondary')};
  }
`;
