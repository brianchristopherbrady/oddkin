import { css } from '@oddkin/core/styles';

/**
 * Layout the card depends on: a column of header, body, and footer that fills the host, and
 * hidden empty regions. No brand or visual tokens.
 */
export const cardStructuralStyles = css`
  :host {
    display: block;
  }
  .card {
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    block-size: 100%;
    min-inline-size: 0;
    /* Inherited by slotted content: long URLs and words wrap inside narrow cards. */
    overflow-wrap: anywhere;
  }
  .body {
    flex: 1 1 auto;
    min-block-size: 0;
  }
  @media (forced-colors: active) {
    .card {
      border: 1px solid CanvasText;
    }
  }
`;
