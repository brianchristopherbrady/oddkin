import { event, prop, type ElementEvents } from '@oddkin/core/element';
import { format, langOf, strings } from '@oddkin/core/i18n';
import { computed, signal, type Readable } from '@oddkin/core/reactive';
import type { Scope } from '@oddkin/core/scope';
import { CALENDAR_STRINGS, dayOf, type CalendarDateFilter } from '../calendar/calendar.js';
import { OddkinFormControl, type FormControlOptions } from '../form-control/form-control.js';
import { Overlay } from '../overlay/overlay.js';
import { dateFields, formatDateText, parseDateText } from './date-text.js';

export const DATE_PICKER_STRINGS = {
  ...CALENDAR_STRINGS,
  choose: 'Choose date',
  change: 'Change date, {date}',
  invalid: 'Enter a valid date in {format}.',
  day: 'DD',
  month: 'MM',
  year: 'YYYY',
};

/** Dispatched when the user commits a date: typed and committed, or chosen in the calendar. */
export const datePickerInputEvent = event('input', {
  bubbles: true,
  composed: true,
  cancelable: false,
  syncs: 'value',
  intent: 'user',
});
/** Dispatched with `input` for each date the user commits. */
export const datePickerChangeEvent = event('change', {
  bubbles: true,
  composed: false,
  cancelable: false,
  intent: 'user',
});

/**
 * One date, typed in the page language's numeric order or chosen from a calendar in a popup: the
 * WAI-ARIA date picker dialog. The value is a `YYYY-MM-DD` date, submitted under `name` as a
 * native date input submits it; the field shows it as the language writes dates in digits
 * (26/10/2026 in British English, 10/26/2026 in American English).
 *
 * @csspart field - The field: label, description, control box, and error.
 * @csspart label - The visible label.
 * @csspart description - Help text, referenced by `aria-describedby`.
 * @csspart control - The text input.
 * @csspart button - Opens the calendar.
 * @csspart popup - The popup that holds the calendar (`odd-calendar`).
 * @csspart error - The error message, referenced by `aria-describedby`.
 * @cssstate user-invalid - The field shows its error: `error` is set, or the date is missing, out of range, or not a date after the user left the field or a validity check failed.
 * @cssstate open - The calendar is open.
 * @a11y The text input is named by the label. The button after it is named "Choose date", or "Change date," with the chosen date in full, and has `aria-haspopup="dialog"` and `aria-expanded`; it opens a non-modal dialog named "Choose date" that holds an `odd-calendar`, which takes focus on the chosen date (or today). Choosing a date closes the dialog and returns focus to the button; Escape or a click outside closes it without a change. Text that is not a date makes the field invalid with a message that gives the expected order.
 * @keyboard The input and the button are Tab stops. A typed date is committed when focus leaves the input or on Enter. Enter or Space on the button opens the calendar; there odd-calendar's keys apply, Enter or Space chooses and closes, and Escape closes.
 * @previewRole datePicker
 * @useFor One date the user may know and type, or prefer to find in a month: a booking, a due date, a publish date.
 * @notFor A memorable date such as a birth date (separate fields, or odd-input type="date"); a date and time (odd-input type="datetime-local"); a range of dates; an inline month to choose from (odd-calendar).
 * @limitation Typed dates are read as three groups of digits in the language's order with a four-digit year; month names are not read.
 * @category Forms
 */
