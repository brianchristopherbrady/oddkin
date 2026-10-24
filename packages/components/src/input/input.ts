import { prop, type ElementEvents } from '@oddkin/core/element';
import { strings } from '@oddkin/core/i18n';
import { OddkinTextControl, changeEvent, inputEvent } from '../form-control/text-control.js';

export { changeEvent, inputEvent };

export const INPUT_STRINGS = { clear: 'Clear' };

/**
 * A labelled single-line text field that participates in forms like a native input.
 *
 * @csspart field - Wrapper of label, description, control, and error.
 * @csspart label - The visible label.
 * @csspart description - Help text, referenced by `aria-describedby`.
 * @csspart control - The native `<input>`.
 * @csspart icon - The search glyph at the start (`type="search"`).
 * @csspart clear - The button that clears a search value (`type="search"`), shown while there is a value to clear.
 * @csspart error - The error message, referenced by `aria-describedby`.
 * @cssprop --odd-field-height - Minimum height (never below the target-size token). Shared by every form control and the field recipe.
 * @cssprop --odd-field-radius - Corner radius. Shared by every form control and the field recipe.
 * @cssprop --odd-field-border-color - Border colour. Shared by every form control and the field recipe.
 * @cssprop --odd-field-background - Background colour. Shared by every form control and the field recipe.
 * @cssstate user-invalid - The field shows its error: `error` is set, or the value is invalid after the user left the field or a validity check failed. Matches `aria-invalid` on the inner control; style it with `odd-input:state(user-invalid)`.
 * @a11y `label` names the native input inside the shadow root; a `<label for>` outside it cannot. Description and error are announced through `aria-describedby`; `aria-invalid` is set for `error`, or for an invalid value after the user leaves the field or a validity check fails (any `invalid` event, including `checkValidity()`, unlike native `:user-invalid`); reset clears it.
 * @keyboard Native text-input behavior; arrow keys step a number or date. In a search field, Escape clears the value (and then reaches outer handlers, such as a dialog, when empty).
 * @previewRole textInput
 * @useFor Short values in forms: names, email addresses, search terms, numbers, dates, and times.
 * @notFor Multi-line text (use odd-textarea); choices from a fixed list (use odd-select or odd-radio-group).
 * @a11y The global `inputmode`, `enterkeyhint`, `autocapitalize`, `autocorrect`, and `spellcheck` attributes on the host are forwarded to the inner input (`enterkeyhint` defaults to `search` in a search field).
 * @limitation A number field steps with the engine's spin buttons where the engine draws them (not on touch devices); they are not styled, because hiding them needs prefixed pseudo-elements.
 * @limitation Validation bubbles anchor to the inner input. `formStateRestoreCallback` restores the value; autofill depends on the inner input's `autocomplete`.
 * @limitation Enter in the field does not submit the form (no implicit submission): the native input inside the shadow root has no form owner. Give the form a submit button.
 * @category Forms
 */
export class OddkinInput extends OddkinTextControl.with({
  type: prop.enum(
    [
      'text',
      'email',
      'password',
      'search',
      'tel',
      'url',
      'number',
      'date',
      'time',
      'datetime-local',
      'month',
      'week',
    ],
    {
      default: 'text',
      reflect: true,
      description: 'Native input type.',
    },
  ),
  min: prop.string({ description: 'Lowest value (number and date types), as on native inputs.' }),
  max: prop.string({ description: 'Highest value (number and date types), as on native inputs.' }),
  step: prop.string({
    description: 'Step between values (number and date types); `any` allows every value.',
  }),
  pattern: prop.string({
    description: 'A regular expression the whole value must match (text types).',
  }),
  strings: prop.object<Partial<typeof INPUT_STRINGS>>({
    description: 'Localized string overrides.',
  }),
}) {
  declare readonly _events?: ElementEvents<typeof OddkinInput>;

  protected override _constraints(): unknown[] {
    return [...super._constraints(), this.type];
  }

  /** @internal The clear button shows while a search value can be cleared. */
  get _clearable(): boolean {
    return (
      this.type === 'search' && this.value !== '' && !this._formDisabled.value && !this.readonly
    );
  }
  /** @internal The clear button's name. */
  get _clearLabel(): string {
    return strings(INPUT_STRINGS, this.strings).clear;
  }
  /** @internal Template handler: the clear button, or Escape in a search field. */
  readonly _onClear = (): void => {
    this.value = '';
    this.emit(inputEvent);
    this.emit(changeEvent);
    this.shadowRoot?.querySelector('input')?.focus();
  };
  /** @internal Template handler: Escape clears a search value, as native search fields do. */
  readonly _onKeydown = (event: KeyboardEvent): void => {
    if (event.key !== 'Escape' || !this._clearable) return;
    event.preventDefault();
    this._onClear();
  };
}

declare global {
  interface HTMLElementTagNameMap {
    'odd-input': OddkinInput;
  }
}
