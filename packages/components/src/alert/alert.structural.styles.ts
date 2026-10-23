import { css } from '@oddkin/core/styles';

/**
 * Glyph, text column, and actions in a row that wraps the actions under the text when narrow.
 * No brand or visual tokens.
 */
export const alertStructuralStyles = css`
  :host {
    display: block;
  }
  .alert {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-start;
    min-inline-size: 0;
  }
  .marker {
    display: inline-flex;
    flex: none;
  }
  .content {
    flex: 1 1 12rem;
    min-inline-size: 0;
    overflow-wrap: anywhere;
  }
  .label {
    margin: 0;
  }
  .end {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
  }
  @media (forced-colors: active) {
    .alert {
      border: 1px solid CanvasText;
    }
  }
`;
