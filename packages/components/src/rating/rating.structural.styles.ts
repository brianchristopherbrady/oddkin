import { css } from '@oddkin/core/styles';

/**
 * The rating is a block; its label, description, and error use the shared field layout. The row
 * holds the stars and the value; each star stacks its radio, drawn as the star's target
 * (`appearance: none`), under the glyph, which lets pointer events through to the radio. A star
 * that is on fills its glyph. No brand tokens.
 */
export const ratingStructuralStyles = css`
  :host {
    display: block;
  }
  .row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
  }
  .stars {
    display: flex;
  }
  .star {
    display: grid;
    place-items: center;
  }
  .star > * {
    grid-area: 1 / 1;
  }
  .star-box {
    inline-size: 100%;
    block-size: 100%;
    margin: 0;
    appearance: none;
    /* Firefox tints a disabled input's background. */
    background: none;
    cursor: pointer;
  }
  .star-box:disabled {
    cursor: not-allowed;
  }
  :host([readonly]) .star-box {
    cursor: inherit;
  }
  .star .glyph {
    pointer-events: none;
  }
  .star[data-state='on'] .glyph {
    fill: currentColor;
  }
  @media (forced-colors: active) {
    .star[data-state='on'] > .glyph {
      color: Highlight;
    }
    .star > .star-box:disabled + .glyph {
      color: GrayText;
    }
  }
`;
