import { css } from '@oddkin/core/styles';

/**
 * The element is the query container (`container-type: inline-size`, named `odd-container`; a
 * page rule on the element can rename it). Fluid by default here; the skin sets the measure. No
 * tokens.
 */
export const containerStructuralStyles = css`
  :host {
    display: block;
    container: odd-container / inline-size;
    min-inline-size: 0;
  }
`;
