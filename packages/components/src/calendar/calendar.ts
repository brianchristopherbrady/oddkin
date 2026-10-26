import { event, prop, type ElementEvents } from '@oddkin/core/element';
import { dateTimeFormat, langOf, strings } from '@oddkin/core/i18n';
import { computed, signal, untracked, type Readable } from '@oddkin/core/reactive';
import type { Scope } from '@oddkin/core/scope';
import { OddkinFormControl, type FormControlOptions } from '../form-control/form-control.js';

export const CALENDAR_STRINGS = {
  previousMonth: 'Previous month',
  nextMonth: 'Next month',
  today: 'Today',
  clear: 'Clear',
};

/** Dispatched when the user chooses or clears a date, as on a native date input. */
export const calendarInputEvent = event('input', {
  bubbles: true,
  composed: true,
  cancelable: false,
  syncs: 'value',
  intent: 'user',
});
/** Dispatched with `input` for each date the user chooses or clears. */
export const calendarChangeEvent = event('change', {
  bubbles: true,
  composed: false,
  cancelable: false,
  intent: 'user',
});

/** Decides whether the user may choose a date (`YYYY-MM-DD`): `true` disables it. */
export type CalendarDateFilter = (date: string) => boolean;

const DAY = 86_400_000;
const pad = (n: number) => String(n).padStart(2, '0');

/** A `YYYY-MM-DD` date as a day number (days since 1970-01-01), or `undefined` when it is none. */
export function dayOf(text: string): number | undefined {
  const match = /^(\d{4,})-(\d{2})-(\d{2})$/.exec(text);
  if (!match) return undefined;
  const [year, month, date] = [Number(match[1]), Number(match[2]) - 1, Number(match[3])];
  const at = new Date(0);
  at.setUTCFullYear(year, month, date);
  if (year < 1 || at.getUTCMonth() !== month || at.getUTCDate() !== date) return undefined;
  return at.getTime() / DAY;
}

/** A day number as `YYYY-MM-DD`. */
export function isoOf(day: number): string {
  const at = new Date(day * DAY);
  return `${String(at.getUTCFullYear()).padStart(4, '0')}-${pad(at.getUTCMonth() + 1)}-${pad(at.getUTCDate())}`;
}

/** The same date `months` later, on the month's last day when it is shorter. */
function addMonths(day: number, months: number): number {
  const at = new Date(day * DAY);
  const date = at.getUTCDate();
  at.setUTCDate(1);
  at.setUTCMonth(at.getUTCMonth() + months);
  const last = new Date(at);
  last.setUTCMonth(last.getUTCMonth() + 1, 0);
  at.setUTCDate(Math.min(date, last.getUTCDate()));
  return at.getTime() / DAY;
}

/** The user's local date as a day number. */
function today(): number {
  const now = new Date();
  return Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) / DAY;
}

type WeekInfo = { readonly firstDay: number };
/** The language's first day of the week, 1 (Monday) to 7 (Sunday); Monday where it is unknown. */
function firstDayOf(lang: string): number {
  try {
    const locale = new Intl.Locale(lang) as Intl.Locale & {
      getWeekInfo?(): WeekInfo;
      weekInfo?: WeekInfo;
    };
    return (locale.getWeekInfo?.() ?? locale.weekInfo)?.firstDay ?? 1;
  } catch {
    return 1;
  }
}

/** One cell of the month grid. */
export interface CalendarDay {
  readonly day: number;
  readonly iso: string;
  /** In the month before or after the shown one. */
  readonly outside: boolean;
  readonly disabled: boolean;
}

