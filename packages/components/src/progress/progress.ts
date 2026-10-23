import { OddkinElement, prop } from '@oddkin/core/element';
import { formatNumber, langOf, strings } from '@oddkin/core/i18n';

export const PROGRESS_STRINGS = { label: 'Progress' };

/** Formats the value text; returns what is shown and announced. */
export type ProgressValueRenderer = (value: number, max: number) => string;

/**
 * Progress of a task. With a `value` it shows how much is done; without, it shows that work is
 * under way and never a percentage.
 *
 * Drawn as an ARIA progress bar rather than a native `<progress>`, whose bar and indicator can
 * only be styled through engine-prefixed pseudo-elements.
 *
 * @csspart base - Label, bar, and description.
 * @csspart label - The visible label.
 * @csspart value-text - The formatted value (determinate only).
 * @csspart track - The bar (`role="progressbar"`).
 * @csspart indicator - The filled part of the bar.
 * @csspart description - Help text below the bar.
 * @cssprop --odd-progress-height - Bar thickness.
 * @a11y A progress bar named by `label` (default "Progress") and described by `description`; the value text is its `aria-valuetext`. Changes are not announced; announce completion separately if it matters.
 * @previewRole progress
 * @useFor Uploads, imports, and other work with a measurable amount.
 * @notFor Work of unknown length in a small space (use odd-spinner); a measurement within a known range such as disk usage.
 * @category Feedback
 */
export class OddkinProgress extends OddkinElement.with({
  value: prop.number({ description: 'Work done, from 0 to `max`; absent: indeterminate.' }),
  max: prop.number({
    default: 1,
    description: 'Value at completion, as on a native progress (1).',
  }),
  label: prop.string({ default: '', description: 'Visible label; names the progress bar.' }),
  description: prop.string({ default: '', description: 'Help text below the bar.' }),
  renderValue: prop.custom<ProgressValueRenderer | undefined>({
    default: () => undefined,
    coerce: (value) =>
      value === undefined || typeof value === 'function'
        ? { ok: true, value: value as ProgressValueRenderer | undefined }
        : { ok: false, reason: 'expected a function or undefined' },
    description: 'Formats the value text (default: a percentage in the element language).',
  }),
  strings: prop.object<Partial<typeof PROGRESS_STRINGS>>({
    description: 'Localized string overrides.',
  }),
}) {
  /** @internal `max` when positive, otherwise 1 (as native). */
  get _max(): number {
    return this.max > 0 ? this.max : 1;
  }
  /** @internal The value clamped to the range, or undefined when indeterminate. */
  get _value(): number | undefined {
    return this.value === undefined ? undefined : Math.min(Math.max(this.value, 0), this._max);
  }
  /** @internal The text shown and announced for the current value. */
  get _valueText(): string {
    const value = this._value;
    if (value === undefined) return '';
    if (this.renderValue) return this.renderValue(value, this._max);
    return formatNumber(value / this._max, langOf(this), { style: 'percent' });
  }
  /** @internal The built-in text with overrides applied. */
  get _strings(): typeof PROGRESS_STRINGS {
    return strings(PROGRESS_STRINGS, this.strings);
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'odd-progress': OddkinProgress;
  }
}
