import { prop, type ElementEvents } from '@oddkin/core/element';
import { strings } from '@oddkin/core/i18n';
import type { FormControlOptions } from '../form-control/form-control.js';
import { keyValue, parseNumber, stepNumber, type NumberRange } from '../form-control/range.js';
import { OddkinTextControl, changeEvent, inputEvent } from '../form-control/text-control.js';

export { changeEvent, inputEvent };

export const INPUT_STRINGS = {
  clear: 'Clear',
  decrement: 'Decrease value',
  increment: 'Increase value',
  badInput: 'Enter a number.',
};

// Page Up and Page Down move a number field this many steps.
const PAGE = 10;

/**
 * A labelled single-line text field that participates in forms like a native input.
 *
 * @csspart field - Wrapper of label, description, control, and error.
 * @csspart label - The visible label.
 * @csspart description - Help text, referenced by `aria-describedby`.
 * @csspart control - The native `<input>`.
 * @csspart icon - The search glyph at the start (`type="search"`).
 * @csspart clear - The button that clears a search value (`type="search"`), shown while there is a value to clear.
 * @csspart stepper - The segment at the end of a number field holding its two buttons (`type="number"`).
 * @csspart decrement - The button that steps a number down, disabled where a step down cannot move the value (`type="number"`).
 * @csspart increment - The button that steps a number up, disabled where a step up cannot move the value (`type="number"`).
 * @csspart error - The error message, referenced by `aria-describedby`.
 * @cssprop --odd-field-height - Minimum height (never below the target-size token). Shared by every form control and the field recipe.
 * @cssprop --odd-field-radius - Corner radius. Shared by every form control and the field recipe.
 * @cssprop --odd-field-border-color - Border colour. Shared by every form control and the field recipe.
 * @cssprop --odd-field-background - Background colour. Shared by every form control and the field recipe.
 * @cssstate user-invalid - The field shows its error: `error` is set, or the value is invalid after the user left the field or a validity check failed. Matches `aria-invalid` on the inner control; style it with `odd-input:state(user-invalid)`.
 * @a11y `label` names the native input inside the shadow root; a `<label for>` outside it cannot. Description and error are announced through `aria-describedby`; `aria-invalid` is set for `error`, or for an invalid value after the user leaves the field or a validity check fails (any `invalid` event, including `checkValidity()`, unlike native `:user-invalid`); reset clears it.
 * @a11y A number field is the WAI-ARIA spinbutton: a text input with `role="spinbutton"`, the decimal input mode (unless the host sets `inputmode`), `aria-valuenow`, `aria-valuemin`, and `aria-valuemax` (and `aria-valuetext` when the text is not the plain number). Its decrement and increment buttons are named by `strings` and are not Tab stops; pressing one keeps focus in the field.
 * @keyboard Native text-input behavior; arrow keys step a date. In a number field, Up and Down step by `step`, Page Up and Page Down by ten steps, and Home and End go to the lowest and highest values on the grid when `min` and `max` are set; each step that moves the value dispatches `input` and `change`, as a native number field's arrow keys do. In a search field, Escape clears the value (and then reaches outer handlers, such as a dialog, when empty).
 * @previewRole textInput
 * @useFor Short values in forms: names, email addresses, search terms, numbers, dates, and times.
 * @notFor Multi-line text (use odd-textarea); choices from a fixed list (use odd-select or odd-radio-group).
 * @a11y The global `inputmode`, `enterkeyhint`, `autocapitalize`, `autocorrect`, and `spellcheck` attributes on the host are forwarded to the inner input (`enterkeyhint` defaults to `search` in a search field).
 * @limitation A number field reads HTML number syntax (a full stop before decimals, an optional exponent), not the page language's format; other text is bad input, which the value and the submission leave out, as in a native number field. Holding a stepper button steps once.
 * @limitation Validation bubbles anchor to the inner input. `formStateRestoreCallback` restores the value; autofill depends on the inner input's `autocomplete`.
 * @limitation Enter in the field does not submit the form (no implicit submission): the native input inside the shadow root has no form owner. Give the form a submit button.
 * @category Forms
 * @customization 1 2 3
 */
