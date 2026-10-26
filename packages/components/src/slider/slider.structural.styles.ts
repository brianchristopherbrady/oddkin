import { css } from '@oddkin/core/styles';
import { rangeStructuralStyles } from '../styles/range.structural.styles.js';

/**
 * The slider is a block: the shared slider area (track, fill, and thumb), the label and the output
 * sharing a row, and the endpoint labels under the track's ends. No brand tokens.
 */
export const sliderStructuralStyles = css`
  ${rangeStructuralStyles}
  :host {
    display: block;
  }
  .heading,
  .endpoints {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
  }
  .heading > .output {
    margin-inline-start: auto;
  }
`;
