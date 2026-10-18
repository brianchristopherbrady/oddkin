import { OddkinElement, prop } from '@oddkin/core/element';
import type { UsageEntry } from '../contracts/types.js';
import { format, formatNumber, langOf, strings } from '../internal/strings.js';

export const USAGE_STRINGS = {
  label: 'Usage',
  ofLimit: '{used} of {limit}',
  unknown: 'Unknown',
  estimated: 'estimated',
  measured: 'measured',
  noLimit: 'no limit reported',
};

/**
 * Token, context, quota, and cost figures exactly as the host supplies them, each marked
 * measured, estimated, or unknown. Never computes or guesses a value.
 *
 * @csspart list - The description list of entries.
 * @csspart meter - A native meter, only when both `used` and `limit` are known.
 * @a11y Values are text; meters repeat them for sighted users and are labelled by their entry.
 * @useFor Showing consumption of tokens, context window, quota, or cost.
 * @notFor Billing statements; amounts are informational.
 * @limitation Precision labels come from the host (`measured` / `estimated` / `unknown`).
 * @category AI
 */
export class OddkinUsageMeter extends OddkinElement.with({
  usage: prop.array<UsageEntry>({ description: 'Usage entries (replace to update).' }),
  label: prop.string({
    default: '',
    description: 'Accessible name; defaults to the localized "Usage".',
  }),
  strings: prop.object<Partial<typeof USAGE_STRINGS>>({
    description: 'Localized string overrides.',
  }),
}) {
  /** @internal */
  get _strings(): typeof USAGE_STRINGS {
    return strings(USAGE_STRINGS, this.strings);
  }

  /** @internal Display text for one entry. */
  _value(entry: UsageEntry): string {
    const t = this._strings;
    if (entry.precision === 'unknown' || entry.used === undefined) return t.unknown;
    const locale = langOf(this);
    const number = (value: number) =>
      entry.kind === 'cost' && entry.currency
        ? formatNumber(value, locale, {
            style: 'currency',
            currency: entry.currency,
            maximumFractionDigits: 4,
          })
        : `${formatNumber(value, locale)}${entry.unit ? ` ${entry.unit}` : ''}`;
    const used = number(entry.used);
    const text =
      entry.limit !== undefined ? format(t.ofLimit, { used, limit: number(entry.limit) }) : used;
    return `${text} (${entry.precision === 'estimated' ? t.estimated : t.measured})`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'odd-usage-meter': OddkinUsageMeter;
  }
}
