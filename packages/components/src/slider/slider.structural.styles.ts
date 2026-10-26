import { css } from '@oddkin/core/styles';
import { rangeStructuralStyles } from '../styles/range.structural.styles.js';
import { sliderRecipeStyles } from './slider.recipe.styles.js';

/**
 * The slider is a block: the shared slider area (track, fill, and thumb), the label and the output
 * sharing a row, and the endpoint labels under the track's ends (those rows are the layout recipe
 * in `slider.recipe.ts`). No brand tokens.
 */
export const sliderStructuralStyles = css`
  ${sliderRecipeStyles}
  ${rangeStructuralStyles}
  :host {
    display: block;
  }
  .heading > .output {
    margin-inline-start: auto;
  }
`;
