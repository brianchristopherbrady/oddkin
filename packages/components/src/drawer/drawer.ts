import { prop } from '@oddkin/core/element';
import { OddkinDialog } from '../dialog/dialog.js';

/**
 * A panel at an inline edge of the viewport: odd-dialog with a side-sheet layout. It is modal by
 * default, so the rest of the page is inert until it closes; with `no-modal` the page stays usable
 * beside it. `side` is logical, so it mirrors in right-to-left text.
 *
 * @slot - The body.
 * @slot header - Under the title: a subtitle or a status.
 * @slot footer - The actions, at the inline end.
 * @csspart dialog - The `<dialog>` panel.
 * @csspart header - The title, the header slot, and the close button, above a divider.
 * @csspart title - The title.
 * @csspart body - The body, which scrolls.
 * @csspart footer - The actions, under a divider; hidden while the slot is empty.
 * @csspart close - The close button.
 * @cssprop --odd-drawer-inline-size - Its width, within the viewport.
 * @a11y A `dialog`, or an `alertdialog` with `alert`, named by `label` (the title). Opening it moves focus to the slotted element with `autofocus`, else the first control in the body or footer, else the close button. Modal, everything outside is inert while it is open; with `no-modal`, focus may leave it. Closing it returns focus to the element that had it when it opened, unless focus has moved elsewhere. The close button is named by `strings.close`.
 * @keyboard Escape closes it unless `closedby="none"`. Modal, Tab and Shift+Tab move through its controls only.
 * @previewRole drawer
 * @useFor Details or a task beside the page that keeps its context: an item's properties, filters, settings.
 * @notFor A decision that must be made first (use odd-dialog); extra detail next to its trigger (use odd-popover); a passing confirmation (use odd-toast).
 * @category Overlays
 * @customization 1 2 3
 */
export class OddkinDrawer extends OddkinDialog.with({
  side: prop.enum(['inline-end', 'inline-start'], {
    default: 'inline-end',
    reflect: true,
    description:
      'The edge it opens at: `inline-end` is the right in left-to-right text and the left in right-to-left text.',
  }),
  noModal: prop.boolean({
    description:
      'Leaves the page usable while it is open: no backdrop, nothing inert, and focus may leave it.',
  }),
}) {
  protected override _modal(): boolean {
    return !this.noModal;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'odd-drawer': OddkinDrawer;
  }
}
