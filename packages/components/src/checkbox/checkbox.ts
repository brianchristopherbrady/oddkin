import { event, prop, type ElementEvents } from '@oddkin/core/element';
import { computed, signal, type Readable } from '@oddkin/core/reactive';
import { OddkinFormControl, type FormControlOptions } from '../form-control/form-control.js';

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
 */
export class OddkinCheckbox extends OddkinFormControl.with({
  defaultChecked: prop.boolean({
    attribute: 'checked',
    description: 'Initial checkedness; the `checked` attribute, as on native checkboxes.',
  }),
  indeterminate: prop.boolean({
    reflect: true,
    description: 'Shows the mixed state; cleared when the user toggles, as on native checkboxes.',
  }),
  value: prop.string({ default: 'on', description: 'Submitted with the form while checked.' }),
  required: prop.boolean({ reflect: true, description: 'Must be checked to submit.' }),
}) {
  static override shadowRootOptions: ShadowRootInit = { mode: 'open', delegatesFocus: true };
  static override events = { input: inputEvent, change: changeEvent };
  declare readonly _events?: ElementEvents<typeof OddkinCheckbox>;

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

  /** @internal Template handler: the user toggled. */
  readonly _onInput = (event: Event): void => {
    this.#checked.value = (event.target as HTMLInputElement).checked;
    this.indeterminate = false;
  };
  /** @internal Template handler: the user committed the toggle. */
  readonly _onChange = (): void => {
    this.emit(changeEvent);
  };
}

declare global {
  interface HTMLElementTagNameMap {
    'odd-checkbox': OddkinCheckbox;
  }
}
