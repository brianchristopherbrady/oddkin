import { describe, expect, it } from 'vitest';
import {
  dateTimeFormat,
  format,
  formatDate,
  formatNumber,
  listFormat,
  numberFormat,
  plural,
  relativeTimeFormat,
  strings,
} from '../src/i18n/index.js';

describe('string tables', () => {
  const DEFAULTS = { send: 'Send', stop: 'Stop {name}' } as const;

  it('apply typed overrides, ignoring unknown keys and non-strings', () => {
    expect(strings(DEFAULTS, undefined)).toBe(DEFAULTS);
    const merged = strings(DEFAULTS, { send: 'Senden' });
    expect(merged).toEqual({ send: 'Senden', stop: 'Stop {name}' });
    expect(DEFAULTS.send).toBe('Send');
    const loose = { send: 1, extra: 'x' } as unknown as Partial<Record<'send', string>>;
    expect(strings(DEFAULTS, loose)).toEqual(DEFAULTS);
  });

  it('format named placeholders as plain text and keep unknown ones', () => {
    expect(format('Stop {name} ({n})', { name: '<b>run</b>', n: 2 })).toBe('Stop <b>run</b> (2)');
    expect(format('{missing} stays', {})).toBe('{missing} stays');
  });

  it('select plural forms by locale and localize the count', () => {
    const forms = { one: '{count} new message', other: '{count} new messages' };
    expect(plural(1, forms, 'en')).toBe('1 new message');
    expect(plural(1200, forms, 'en')).toBe('1,200 new messages');
    expect(plural(1200, forms, 'de')).toBe('1.200 new messages');
    // Arabic has a `few` category; a table without it falls back to `other`.
    expect(plural(3, { few: 'few', other: 'other' }, 'ar')).toBe('few');
    expect(plural(3, { other: 'other {count}' }, 'ar')).toMatch(/^other /);
  });
});

describe('Intl formatters', () => {
  it('are cached per kind, locale, and options', () => {
    expect(numberFormat('en')).toBe(numberFormat('en'));
    expect(numberFormat('en', { style: 'percent' })).not.toBe(numberFormat('en'));
    expect(numberFormat('de')).not.toBe(numberFormat('en'));
    expect(dateTimeFormat('en', { dateStyle: 'short' })).toBe(
      dateTimeFormat('en', { dateStyle: 'short' }),
    );
    expect(relativeTimeFormat('en').format(-1, 'day')).toBe('1 day ago');
    expect(listFormat('en').format(['a', 'b', 'c'])).toBe('a, b, and c');
  });

  it('fall back to the default locale for an invalid tag instead of throwing', () => {
    expect(() => numberFormat('not a locale!')).not.toThrow();
    expect(formatNumber(1234.5, 'not a locale!')).toBe(numberFormat().format(1234.5));
    expect(formatNumber(5, 'en', { style: 'currency' })).toBe('5');
  });

  it('format dates from Date, ISO text, or timestamps, and reject invalid input', () => {
    const iso = '2026-10-18T09:30:00Z';
    const options = { dateStyle: 'medium', timeZone: 'UTC' } as const;
    expect(formatDate(iso, 'en', options)).toBe('Oct 18, 2026');
    expect(formatDate(new Date(iso), 'en', options)).toBe('Oct 18, 2026');
    expect(formatDate(Date.parse(iso), 'en', options)).toBe('Oct 18, 2026');
    expect(formatDate(undefined, 'en')).toBeUndefined();
    expect(formatDate('', 'en')).toBeUndefined();
    expect(formatDate('yesterday', 'en')).toBeUndefined();
  });
});
