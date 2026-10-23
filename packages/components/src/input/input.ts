import { FormValue } from '@oddkin/core/controllers/form';
import { OddkinElement, event, prop, type ElementEvents } from '@oddkin/core/element';
import { computed, signal, type Readable } from '@oddkin/core/reactive';
import type { Scope } from '@oddkin/core/scope';

/** Native `input` events cross the shadow boundary once; declared here for metadata and sync. */
export const inputEvent = event('input', {
  bubbles: true,
  composed: true,
  cancelable: false,
  syncs: 'value',
  intent: 'user',
});
/** Re-dispatched at the host when the user commits a change (native `change` is not composed). */
export const changeEvent = event('change', {
  bubbles: true,
  composed: false,
  cancelable: false,
  intent: 'user',
});

/**
 * A labelled single-line text field that participates in forms like a native input.
 *
 * @csspart field - Wrapper of label, description, control, and error.
 * @csspart label - The visible label.
 * @csspart description - Help text, referenced by `aria-describedby`.
 * @csspart control - The native `<input>`.
 * @csspart error - The error message, referenced by `aria-describedby`.
 * @cssprop --odd-input-height - Minimum height (never below the target-size token).
 * @cssprop --odd-input-radius - Corner radius.
 * @cssprop --odd-input-border-color - Border colour.
 * @cssprop --odd-input-background - Background colour.
 * @cssstate user-invalid - The field shows its error: `error` is set, or the value is invalid after the user left the field or a validity check failed. Matches `aria-invalid` on the inner control; style it with `odd-input:state(user-invalid)`.
 * @a11y `label` names the native input inside the shadow root; a `<label for>` outside it cannot. Description and error are announced through `aria-describedby`; `aria-invalid` is set for `error`, or for an invalid value after the user leaves the field or a validity check fails (any `invalid` event, including `checkValidity()`, unlike native `:user-invalid`); reset clears it.
 * @keyboard Native text-input behavior.
 * @previewRole textInput
 * @useFor Short free-text values in forms: names, email addresses, search terms.
 * @notFor Multi-line text, choices from a fixed list, dates.
 * @limitation Validation bubbles anchor to the inner input. `formStateRestoreCallback` restores the value; autofill depends on the inner input's `autocomplete`.
 * @limitation Enter in the field does not submit the form (no implicit submission): the native input inside the shadow root has no form owner. Give the form a submit button.
 * @category Forms
 */
export class OddkinInput extends OddkinElement.with({
  label: prop.string({ default: '', description: 'Visible label; names the control.' }),
  description: prop.string({ default: '', description: 'Help text below the label.' }),
  error: prop.string({
    default: '',
    description: 'Error message; marks the field invalid (custom validity) while set.',
  }),
  defaultValue: prop.string({
    default: '',
    attribute: 'value',
    description: 'Initial value; the `value` attribute, as on native inputs.',
  }),
  type: prop.enum(['text', 'email', 'password', 'search', 'tel', 'url'], {
    default: 'text',
    reflect: true,
    description: 'Native input type.',
  }),
  name: prop.string({
    reflect: true,
    description:
      'Name submitted with the form. Reflected: a form-associated element submits under its name attribute.',
  }),
  placeholder: prop.string({
    default: '',
    description: 'Placeholder; never a substitute for a label.',
  }),
  autocomplete: prop.string({ default: '', description: 'Autofill hint for the native input.' }),
  required: prop.boolean({ reflect: true, description: 'A value is required to submit.' }),
  disabled: prop.boolean({ reflect: true, description: 'Prevents interaction and submission.' }),
  readonly: prop.boolean({ reflect: true, description: 'Prevents editing; still submitted.' }),
}) {
  static formAssociated = true;
  static override shadowRootOptions: ShadowRootInit = { mode: 'open', delegatesFocus: true };
  static override events = { input: inputEvent, change: changeEvent };
  declare readonly _events?: ElementEvents<typeof OddkinInput>;

  // undefined until the value is set or typed ("dirty"), then independent of `defaultValue`.
  readonly #value = signal<string | undefined>(undefined);

  // Form value, validity mirrored from the inner input, reset, restore, and fieldset state.
  readonly #form = new FormValue({
    internals: () => this.internals,
    value: () => this.value,
    control: () => this.shadowRoot?.querySelector('input'),
    error: () => this.error,
    watch: () => [this.required, this.type, this.disabled, this.readonly],
    onReset: () => {
      this.#value.value = undefined;
      this._touched.value = false;
    },
    onRestore: (state) => {
      if (typeof state === 'string') this.value = state;
    },
  });

  /** @internal Disabled by an ancestor `<fieldset disabled>`. */
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
  /** @internal The value as a readable for the template's live binding. */
  readonly _currentValue: Readable<string> = computed(() => this.value);

  constructor() {
    super();
    // A value assigned before the element was defined becomes the dirty value.
    if (Object.hasOwn(this, 'value')) {
      const early = (this as { value?: unknown }).value;
      delete (this as { value?: unknown }).value;
      this.value = String(early ?? '');
    }
  }

  /** The current value. Setting it (or typing) detaches it from `defaultValue`. */
  get value(): string {
    return this.#value.value ?? this.defaultValue;
  }
  set value(value: string) {
    this.#value.value = String(value ?? '');
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
  /** As on a native input; the message is also shown, since it sets `error`. An empty string clears it. */
  setCustomValidity(message: string): void {
    this.error = message;
  }

  /** @internal Template handler: the user typed. */
  readonly _onInput = (event: Event): void => {
    this.#value.value = (event.target as HTMLInputElement).value;
  };
  /** @internal Template handler: the user committed a change. */
  readonly _onChange = (): void => {
    this.emit(changeEvent);
  };
  /** @internal Template handler: the user left the field. */
  readonly _onBlur = (): void => {
    this._touched.value = true;
  };

  protected override connected(scope: Scope): void {
    // A failed form submission marks the field touched, so errors become visible.
    scope.listen(this, 'invalid', () => (this._touched.value = true));
  }

  protected override mounted(scope: Scope): void {
    // After the commit that wrote the inner input, so its validity is current.
    scope.use(this.#form);
    // Styling hook for consumers (`odd-input:state(user-invalid)`), derived from the same
    // state as aria-invalid; never a second source of truth.
    scope.effect(() => this.setState('user-invalid', this._userInvalid.value), {
      phase: 'post',
      name: '<odd-input> user-invalid state',
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

declare global {
  interface HTMLElementTagNameMap {
    'odd-input': OddkinInput;
  }
}
