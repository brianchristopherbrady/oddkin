/** Merge host-supplied string overrides over defaults (unknown keys ignored). */
export function strings<T extends Record<string, string>>(
  defaults: T,
  overrides: Partial<Record<string, string>> | undefined,
): T {
  if (!overrides) return defaults;
  const out: Record<string, string> = { ...defaults };
  for (const key of Object.keys(defaults)) {
    const value = overrides[key];
    if (typeof value === 'string') out[key] = value;
  }
  return out as T;
}

export { format } from '../controllers/announcer.js';

/** Format a number with the element's language (inherited `lang`). */
export function formatNumber(
  value: number,
  locale: string | undefined,
  options?: Intl.NumberFormatOptions,
): string {
  try {
    return new Intl.NumberFormat(locale || undefined, options).format(value);
  } catch {
    return String(value);
  }
}

/** The nearest `lang` (crossing shadow roots), for `Intl` formatting. */
export function langOf(element: Element): string | undefined {
  let node: Node | null = element;
  while (node) {
    if (node instanceof Element && node.hasAttribute('lang'))
      return node.getAttribute('lang') || undefined;
    node = node instanceof ShadowRoot ? node.host : node.parentNode;
  }
  return undefined;
}

export function formatTime(
  iso: string | undefined,
  locale: string | undefined,
): string | undefined {
  if (!iso) return undefined;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return undefined;
  try {
    return new Intl.DateTimeFormat(locale || undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(date);
  } catch {
    return date.toISOString();
  }
}
