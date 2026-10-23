import { css } from '@oddkin/core/styles';

/** Inline layout of glyph and text, and a forced-colours border. No brand or visual tokens. */
export const badgeStructuralStyles = css`
  :host {
    display: inline-block;
    vertical-align: middle;
    max-inline-size: 100%;
  }
  .badge {
    display: inline-flex;
    align-items: center;
    max-inline-size: 100%;
    overflow-wrap: anywhere;
  }
  .marker {
    display: inline-flex;
  }
  @media (forced-colors: active) {
    .badge {
      border: 1px solid CanvasText;
    }
  }
`;
