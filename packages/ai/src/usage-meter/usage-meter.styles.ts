import { css } from '@oddkin/core/styles';
import { token } from '@oddkin/tokens/refs';
import { usageMeterRecipeStyles } from './usage-meter.recipe.styles.js';

/** The arrangement is the layout recipe in `usage-meter.recipe.ts`. */
export const usageMeterStyles = css`
  ${usageMeterRecipeStyles}
  .list {
    margin: 0;
    font-size: ${token('font.size.sm')};
  }
  .entry {
    display: grid;
    grid-template-columns: minmax(6rem, max-content) 1fr;
    gap: ${token('space.xs')};
    align-items: baseline;
  }
  dt {
    color: ${token('color.text.secondary')};
  }
  dd {
    display: grid;
    gap: ${token('space.2xs')};
    margin: 0;
  }
  .entry[data-precision='estimated'] .value {
    font-style: italic;
  }
  .entry[data-precision='unknown'] .value {
    color: ${token('color.text.secondary')};
  }
  meter {
    inline-size: 100%;
    max-inline-size: 16rem;
  }
`;
