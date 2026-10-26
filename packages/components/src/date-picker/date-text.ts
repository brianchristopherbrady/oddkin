import { dateTimeFormat } from '@oddkin/core/i18n';
import { dayOf } from '../calendar/calendar.js';

const DAY = 86_400_000;

/** How the page language writes a numeric date: the field order and the text between fields. */
export interface DateFields {
  readonly order: readonly ('day' | 'month' | 'year')[];
  /** The text between the first two fields ("/", ".", "-", ". "). */
  readonly separator: string;
}

const numeric = (lang: string) =>
  dateTimeFormat(lang, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'UTC',
    numberingSystem: 'latn',
  });

/** The order and separator of `lang`'s numeric dates, from `Intl.DateTimeFormat#formatToParts`. */
export function dateFields(lang: string): DateFields {
  const parts = numeric(lang).formatToParts(new Date(Date.UTC(2026, 10, 25)));
  const order = parts
    .map((part) => part.type)
    .filter((type): type is 'day' | 'month' | 'year' => /^(day|month|year)$/.test(type));
  const first = parts.findIndex((part) => part.type === order[0]);
  return { order, separator: parts[first + 1]!.value };
}

/** `YYYY-MM-DD` as `lang` writes it in digits ("26/10/2026", "10/26/2026", "26.10.2026"). */
export function formatDateText(iso: string, lang: string): string {
  const day = dayOf(iso);
  return day === undefined ? '' : numeric(lang).format(new Date(day * DAY));
}

/**
 * Typed text in `lang`'s field order as `YYYY-MM-DD`: three groups of digits, the year with four,
 * between any other characters. `undefined` when it is not a real date.
 */
export function parseDateText(text: string, lang: string): string | undefined {
  const groups = text.match(/\d+/g);
  if (groups?.length !== 3) return undefined;
  const fields: Record<string, string> = {};
  dateFields(lang).order.forEach((field, i) => (fields[field] = groups[i]!));
  const { day = '', month = '', year = '' } = fields;
  if (year.length !== 4) return undefined;
  const iso = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  return dayOf(iso) === undefined ? undefined : iso;
}
