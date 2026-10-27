import { OddkinElement, prop } from '@oddkin/core/element';
import { dateTimeFormat, langOf, relativeTimeFormat, strings } from '@oddkin/core/i18n';

export const RELATIVE_TIME_STRINGS = { unavailable: 'Time unavailable' };

/** The absolute date and time beside a relative one: "October 24, 2026 at 9:30 AM PDT". */
const ABSOLUTE: Intl.DateTimeFormatOptions = {
  year: 'numeric',
  month: 'long',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
  timeZoneName: 'short',
};

/**
 * The value and unit that say how far `date` is from `now`, both in milliseconds: under 45 s is
 * "now" (`0 second`), then minutes, hours, days, weeks, months, and years, each rounded.
 */
export function relativeUnit(date: number, now: number): [number, Intl.RelativeTimeFormatUnit] {
  const seconds = (date - now) / 1000;
  const abs = Math.abs(seconds);
  // Each threshold keeps the rounded value at 1 or more.
  const round = (divisor: number) => Math.round(seconds / divisor);
  if (abs < 45) return [0, 'second'];
  if (abs < 45 * 60) return [round(60), 'minute'];
  if (abs < 22 * 3600) return [round(3600), 'hour'];
  if (abs < 6.5 * 86400) return [round(86400), 'day'];
  if (abs < 26 * 86400) return [round(7 * 86400), 'week'];
  if (abs < 320 * 86400) return [round(30.4375 * 86400), 'month'];
  return [round(365.25 * 86400), 'year'];
}

/**
 * A date and time said relative to now ("3 hours ago", "in 2 days", "now") in the page's language,
 * as a `<time>` that keeps the exact value; the absolute date and time is its tooltip, and with
 * `detail` it is shown as well. An empty or unparseable `datetime` says so in words.
 *
 * @csspart base - The element's box.
 * @csspart time - The relative text: a `<time>`, or the unavailable text.
 * @csspart detail - The absolute date and time (with `detail`).
 * @a11y Assistive technology reads the relative text; the absolute date and time is the native tooltip of the `<time>` (hover only), so show it with `detail` where it matters, as Figma's Absolute detail does.
 * @limitation It does not update itself: the text is computed when it renders (Figma: not a live clock). Set `datetime` again to refresh it, or show the absolute date.
 * @previewRole relativeTime
 * @useFor When something happened or will happen, where closeness matters more than the exact time: activity, comments, updates.
 * @notFor Exact times that people compare or copy (show the absolute date); a running countdown.
 * @category Display
 * @customization 1 2 3
 */
export class OddkinRelativeTime extends OddkinElement.with({
  datetime: prop.string({
    default: '',
    description: 'When: an ISO 8601 date and time, as on `<time datetime>`.',
  }),
  detail: prop.boolean({ reflect: true, description: 'Also shows the absolute date and time.' }),
  strings: prop.object<Partial<typeof RELATIVE_TIME_STRINGS>>({
    description: 'Localized string overrides.',
  }),
}) {
  /** @internal The parsed date, or undefined when `datetime` is empty or unparseable. */
  get _date(): Date | undefined {
    if (!this.datetime) return undefined;
    const date = new Date(this.datetime);
    return Number.isNaN(date.getTime()) ? undefined : date;
  }

  /** @internal The relative text. */
  _relative(date: Date): string {
    const [value, unit] = relativeUnit(date.getTime(), Date.now());
    return relativeTimeFormat(langOf(this), { numeric: 'auto' }).format(value, unit);
  }

  /** @internal The absolute date and time. */
  _absolute(date: Date): string {
    return dateTimeFormat(langOf(this), ABSOLUTE).format(date);
  }

  /** @internal The text for a missing or unparseable `datetime`. */
  get _unavailable(): string {
    return strings(RELATIVE_TIME_STRINGS, this.strings).unavailable;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'odd-relative-time': OddkinRelativeTime;
  }
}
