import { css } from '@oddkin/core/styles';

/**
 * The switch: a 2.5rem × 1.5rem track (the native checkbox with `appearance: none`) with a 1rem
 * thumb at its inline start, moved to its inline end while checked (mirrored right to left by
 * the logical margin). Forced colours win over the skin by one class. No brand tokens.
 */
export const switchStructuralStyles = css`
  :host {
    display: block;
  }
  .switch-track {
    box-sizing: border-box;
    display: block;
    inline-size: 2.5rem;
    block-size: 1.5rem;
    margin: 0;
    appearance: none;
    cursor: inherit;
  }
  .switch-thumb {
    box-sizing: border-box;
    justify-self: start;
    inline-size: 1rem;
    block-size: 1rem;
    margin-inline-start: 0.25rem;
    pointer-events: none;
  }
  .switch-track:checked + .switch-thumb {
    margin-inline-start: 1.25rem;
  }
  @media (forced-colors: active) {
    .indicator > .switch-track {
      border: 1px solid CanvasText;
    }
    .indicator > .switch-track:checked {
      border-color: Highlight;
      background: Highlight;
    }
    .choice .indicator > .switch-track + .switch-thumb {
      background: CanvasText;
    }
    .choice .indicator > .switch-track:disabled + .switch-thumb {
      background: GrayText;
    }
    .choice .indicator > .switch-track:checked + .switch-thumb {
      background: HighlightText;
    }
    .indicator > .switch-track:disabled {
      border-color: GrayText;
    }
  }
`;
