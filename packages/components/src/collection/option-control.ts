import { event, prop, type ElementEvents } from '@oddkin/core/element';
import { computed, type Readable } from '@oddkin/core/reactive';
import type { Scope } from '@oddkin/core/scope';
import { OddkinFormControl, type FormControlOptions } from '../form-control/form-control.js';
import { CollectionSource, readOptions, type OptionRecord } from './collection.js';

/** The user changed the selection. */
export const optionInputEvent = event('input', {
  bubbles: true,
  composed: true,
  cancelable: false,
  syncs: 'value',
  intent: 'user',
});
/** Dispatched after `input` for each user change (native `change` is not composed). */
export const optionChangeEvent = event('change', {
  bubbles: true,
  composed: false,
  cancelable: false,
  intent: 'user',
});

const same = (a: readonly string[], b: readonly string[]) =>
  a.length === b.length && a.every((value) => b.includes(value));

/**
 * What every value collection that is a form control shares (component-contracts.md §2.2, §2.4):
 * options from `<option>`/`<optgroup>` children or `options`, one value or several (`multiple`),
 * the declared default (the `value` attribute, then `<option selected>`), the form value (each
 * value under `name` with `multiple`), `required` through a detached native select (the browser's
 * own valueMissing flag and message, pointed at `_anchor()`), reset, restore, and user changes
 * reported as `input` and `change` (an element adding events declares all of them in its own
 * `events`, which replaces these). Under `odd-listbox` and `odd-combobox`; internal to
 * `@oddkin/components` (import it relatively).
 */
export class OddkinOptionControl extends OddkinFormControl.with({
  label: prop.string({ default: '', description: 'Visible label; names the control.' }),
  options: prop.object<readonly OptionRecord[]>({
    description: 'The choices; when set, `<option>` children are ignored.',
  }),
  value: prop.string({
    default: '',
    description: 'Value of the selected option; the `value` attribute sets the default.',
  }),
  values: prop.object<readonly string[]>({
    description: 'Values of the selected options with `multiple`.',
  }),
  multiple: prop.boolean({ reflect: true, description: 'Several options can be selected.' }),
  required: prop.boolean({ reflect: true, description: 'An option must be selected to submit.' }),
  loading: prop.boolean({
    reflect: true,
    description: 'Shows a busy row and marks the options busy.',
  }),
}) {
  static override events = { input: optionInputEvent, change: optionChangeEvent };
  declare readonly _events?: ElementEvents<typeof OddkinOptionControl>;

  readonly #source = new CollectionSource<OptionRecord>({
    host: this,
    name: 'options',
    property: () => this.options,
    read: readOptions,
  });
  // A detached native select mirrors `required` and the selection, so the browser supplies the
  // valueMissing flag and its own message; `_anchor()` is where the message points.
  readonly #mirror = document.createElement('select');
  // Declared `<option selected>` children set the selection until the user or a script does.
  #chosen = false;
  #applied: unknown;

  /** @internal The options in use. */
  readonly _options: Readable<readonly OptionRecord[]> = this.#source.records;

  /** @internal Selected values, single or multiple. */
  readonly _selected: Readable<readonly string[]> = computed(() =>
    this.multiple ? (this.values ?? []) : this.value ? [this.value] : [],
  );

  /** @internal Where a blocked submission points and moves focus. */
  protected _anchor(): HTMLElement | null | undefined {
    return null;
  }

  protected override _formOptions(): FormControlOptions {
    return {
      value: () => {
        const selected = this._selected.value;
        if (!this.multiple) return selected[0] ?? null;
        const name = this.name;
        if (!name || !selected.length) return null;
        const data = new FormData();
        for (const value of selected) data.append(name, value);
        return data;
      },
      state: () => this._selected.value.join('\n'),
      control: () => {
        const mirror = this.#mirror;
        mirror.required = this.required;
        mirror.multiple = this.multiple;
        mirror.replaceChildren(
          ...this._selected.value.map((value) => new Option(value, value, true, true)),
        );
        return mirror;
      },
      anchor: () => this._anchor(),
      onReset: () => {
        this.#chosen = false;
        this.#applyDeclared();
        this._onReset();
      },
      onRestore: (state) => {
        if (typeof state !== 'string') return;
        this.#chosen = true;
        if (this.multiple) this.values = state ? state.split('\n') : [];
        else this.value = state;
      },
    };
  }

  /** @internal After the owning form's reset restored the declared selection. */
  protected _onReset(): void {}

  // The declared default: `<option selected>` children, unless the `value` attribute gives one.
  #applyDeclared(): void {
    if (this.#chosen) return;
    const declared = this.#source.selected.peek();
    if (this.multiple) this.#applied = this.values = declared;
    else this.#applied = this.value = this.getAttribute('value') ?? declared[0] ?? '';
  }

  /** @internal Sets the selection the user chose and reports it; false when nothing changed. */
  _commit(next: readonly string[]): boolean {
    if (same(next, this._selected.peek())) return false;
    this.#chosen = true;
    if (this.multiple) this.values = next;
    else this.value = next[0] ?? '';
    this.emit(optionInputEvent);
    this.emit(optionChangeEvent);
    return true;
  }

  /** @internal The option, when the user may choose it now. */
  _usable(option: OptionRecord | undefined): OptionRecord | undefined {
    // `_formDisabled` covers the element's own `disabled` and a disabled fieldset.
    return option && !option.disabled && !this._formDisabled.peek() ? option : undefined;
  }

  /** @internal Selects the option (single) or toggles it (multiple); false when unusable or unchanged. */
  _toggle(option: OptionRecord | undefined): boolean {
    if (!this._usable(option)) return false;
    const value = (option as OptionRecord).value;
    const before = this._selected.peek();
    if (!this.multiple) return this._commit([value]);
    return this._commit(
      before.includes(value) ? before.filter((v) => v !== value) : [...before, value],
    );
  }

  protected override connected(scope: Scope): void {
    super.connected(scope);
    scope.use(this.#source);
    // A selection set as a property before connecting is the author's, not a default.
    if (this.multiple ? this.values !== undefined : this.value && !this.hasAttribute('value'))
      this.#chosen = true;
    scope.effect(() => {
      void this.#source.selected.value;
      this.#applyDeclared();
    });
  }

  protected override updated(changes: ReadonlyMap<string, unknown>): void {
    // A script's selection, unlike the declared default, stays.
    if (
      (changes.has('value') && this.value !== this.#applied) ||
      (changes.has('values') && this.values !== this.#applied)
    )
      this.#chosen = true;
  }
}