export class OddkinDatePicker extends OddkinFormControl.with({
  label: prop.string({ default: '', description: 'Visible label; names the field.' }),
  defaultValue: prop.string({
    default: '',
    attribute: 'value',
    description: 'Initial date, `YYYY-MM-DD`; the `value` attribute, as on a native date input.',
  }),
  min: prop.string({ default: '', description: 'Earliest date, `YYYY-MM-DD`.' }),
  max: prop.string({ default: '', description: 'Latest date, `YYYY-MM-DD`.' }),
  required: prop.boolean({ reflect: true, description: 'A date is required to submit.' }),
  readonly: prop.boolean({
    reflect: true,
    description: 'The date can be read and the calendar opened, not changed; still submitted.',
  }),
  placeholder: prop.string({
    default: '',
    description: 'Placeholder; never a substitute for a label.',
  }),
  firstDay: prop.number({
    default: 0,
    description:
      "The calendar's first day of the week, 1 (Monday) to 7 (Sunday); 0 follows the page language.",
  }),
  isDateDisabled: prop.custom<CalendarDateFilter | undefined>({
    default: () => undefined,
    attribute: false,
    coerce: (value) =>
      value === undefined || typeof value === 'function'
        ? { ok: true, value: value as CalendarDateFilter | undefined }
        : { ok: false, reason: 'expected a function or undefined' },
    description:
      'Returns `true` for a date (`YYYY-MM-DD`) the user may not choose in the calendar.',
  }),
  strings: prop.object<Partial<typeof DATE_PICKER_STRINGS>>({
    description:
      "Localized string overrides: `choose`, `change` (`{date}`), `invalid` (`{format}`), `day`, `month`, `year`, and the calendar's `previousMonth`, `nextMonth`, `today`, `clear`.",
  }),
}) {
  static override shadowRootOptions: ShadowRootInit = { mode: 'open', delegatesFocus: true };
  static override events = { input: datePickerInputEvent, change: datePickerChangeEvent };
  declare readonly _events?: ElementEvents<typeof OddkinDatePicker>;

  // undefined until set or committed ("dirty"), then independent of `defaultValue`.
  readonly #value = signal<string | undefined>(undefined);
  // What the user typed and has not committed as a date; undefined shows the value.
  readonly #typed = signal<string | undefined>(undefined);
  // Supplies `required`, `min`, and `max` validity and their messages, as a native date input.
  readonly #validator = Object.assign(document.createElement('input'), { type: 'date' });
  readonly #overlay = new Overlay({
    host: this,
    surface: () => this.shadowRoot?.querySelector<HTMLElement>('[part~="popup"]'),
    anchor: () => this.shadowRoot?.querySelector<HTMLElement>('.control-box'),
    onToggle: (open) => {
      this.setState('open', open);
      if (open) this.shadowRoot?.querySelector<HTMLElement>('odd-calendar')?.focus();
    },
  });

  constructor() {
    super();
    // A value assigned before the element was defined becomes the dirty value.
    if (Object.hasOwn(this, 'value')) {
      const early = (this as { value?: unknown }).value;
      delete (this as { value?: unknown }).value;
      this.value = String(early ?? '');
    }
  }

  /** @internal The calendar is open; the button's `aria-expanded`. */
  readonly _open: Readable<boolean> = this.#overlay.open;

  /** @internal The value: a real `YYYY-MM-DD` date or empty, as a native date input sanitizes it. */
  readonly _value: Readable<string> = computed(() => {
    const text = this.#value.value ?? this.defaultValue;
    return dayOf(text) === undefined ? '' : text;
  });

  /** The chosen date, `YYYY-MM-DD`, or empty. Setting it detaches it from `defaultValue`. */
  get value(): string {
    return this._value.value;
  }
  set value(value: string) {
    this.#value.value = String(value ?? '');
    this.#typed.value = undefined;
  }

  /** @internal The built-in text with the author's overrides. */
  readonly _strings: Readable<typeof DATE_PICKER_STRINGS> = computed(() =>
    strings(DATE_PICKER_STRINGS, this.strings),
  );

  /** @internal The page language, for `Intl`. */
  get _lang(): string {
    return langOf(this) ?? navigator.language;
  }

  /** @internal The field's text: what the user typed, or the value as the language writes it. */
  get _text(): string {
    return this.#typed.value ?? formatDateText(this._value.value, this._lang);
  }

  /** @internal The message for typed text that is not a date; empty when there is none. */
  readonly _badInput: Readable<string> = computed(() => {
    const typed = this.#typed.value;
    if (!typed || parseDateText(typed, this._lang) !== undefined) return '';
    const text = this._strings.value;
    const { order, separator } = dateFields(this._lang);
    return format(text.invalid, { format: order.map((field) => text[field]).join(separator) });
  });

  /** @internal The button's name: "Choose date", or "Change date, …" with the chosen date. */
  get _buttonLabel(): string {
    const text = this._strings.value;
    const day = dayOf(this._value.value);
    if (day === undefined) return text.choose;
    const date = new Intl.DateTimeFormat(this._lang, { dateStyle: 'full', timeZone: 'UTC' });
    return format(text.change, { date: date.format(new Date(day * 86_400_000)) });
  }

  /** @internal Disabled by its attribute or a disabled fieldset. */
  get _inactive(): boolean {
    return this._formDisabled.value;
  }

  protected override _formOptions(): FormControlOptions {
    return {
      value: () => this._value.value,
      control: () =>
        Object.assign(this.#validator, {
          required: this.required,
          readOnly: this.readonly,
          disabled: this._inactive,
          min: this.min,
          max: this.max,
          value: this._value.value,
        }),
      // Barred, as the read-only or disabled native input is, so its text is not reported.
      badInput: () => (this.readonly || this._inactive ? '' : this._badInput.value),
      anchor: () => this.shadowRoot?.querySelector<HTMLElement>('[part~="control"]'),
      watch: () => [this.required, this.min, this.max],
      onReset: () => {
        this.#value.value = undefined;
        this.#typed.value = undefined;
      },
      onRestore: (state) => {
        if (typeof state === 'string') this.value = state;
      },
    };
  }

  #commit(value: string): void {
    if (value === this._value.peek()) return;
    this.#value.value = value;
    this.emit(datePickerInputEvent);
    this.emit(datePickerChangeEvent);
  }

  /** @internal Template handler: typing. The host's `input` waits for a committed date. */
  readonly _onInput = (event: Event): void => {
    event.stopPropagation();
    this.#typed.value = (event.target as HTMLInputElement).value;
  };

  /** @internal Template handler: the typed text is committed (Enter, or focus left the input). */
  readonly _onChange = (): void => {
    const typed = this.#typed.peek();
    if (typed === undefined) return;
    const parsed = typed.trim() ? parseDateText(typed, this._lang) : '';
    // Text that is not a date stays for the user to correct; the value empties.
    if (parsed !== undefined) this.#typed.value = undefined;
    this.#commit(parsed ?? '');
  };

  /**
   * @internal Template handler: the calendar button. It takes focus (WebKit does not on a click):
   * the input's `change` commits a typed date first, so the calendar opens on it, and focus
   * returns to the button, the opener, when the calendar closes.
   */
  readonly _onButton = (event: Event): void => {
    (event.currentTarget as HTMLElement).focus();
    this.#overlay.toggle();
  };

  /** @internal Template handler: the user chose a date in the calendar. */
  readonly _onCalendarChange = (event: Event): void => {
    this.#typed.value = undefined;
    this.#commit((event.target as HTMLElement & { value: string }).value);
    this.#overlay.hide();
  };

  protected override mounted(scope: Scope): void {
    super.mounted(scope);
    scope.use(this.#overlay);
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'odd-date-picker': OddkinDatePicker;
  }
}
