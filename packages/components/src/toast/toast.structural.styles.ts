import { css } from '@oddkin/core/styles';

/**
 * The toast at the block-end and inline-end corner of the viewport, each open toast above the open
 * ones after it in the document (`--_toast-offset` and `--_toast-index`, written by the element);
 * logical, so right-to-left text mirrors the corner. A grid: the glyph, the title, and the close
 * button on the first row; the message and the action under the title. No brand or visual tokens.
 */
export const toastStructuralStyles = css`
  :host([popover]) {
    inset: auto;
    inset-block-end: calc(
      var(--_toast-inset, 0px) + var(--_toast-offset, 0px) + var(--_toast-index, 0) *
        var(--_toast-gap, 0px)
    );
    inset-inline-end: var(--_toast-inset, 0px);
    inline-size: min(var(--odd-toast-inline-size, 24rem), 100% - 2 * var(--_toast-inset, 0px));
  }
  .toast {
    display: grid;
    grid-template-columns: auto 1fr auto auto;
    grid-template-areas:
      'marker label label close'
      '. message end .';
    align-items: center;
    overflow-wrap: anywhere;
  }
  .marker {
    display: inline-flex;
    grid-area: marker;
  }
  .label {
    grid-area: label;
    margin: 0;
  }
  .message {
    grid-area: message;
  }
  .end {
    display: flex;
    grid-area: end;
  }
  .overlay-close {
    grid-area: close;
  }
`;
