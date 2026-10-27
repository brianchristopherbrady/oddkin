import { prop } from '@oddkin/core/element';
import { signal } from '@oddkin/core/reactive';
import type { Scope } from '@oddkin/core/scope';
import type { OddkinCheckbox } from '../checkbox/checkbox.js';
import { OddkinFormControl, type FormControlOptions } from '../form-control/form-control.js';

/**
 * A named group of `odd-checkbox` choices with one legend, description, and error. Each choice
 * keeps its own name, value, and checkedness; the group adds `required` (at least one checked)
 * and `disabled` for all of them.
 *
 * @slot - The `odd-checkbox` choices.
 * @csspart field - The group: legend, description, choices, and error.
 * @csspart label - The visible legend.
 * @csspart description - Help text, referenced by `aria-describedby`.
 * @csspart control - The choices.
 * @csspart error - The error message, referenced by `aria-describedby`.
 * @cssstate user-invalid - The group shows its error: `error` is set, or no choice is checked in a required group after focus left it or a validity check failed.
 * @a11y A `role="group"` in the shadow root, named by the legend and described by the description and error, holds the slotted checkboxes, as a `<fieldset>` would. Each checkbox keeps its own name and state.
 * @keyboard Tab moves through the checkboxes; Space toggles the focused one.
 * @previewRole checkboxGroup
 * @useFor Several independent choices under one question, such as notification channels.
 * @notFor One choice among several (use odd-radio-group); a single yes-or-no choice (use odd-checkbox).
 * @limitation `disabled` sets `disabled` on the choices that were enabled and clears it from those again when the group is enabled; a `<fieldset disabled>` around the group disables everything natively.
 * @limitation A required group reports the browser's own message for an unselected set ("Please select one of these options." in English) at its first enabled choice; set `error` for your own wording.
 * @category Forms
 * @customization 1 2 3
 */
export class OddkinCheckboxGroup extends OddkinFormControl.with({
  label: prop.string({ default: '', description: 'Visible legend; names the group.' }),
  required: prop.boolean({
    reflect: true,
    description: 'At least one choice must be checked to submit.',
  }),
  orientation: prop.enum(['vertical', 'horizontal'], {
    default: 'vertical',
    reflect: true,
    description: 'Stacks the choices, or lines them up and wraps them.',
  }),
}) {
  /** @internal The slotted checkboxes, in order. */
  readonly _choices = signal<readonly OddkinCheckbox[]>([]);

  // Choices this group disabled, so enabling the group leaves the author's disabled ones alone.
  readonly #disabledHere = new WeakSet<OddkinCheckbox>();

  // A hidden radio in the shadow root supplies the browser's flag and message for "none chosen".
  #flag(): HTMLInputElement | null | undefined {
    return this.shadowRoot?.querySelector<HTMLInputElement>('.flag');
  }

  protected override _formOptions(): FormControlOptions {
    return {
      value: () => null,
      control: () => this.#flag(),
      anchor: () =>
        this._choices.value.find((choice) => !choice.disabled)?.shadowRoot?.querySelector('input'),
      watch: () => {
        const required = this.required;
        const choices = this._choices.value;
        const checked = choices.some((choice) => choice.checked);
        // The anchor is the first enabled choice.
        for (const choice of choices) void choice.disabled;
        const flag = this.#flag();
        if (flag) Object.assign(flag, { required, checked });
      },
    };
  }

  protected override mounted(scope: Scope): void {
    super.mounted(scope);
    scope.effect(() => {
      const disabled = this.disabled;
      for (const choice of this._choices.value) {
        if (disabled && !choice.disabled) {
          choice.disabled = true;
          this.#disabledHere.add(choice);
        } else if (!disabled && this.#disabledHere.delete(choice)) choice.disabled = false;
      }
    });
  }

  /** @internal Template handler: the slotted choices changed. */
  readonly _onSlotChange = (event: Event): void => {
    const next = (event.target as HTMLSlotElement)
      .assignedElements()
      .filter((el): el is OddkinCheckbox => el.localName === 'odd-checkbox');
    for (const choice of this._choices.value)
      if (!next.includes(choice) && this.#disabledHere.delete(choice)) choice.disabled = false;
    this._choices.value = next;
  };

  /** @internal Template handler: focus left the group, not just moved between its choices. */
  readonly _onFocusOut = (event: FocusEvent): void => {
    if (!this.contains(event.relatedTarget as Node | null)) this._onBlur();
  };
}

declare global {
  interface HTMLElementTagNameMap {
    'odd-checkbox-group': OddkinCheckboxGroup;
  }
}
