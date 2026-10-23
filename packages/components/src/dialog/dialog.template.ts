import { html } from '@oddkin/core/template';
import { closeButton } from '../overlay/overlay.js';
import type { OddkinDialog } from './dialog.js';

/**
 * Anatomy: `part="dialog"`, a native `<dialog>` with the shared sheet look, holds the `header`
 * (the `title`, the header slot, and, unless `no-close`, the `close` button), the `body` with the
 * default slot, and the `footer` with the footer slot, hidden while it is empty. The title names
 * the dialog; the body describes an alert dialog.
 */
export const dialogTemplate = (dialog: OddkinDialog) =>
  html`<dialog
    part="dialog"
    class="overlay-surface sheet dialog"
    role=${dialog.alert ? 'alertdialog' : null}
    aria-labelledby="title"
    aria-describedby=${dialog.alert ? 'body' : null}
  >
    <div part="header" class="header">
      <div class="heading">
        <h2 part="title" id="title" class="title">${dialog.label}</h2>
        <slot name="header"></slot>
      </div>
      ${dialog.noClose ? '' : closeButton(dialog._strings.value.close, () => dialog.close())}
    </div>
    <div part="body" id="body" class="body"><slot></slot></div>
    <div part="footer" class="footer" ?hidden=${!dialog._hasFooter.value}>
      <slot name="footer" @slotchange=${dialog._onSlotChange}></slot>
    </div>
  </dialog>`;