/**
 * A month of dates to choose one from: the WAI-ARIA date grid, with the month and buttons to the
 * months before and after above it, and Today and Clear below. The value is a `YYYY-MM-DD` date,
 * submitted under `name` as a native date input submits it. Weeks start on the page language's
 * first day (`first-day` sets it); names come from `Intl.DateTimeFormat`.
 *
 * @csspart field - The field: label, description, calendar, and error.
 * @csspart label - The visible label.
 * @csspart description - Help text, referenced by `aria-describedby`.
 * @csspart calendar - The surface: month navigation, grid, and actions.
 * @csspart header - The month navigation row.
 * @csspart previous - The button to the month before.
 * @csspart heading - The month and year shown.
 * @csspart next - The button to the month after.
 * @csspart grid - The date grid (`role="grid"`).
 * @csspart weekday - A column header: the day of the week.
 * @csspart day - A date cell (`role="gridcell"`).
 * @csspart day-outside - A date in the month before or after.
 * @csspart day-today - Today's date.
 * @csspart day-selected - The chosen date.
 * @csspart day-disabled - A date outside `min` and `max` or disabled by `isDateDisabled`.
 * @csspart actions - The row of the Today and Clear buttons.
 * @csspart today - Chooses today.
 * @csspart clear - Clears the value.
 * @csspart error - The error message, referenced by `aria-describedby`.
 * @cssstate user-invalid - The calendar shows its error: `error` is set, or a required calendar has no date after focus left it or a validity check failed.
 * @a11y A `group` named by the label holds the month buttons, a `grid` named by the month and year, and the Today and Clear buttons. Each date cell is named by the full date and marks the chosen date `aria-selected`, today `aria-current="date"`, and dates that cannot be chosen `aria-disabled`; a read-only grid is `aria-readonly`. The month and year are a polite live region, so the month buttons announce the new month.
 * @keyboard The grid is one Tab stop. Left and Right move a day (swapped in right-to-left text), Up and Down a week; Home and End go to the first and last day of the week; Page Up and Page Down move a month, with Shift a year. Enter or Space chooses the date (not when read-only). Moving past `min` or `max` stops there.
 * @previewRole calendar
 * @useFor Choosing one date where the month view helps: a booking, a due date, a day in a schedule.
 * @notFor A memorable date such as a birth date (use odd-input type="date" or separate fields); a date and time (use odd-input type="datetime-local"); a range of dates.
 * @limitation Where the browser has no week information (`Intl.Locale` without `getWeekInfo`), weeks start on Monday unless `first-day` is set.
 * @category Forms
 */
