import { event, prop, type ElementEvents } from '@oddkin/core/element';
import { computed, signal, type Readable } from '@oddkin/core/reactive';
import type { Scope } from '@oddkin/core/scope';
import { OddkinFormControl, type FormControlOptions } from './form-control.js';
import { TextHints } from './text-hints.js';

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
 * A form control over a native text field (`odd-input`, `odd-textarea`): a visible label,
 * `value` as native (the attribute is the default), placeholder, autofill hint, length limits,
 * `required`, and `readonly`. Subclasses render the native field with class `control` and bind
 * `_currentValue`, `_onInput`, `_onChange`, `_onBlur`, and the `_hints` the host was given on it.
 */
export class OddkinTextControl extends OddkinFormControl.with({
  label: prop.string({ default: '', description: 'Visible label; names the control.' }),
  defaultValue: prop.string({
    default: '',
    attribute: 'value',
    description: 'Initial value; the `value` attribute, as on native inputs.',
  }),
  minLength: prop.number({ attribute: 'minlength', description: 'Fewest characters.' }),
  maxLength: prop.number({
    attribute: 'maxlength',
    description: 'Most characters; typing stops there.',
  }),
  placeholder: prop.string({
    default: '',
    description: 'Placeholder; never a substitute for a label.',
  }),
  autocomplete: prop.string({ default: '', description: 'Autofill hint for the native field.' }),
  required: prop.boolean({ reflect: true, description: 'A value is required to submit.' }),
  readonly: prop.boolean({ reflect: true, description: 'Prevents editing; still submitted.' }),
}) {
  static override shadowRootOptions: ShadowRootInit = { mode: 'open', delegatesFocus: true };
  static override events = { input: inputEvent, change: changeEvent };
  declare readonly _events?: ElementEvents<typeof OddkinTextControl>;

  // undefined until the value is set or typed ("dirty"), then independent of `defaultValue`.
  readonly #value = signal<string | undefined>(undefined);

  /** @internal The host's text-entry hints (`inputmode`, `spellcheck`, …) for the native field. */
  readonly _hints = new TextHints(this);

  /**
   * @internal The text in the native field, for the template's live binding: what the user typed,
   * even when the value cannot hold it (a number field's letters), else the value.
   */
  readonly _currentValue: Readable<string> = computed(
    () => this.#value.value ?? this._sanitize(this.defaultValue),
  );

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
    const typed = this.#value.value;
    return typed === undefined ? this._sanitize(this.defaultValue) : this._sanitize(typed, true);
  }
  set value(value: string) {
    this.#value.value = this._sanitize(String(value ?? ''));
  }

  /**
   * @internal The value a text stands for, as a native input's value sanitization: the text
   * itself here. `typed` text came from the user and may be read more loosely.
   */
  protected _sanitize(text: string, _typed = false): string {
    return text;
  }

  protected override connected(scope: Scope): void {
    super.connected(scope);
    scope.use(this._hints);
  }

  /** @internal Properties that change validity without a change of value. */
  protected _constraints(): unknown[] {
    return [this.required, this.readonly];
  }

  protected override _formOptions(): FormControlOptions {
    return {
      value: () => this.value,
      control: () => this.shadowRoot?.querySelector<HTMLInputElement>('.control'),
      watch: () => this._constraints(),
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
