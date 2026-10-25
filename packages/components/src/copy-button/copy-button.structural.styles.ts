import { css } from '@oddkin/core/styles';

/** The button and its status in a row that wraps. No tokens. */
export const copyButtonStructuralStyles = css`
  :host {
    display: inline-block;
    vertical-align: middle;
  }
  .base {
    display: inline-flex;
    flex-wrap: wrap;
    align-items: center;
  }
  .fallback {
    min-inline-size: 0;
    font: inherit;
  }
`;
