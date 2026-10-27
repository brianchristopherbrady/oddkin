import { prop } from '@oddkin/core/element';
import { format, langOf, plural, strings } from '@oddkin/core/i18n';
import { computed, type Readable } from '@oddkin/core/reactive';
import { OddkinRadioControl, type OptionRecord } from '../form-control/radio-control.js';

export type { OptionRecord } from '../form-control/radio-control.js';
export { changeEvent, inputEvent } from '../form-control/radio-control.js';

export const RATING_STRINGS = {
  star: '{count} stars',
  starOne: '{count} star',
  summary: '{value} of {max}',
  empty: 'Not rated',
};

/**
 * A score from one to `max` stars (default five), with the chosen value beside the stars ("3 of
 * 5"): the radio-group behavior drawn as stars, each filled up to the chosen one. Without
 * `<option>` children or `options`, the stars are named by `strings.star` ("3 stars"); options
 * name them instead ("Good"), and their count replaces `max`.
 *
 * @csspart field - Wrapper of label, description, stars, value, and error.
 * @csspart label - The visible label.
 * @csspart description - Help text, referenced by `aria-describedby`.
 * @csspart control - The row of stars and the value.
 * @csspart option - One star.
 * @csspart value - The chosen value, or `strings.empty` while nothing is chosen.
 * @csspart error - The error message, referenced by `aria-describedby`.
 * @cssstate user-invalid - The rating shows its error: `error` is set, or nothing is chosen while `required` after focus left the stars or a validity check failed.
 * @a11y A `role="radiogroup"` in the shadow root, named by `label` and described by the description and error, holds a native radio per star, named by its option's label ("3 stars"), as the WAI-ARIA rating radio group example. `readonly` adds `aria-readonly` and keeps the stars focusable.
 * @keyboard Native radio behavior: Tab enters at the chosen star (or the first, when none is chosen) and leaves; arrow keys move to the next or previous star and choose it; Space chooses the focused star. While `readonly`, the keys and clicks change nothing.
 * @previewRole rating
 * @useFor A score the user gives on a short ordered scale: an opinion of an item, a satisfaction level.
 * @notFor A number on a long or continuous scale (use odd-slider); choices that are not ordered (use odd-radio-group).
 * @limitation Whole stars only: no half values. The focus ring and the chosen value move together, as on native radios.
 * @category Forms
 * @customization 1 2 3
 */
export class OddkinRating extends OddkinRadioControl.with({
  max: prop.number({
    default: 5,
    reflect: true,
    description: 'How many stars, when the options are not given.',
  }),
  readonly: prop.boolean({
    reflect: true,
    description:
      'Shows the value without letting the user change it; still submitted and, as a native read-only field, barred from validation.',
  }),
  strings: prop.object<Partial<typeof RATING_STRINGS>>({
    description:
      'Localized string overrides: `star` and `starOne` (a star\'s name, "{count} stars"), `summary` ("{value} of {max}"), `empty` (nothing chosen).',
  }),
}) {
  // The options from children or `options`, as the shared radio control read them.
  readonly #given = (this as OddkinRadioControl)._options;

  /** @internal The built-in text with the author's overrides. */
  readonly _strings: Readable<typeof RATING_STRINGS> = computed(() =>
    strings(RATING_STRINGS, this.strings),
  );

  /** @internal The stars: the given options, else `max` stars named by `strings.star`. */
  override readonly _options: Readable<readonly OptionRecord[]> = computed(() => {
    const given = this.#given.value;
    if (given.length) return given;
    const s = this._strings.value;
    const lang = langOf(this);
    return Array.from({ length: Math.max(1, Math.floor(this.max) || 5) }, (_, index) => ({
      value: String(index + 1),
      label: plural(index + 1, { one: s.starOne, other: s.star }, lang),
    }));
  });

  /** @internal The chosen star's position from one; zero while nothing is chosen. */
  readonly _position: Readable<number> = computed(
    () => this._options.value.findIndex((option) => option.value === this.value) + 1,
  );

  /** @internal What the value part says. */
  readonly _summary: Readable<string> = computed(() => {
    const s = this._strings.value;
    const position = this._position.value;
    return position
      ? format(s.summary, { value: position, max: this._options.value.length })
      : s.empty;
  });

  /**
   * @internal Template handler: while read-only, a click checks nothing. The engines check a radio
   * by the arrow keys and Space through a cancelable click too, so this covers the keys.
   */
  readonly _onClick = (event: Event): void => {
    if (this.readonly && (event.target as Element).localName === 'input') event.preventDefault();
  };
}

declare global {
  interface HTMLElementTagNameMap {
    'odd-rating': OddkinRating;
  }
}
