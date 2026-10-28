import { css } from '@oddkin/core/styles';

/**
 * The slides above a wrapping row of controls; a slide and the controls never overflow the
 * carousel, and the controls wrap on a narrow carousel rather than drop any. No brand or visual
 * tokens.
 */
export const carouselStructuralStyles = css`
  :host {
    display: block;
  }
  .carousel {
    display: flex;
    flex-direction: column;
    min-inline-size: 0;
  }
  .slide {
    min-inline-size: 0;
    overflow-wrap: anywhere;
  }
  .controls,
  .picker {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    min-inline-size: 0;
  }
  .odd-button {
    flex: none;
  }
  .pick {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    box-sizing: border-box;
    margin: 0;
    font: inherit;
    cursor: pointer;
  }
  @media (forced-colors: active) {
    .pick {
      border: 1px solid ButtonText;
    }
    .pick[aria-current='true'] {
      border-color: Highlight;
      background: Highlight;
      color: HighlightText;
    }
    .step[aria-disabled='true'] {
      border-color: GrayText;
      color: GrayText;
    }
  }
`;
