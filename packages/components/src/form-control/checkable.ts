import { event, prop, type ElementEvents } from '@oddkin/core/element';
import { computed, signal, type Readable } from '@oddkin/core/reactive';
import { OddkinFormControl, type FormControlOptions } from './form-control.js';

/** Native `input` events cross the shadow boundary once; declared here for metadata and sync. */
export const inputEvent = event('input', {
  bubbles: true,
  composed: true,
  cancelable: false,
  syncs: 'checked',
  intent: 'user',
});
/** Re-dispatched at the host when the user toggles (native `change` is not composed). */
export const changeEvent = event('change', {
  bubbles: true,
  composed: false,
  cancelable: false,
  intent: 'user',
});

/**
 * A form control over a native checkbox (`odd-checkbox`, `odd-switch`): `checked` as native (the
 * attribute is the default), `value` submitted while checked, `required`. Subclasses bind
 * `_currentChecked`, `_onInput`, `_onChange`, and `_onBlur` on their inner checkbox.
 */
export class OddkinCheckable extends OddkinFormControl.with({
  defaultChecked: prop.boolean({
    attribute: 'checked',
    description: 'Initial checkedness; the `checked` attribute, as on native checkboxes.',
  }),
  value: prop.string({ default: 'on', description: 'Submitted with the form while checked.' }),
  required: prop.boolean({ reflect: true, description: 'Must be checked to submit.' }),
}) {
  static override shadowRootOptions: ShadowRootInit = { mode: 'open', delegatesFocus: true };
  static override events = { input: inputEvent, change: changeEvent };
  declare readonly _events?: ElementEvents<typeof OddkinCheckable>;

  // undefined until set or toggled ("dirty"), then independent of `defaultChecked`.
  readonly #checked = signal<boolean | undefined>(undefined);

  /** @internal Checkedness as a readable for the template's live binding. */
  readonly _currentChecked: Readable<boolean> = computed(() => this.checked);

  constructor() {
    super();
    // Checkedness assigned before the element was defined becomes the dirty state.
    if (Object.hasOwn(this, 'checked')) {
      const early = (this as { checked?: unknown }).checked;
      delete (this as { checked?: unknown }).checked;
      this.checked = !!early;
    }
  }

  /** The current checkedness. Setting it (or toggling) detaches it from `defaultChecked`. */
  get checked(): boolean {
    return this.#checked.value ?? this.defaultChecked;
  }
  set checked(checked: boolean) {
    this.#checked.value = !!checked;
  }

  protected override _formOptions(): FormControlOptions {
    return {
      value: () => (this.checked ? this.value : null),
      state: () => (this.checked ? 'checked' : 'unchecked'),
      control: () => this.shadowRoot?.querySelector('input'),
      watch: () => this.required,
      onReset: () => {
        this.#checked.value = undefined;
      },
      onRestore: (state) => {
        if (state === 'checked' || state === 'unchecked') this.checked = state === 'checked';
      },
    };
  }

  /** @internal Called after the user toggled, before `input` reaches listeners at the host. */
  protected _toggled(): void {}

  /** @internal Template handler: the user toggled. */
  readonly _onInput = (event: Event): void => {
    this.#checked.value = (event.target as HTMLInputElement).checked;
    this._toggled();
  };
  /** @internal Template handler: the user committed the toggle. */
  readonly _onChange = (): void => {
    this.emit(changeEvent);
  };
}
