import { css } from '@oddkin/core/styles';

/**
 * The side-sheet layout over odd-dialog's column: fixed at one inline edge for the full height of
 * the viewport, modal (in the top layer) or not (`dialog.show()` leaves a dialog in the flow, so it
 * is fixed here). `side` is logical, so the margins mirror in right-to-left text. The divider under
 * the header is `.header::after`; in forced colours, which paint backgrounds as Canvas, it is a
 * border instead. No brand or visual tokens.
 */
export const drawerStructuralStyles = css`
  .dialog {
    position: fixed;
    inset: 0;
    inline-size: min(var(--odd-drawer-inline-size, 24rem), 100%);
    block-size: auto;
    max-block-size: none;
    margin-block: 0;
    margin-inline-start: auto;
    margin-inline-end: 0;
  }
  :host([side='inline-start']) .dialog {
    margin-inline-start: 0;
    margin-inline-end: auto;
  }
  .header {
    position: relative;
  }
  .header::after {
    content: '';
    position: absolute;
    inset-block-end: 0;
    inset-inline: 0;
  }
  @media (forced-colors: active) {
    .dialog .header::after {
      block-size: 0;
      border-block-end: 1px solid CanvasText;
    }
  }
`;
