import { event, prop, type ElementEvents } from '@oddkin/core/element';
import type { Readable } from '@oddkin/core/reactive';
import type { Scope } from '@oddkin/core/scope';
import { CollectionSource, readOptions, type OptionRecord } from '../collection/collection.js';
import { OddkinFormControl, type FormControlOptions } from './form-control.js';

export type { OptionRecord } from '../collection/collection.js';

/** Native `input` events cross the shadow boundary once; declared here for metadata and sync. */
export const inputEvent = event('input', {
  bubbles: true,
  composed: true,
  cancelable: false,
  syncs: 'value',
  intent: 'user',
});
/** Re-dispatched at the host when the user checks an option (native `change` is not composed). */
export const changeEvent = event('change', {
  bubbles: true,
  composed: false,
  cancelable: false,
  intent: 'user',
});

/**
 * One value from a set of options, drawn as native radios in one shadow tree
 * (`odd-radio-group`, `odd-segmented-control`): the platform gives the set one Tab stop and
 * arrow-key selection. Options come from `<option>` and `<optgroup>` children or from `options`
 * (component-contracts.md §2.2). `value` is the checked option's value; the `value` attribute,
 * else the last `<option selected>`, is the default, and without either nothing is checked.
 * Subclasses render each option with `radioInput`, then `radioFlag`, and bind `_onFocusOut`
 * around the radios.
 */
export class OddkinRadioControl extends OddkinFormControl.with({
  label: prop.string({ default: '', description: 'Visible label; names the group.' }),
  options: prop.object<readonly OptionRecord[]>({
    description: 'The choices; when set, `<option>` children are ignored.',
  }),
  value: prop.string({
    default: '',
    description: 'Value of the checked option; the `value` attribute sets the default.',
  }),
  required: prop.boolean({ reflect: true, description: 'An option must be checked to submit.' }),
}) {
  static override shadowRootOptions: ShadowRootInit = { mode: 'open', delegatesFocus: true };
  static override events = { input: inputEvent, change: changeEvent };
  declare readonly _events?: ElementEvents<typeof OddkinRadioControl>;

  readonly #source = new CollectionSource<OptionRecord>({
    host: this,
    name: 'options',
    property: () => this.options,
    read: readOptions,
  });
  // The declared default holds until the user or a script chooses.
  #chosen = false;
  #applied: unknown;

  /** @internal The options in use. */
  readonly _options: Readable<readonly OptionRecord[]> = this.#source.records;

  protected override _formOptions(): FormControlOptions {
    return {
      // As a native radio group, nothing is submitted while no option is checked.
      value: () =>
        this._options.value.some((option) => option.value === this.value) ? this.value : null,
      // Every radio reports the set's validity; a disabled one is barred, so ask an enabled one:
      // the first option's, else the hidden flag after them (`radioFlag`).
      control: () => this.shadowRoot?.querySelector<HTMLInputElement>('input:enabled'),
      watch: () => [this.required, this._options.value],
      onReset: () => {
        this.#chosen = false;
        this.#applyDeclared();
      },
      onRestore: (state) => {
        if (typeof state === 'string') this.value = state;
      },
    };
  }

  #applyDeclared(): void {
    if (this.#chosen) return;
    this.#applied = this.value =
      this.getAttribute('value') ?? this.#source.selected.peek().at(-1) ?? '';
  }

  /** @internal Template handler: the user checked an option. */
  readonly _onInput = (event: Event): void => {
    this.value = (event.target as HTMLInputElement).value;
  };
  /** @internal Template handler: the user committed a change. */
  readonly _onChange = (): void => {
    this.emit(changeEvent);
  };
  /** @internal Template handler: focus left the set, not just moved between its radios. */
  readonly _onFocusOut = (event: FocusEvent): void => {
    if (!(event.currentTarget as Element).contains(event.relatedTarget as Node | null))
      this._onBlur();
  };

  protected override connected(scope: Scope): void {
    super.connected(scope);
    scope.use(this.#source);
    // A value set as a property before connecting is the author's, not a default.
    if (this.value && !this.hasAttribute('value')) this.#chosen = true;
    scope.effect(() => {
      void this._options.value;
      this.#applyDeclared();
    });
  }

  protected override updated(changes: ReadonlyMap<string, unknown>): void {
    // A value the user, a script, or a restore set, unlike the declared default, stays.
    if (changes.has('value') && this.value !== this.#applied) this.#chosen = true;
  }
}
