import { prop, type ElementEvents } from '@oddkin/core/element';
import { strings } from '@oddkin/core/i18n';
import { computed, signal, type Readable } from '@oddkin/core/reactive';
import type { Scope } from '@oddkin/core/scope';
import {
  queryChangeEvent,
  type OptionRecord,
  type QueryChangeDetail,
} from '../collection/collection.js';
import { optionChangeEvent, optionInputEvent } from '../collection/option-control.js';
import { OddkinOptionField, OPTION_FIELD_STRINGS } from '../collection/option-field.js';
import { TextHints } from '../form-control/text-hints.js';

export type { OptionRecord } from '../collection/collection.js';

export const COMBOBOX_STRINGS = {
  ...OPTION_FIELD_STRINGS,
  loading: 'Loading…',
  empty: 'No matching options',
};

/** The details of `odd-query-change`. */
export type ComboboxQueryDetail = QueryChangeDetail;
/** The user typed in the input (one definition with `odd-command-palette`'s). */
export const comboboxQueryEvent = queryChangeEvent;

/**
 * An editable input with a popup listbox (APG combobox, list autocomplete): typing filters the
 * options and the first match becomes active; Enter or a click chooses. With `multiple`, chosen
 * values are chips in the field, collapsed to "+N" while the field is not in use. Options come from
 * `<option>` and `<optgroup>` children, written as for a native select, or from `options`.
 *
 * @slot empty - Shown when no option matches and nothing is loading (default `strings.empty`).
 * @slot status - Status content such as an error and a retry button, shown in the popup.
 * @csspart field - Wrapper of label, description, control, and error.
 * @csspart label - The visible label.
 * @csspart description - Help text, referenced by `aria-describedby`.
 * @csspart control - The field box holding the input and, with `multiple`, the chips.
 * @csspart input - The text input with `role="combobox"`.
 * @csspart chip - Each chosen value with `multiple`.
 * @csspart chip-remove - The button that removes a chip's value.
 * @csspart more - The "+N" chip that stands for the chips not shown.
 * @csspart clear - The button that clears the value, shown while there is one.
 * @csspart popup - The popup surface holding the listbox and the states.
 * @csspart listbox - The `role="listbox"` element.
 * @csspart option - Each option row.
 * @csspart group - Each group's heading.
 * @csspart loading - The busy row while `loading`.
 * @csspart empty - The wrapper of the empty slot.
 * @csspart error - The error message, referenced by `aria-describedby`.
 * @cssstate user-invalid - The field shows its error: `error` is set, or nothing is chosen while `required` after the user left the field or a validity check failed.
 * @a11y The input has `role="combobox"`, `aria-expanded`, `aria-controls`, `aria-autocomplete="list"`, and names the active option with `aria-activedescendant`; `label` names it. Options carry `aria-selected`; with `multiple` they are drawn with a check box, and the listbox has `aria-multiselectable`. Chips are a list named by `strings.selected`; each remove button is named by `strings.remove`, and the "+N" chip reads "N more" (`strings.more`).
 * @keyboard Typing filters the options and opens the popup with the first match active. Down and Up open the popup (on the selected or first option, or the last); in the popup they move the active option, and Enter chooses it (single: closes; multiple: toggles and stays open). Alt+Down opens without moving, Alt+Up closes. Escape closes the popup, or when it is closed clears the text and the value. With `multiple`, Backspace in an empty input removes the last value, and Left at the start of the input moves to the chips: Left and Right move between them, Backspace and Delete remove one, Escape returns to the input.
 * @a11y The global `inputmode`, `enterkeyhint`, `autocapitalize`, `autocorrect`, and `spellcheck` attributes on the host are forwarded to the search input; `spellcheck` defaults to `false`, as a query is not prose.
 * @previewRole combobox
 * @useFor Choosing from a long list by typing: people, projects, countries; several values with `multiple`.
 * @notFor A short list (use odd-select or odd-radio-group); free text with suggestions only (use odd-input); commands (use odd-command-palette).
 * @category Forms
 * @customization 1 2 3
 */
