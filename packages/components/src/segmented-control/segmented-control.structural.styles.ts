import { css } from '@oddkin/core/styles';

/**
 * The control is a block; its label, description, and error use the shared field layout. The
 * track is a row of equal columns, each at least as wide as its option's longest word, so an
 * option's text wraps between words, never inside one (a control sized to its content gets room
 * for its widest option in every column). Each segment stacks its radio, drawn as the segment's
 * surface (`appearance: none`), under its text, which lets pointer events through to the radio.
 * No brand tokens.
 */
export const segmentedControlStructuralStyles = css`
  :host {
    display: block;
  }
  .track {
    display: grid;
    grid-auto-columns: 1fr;
    grid-auto-flow: column;
  }
  .segment {
    display: grid;
    cursor: pointer;
  }
  .segment:has(:disabled) {
    cursor: not-allowed;
  }
  .segment > * {
    grid-area: 1 / 1;
  }
  .segment-box {
    inline-size: 100%;
    block-size: 100%;
    margin: 0;
    appearance: none;
    /* Firefox tints a disabled input's background. */
    background: none;
    cursor: inherit;
  }
  .segment-label {
    display: flex;
    align-items: center;
    justify-content: center;
    text-align: center;
    overflow-wrap: break-word;
    pointer-events: none;
  }
  @media (forced-colors: active) {
    .track {
      border: 1px solid CanvasText;
    }
    .segment > .segment-box:checked {
      background: Highlight;
    }
    .segment > .segment-box:checked + .segment-label {
      color: HighlightText;
    }
    .segment > .segment-box:disabled + .segment-label {
      color: GrayText;
    }
  }
`;
