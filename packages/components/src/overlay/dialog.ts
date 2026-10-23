import { signal, type Readable } from '@oddkin/core/reactive';
import type { Controller, Scope } from '@oddkin/core/scope';
import { composedContains, deepActiveElement } from './overlay.js';

/**
 * The wiring every modal overlay shares (component-contracts.md §2.6, §3.5; ADR 0044): a native
 * `<dialog>` in the owner's shadow root opened with `showModal()`, so the rest of the page is inert;
 * initial focus and focus return; `close` and `cancel` re-dispatched at the owner; `closedby`,
 * native where supported and emulated elsewhere; and a `<form method="dialog">` in the owner's light
 * DOM, which the native lookup cannot connect to a dialog in a shadow root. Internal to
 * `@oddkin/components`: import it relatively.
 */
export type ClosedBy = 'any' | 'closerequest' | 'none';

export interface ModalDialogOptions {
  /** The element that owns the dialog; `close` and `cancel` are re-dispatched at it. */
  readonly host: HTMLElement;
  /** The `<dialog>`, rendered in the host's shadow root before `connect`. */
  readonly dialog: () => HTMLDialogElement | null | undefined;
  /** What closes it besides script: Escape (`closerequest`, the default), also a press on the backdrop (`any`), or neither (`none`). Read at each opening, so a getter follows a live property. */
  readonly closedBy?: ClosedBy;
  /** Where focus goes when it opens. Default: `[autofocus]` in the host's light DOM, then the first control there, then what the browser chose (the dialog's own first control). */
  readonly initialFocus?: () => HTMLElement | null | undefined;
  /** Where focus returns on close. Default: where it was when it opened. */
  readonly returnFocus?: () => HTMLElement | null | undefined;
  /** After each open (focus placed) and close (the browser has returned focus to the opener; `returnFocus` has not run). */
  readonly onToggle?: (open: boolean) => void;
}

const FOCUSABLE =
  'button, [href], input:not([type="hidden"]), select, textarea, [tabindex]:not([tabindex="-1"]), [contenteditable]:not([contenteditable="false"])';

/** The first element in `root`'s light DOM that takes focus, including focus-delegating hosts. */
export function firstFocusable(root: ParentNode): HTMLElement | null {
  for (const el of root.querySelectorAll<HTMLElement>('*')) {
    if (!(el.matches(FOCUSABLE) || el.shadowRoot?.delegatesFocus)) continue;
    if (el.matches(':disabled') || !el.checkVisibility()) continue;
    return el;
  }
  return null;
}

/** Whether the browser handles `closedby` itself (above the floor: ADR 0044). */
const nativeClosedBy = () => 'closedBy' in HTMLDialogElement.prototype;

export class ModalDialog implements Controller {
  readonly #options: ModalDialogOptions;
  readonly #open = signal(false);
  #opener: HTMLElement | null = null;

  /** Whether the dialog is open. */
  readonly open: Readable<boolean> = this.#open;

  constructor(options: ModalDialogOptions) {
    this.#options = options;
  }

  /** The dialog's return value: the `close()` argument or the submitting button's value. */
  get returnValue(): string {
    return this.#options.dialog()?.returnValue ?? '';
  }
  set returnValue(value: string) {
    const dialog = this.#options.dialog();
    if (dialog) dialog.returnValue = value;
  }

  connect(scope: Scope): void {
    const dialog = this.#options.dialog();
    if (!dialog) return;
    const host = this.#options.host;
    const closedBy = () => this.#options.closedBy ?? 'closerequest';
    scope.listen(dialog, 'close', () => {
      this.#closed(dialog);
      host.dispatchEvent(new Event('close'));
    });
    scope.listen(dialog, 'cancel', (event) => {
      if (!nativeClosedBy() && closedBy() === 'none') {
        event.preventDefault();
        return;
      }
      if (!this.#cancel(event.cancelable)) event.preventDefault();
    });
    // `closedby="any"` where the browser lacks it: a press on the backdrop is a press on the
    // dialog outside its box.
    scope.listen<MouseEvent>(dialog, 'click', (event) => {
      if (nativeClosedBy() || closedBy() !== 'any' || event.target !== dialog) return;
      const box = dialog.getBoundingClientRect();
      const inside =
        event.clientX >= box.left &&
        event.clientX <= box.right &&
        event.clientY >= box.top &&
        event.clientY <= box.bottom;
      if (!inside && this.#cancel(true)) this.close();
    });
    scope.listen<SubmitEvent>(host, 'submit', (event) => {
      const submitter = event.submitter as HTMLButtonElement | null;
      const form = event.target as HTMLFormElement;
      const method = submitter?.hasAttribute('formmethod') ? submitter.formMethod : form.method;
      if (method !== 'dialog' || !dialog.open) return;
      event.preventDefault();
      this.close(submitter ? submitter.value : undefined);
    });
    scope.add(() => {
      // Removed while open: a dialog outside the document is no longer modal, so close it.
      if (!dialog.open) return;
      dialog.close();
      this.#open.value = false;
      this.#options.onToggle?.(false);
    }, 'modal dialog');
    this.#open.value = dialog.open;
  }

  /** Opens it modally, unless it is open or not connected. */
  show(): void {
    const dialog = this.#options.dialog();
    if (!dialog?.isConnected || dialog.open) return;
    this.#opener = deepActiveElement() as HTMLElement | null;
    if (nativeClosedBy()) dialog.setAttribute('closedby', this.#options.closedBy ?? 'closerequest');
    dialog.showModal();
    this.#open.value = true;
    const host = this.#options.host;
    const target =
      this.#options.initialFocus?.() ??
      host.querySelector<HTMLElement>('[autofocus]') ??
      firstFocusable(host);
    target?.focus();
    this.#options.onToggle?.(true);
  }

  /** Closes it; `returnValue` becomes the argument when there is one. */
  close(returnValue?: string): void {
    const dialog = this.#options.dialog();
    if (!dialog?.open) return;
    dialog.close(returnValue);
    this.#closed(dialog);
  }

  /** Dispatches a cancelable `cancel` at the host; true unless it was cancelled. */
  #cancel(cancelable: boolean): boolean {
    const relay = new Event('cancel', { cancelable });
    this.#options.host.dispatchEvent(relay);
    return !relay.defaultPrevented;
  }

  /** Closed by `close()`, or by the browser, whose `close` event comes a task later. */
  #closed(dialog: HTMLDialogElement): void {
    if (!this.#open.value || dialog.open) return;
    this.#open.value = false;
    this.#options.onToggle?.(false);
    const active = deepActiveElement();
    // The browser has usually returned focus to the opener already; it may not have, or the owner
    // may want it elsewhere.
    if (
      !active ||
      active === document.body ||
      active === this.#opener ||
      composedContains(dialog, active)
    ) {
      const target = this.#options.returnFocus?.() ?? this.#opener;
      // Safari does not focus a button on a press, so there may be no opener: leave the closed
      // dialog rather than keep focus in it.
      if (target && target !== document.body) target.focus();
      else if (active && composedContains(dialog, active)) (active as HTMLElement).blur();
    }
  }
}
