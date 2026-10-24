import { css } from '@oddkin/core/styles';

/**
 * The control is a block; its label, description, and error use the shared field layout. The
 * track lines up equal segments; each segment stacks its radio, drawn as the segment's surface
 * (`appearance: none`), under its text, which lets pointer events through to the radio. No
 * brand tokens.
 */
export const segmentedControlStructuralStyles = css`
  :host {
    display: block;
  }
  .track {
    display: flex;
  }
  .segment {
    display: grid;
    flex: 1 1 0;
    min-inline-size: 0;
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
    min-inline-size: 0;
    text-align: center;
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
