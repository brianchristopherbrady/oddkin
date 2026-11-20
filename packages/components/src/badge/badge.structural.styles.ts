import { css } from '@oddkin/core/styles';

/** Inline layout of glyph and text, and a forced-colours border. No brand or visual tokens. */
export const badgeStructuralStyles = css`
  :host {
    display: inline-block;
    vertical-align: middle;
    min-inline-size: 0;
    max-inline-size: 100%;
  }
  .badge {
    display: flex;
    align-items: flex-start;
    max-inline-size: 100%;
  }
  .marker {
    display: inline-flex;
    flex: none;
    align-items: center;
    min-block-size: 1lh;
  }
  .label {
    min-inline-size: 0;
    white-space: normal;
    overflow-wrap: anywhere;
  }
  @media (forced-colors: active) {
    .badge {
      border: 1px solid CanvasText;
    }
  }
`;
