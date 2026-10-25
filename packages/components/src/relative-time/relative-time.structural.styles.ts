import { css } from '@oddkin/core/styles';

/** The glyph beside the relative text; the absolute date and time below. No tokens. */
export const relativeTimeStructuralStyles = css`
  :host {
    display: inline-block;
  }
  .base {
    display: inline-flex;
    flex-direction: column;
  }
  .relative {
    display: inline-flex;
    align-items: center;
  }
`;
