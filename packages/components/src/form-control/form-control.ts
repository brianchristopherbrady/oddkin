import { FormValue, type FormValueOptions } from '@oddkin/core/controllers/form';
import { OddkinElement, prop } from '@oddkin/core/element';
import { computed, signal, type Readable } from '@oddkin/core/reactive';
import type { Scope } from '@oddkin/core/scope';

/** What a form control adds to the shared participation: its value, inner control, reset, restore. */
export type FormControlOptions = Omit<FormValueOptions, 'internals' | 'error'>;

/**
 * Form participation every Oddkin form control shares (component-contracts.md §2.4): name,
 * disabled (also by a disabled fieldset), help and error text, the form owner, validity and the
 * constraint-validation methods, reset, state restore, and the `user-invalid` custom state.
 * Subclasses describe their value in `_formOptions()`, call `super` in `connected` and `mounted`,
 * and bind `_onBlur` on their inner control.
 */
export class OddkinFormControl extends OddkinElement.with({
  name: prop.string({
    reflect: true,
    description:
      'Name submitted with the form. Reflected: a form-associated element submits under its name attribute.',
  }),
  disabled: prop.boolean({ reflect: true, description: 'Prevents interaction and submission.' }),
  description: prop.string({ default: '', description: 'Help text below the label.' }),
  error: prop.string({
    default: '',
    description: 'Error message; marks the field invalid (custom validity) while set.',
  }),
}) {
  static formAssociated = true;

  // Created first: the readables below come from it. `_formOptions()` returns closures only, so
  // the subclass's own fields are read after construction.
  readonly #form: FormValue = this.#createForm();

  /**
   * @internal Disabled by its `disabled` attribute or an ancestor `<fieldset disabled>`: both reach
   * `formDisabledCallback`, which also re-reads validity, since a disabled control is barred.
   */
  readonly _formDisabled: Readable<boolean> = this.#form.disabled;
  /** @internal The user left the field or a submission was attempted. */
  readonly _touched = signal(false);
  /** @internal The current value failed validation. */
  readonly _invalid: Readable<boolean> = this.#form.invalid;
  /**
   * @internal The field shows its error: `error` is set, or the value is invalid after the user
   * left the field or a validity check failed. One source for `aria-invalid` and the
   * `user-invalid` custom state.
   */
  readonly _userInvalid: Readable<boolean> = computed(
    () => !!this.error || (this._touched.value && this._invalid.value),
  );

  #createForm(): FormValue {
    const options = this._formOptions();
    return new FormValue({
      ...options,
      internals: () => this.internals,
      error: () => this.error,
      onReset: () => {
        options.onReset?.();
        this._touched.value = false;
      },
    });
  }

  /** @internal The subclass's value, inner control, reset, and restore (closures only). */
  protected _formOptions(): FormControlOptions {
    return { value: () => null };
  }

  /** The form this field belongs to, if any. */
  get form(): HTMLFormElement | null {
    return this.internals.form;
  }
  get validity(): ValidityState {
    return this.internals.validity;
  }
  get validationMessage(): string {
    return this.internals.validationMessage;
  }
  get willValidate(): boolean {
    return this.internals.willValidate;
  }
  checkValidity(): boolean {
    return this.internals.checkValidity();
  }
  reportValidity(): boolean {
    return this.internals.reportValidity();
  }
  /** As on native controls; the message is also shown, since it sets `error`. An empty string clears it. */
  setCustomValidity(message: string): void {
    this.error = message;
  }

  /** @internal Template handler: the user left the control. */
  readonly _onBlur = (): void => {
    this._touched.value = true;
  };

  protected override connected(scope: Scope): void {
    // A failed form submission marks the field touched, so errors become visible.
    scope.listen(this, 'invalid', () => (this._touched.value = true));
  }

  protected override mounted(scope: Scope): void {
    // After the commit that wrote the inner control, so its validity is current.
    scope.use(this.#form);
    // Styling hook (`:state(user-invalid)`) derived from the same state as aria-invalid.
    scope.effect(() => this.setState('user-invalid', this._userInvalid.value), {
      phase: 'post',
      name: 'user-invalid state',
    });
  }

  /** Native callback: the owning form was reset. */
  formResetCallback(): void {
    this.#form.formResetCallback();
  }
  /** Native callback: restore after navigation or autofill restore. */
  formStateRestoreCallback(
    state: string | File | FormData | null,
    mode: 'restore' | 'autocomplete',
  ): void {
    this.#form.formStateRestoreCallback(state, mode);
  }
  /** Native callback: an ancestor fieldset's disabled state changed. */
  formDisabledCallback(disabled: boolean): void {
    this.#form.formDisabledCallback(disabled);
  }
  /** Native callback: the form owner changed (moved, `form` attribute, or the named form). */
  formAssociatedCallback(form: HTMLFormElement | null): void {
    this.#form.formAssociatedCallback(form);
  }
}
