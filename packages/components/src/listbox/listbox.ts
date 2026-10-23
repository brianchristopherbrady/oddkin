import { ActiveDescendant } from '@oddkin/core/controllers/active-descendant';
import { Typeahead } from '@oddkin/core/controllers/typeahead';
import { event, prop, type ElementEvents } from '@oddkin/core/element';
import { strings } from '@oddkin/core/i18n';
import { computed, signal, type Readable } from '@oddkin/core/reactive';
import type { Scope } from '@oddkin/core/scope';
import { CollectionSource, readOptions, type OptionRecord } from '../collection/collection.js';
import { OddkinFormControl, type FormControlOptions } from '../form-control/form-control.js';

export type { OptionRecord } from '../collection/collection.js';

export const LISTBOX_STRINGS = { loading: 'Loading…', empty: 'No options available' };

/** The user changed the selection. */
export const listboxInputEvent = event('input', {
  bubbles: true,
  composed: true,
  cancelable: false,
  syncs: 'value',
  intent: 'user',
});
/** Dispatched after `input` for each user change (native `change` is not composed). */
export const listboxChangeEvent = event('change', {
  bubbles: true,
  composed: false,
  cancelable: false,
  intent: 'user',
});

const same = (a: readonly string[], b: readonly string[]) =>
  a.length === b.length && a.every((value) => b.includes(value));

/**
 * Persistent choices in a form (APG listbox): the listbox keeps focus and the active option is its
 * `aria-activedescendant`. Options come from `<option>` and `<optgroup>` children, written as for a
 * native select (`selected` marks the default), or from `options`.
 *
 * @slot empty - Shown when there are no options and nothing is loading (default `strings.empty`).
 * @slot status - Status content such as an error and a retry button.
 * @csspart field - Wrapper of label, description, surface, and error.
 * @csspart label - The visible label.
 * @csspart description - Help text, referenced by `aria-describedby`.
 * @csspart base - The surface holding the options and the states.
 * @csspart listbox - The `role="listbox"` element, which takes focus.
 * @csspart option - Each option row.
 * @csspart group - Each group's heading.
 * @csspart loading - The busy row while `loading`.
 * @csspart empty - The wrapper of the empty slot.
 * @csspart error - The error message, referenced by `aria-describedby`.
 * @cssprop --odd-listbox-max-height - Height beyond which the options scroll (default: none).
 * @cssstate user-invalid - The field shows its error: `error` is set, or nothing is selected while `required` after the user left the listbox or a validity check failed.
 * @a11y A `listbox` named by `label`, with `aria-multiselectable`, `aria-required`, `aria-invalid`, and `aria-busy` while loading; options carry `aria-selected`, and groups are named by their heading. The selection is marked by a check and a surface, not colour alone.
 * @keyboard Tab focuses the listbox. Up and Down move the active option; Home and End go to the first and last. Typing moves to the next option whose label starts with the typed characters. Single: the selection follows the active option. Multiple: Space toggles the active option, Shift with Up or Down extends the selection, Ctrl+A selects every option.
 * @previewRole listbox
 * @useFor A visible list of a few to a few dozen choices, one or several, in a form.
 * @notFor A compact choice (use odd-select); a long list to search (use odd-combobox); actions (use odd-menu).
 * @category Forms
 */
