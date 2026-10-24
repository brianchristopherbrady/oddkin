import { ActiveDescendant } from '@oddkin/core/controllers/active-descendant';
import { ResizeController } from '@oddkin/core/controllers/observe';
import { prop, type ElementEvents } from '@oddkin/core/element';
import { format, formatNumber, langOf, strings } from '@oddkin/core/i18n';
import { computed, signal, type Readable } from '@oddkin/core/reactive';
import type { Scope } from '@oddkin/core/scope';
import {
  queryChangeEvent,
  type OptionRecord,
  type QueryChangeDetail,
} from '../collection/collection.js';
import {
  OddkinOptionControl,
  optionChangeEvent,
  optionInputEvent,
} from '../collection/option-control.js';
import { composedContains, Overlay } from '../overlay/overlay.js';

export type { OptionRecord } from '../collection/collection.js';

export const COMBOBOX_STRINGS = {
  loading: 'Loading…',
  empty: 'No matching options',
  clear: 'Clear',
  remove: 'Remove {label}',
  selected: 'Selected',
  more: '{count} more',
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
 * @previewRole combobox
 * @useFor Choosing from a long list by typing: people, projects, countries; several values with `multiple`.
 * @notFor A short list (use odd-select or odd-radio-group); free text with suggestions only (use odd-input); commands (use odd-command-palette).
 * @category Forms
 */
export class OddkinCombobox extends OddkinOptionControl.with({
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

  readonly #query = signal('');
  // Single: the user typed since the value was last chosen, so the input shows the text.
  readonly #editing = signal(false);
  readonly #focusWithin = signal(false);
  // Activate the first match once the filtered rows have rendered.
  #activateFirst = false;
  readonly #overlay = new Overlay({
    host: this,
    surface: () => this._popup(),
    anchor: () => this._box(),
    mode: 'manual',
    dismiss: true,
    // The popup's opening is not the element's own state.
    relay: false,
    onToggle: (open) => {
      if (!open) this.#active.setActive(-1);
    },
  });
  readonly #active = new ActiveDescendant({
    target: () => this._input(),
    items: () => this._optionElements(),
    homeEnd: false,
    onActiveChange: (index) => (this._activeIndex.value = index),
  });
  readonly #resize = new ResizeController(() => this.#measure(), {
    targets: () => [this._box()],
  });

  /** @internal The active row's index among the shown options. */
  readonly _activeIndex = signal(-1);
  /** @internal Chips shown while collapsed (the rest are "+N"). */
  readonly _shown = signal(Number.POSITIVE_INFINITY);
  /** @internal Whether the popup is open, for `aria-expanded`. */
  readonly _open: Readable<boolean> = this.#overlay.open;
  /** @internal With `multiple`, the chips collapse to "+N" while the field is not in use. */
  readonly _collapsed: Readable<boolean> = computed(() => !this.#focusWithin.value);

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
  get _strings(): typeof COMBOBOX_STRINGS {
    return strings(COMBOBOX_STRINGS, this.strings);
  }

  /** @internal The remove button's name for a chip. */
  _removeLabel(label: string): string {
    return format(this._strings.remove, { label });
  }

  /** @internal The "+N" chip's text for assistive technology. */
  _moreLabel(count: number): string {
    return format(this._strings.more, { count: formatNumber(count, langOf(this)) });
  }

  /** @internal The label of `value` among all options, or the value itself. */
  _labelOf(value: string): string {
    if (!value) return '';
    return this._options.value.find((option) => option.value === value)?.label ?? value;
  }

  /** @internal The user may change the value now. */
  get _editable(): boolean {
    return !this.readonly && !this._formDisabled.peek();
  }

  /** @internal The clear button shows while there is a value the user may clear. */
  get _clearable(): boolean {
    return !this.readonly && !this._formDisabled.value && this._selected.value.length > 0;
  }

  /** @internal The text input. */
  _input(): HTMLInputElement | null | undefined {
    return this.shadowRoot?.querySelector<HTMLInputElement>('[part~="input"]');
  }

  /** @internal The field box the popup is placed against. */
  _box(): HTMLElement | null | undefined {
    return this.shadowRoot?.querySelector<HTMLElement>('[part~="control"]');
  }

  /** @internal The popup surface. */
  _popup(): HTMLElement | null | undefined {
    return this.shadowRoot?.getElementById('popup');
  }

  /** @internal The option rows, in the order of `_shownOptions`. */
  _optionElements(): HTMLElement[] {
    return [...(this.shadowRoot?.querySelectorAll<HTMLElement>('[role="option"]') ?? [])];
  }

  protected override _anchor(): HTMLElement | null | undefined {
    return this._input();
  }

  protected override _onReset(): void {
    this.#query.value = '';
    this.#editing.value = false;
  }

  #open(at?: 'first' | 'last' | 'selected'): void {
    if (!this._editable) return;
    this.#overlay.show();
    if (!at) return;
    const options = this._shownOptions.peek();
    const usable = (option: OptionRecord) => !option.disabled;
    const selected = this._selected.peek();
    const index =
      at === 'last'
        ? options.findLastIndex(usable)
        : at === 'selected' && options.some((o) => selected.includes(o.value))
          ? options.findIndex((o) => selected.includes(o.value) && usable(o))
          : options.findIndex(usable);
    this.#active.setActive(index);
  }

  #close(): void {
    this.#overlay.hide();
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
    this.#close();
  }

  /** Clears the value and the text, as a user's clear does. */
  #clear(): void {
    this.#revert();
    this._commit([]);
  }

  /** @internal Removes one chosen value (multiple). */
  _remove(value: string): void {
    if (!this._editable) return;
    this._commit(this._selected.peek().filter((v) => v !== value));
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
    this.#open();
  };

  /** @internal Template handler: a click in the input opens the popup. */
  readonly _onInputClick = (): void => {
    if (!this.#overlay.open.peek()) this.#open();
  };

  /** @internal Template handler: the combobox keys (the active option's arrows are the controller's). */
  readonly _onKeydown = (event: KeyboardEvent): void => {
    if (event.defaultPrevented || event.isComposing || event.ctrlKey || event.metaKey) return;
    const open = this.#overlay.open.peek();
    const input = event.target as HTMLInputElement;
    switch (event.key) {
      case 'ArrowDown':
      case 'ArrowUp':
        if (open && !(event.altKey && event.key === 'ArrowUp')) return;
        if (open) this.#close();
        else if (event.altKey) this.#open();
        else this.#open(event.key === 'ArrowUp' ? 'last' : 'selected');
        break;
      case 'Enter': {
        if (!open) return;
        const index = this.#active.activeIndex;
        if (index >= 0) this._choose(index);
        else this.#close();
        break;
      }
      case 'Escape':
        if (open) {
          this.#close();
          if (!this.multiple) this.#revert();
        } else if (this._editable && (this.#query.peek() || this._selected.peek().length))
          this.#clear();
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
        const chips = this.#removeButtons();
        if (!chips.length) return;
        chips.at(-1)?.focus();
        break;
      }
      default:
        return;
    }
    event.preventDefault();
  };

  #removeButtons(): HTMLElement[] {
    return [
      ...(this.shadowRoot?.querySelectorAll<HTMLElement>('[part~="chip-remove"]') ?? []),
    ].filter((button) => button.checkVisibility());
  }

  /** @internal Template handler: keys on a chip's remove button. */
  readonly _onChipKeydown = (event: KeyboardEvent, value: string): void => {
    if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return;
    const buttons = this.#removeButtons();
    const at = buttons.indexOf(event.currentTarget as HTMLElement);
    const rtl = getComputedStyle(event.currentTarget as Element).direction === 'rtl';
    const input = this._input();
    switch (event.key) {
      case 'ArrowLeft':
      case 'ArrowRight': {
        const back = event.key === (rtl ? 'ArrowRight' : 'ArrowLeft');
        const next = buttons[at + (back ? -1 : 1)];
        if (next) next.focus();
        else if (!back) input?.focus();
        break;
      }
      case 'Backspace':
      case 'Delete':
        this._remove(value);
        // The previous chip, or the input when none is left before it.
        (buttons[at - 1] ?? input)?.focus();
        break;
      case 'Escape':
        input?.focus();
        break;
      default:
        return;
    }
    event.preventDefault();
  };

  /** @internal Template handler: a chip's remove button. */
  readonly _onChipRemove = (value: string): void => {
    this._remove(value);
    this._input()?.focus();
  };

  /** @internal Template handler: the clear button. */
  readonly _onClear = (): void => {
    if (!this._editable) return;
    this.#clear();
    this._input()?.focus();
  };

  /** @internal Template handler: presses in the popup keep focus in the input. */
  readonly _onPopupPointerdown = (event: PointerEvent): void => {
    event.preventDefault();
  };

  /** @internal Template handler: a click on an option chooses it. */
  readonly _onPopupClick = (event: MouseEvent): void => {
    const index = this._optionElements().findIndex((row) => event.composedPath().includes(row));
    if (index < 0) return;
    this.#active.setActive(index, { scroll: false });
    this._choose(index);
  };

  /** Chips that fit beside the input on one line while collapsed; the rest become "+N". */
  #measure(): void {
    const box = this._box();
    const input = this._input();
    if (!this.multiple || !box || !input) return;
    // Expanded, every chip shows (the template ignores `_shown`).
    if (!this._collapsed.peek()) return;
    const chips = [...box.querySelectorAll<HTMLElement>('[part~="chip"]')];
    const more = box.querySelector<HTMLElement>('[part~="more"]');
    const list = chips[0]?.parentElement;
    if (!list || !more) return;
    const boxStyle = getComputedStyle(box);
    const gap = parseFloat(getComputedStyle(list).columnGap) || 0;
    const room =
      box.clientWidth -
      (parseFloat(boxStyle.paddingInlineStart) || 0) -
      (parseFloat(boxStyle.paddingInlineEnd) || 0) -
      (parseFloat(getComputedStyle(input).minInlineSize) || 0) -
      (parseFloat(boxStyle.columnGap) || 0);
    const plus = more.getBoundingClientRect().width + gap;
    const widths = chips.map((chip) => chip.getBoundingClientRect().width);
    let used = 0;
    let shown = 0;
    for (; shown < widths.length; shown++) {
      const next = used + (shown ? gap : 0) + (widths[shown] ?? 0);
      if (next + (shown + 1 < widths.length ? plus : 0) > room) break;
      used = next;
    }
    this._shown.value = shown;
  }

  protected override connected(scope: Scope): void {
    super.connected(scope);
    scope.listen(this, 'focusin', () => (this.#focusWithin.value = true));
    scope.listen(this, 'focusout', (event: FocusEvent) => {
      const to = event.relatedTarget as Node | null;
      if (to && composedContains(this, to)) return;
      this.#focusWithin.value = false;
      this.#close();
      this.#query.value = '';
      this.#editing.value = false;
      this._onBlur();
    });
  }

  protected override mounted(scope: Scope): void {
    super.mounted(scope);
    scope.use(this.#overlay);
    scope.use(this.#active);
    scope.use(this.#resize);
  }

  protected override updated(changes: ReadonlyMap<string, unknown>): void {
    super.updated(changes);
    this.#active.sync();
    if (this.#activateFirst) {
      this.#activateFirst = false;
      this.#active.setActive(this._shownOptions.peek().findIndex((option) => !option.disabled));
    }
    this.#overlay.update();
    this.#measure();
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'odd-combobox': OddkinCombobox;
  }
}
