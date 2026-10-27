import { prop } from '@oddkin/core/element';
import { strings } from '@oddkin/core/i18n';
import { computed, type Readable } from '@oddkin/core/reactive';
import { OddkinTextControl } from '../form-control/text-control.js';

export { changeEvent, inputEvent } from '../form-control/text-control.js';

export const ONE_TIME_CODE_STRINGS = {
  hint: 'You can paste the entire code.',
  pending: 'Verifying code…',
  complete: 'Code accepted.',
};

// Keys that would move the caret off the end: entry stays one predictable run of digits.
const CARET_KEYS = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End']);

/**
 * A one-time code (a verification code sent by text message or email) entered into `maxlength`
 * cells (default six). It is one native input with `autocomplete="one-time-code"` and a numeric
 * keyboard (the global `inputmode` attribute, `numeric` unless the host sets it) behind the drawn
 * cells, so the platform's autofill, paste, and form value
 * work as on any field: digits only, typed or pasted, the caret always after the last digit.
 * `status` reports the verification the page runs: `pending` keeps the code read-only with a
 * busy line, `complete` confirms it; a failure is `error`.
 *
 * @csspart field - Wrapper of label, description, cells, status, and error.
 * @csspart label - The visible label.
 * @csspart description - Help text, referenced by `aria-describedby`.
 * @csspart control - The native input over the cells.
 * @csspart cell - One digit's cell.
 * @csspart status - The line under the cells: `strings.hint`, or the `pending` or `complete` text with its glyph.
 * @csspart error - The error message, referenced by `aria-describedby`.
 * @cssstate user-invalid - The code shows its error: `error` is set, or the code is missing or too short after focus left it or a validity check failed.
 * @a11y One text input named by `label`, described by the description, the status line, and the error; the cells are drawn and hidden from assistive technology, so the code is read as one value. The status line is a `role="status"` region, so `pending` and `complete` are announced.
 * @keyboard Typing enters digits and moves to the next cell; Backspace removes the last digit; paste enters the whole code. The arrow, Home, and End keys keep the caret after the last digit, and a click puts it there. Tab selects the code, as in any field, so typing then replaces it.
 * @previewRole oneTimeCode
 * @useFor A short code the user copies from a message to confirm a sign-in, an address, or a payment.
 * @notFor Passwords and PINs the user chooses (use odd-input type="password"); long reference numbers (use odd-input).
 * @limitation Digits only. A digit in the middle cannot be selected alone: Backspace back to it.
 * @category Forms
 */
export class OddkinOneTimeCode extends OddkinTextControl.with({
  status: prop.enum(['idle', 'pending', 'complete'], {
    default: 'idle',
    reflect: true,
    description:
      'The verification the page runs: `pending` makes the code read-only and shows `strings.pending`; `complete` shows `strings.complete`.',
  }),
  strings: prop.object<Partial<typeof ONE_TIME_CODE_STRINGS>>({
    description:
      'Localized string overrides: `hint` (under the cells while idle), `pending`, `complete`.',
  }),
}) {
  /** @internal The built-in text with the author's overrides. */
  readonly _strings: Readable<typeof ONE_TIME_CODE_STRINGS> = computed(() =>
    strings(ONE_TIME_CODE_STRINGS, this.strings),
  );

  /** @internal How many cells: `maxlength`, default six. */
  get _cells(): number {
    return Math.max(1, Math.floor(this.maxLength ?? 6) || 6);
  }

  /** @internal The status line's text. */
  get _statusText(): string {
    const s = this._strings.value;
    return this.status === 'idle' ? s.hint : s[this.status];
  }

  protected override _constraints(): unknown[] {
    return [...super._constraints(), this.status, this.maxLength, this.minLength];
  }

  // Typed text: its digits (full-width ones from an input method too), at most one per cell.
  protected override _sanitize(text: string, typed = false): string {
    return typed ? text.normalize('NFKC').replace(/\D/g, '').slice(0, this._cells) : text;
  }

  /**
   * @internal Template handler (`input`, `compositionend`): the field keeps only its digits, then
   * the shared handler. Text an input method is composing stays until the composition ends.
   */
  readonly _onCodeInput = (event: Event): void => {
    const input = event.target as HTMLInputElement;
    if (!(event as InputEvent).isComposing) {
      const digits = this._sanitize(input.value, true);
      if (digits !== input.value) input.value = digits;
    }
    this._onInput(event);
  };

  /** @internal Template handler: the caret stays after the last digit. */
  readonly _onCodeKeydown = (event: KeyboardEvent): void => {
    if (CARET_KEYS.has(event.key) && !event.isComposing) event.preventDefault();
  };

  /** @internal Template handler: a click puts the caret after the last digit. */
  readonly _toEnd = (event: Event): void => {
    const input = event.target as HTMLInputElement;
    const end = input.value.length;
    if (input.selectionStart !== end || input.selectionEnd !== end)
      input.setSelectionRange(end, end);
  };

  protected override updated(): void {
    // A value set while the field has focus keeps the caret where it was: put it after the last
    // digit. A selection of the whole code stays, and so does text an input method is composing.
    const input = this.shadowRoot?.querySelector<HTMLInputElement>('.control');
    const end = this.value.length;
    if (input?.value === this.value && input.selectionEnd !== end)
      input.setSelectionRange(end, end);
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'odd-one-time-code': OddkinOneTimeCode;
  }
}
