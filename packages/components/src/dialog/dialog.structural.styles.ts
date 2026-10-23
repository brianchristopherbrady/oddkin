import { css } from '@oddkin/core/styles';

/**
 * A column of header, body, and footer inside the `<dialog>`: the body scrolls when the dialog
 * reaches its maximum height (a scroll container's automatic minimum size is zero, so it shrinks),
 * and the header and footer stay. The browser's rules show and hide the dialog (`display` is set
 * only while it is open). A form slotted into the footer lays out its actions like direct
 * children. The divider above the actions is `.footer::before`; in forced colours, which paint
 * backgrounds as Canvas, it is a border instead. No brand or visual tokens.
 */
export const dialogStructuralStyles = css`
  .dialog {
    box-sizing: border-box;
    inline-size: min(var(--odd-dialog-inline-size, 32rem), 100%);
    overflow-wrap: anywhere;
  }
  .dialog[open] {
    display: flex;
    flex-direction: column;
  }
  .header {
    display: flex;
    flex: none;
    align-items: flex-start;
  }
  .heading {
    flex: 1 1 auto;
    min-inline-size: 0;
  }
  .title {
    margin: 0;
  }
  .body {
    flex: 1 1 auto;
    overflow: auto;
  }
  .footer {
    position: relative;
    display: flex;
    flex: none;
    flex-wrap: wrap;
    justify-content: flex-end;
  }
  .footer[hidden] {
    display: none;
  }
  .footer ::slotted(form) {
    display: contents;
  }
  .footer::before {
    content: '';
    position: absolute;
    inset-block-start: 0;
    inset-inline: 0;
  }
  @media (forced-colors: active) {
    .dialog .footer::before {
      block-size: 0;
      border-block-start: 1px solid CanvasText;
    }
  }
`;