export class OddkinCalendar extends OddkinFormControl.with({
  label: prop.string({ default: '', description: 'Visible label; names the calendar.' }),
  defaultValue: prop.string({
    default: '',
    attribute: 'value',
    description: 'Initial date, `YYYY-MM-DD`; the `value` attribute, as on a native date input.',
  }),
  min: prop.string({ default: '', description: 'Earliest date that can be chosen, `YYYY-MM-DD`.' }),
  max: prop.string({ default: '', description: 'Latest date that can be chosen, `YYYY-MM-DD`.' }),
  required: prop.boolean({ reflect: true, description: 'A date is required to submit.' }),
  readonly: prop.boolean({
    reflect: true,
    description:
      'The dates can be moved through but the value cannot change; still submitted, and not validated.',
  }),
  firstDay: prop.number({
    default: 0,
    description:
      'First day of the week, 1 (Monday) to 7 (Sunday) as in `Intl.Locale` week information; 0 follows the page language.',
  }),
  isDateDisabled: prop.custom<CalendarDateFilter | undefined>({
    default: () => undefined,
    attribute: false,
    coerce: (value) =>
      value === undefined || typeof value === 'function'
        ? { ok: true, value: value as CalendarDateFilter | undefined }
        : { ok: false, reason: 'expected a function or undefined' },
    description:
      'Returns `true` for a date (`YYYY-MM-DD`) the user may not choose, such as a weekend or a booked day.',
  }),
  strings: prop.object<Partial<typeof CALENDAR_STRINGS>>({
    description: 'Localized string overrides: `previousMonth`, `nextMonth`, `today`, `clear`.',
  }),
}) {
  static override events = { input: calendarInputEvent, change: calendarChangeEvent };
  declare readonly _events?: ElementEvents<typeof OddkinCalendar>;

  // undefined until set or chosen ("dirty"), then independent of `defaultValue`.
  readonly #value = signal<string | undefined>(undefined);
  // The date the grid's Tab stop is on, once the user moved it; otherwise the value or today.
  readonly #active = signal<number | undefined>(undefined);
  #focusActive = false;
  // Supplies `required`, `min`, and `max` validity and their messages, as a native date input.
  readonly #validator = Object.assign(document.createElement('input'), { type: 'date' });

  constructor() {
    super();
    // A value assigned before the element was defined becomes the dirty value.
    if (Object.hasOwn(this, 'value')) {
      const early = (this as { value?: unknown }).value;
      delete (this as { value?: unknown }).value;
      this.value = String(early ?? '');
    }
  }

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
    this.#active.value = undefined;
  }

  /** @internal The built-in text with the author's overrides. */
  readonly _strings: Readable<typeof CALENDAR_STRINGS> = computed(() =>
    strings(CALENDAR_STRINGS, this.strings),
  );

  /** @internal The page language, for `Intl`. */
  get _lang(): string {
    return langOf(this) ?? navigator.language;
  }

  /** @internal First day of the week: 1 (Monday) to 7 (Sunday, 0 to `getUTCDay()`). */
  get _weekStart(): number {
    const set = Math.trunc(this.firstDay);
    return set >= 1 && set <= 7 ? set : firstDayOf(this._lang);
  }

  #bounds(): [number, number] {
    return [dayOf(this.min) ?? -Infinity, dayOf(this.max) ?? Infinity];
  }

  #clamp(day: number): number {
    const [min, max] = this.#bounds();
    return Math.min(Math.max(day, min), max);
  }

  /** @internal The user may choose `day`: within `min` and `max`, and not disabled by the hook. */
  _selectable(day: number): boolean {
    const [min, max] = this.#bounds();
    return day >= min && day <= max && !this.isDateDisabled?.(isoOf(day));
  }

  /** @internal The date that holds the grid's Tab stop; its month is shown. */
  readonly _active: Readable<number> = computed(() =>
    this.#clamp(this.#active.value ?? dayOf(this._value.value) ?? today()),
  );

  /** @internal Today, as a day number. */
  get _today(): number {
    return today();
  }

  /** @internal The six weeks shown: the active date's month, with days before and after. */
  get _weeks(): CalendarDay[][] {
    const at = new Date(this._active.value * DAY);
    const month = at.getUTCMonth();
    const first = Date.UTC(at.getUTCFullYear(), month, 1) / DAY;
    const lead = (new Date(first * DAY).getUTCDay() - this._weekStart + 7) % 7;
    const weeks: CalendarDay[][] = [];
    for (let week = 0; week < 6; week++) {
      const days: CalendarDay[] = [];
      for (let i = 0; i < 7; i++) {
        const day = first - lead + week * 7 + i;
        days.push({
          day,
          iso: isoOf(day),
          outside: new Date(day * DAY).getUTCMonth() !== month,
          disabled: !this._selectable(day),
        });
      }
      weeks.push(days);
    }
    return weeks;
  }

  /** @internal The column headers: short names shown, full names for assistive technology. */
  get _weekdays(): { short: string; long: string }[] {
    const short = dateTimeFormat(this._lang, { weekday: 'short', timeZone: 'UTC' });
    const long = dateTimeFormat(this._lang, { weekday: 'long', timeZone: 'UTC' });
    // 1970-01-04 was a Sunday (day 3).
    return Array.from({ length: 7 }, (_, i) => {
      const date = new Date((3 + ((this._weekStart + i) % 7)) * DAY);
      return { short: short.format(date), long: long.format(date) };
    });
  }

  /** @internal Text for a day: `"numeric"` (the cell), `"full"` (its name), or `"month"` (the heading). */
  _format(day: number, style: 'numeric' | 'full' | 'month'): string {
    const options: Intl.DateTimeFormatOptions =
      style === 'numeric'
        ? { day: 'numeric', timeZone: 'UTC' }
        : style === 'full'
          ? { dateStyle: 'full', timeZone: 'UTC' }
          : { month: 'long', year: 'numeric', timeZone: 'UTC' };
    return dateTimeFormat(this._lang, options).format(new Date(day * DAY));
  }

  /** @internal The month before (-1) or after (1) has a date within `min` and `max`. */
  _canMove(months: -1 | 1): boolean {
    const [min, max] = this.#bounds();
    const at = new Date(this._active.value * DAY);
    const first = Date.UTC(at.getUTCFullYear(), at.getUTCMonth() + months, 1) / DAY;
    const last = Date.UTC(at.getUTCFullYear(), at.getUTCMonth() + months + 1, 0) / DAY;
    return last >= min && first <= max;
  }

  /** @internal Disabled by its attribute or a disabled fieldset. */
  get _inactive(): boolean {
    return this.disabled || this._formDisabled.value;
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
      // A disabled grid has no Tab stop; the anchor must still be inside the element.
      anchor: () => this._activeCell ?? this,
      watch: () => [this.required, this.readonly, this.min, this.max],
      onReset: () => {
        this.#value.value = undefined;
        this.#active.value = undefined;
      },
      onRestore: (state) => {
        if (typeof state === 'string') this.value = state;
      },
    };
  }

  // The user chose `day` (or cleared the value with `undefined`).
  #choose(day: number | undefined): void {
    if (this.readonly) return;
    if (day !== undefined) this.#active.value = day;
    const next = day === undefined ? '' : isoOf(day);
    if (next === this._value.peek()) return;
    this.#value.value = next;
    this.emit(calendarInputEvent);
    this.emit(calendarChangeEvent);
  }

  // Moves the grid's Tab stop to `day` (within `min` and `max`), and focus with it from the grid.
  #moveTo(day: number, focus: boolean): void {
    const next = this.#clamp(day);
    if (next === this._active.peek()) return;
    this.#focusActive = focus;
    this.#active.value = next;
  }

  /** @internal The date cell that holds the grid's Tab stop. */
  get _activeCell(): HTMLElement | null | undefined {
    return this.shadowRoot?.querySelector<HTMLElement>('[part~="day"][tabindex="0"]');
  }

  /** Focuses the date that holds the grid's Tab stop. */
  override focus(options?: FocusOptions): void {
    this._activeCell?.focus(options);
  }

  /** @internal Template handler: keys in the grid. */
  readonly _onKeydown = (event: KeyboardEvent): void => {
    if (this._inactive || event.altKey || event.ctrlKey || event.metaKey) return;
    const active = this._active.peek();
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      if (this._selectable(active)) this.#choose(active);
      return;
    }
    const rtl = getComputedStyle(this).direction === 'rtl';
    const column = (new Date(active * DAY).getUTCDay() - this._weekStart + 7) % 7;
    const page = event.shiftKey ? 12 : 1;
    const next: Record<string, () => number> = {
      ArrowLeft: () => active + (rtl ? 1 : -1),
      ArrowRight: () => active + (rtl ? -1 : 1),
      ArrowUp: () => active - 7,
      ArrowDown: () => active + 7,
      Home: () => active - column,
      End: () => active + 6 - column,
      PageUp: () => addMonths(active, -page),
      PageDown: () => addMonths(active, page),
    };
    const move = next[event.key];
    if (!move) return;
    event.preventDefault();
    this.#moveTo(move(), true);
  };

  /** @internal Template handler: a date cell was clicked. */
  _onDay(day: number): void {
    if (this._inactive || !this._selectable(day)) return;
    // A date in the month before or after shows its month; focus follows it there.
    this.#moveTo(day, true);
    this.#choose(day);
  }

  /** @internal Template handler: the month buttons (disabled past min and max). Focus stays. */
  _onMonth(months: -1 | 1): void {
    this.#moveTo(addMonths(this._active.peek(), months), false);
  }

  /** @internal Template handler: focus left the calendar. */
  readonly _onFocusOut = (event: FocusEvent): void => {
    if (!this.shadowRoot?.contains(event.relatedTarget as Node | null)) this._onBlur();
  };

  /** @internal Template handler: the Today button. */
  readonly _onToday = (): void => {
    const day = today();
    if (this._selectable(day)) this.#choose(day);
  };

  /** @internal Template handler: the Clear button. */
  readonly _onClear = (): void => this.#choose(undefined);

  protected override mounted(scope: Scope): void {
    super.mounted(scope);
    scope.effect(
      () => {
        void this._active.value;
        // A date that had focus but no longer holds the Tab stop (the value or bounds moved it)
        // passes focus on too.
        const focused = this.shadowRoot?.activeElement as HTMLElement | null | undefined;
        const stray = !!focused?.matches('[part~="day"]') && focused.tabIndex !== 0;
        if (!this.#focusActive && !stray) return;
        this.#focusActive = false;
        untracked(() => this._activeCell?.focus());
      },
      { phase: 'post', name: '<odd-calendar> focus the active date' },
    );
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'odd-calendar': OddkinCalendar;
  }
}
