import { event, prop, type ElementEvents } from '@oddkin/core/element';
import { computed, signal, type Readable } from '@oddkin/core/reactive';
import { OddkinFormControl, type FormControlOptions } from '../form-control/form-control.js';

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
 * @cssprop --odd-field-height - Minimum height (never below the target-size token). Shared by every form control and the field recipe.
 * @cssprop --odd-field-radius - Corner radius. Shared by every form control and the field recipe.
 * @cssprop --odd-field-border-color - Border colour. Shared by every form control and the field recipe.
 * @cssprop --odd-field-background - Background colour. Shared by every form control and the field recipe.
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
export class OddkinInput extends OddkinFormControl.with({
  label: prop.string({ default: '', description: 'Visible label; names the control.' }),
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
  placeholder: prop.string({
    default: '',
    description: 'Placeholder; never a substitute for a label.',
  }),
  autocomplete: prop.string({ default: '', description: 'Autofill hint for the native input.' }),
  required: prop.boolean({ reflect: true, description: 'A value is required to submit.' }),
  readonly: prop.boolean({ reflect: true, description: 'Prevents editing; still submitted.' }),
}) {
  static override shadowRootOptions: ShadowRootInit = { mode: 'open', delegatesFocus: true };
  static override events = { input: inputEvent, change: changeEvent };
  declare readonly _events?: ElementEvents<typeof OddkinInput>;

  // undefined until the value is set or typed ("dirty"), then independent of `defaultValue`.
  readonly #value = signal<string | undefined>(undefined);

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

  protected override _formOptions(): FormControlOptions {
    return {
      value: () => this.value,
      control: () => this.shadowRoot?.querySelector('input'),
      watch: () => [this.required, this.type, this.readonly],
      onReset: () => {
        this.#value.value = undefined;
      },
      onRestore: (state) => {
        if (typeof state === 'string') this.value = state;
      },
    };
  }

  /** @internal Template handler: the user typed. */
  readonly _onInput = (event: Event): void => {
    this.#value.value = (event.target as HTMLInputElement).value;
  };
  /** @internal Template handler: the user committed a change. */
  readonly _onChange = (): void => {
    this.emit(changeEvent);
  };
}

declare global {
  interface HTMLElementTagNameMap {
    'odd-input': OddkinInput;
  }
}
