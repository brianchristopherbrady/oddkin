import { css } from '@oddkin/core/styles';

/**
 * Controls in a wrapping row (a column when vertical); an `<hr>` child is a line across the row.
 * No brand or visual tokens.
 */
export const toolbarStructuralStyles = css`
  :host {
    display: block;
  }
  .toolbar {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    min-inline-size: 0;
  }
  :host([orientation='vertical']) .toolbar {
    flex-direction: column;
    flex-wrap: nowrap;
    align-items: stretch;
  }
  ::slotted(hr) {
    align-self: stretch;
    margin: 0;
    border: 0;
  }
  @media (forced-colors: active) {
    .toolbar {
      border-color: CanvasText;
    }
    /* Above the skin's separator colour. */
    :host ::slotted(hr) {
      background: CanvasText;
    }
  }
`;
