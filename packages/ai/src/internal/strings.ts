import { formatDate } from '@oddkin/core/i18n';

export { format, formatNumber, langOf, strings } from '@oddkin/core/i18n';

/** A record timestamp (ISO 8601) as medium date and short time in `locale`. */
export function formatTime(
  iso: string | undefined,
  locale: string | undefined,
): string | undefined {
  return formatDate(iso, locale);
}

/** An element's copy outcome strings, as the `strings` of the `odd-copy-button` it renders. */
export const copyStrings = (t: { copied: string; copyFailed: string }) => ({
  copied: t.copied,
  failed: t.copyFailed,
});
