import { ActiveDescendant } from '@oddkin/core/controllers/active-descendant';
import { Typeahead } from '@oddkin/core/controllers/typeahead';
import { prop, type ElementEvents } from '@oddkin/core/element';
import { strings } from '@oddkin/core/i18n';
import { signal } from '@oddkin/core/reactive';
import type { Scope } from '@oddkin/core/scope';
import {
  OddkinOptionControl,
  optionChangeEvent,
  optionInputEvent,
} from '../collection/option-control.js';

export type { OptionRecord } from '../collection/collection.js';

export const LISTBOX_STRINGS = { loading: 'Loading…', empty: 'No options available' };

/** The user changed the selection. */
export const listboxInputEvent = optionInputEvent;
/** Dispatched after `input` for each user change (native `change` is not composed). */
export const listboxChangeEvent = optionChangeEvent;

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
 * @customization 1 2 3
 */
export class OddkinListbox extends OddkinOptionControl.with({
  strings: prop.object<Partial<typeof LISTBOX_STRINGS>>({
    description: 'Localized string overrides.',
  }),
}) {
  declare readonly _events?: ElementEvents<typeof OddkinListbox>;

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
  // Shift+arrow ranges grow from here.
  #anchor = -1;
  // The active option shows only while the listbox has focus.
  #focused = false;

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

  protected override _anchor(): HTMLElement | null | undefined {
    return this._listbox();
  }

  /** @internal Selects the option (single) or toggles it (multiple). */
  _choose(index: number): void {
    const option = this._usable(this._options.peek()[index]);
    if (!option) return;
    this.#anchor = index;
    this._toggle(option);
  }

  /** @internal Adds the usable options from the range's anchor to `index` (multiple). */
  _extend(index: number): void {
    if (!this._usable(this._options.peek()[index])) return;
    const from = this.#anchor < 0 ? index : this.#anchor;
    const range = this._options
      .peek()
      .slice(Math.min(from, index), Math.max(from, index) + 1)
      .filter((option) => !option.disabled)
      .map((option) => option.value);
    this._commit([...new Set([...this._selected.peek(), ...range])]);
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
    if (!this._usable(this._options.peek()[index])) return;
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
      this._commit(
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

  protected override mounted(scope: Scope): void {
    super.mounted(scope);
    scope.use(this.#typeahead);
    scope.use(this.#active);
  }

  protected override updated(changes: ReadonlyMap<string, unknown>): void {
    super.updated(changes);
    this.#active.sync();
    this._activeIndex.value = this.#focused ? this.#active.activeIndex : -1;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'odd-listbox': OddkinListbox;
  }
}
