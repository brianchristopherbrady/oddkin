import { prop, type ElementEvents } from '@oddkin/core/element';
import { OddkinCheckable, changeEvent, inputEvent } from '../form-control/checkable.js';

export { changeEvent, inputEvent };

/**
 * A checkbox that participates in forms like a native one: a native checkbox in the shadow root,
 * drawn by the shared control-indicator module, labelled by the slotted text.
 *
 * @slot - The label; names the checkbox.
 * @csspart field - Wrapper of the checkbox row, description, and error.
 * @csspart label - The label text beside the box.
 * @csspart control - The native checkbox (the drawn box).
 * @csspart description - Help text, referenced by `aria-describedby`.
 * @csspart error - The error message, referenced by `aria-describedby`.
 * @cssstate user-invalid - The checkbox shows its error: `error` is set, or a required box is unchecked after the user left it or a validity check failed. Style it with `odd-checkbox:state(user-invalid)`.
 * @a11y The slotted text names the native checkbox through its `<label>`; description and error are announced through `aria-describedby`. `indeterminate` is exposed as mixed and cleared when the user toggles, as on native checkboxes.
 * @keyboard Space toggles; Tab order as a native checkbox.
 * @previewRole checkbox
 * @useFor A single yes-or-no choice, or one option among several that can each be on or off.
 * @notFor An immediate on/off setting (use odd-switch); one choice among several (use odd-radio-group).
 * @limitation Validation bubbles anchor to the inner checkbox.
 * @category Forms
 * @customization 1 2 3
 */
export class OddkinCheckbox extends OddkinCheckable.with({
  indeterminate: prop.boolean({
    reflect: true,
    description: 'Shows the mixed state; cleared when the user toggles, as on native checkboxes.',
  }),
}) {
  declare readonly _events?: ElementEvents<typeof OddkinCheckbox>;

  protected override _toggled(): void {
    this.indeterminate = false;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'odd-checkbox': OddkinCheckbox;
  }
}