export class OddkinCombobox extends OddkinOptionField.with({
  readonly: prop.boolean({
    reflect: true,
    description: 'The value shows but cannot be changed; it is still submitted.',
  }),
  placeholder: prop.string({ default: '', description: 'Text shown in the empty input.' }),
  noFilter: prop.boolean({
    reflect: true,
    description:
      'The element does not filter: listen to `odd-query-change` and replace `options` with the matches.',
  }),
  strings: prop.object<Partial<typeof COMBOBOX_STRINGS>>({
    description: 'Localized string overrides; `remove` takes `{label}` and `more` takes `{count}`.',
  }),
}) {
  static override events = {
    input: optionInputEvent,
    change: optionChangeEvent,
    'odd-query-change': queryChangeEvent,
  };
  declare readonly _events?: ElementEvents<typeof OddkinCombobox>;

  /** @internal The host's text-entry hints for the input. */
  readonly _hints = new TextHints(this);
  readonly #query = signal('');
  // Single: the user typed since the value was last chosen, so the input shows the text.
  readonly #editing = signal(false);
  // Activate the first match once the filtered rows have rendered.
  #activateFirst = false;

  /** @internal The options the popup shows: all of them, or those whose label contains the text. */
  readonly _shownOptions: Readable<readonly OptionRecord[]> = computed(() => {
    const options = this._options.value;
    // Single: the text is empty whenever it shows the chosen option's label (not editing).
    const query = this.#query.value.trim().toLocaleLowerCase();
    if (this.noFilter || !query) return options;
    return options.filter((option) => option.label.toLocaleLowerCase().includes(query));
  });

  /** @internal The input's text: the typed text, or (single) the chosen option's label. */
  readonly _text: Readable<string> = computed(() =>
    this.multiple || this.#editing.value ? this.#query.value : this._labelOf(this.value),
  );

  /** The text in the input, as the user typed it (read-only). */
  get query(): string {
    return this.#query.value;
  }

  /** @internal Localized strings. */
  override get _strings(): typeof COMBOBOX_STRINGS {
    return strings(COMBOBOX_STRINGS, this.strings);
  }

  protected override _homeEnd(): boolean {
    return false;
  }

  protected override _readonly(): boolean {
    return this.readonly;
  }

  protected override _anchor(): HTMLElement | null | undefined {
    return this._entry();
  }

  protected override _onReset(): void {
    this.#revert();
  }

  protected override _onLeave(): void {
    this.#revert();
  }

  /** Back to the chosen value's text (single); the typed text is dropped. */
  #revert(): void {
    this.#query.value = '';
    this.#editing.value = false;
  }

  /** @internal Chooses the shown option at `index`. */
  _choose(index: number): void {
    const option = this._usable(this._shownOptions.peek()[index]);
    if (!option || this.readonly) return;
    this._toggle(option);
    if (this.multiple) return;
    this.#revert();
    this._hide();
  }

  /** Clears the value and the text, as a user's clear does. */
  override _clear(): void {
    this.#revert();
    super._clear();
  }

  /** @internal Template handler: typing filters and opens the popup; it is not a value change. */
  readonly _onInput = (event: Event): void => {
    // The inner input's `input` is not the element's: its value changes only by choosing.
    event.stopPropagation();
    const query = (event.target as HTMLInputElement).value;
    this.#query.value = query;
    this.#editing.value = true;
    this.#activateFirst = true;
    this.emit(queryChangeEvent, { query });
    this._show();
  };

  /** @internal Template handler: a click in the input opens the popup. */
  readonly _onInputClick = (): void => {
    if (!this._showing) this._show();
  };

  /** @internal Template handler: the combobox keys (the active option's arrows are the controller's). */
  readonly _onKeydown = (event: KeyboardEvent): void => {
    if (event.defaultPrevented || event.isComposing || event.ctrlKey || event.metaKey) return;
    const open = this._showing;
    const input = event.target as HTMLInputElement;
    switch (event.key) {
      case 'ArrowDown':
      case 'ArrowUp':
        if (open && !(event.altKey && event.key === 'ArrowUp')) return;
        if (open) this._hide();
        else if (event.altKey) this._show();
        else this._show(event.key === 'ArrowUp' ? 'last' : 'selected');
        break;
      case 'Enter': {
        if (!open) return;
        const index = this._active;
        if (index >= 0) this._choose(index);
        else this._hide();
        break;
      }
      case 'Escape':
        if (open) {
          this._hide();
          if (!this.multiple) this.#revert();
        } else if (this._editable && (this.#query.peek() || this._selected.peek().length))
          this._clear();
        else return;
        event.stopPropagation();
        break;
      case 'Backspace': {
        const last = this._selected.peek().at(-1);
        if (!this.multiple || input.value || last === undefined || !this._editable) return;
        this._remove(last);
        break;
      }
      case 'ArrowLeft':
      case 'ArrowRight': {
        const rtl = getComputedStyle(input).direction === 'rtl';
        const back = event.key === (rtl ? 'ArrowRight' : 'ArrowLeft');
        if (!this.multiple || !back || input.selectionStart || input.selectionEnd) return;
        if (!this._focusChips()) return;
        break;
      }
      default:
        return;
    }
    event.preventDefault();
  };

  /** @internal Template handler: a click on an option chooses it. */
  readonly _onPopupClick = (event: MouseEvent): void => {
    const index = this._rowElements().findIndex((row) => event.composedPath().includes(row));
    if (index < 0) return;
    this._setActive(index, { scroll: false });
    this._choose(index);
  };

  protected override connected(scope: Scope): void {
    super.connected(scope);
    scope.use(this._hints);
  }

  protected override updated(changes: ReadonlyMap<string, unknown>): void {
    super.updated(changes);
    if (this.#activateFirst) {
      this.#activateFirst = false;
      this._setActive(this._shownOptions.peek().findIndex((option) => !option.disabled));
    }
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'odd-combobox': OddkinCombobox;
  }
}
