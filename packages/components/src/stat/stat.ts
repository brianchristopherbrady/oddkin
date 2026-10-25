import { OddkinElement, prop } from '@oddkin/core/element';
import { strings } from '@oddkin/core/i18n';
import type { Scope } from '@oddkin/core/scope';

export const STAT_STRINGS = { loading: 'Loading…', unavailable: 'Data not available' };

/**
 * One metric: its `label`, its `value`, and the context in the default slot ("+8.2% this month").
 * `trend` adds an arrow for the direction of change, without saying whether it is good: the
 * signed value in the context says it in words. While `loading` a placeholder stands in for the
 * value; an empty `value` says "Data not available".
 *
 * @slot - The context: the signed change and its period, or a comparison ("Across 12 teams").
 * @csspart base - The stat's surface.
 * @csspart label - The label.
 * @csspart value - The value ("—" when there is none).
 * @csspart placeholder - The loading placeholder (an `odd-skeleton`).
 * @csspart context - The trend arrow and the context.
 * @a11y Read in order: label, value, context. Put the sign and the period in the context ("+8.2% this month"): the arrow is decorative. While `loading` the element is busy (`aria-busy`) and says `strings.loading`; without a value it says `strings.unavailable` and the dash is hidden.
 * @previewRole stat
 * @useFor A key figure on a dashboard or summary: a count, a total, a rate, with its change.
 * @notFor Progress toward a goal (use a progress bar); several figures compared side by side (use a table or chart).
 * @category Display
 */
export class OddkinStat extends OddkinElement.with({
  label: prop.string({ default: '', description: 'What the value measures.' }),
  value: prop.string({
    default: '',
    description: 'The value, formatted: "1,284", "$4.2M", "98.6%".',
  }),
  trend: prop.enum(['none', 'increase', 'decrease'], {
    default: 'none',
    reflect: true,
    description: 'An arrow for the direction of change, with no colour for good or bad.',
  }),
  loading: prop.boolean({ reflect: true, description: 'Shows a placeholder for the value.' }),
  strings: prop.object<Partial<typeof STAT_STRINGS>>({
    description: 'Localized string overrides.',
  }),
}) {
  /** @internal The localized words. */
  get _strings(): typeof STAT_STRINGS {
    return strings(STAT_STRINGS, this.strings);
  }

  protected override mounted(scope: Scope): void {
    scope.effect(() => {
      this.internals.ariaBusy = this.loading ? 'true' : null;
    });
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'odd-stat': OddkinStat;
  }
}