export class OddkinListbox extends OddkinFormControl.with({
  label: prop.string({ default: '', description: 'Visible label; names the listbox.' }),
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
    description: 'Shows a busy row and marks the listbox busy.',
  }),
  strings: prop.object<Partial<typeof LISTBOX_STRINGS>>({
    description: 'Localized string overrides.',
  }),
}) {
  static override events = { input: listboxInputEvent, change: listboxChangeEvent };
  declare readonly _events?: ElementEvents<typeof OddkinListbox>;

  readonly #source = new CollectionSource<OptionRecord>({
    host: this,
    name: 'options',
    property: () => this.options,
    read: readOptions,
  });
  // A detached native select mirrors `required` and the selection, so the browser supplies the
  // valueMissing flag and its own message; the listbox is where the message points.
  readonly #mirror = document.createElement('select');
  readonly #active = new ActiveDescendant({
    target: () => this._listbox(),
    items: () => this._optionElements(),
    onActiveChange: (index, _item, event) => this.#onActive(index, event),
  });
  readonly #typeahead = new Typeahead({
    items: () => this._optionElements(),
    active: () => this.#active.activeIndex,
    text: (row) => row.querySelector('.option-text')?.textContent ?? '',
    onMatch: (index) => {
      this.#active.setActive(index);
      if (!this.multiple) this._choose(index);
    },
  });
  // Declared `<option selected>` children set the selection until the user or a script does.
  #chosen = false;
  #applied: unknown;
  // Shift+arrow ranges grow from here.
  #anchor = -1;
  // The active option shows only while the listbox has focus.
  #focused = false;

  /** @internal The options in use. */
  readonly _options: Readable<readonly OptionRecord[]> = this.#source.records;

  /** @internal Selected values, single or multiple. */
  readonly _selected: Readable<readonly string[]> = computed(() =>
    this.multiple ? (this.values ?? []) : this.value ? [this.value] : [],
  );

  /** @internal The active option's index, for the visual focus. */
  readonly _activeIndex = signal(-1);

  /** @internal Localized strings. */
  get _strings(): typeof LISTBOX_STRINGS {
    return strings(LISTBOX_STRINGS, this.strings);
  }

  /** @internal The focus target. */
  _listbox(): HTMLElement | null | undefined {
    return this.shadowRoot?.querySelector<HTMLElement>('[part~="listbox"]');
  }

  /** @internal The option rows, in the order of `_options`. */
  _optionElements(): HTMLElement[] {
    return [...(this.shadowRoot?.querySelectorAll<HTMLElement>('[role="option"]') ?? [])];
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
      anchor: () => this._listbox(),
      onReset: () => {
        this.#chosen = false;
        this.#applyDeclared();
      },
      onRestore: (state) => {
        if (typeof state !== 'string') return;
        this.#chosen = true;
        if (this.multiple) this.values = state ? state.split('\n') : [];
        else this.value = state;
      },
    };
  }

  // The declared default: `<option selected>` children, unless the `value` attribute gives one.
  #applyDeclared(): void {
    if (this.#chosen) return;
    const declared = this.#source.selected.peek();
    if (this.multiple) this.#applied = this.values = declared;
    else this.#applied = this.value = this.getAttribute('value') ?? declared[0] ?? '';
  }

  /** Sets the selection the user chose and reports it. */
  #commit(next: readonly string[]): void {
    if (same(next, this._selected.peek())) return;
    this.#chosen = true;
    if (this.multiple) this.values = next;
    else this.value = next[0] ?? '';
    this.emit(listboxInputEvent);
    this.emit(listboxChangeEvent);
  }

  #usable(index: number): OptionRecord | undefined {
    const option = this._options.peek()[index];
    // `_formDisabled` covers the element's own `disabled` and a disabled fieldset.
    return option && !option.disabled && !this._formDisabled.peek() ? option : undefined;
  }

  /** @internal Selects the option (single) or toggles it (multiple). */
  _choose(index: number): void {
    const option = this.#usable(index);
    if (!option) return;
    this.#anchor = index;
    const before = this._selected.peek();
    if (!this.multiple) this.#commit([option.value]);
    else if (before.includes(option.value))
      this.#commit(before.filter((value) => value !== option.value));
    else this.#commit([...before, option.value]);
  }

  /** @internal Adds the usable options from the range's anchor to `index` (multiple). */
  _extend(index: number): void {
    if (!this.#usable(index)) return;
    const from = this.#anchor < 0 ? index : this.#anchor;
    const range = this._options
      .peek()
      .slice(Math.min(from, index), Math.max(from, index) + 1)
      .filter((option) => !option.disabled)
      .map((option) => option.value);
    this.#commit([...new Set([...this._selected.peek(), ...range])]);
  }

  #onActive(index: number, event?: KeyboardEvent): void {
    this._activeIndex.value = this.#focused ? index : -1;
    if (!event || index < 0) return;
    if (!this.multiple) this._choose(index);
    else if (event.shiftKey) this._extend(index);
  }

  /** @internal Template handler: a click selects (single) or toggles (multiple) the option. */
  readonly _onClick = (event: MouseEvent): void => {
    const index = this._optionElements().findIndex((row) => event.composedPath().includes(row));
    if (!this.#usable(index)) return;
    this.#active.setActive(index, { scroll: false });
    if (this.multiple && event.shiftKey) this._extend(index);
    else this._choose(index);
  };

  /** @internal Template handler: selection keys beyond the active option's arrows. */
  readonly _onKeydown = (event: KeyboardEvent): void => {
    if (event.defaultPrevented || event.altKey || event.metaKey || event.isComposing) return;
    const index = this.#active.activeIndex;
    if (event.ctrlKey) {
      if (event.key !== 'a' || !this.multiple || this._formDisabled.peek()) return;
      this.#commit(
        this._options
          .peek()
          .filter((option) => !option.disabled)
          .map((option) => option.value),
      );
    } else if (event.key === ' ' && !this.#typeahead.query) {
      if (index >= 0) this._choose(index);
    } else if (event.key === 'Enter' && this.multiple) {
      if (index >= 0) this._choose(index);
    } else if (!this.#typeahead.type(event.key)) return;
    event.preventDefault();
  };

  /** @internal Template handler: focus shows the selected (or first usable) option as active. */
  readonly _onFocus = (): void => {
    this.#focused = true;
    if (this.#active.activeIndex < 0) {
      const selected = this._selected.peek();
      const options = this._options.peek();
      const at = options.findIndex((option) => selected.includes(option.value));
      this.#active.setActive(at >= 0 ? at : options.findIndex((option) => !option.disabled));
    }
    this._activeIndex.value = this.#active.activeIndex;
  };

  /** @internal Template handler: leaving hides the active option and marks the field touched. */
  readonly _onListboxBlur = (): void => {
    this.#focused = false;
    this._activeIndex.value = -1;
    this._onBlur();
  };

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

  protected override mounted(scope: Scope): void {
    super.mounted(scope);
    scope.use(this.#typeahead);
    scope.use(this.#active);
  }

  protected override updated(changes: ReadonlyMap<string, unknown>): void {
    // A script's selection, unlike the declared default, stays.
    if (
      (changes.has('value') && this.value !== this.#applied) ||
      (changes.has('values') && this.values !== this.#applied)
    )
      this.#chosen = true;
    this.#active.sync();
    this._activeIndex.value = this.#focused ? this.#active.activeIndex : -1;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'odd-listbox': OddkinListbox;
  }
}
