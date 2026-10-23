import { css } from '@oddkin/core/styles';

/**
 * Inline chip with its remove button; the focus ring of the remove button is drawn around the
 * whole chip, as Figma shows it. No brand or visual tokens.
 */
export const chipStructuralStyles = css`
  :host {
    display: inline-block;
    vertical-align: middle;
    max-inline-size: 100%;
  }
  .chip {
    display: inline-flex;
    align-items: center;
    max-inline-size: 100%;
  }
  .label {
    min-inline-size: 0;
    overflow-wrap: anywhere;
  }
  .remove {
    display: inline-grid;
    place-items: center;
    margin: 0;
    padding: 0;
    border: 0;
    background: none;
    color: inherit;
    font: inherit;
    cursor: pointer;
  }
  .remove:disabled {
    cursor: not-allowed;
  }
  .remove:focus-visible {
    outline: none;
  }
  @media (forced-colors: active) {
    .chip {
      border: 1px solid CanvasText;
    }
    .remove {
      color: ButtonText;
    }
  }
`;