export class OddkinInput extends OddkinTextControl.with({
  type: prop.enum(
    [
      'text',
      'email',
      'password',
      'search',
      'tel',
      'url',
      'number',
      'date',
      'time',
      'datetime-local',
      'month',
      'week',
    ],
    {
      default: 'text',
      reflect: true,
      description: 'Native input type.',
    },
  ),
  min: prop.string({ description: 'Lowest value (number and date types), as on native inputs.' }),
  max: prop.string({ description: 'Highest value (number and date types), as on native inputs.' }),
  step: prop.string({
    description: 'Step between values (number and date types); `any` allows every value.',
  }),
  pattern: prop.string({
    description: 'A regular expression the whole value must match (text types).',
  }),
  strings: prop.object<Partial<typeof INPUT_STRINGS>>({
    description: 'Localized string overrides.',
  }),
}) {
  declare readonly _events?: ElementEvents<typeof OddkinInput>;

  // A detached native input of this type: number validity, `valueAsNumber`, and date stepping.
  #nativeInput?: HTMLInputElement;
  // The value when the field took focus or last reported a change.
  #reported = '';

  protected override _constraints(): unknown[] {
    return [...super._constraints(), this.type, this.min, this.max, this.step];
  }

  protected override _sanitize(text: string, typed = false): string {
    if (this.type !== 'number') return text;
    // Typed text may hold full-width digits from an input method, as a native number field reads
    // them, and may end in a full stop on the way to decimals; engines read "1." as 1.
    if (typed) text = text.normalize('NFKC');
    const number = typed && /^-?\d+\.$/.test(text) ? text.slice(0, -1) : text;
    return parseNumber(number) === undefined ? '' : number;
  }

  protected override _formOptions(): FormControlOptions {
    const options = super._formOptions();
    return {
      ...options,
      control: () => (this.type === 'number' ? this.#native() : options.control?.()),
      // Barred, as a read-only or disabled native input is, so its text is not reported.
      badInput: () =>
        this.type === 'number' &&
        !this.readonly &&
        !this.#inactive &&
        this._currentValue.value !== '' &&
        this.value === ''
          ? this.#strings.badInput
          : '',
      anchor: () => this.shadowRoot?.querySelector<HTMLElement>('.control'),
    };
  }

  /** The value as a number (a date or time as milliseconds), as on native inputs; `NaN` when empty. */
  get valueAsNumber(): number {
    return this.#native().valueAsNumber;
  }
  set valueAsNumber(value: number) {
    const native = this.#native();
    native.valueAsNumber = value;
    this.value = native.value;
  }

  /** Steps the value up `n` steps (default 1), as on native inputs; dispatches no events. */
  stepUp(n?: number): void {
    this.#stepBy(n ?? 1);
  }
  /** Steps the value down `n` steps (default 1), as on native inputs; dispatches no events. */
  stepDown(n?: number): void {
    this.#stepBy(-(n ?? 1));
  }

  get #inactive(): boolean {
    return this.disabled || this._formDisabled.value;
  }
  get #strings(): typeof INPUT_STRINGS {
    return strings(INPUT_STRINGS, this.strings);
  }

  #native(): HTMLInputElement {
    this.#nativeInput ??= document.createElement('input');
    return Object.assign(this.#nativeInput, {
      type: this.type,
      required: this.required,
      readOnly: this.readonly,
      disabled: this.#inactive,
      min: this.min ?? '',
      max: this.max ?? '',
      step: this.step ?? '',
      value: this.value,
    });
  }

  get #range(): NumberRange {
    const min = parseNumber(this.min);
    const step = parseNumber(this.step);
    return {
      min,
      max: parseNumber(this.max),
      step: this.step?.toLowerCase() === 'any' ? undefined : step && step > 0 ? step : 1,
      base: min ?? parseNumber(this._sanitize(this.defaultValue)) ?? 0,
    };
  }

  // The number `n` steps from the value, or undefined when the field stays empty.
  #stepped(n: number, range = this.#range): number | undefined {
    return stepNumber(parseNumber(this.value), n, range);
  }

  #stepBy(n: number): void {
    if (this.type !== 'number') {
      const native = this.#native();
      if (n < 0) native.stepDown(-n);
      else native.stepUp(n);
      this.value = native.value;
      return;
    }
    const range = this.#range;
    if (range.step === undefined) {
      throw new DOMException('A number field with step="any" has no step.', 'InvalidStateError');
    }
    const next = this.#stepped(n, range);
    if (next !== undefined) this.value = String(next);
  }

  // Sets the value the user stepped to; dispatches input and change when it moved.
  #commit(next: number | undefined): void {
    if (next === undefined || next === parseNumber(this.value)) return;
    this.value = String(next);
    this.#reported = this.value;
    this.emit(inputEvent);
    this.emit(changeEvent);
  }

  /** @internal Template handler: the field took focus. */
  readonly _onFocus = (): void => {
    this.#reported = this.value;
  };
  /**
   * @internal Template handler: the user committed a change. As on the native number field, a
   * number field reports a change of its value, not of text that leaves the value as it was.
   */
  override readonly _onChange = (): void => {
    if (this.type === 'number' && this.value === this.#reported) return;
    this.#reported = this.value;
    this.emit(changeEvent);
  };

  /** @internal The number field's ARIA value attributes and which stepper buttons can act. */
  get _spin(): {
    now: string | null;
    text: string | null;
    min: string | null;
    max: string | null;
    down: boolean;
    up: boolean;
  } {
    const number = parseNumber(this.value);
    const text = this._currentValue.value;
    const range = this.#range;
    const live = !this.readonly && !this.#inactive;
    const moves = (n: number) => {
      const next = this.#stepped(n, range);
      return live && next !== undefined && next !== number;
    };
    const now = number === undefined ? null : String(number);
    return {
      now,
      text: text !== '' && text !== now ? text : null,
      min: range.min === undefined ? null : String(range.min),
      max: range.max === undefined ? null : String(range.max),
      down: moves(-1),
      up: moves(1),
    };
  }
  /** @internal The stepper buttons' names. */
  get _stepLabels(): { decrement: string; increment: string } {
    return this.#strings;
  }
  /** @internal Template handler: a press on a stepper button leaves focus in the field. */
  readonly _onStepPress = (event: Event): void => {
    event.preventDefault();
  };
  /** @internal Template handler: a stepper button (its `data-step`); disabled when it cannot act. */
  readonly _onStep = (event: Event): void => {
    const n = Number((event.currentTarget as HTMLElement).dataset.step);
    this.shadowRoot?.querySelector<HTMLInputElement>('.control')?.focus({ preventScroll: true });
    this.#commit(this.#stepped(n));
  };

  /** @internal The clear button shows while a search value can be cleared. */
  get _clearable(): boolean {
    return (
      this.type === 'search' && this.value !== '' && !this._formDisabled.value && !this.readonly
    );
  }
  /** @internal The clear button's name. */
  get _clearLabel(): string {
    return this.#strings.clear;
  }
  /** @internal Template handler: the clear button, or Escape in a search field. */
  readonly _onClear = (): void => {
    this.value = '';
    this.emit(inputEvent);
    this.emit(changeEvent);
    this.shadowRoot?.querySelector('input')?.focus();
  };
  /**
   * @internal Template handler: the number field's stepping keys, and Escape, which clears a
   * search value as native search fields do.
   */
  readonly _onKeydown = (event: KeyboardEvent): void => {
    // Keys an input method is composing with are its own (choosing a candidate, cancelling).
    if (event.isComposing) return;
    if (this.type === 'number') {
      // A disabled field takes no keys; a read-only one keeps its value.
      if (event.altKey || event.ctrlKey || event.metaKey || this.readonly) return;
      // Left and Right stay text-editing keys, as Home and End without bounds.
      const next = keyValue(event.key, parseNumber(this.value), this.#range, { page: PAGE });
      if (next === undefined) return;
      event.preventDefault();
      this.#commit(next);
      return;
    }
    if (event.key !== 'Escape' || !this._clearable) return;
    event.preventDefault();
    this._onClear();
  };
}

declare global {
  interface HTMLElementTagNameMap {
    'odd-input': OddkinInput;
  }
}
