import { OddkinElement, prop } from '@oddkin/core/element';
import { strings } from '@oddkin/core/i18n';
import { computed, signal, type Readable } from '@oddkin/core/reactive';
import type { Scope } from '@oddkin/core/scope';
import { ModalDialog } from '../overlay/dialog.js';

export const DIALOG_STRINGS = {
  close: 'Close',
};

/**
 * A modal dialog: a native `<dialog>` shown modally, so the rest of the page is inert until it
 * closes. Escape closes it unless `closedby="none"`; with `closedby="any"`, so does a press
 * on the backdrop. A `<form method="dialog">` inside closes it with the value of the button that
 * submitted it.
 *
 * @slot - The body.
 * @slot header - Under the title: a subtitle or a status.
 * @slot footer - The actions, at the inline end.
 * @csspart dialog - The `<dialog>` surface.
 * @csspart header - The title, the header slot, and the close button.
 * @csspart title - The title.
 * @csspart body - The body.
 * @csspart footer - The actions, under a divider; hidden while the slot is empty.
 * @csspart close - The close button.
 * @cssprop --odd-dialog-inline-size - Its width, within the viewport.
 * @a11y A `dialog`, or an `alertdialog` with `alert`, named by `label` (the title); an alert dialog is also described by its body. Opening it moves focus to the slotted element with `autofocus`, else the first control in the body or footer, else the close button. Everything outside is inert while it is open. Closing it returns focus to the element that had it when it opened. The close button is named by `strings.close`.
 * @keyboard Tab and Shift+Tab move through its controls only. Escape closes it unless `closedby="none"`.
 * @previewRole dialog
 * @previewRole alertDialog
 * @useFor A task or decision that must be finished or dismissed before going on: a short form, a confirmation, a destructive action.
 * @notFor Extra detail next to its trigger (use odd-popover); a panel beside the page (use odd-drawer); a passing confirmation (use odd-toast).
 * @category Overlays
 * @customization 1 2 3
 */
export class OddkinDialog extends OddkinElement.with({
  label: prop.string({ default: '', description: 'The title, which names the dialog. Required.' }),
  alert: prop.boolean({
    description:
      'Makes it an alert dialog: an urgent message that needs a response, such as confirming that something is deleted. Its body describes it.',
  }),
  closedBy: prop.enum(['closerequest', 'any', 'none'], {
    attribute: 'closedby',
    default: 'closerequest',
    description:
      'What closes it besides its controls: Escape (`closerequest`), also a press on the backdrop (`any`), or neither (`none`). The browser does it where it can; elsewhere the dialog does.',
  }),
  noClose: prop.boolean({
    description: 'Hides the close button. Keep another way out, such as a Cancel button.',
  }),
  open: prop.boolean({ reflect: true, description: 'Whether it is open.' }),
  strings: prop.object<Partial<typeof DIALOG_STRINGS>>({
    description: 'Localized string overrides.',
  }),
}) {
  readonly #dialog: ModalDialog = this.#createDialog();

  /** @internal The built-in text with the author's overrides. */
  readonly _strings: Readable<typeof DIALOG_STRINGS> = computed(() =>
    strings(DIALOG_STRINGS, this.strings),
  );

  /** @internal True while the footer slot has content; read by the template. */
  readonly _hasFooter = signal(false);

  /** @internal Slot change handler used by the template. */
  readonly _onSlotChange = (event: Event): void => {
    const slot = event.target as HTMLSlotElement;
    this._hasFooter.value = slot
      .assignedNodes({ flatten: true })
      .some((node) => node.nodeType === Node.ELEMENT_NODE || !!node.textContent?.trim());
  };

  /** The `close()` argument, or the value of the button that submitted its form. */
  get returnValue(): string {
    return this.#dialog.returnValue;
  }
  set returnValue(value: string) {
    this.#dialog.returnValue = value;
  }

  /** Opens it. */
  show(): void {
    this.#dialog.show();
  }

  /** Closes it; `returnValue` becomes the argument when there is one. */
  close(returnValue?: string): void {
    this.#dialog.close(returnValue);
  }

  /** Whether it opens modally; read at each opening. odd-drawer overrides it. */
  protected _modal(): boolean {
    return true;
  }

  #createDialog(): ModalDialog {
    const host = this;
    return new ModalDialog({
      host,
      dialog: () => host.shadowRoot?.querySelector('dialog'),
      get modal() {
        return host._modal();
      },
      get closedBy() {
        return host.closedBy;
      },
      onToggle: (open) => (host.open = open),
    });
  }

  protected override mounted(scope: Scope): void {
    scope.use(this.#dialog);
  }

  protected override updated(changes: ReadonlyMap<string, unknown>): void {
    if (!changes.has('open')) return;
    if (this.open) this.#dialog.show();
    else this.#dialog.close();
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'odd-dialog': OddkinDialog;
  }
}
