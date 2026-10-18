/**
 * `@oddkin/core/i18n` — localization helpers for components: string tables with typed
 * overrides, `{placeholder}` formatting, plural selection, the nearest `lang` and `dir` across
 * shadow roots, and cached `Intl` formatters. DOM-free at import; `langOf` and `dirOf` read the
 * node they are given. Contract: docs/architecture/core-contracts.md §4.2.
 */

export type StringTable = Readonly<Record<string, string>>;

/** Overrides for a table: any subset of its keys. */
export type StringOverrides<T extends StringTable> = Partial<Record<keyof T, string>>;

/**
 * `defaults` with string `overrides` applied. Unknown keys and non-string values are ignored;
 * without overrides the defaults object itself is returned.
 */
export function strings<T extends StringTable>(
  defaults: T,
  overrides: StringOverrides<T> | null | undefined,
): T {
  if (!overrides) return defaults;
  const out: Record<string, string> = { ...defaults };
  for (const key of Object.keys(defaults)) {
    const value = (overrides as Record<string, unknown>)[key];
    if (typeof value === 'string') out[key] = value;
  }
  return out as T;
}

/** Replace `{name}` placeholders. Values are plain text; unknown placeholders stay as written. */
export function format(
  template: string,
  values: Readonly<Record<string, string | number>>,
): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in values ? String(values[key]) : match,
  );
}

export type PluralForms = Partial<Record<Intl.LDMLPluralRule, string>> & { readonly other: string };

/**
 * The form of `forms` for `count` in `locale` (`other` when the locale's category is missing),
 * formatted with `{count}` as the localized number.
 */
export function plural(
  count: number,
  forms: PluralForms,
  locale?: string,
  values: Readonly<Record<string, string | number>> = {},
): string {
  const rule = cached('PluralRules', locale, undefined, (l) => new Intl.PluralRules(l));
  const template = forms[rule.select(count)] ?? forms.other;
  return format(template, { ...values, count: formatNumber(count, locale) });
}

/** The nearest `lang` attribute, crossing shadow roots; `undefined` when none is set. */
export function langOf(node: Node): string | undefined {
  for (let n: Node | null = node; n; n = n instanceof ShadowRoot ? n.host : n.parentNode)
    if (n instanceof Element && n.hasAttribute('lang')) return n.getAttribute('lang') || undefined;
  return undefined;
}

/** The element's resolved direction (inherits through shadow roots, honours `dir="auto"`). */
export function dirOf(element: Element): 'ltr' | 'rtl' {
  return getComputedStyle(element).direction === 'rtl' ? 'rtl' : 'ltr';
}

const MAX_CACHED = 64;
const cache = new Map<string, unknown>();

/**
 * One formatter per kind, locale, and options. An invalid locale falls back to the user
 * agent's default rather than throwing.
 */
function cached<F>(
  kind: string,
  locale: string | undefined,
  options: object | undefined,
  create: (locale: string | undefined) => F,
): F {
  const key = `${kind}|${locale ?? ''}|${options ? JSON.stringify(options) : ''}`;
  let formatter = cache.get(key) as F | undefined;
  if (formatter) return formatter;
  try {
    formatter = create(locale || undefined);
  } catch (error) {
    if (!(error instanceof RangeError) || !locale) throw error;
    formatter = create(undefined);
  }
  if (cache.size >= MAX_CACHED) cache.delete(cache.keys().next().value!);
  cache.set(key, formatter);
  return formatter;
}

export function numberFormat(
  locale?: string,
  options?: Intl.NumberFormatOptions,
): Intl.NumberFormat {
  return cached('NumberFormat', locale, options, (l) => new Intl.NumberFormat(l, options));
}

export function dateTimeFormat(
  locale?: string,
  options?: Intl.DateTimeFormatOptions,
): Intl.DateTimeFormat {
  return cached('DateTimeFormat', locale, options, (l) => new Intl.DateTimeFormat(l, options));
}

export function relativeTimeFormat(
  locale?: string,
  options?: Intl.RelativeTimeFormatOptions,
): Intl.RelativeTimeFormat {
  return cached(
    'RelativeTimeFormat',
    locale,
    options,
    (l) => new Intl.RelativeTimeFormat(l, options),
  );
}

export function listFormat(locale?: string, options?: Intl.ListFormatOptions): Intl.ListFormat {
  return cached('ListFormat', locale, options, (l) => new Intl.ListFormat(l, options));
}

/** `value` as a localized number; invalid options fall back to `String(value)`. */
export function formatNumber(
  value: number,
  locale?: string,
  options?: Intl.NumberFormatOptions,
): string {
  try {
    return numberFormat(locale, options).format(value);
  } catch {
    return String(value);
  }
}

/** A date, ISO string, or timestamp as localized text; `undefined` for missing or invalid input. */
export function formatDate(
  value: Date | string | number | null | undefined,
  locale?: string,
  options: Intl.DateTimeFormatOptions = { dateStyle: 'medium', timeStyle: 'short' },
): string | undefined {
  if (value === null || value === undefined || value === '') return undefined;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;
  try {
    return dateTimeFormat(locale, options).format(date);
  } catch {
    return date.toISOString();
  }
}
