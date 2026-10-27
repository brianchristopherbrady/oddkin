import { Typeahead } from '@oddkin/core/controllers/typeahead';
import { prop, type ElementEvents } from '@oddkin/core/element';
import { format, formatNumber, langOf, strings } from '@oddkin/core/i18n';
import type { Readable } from '@oddkin/core/reactive';
import type { Scope } from '@oddkin/core/scope';
import type { OptionRecord, TreeItemRecord } from '../collection/collection.js';
import { optionChangeEvent, optionInputEvent } from '../collection/option-control.js';
import { OddkinOptionField, OPTION_FIELD_STRINGS } from '../collection/option-field.js';
import { TreeModel, treeToggleEvent, type TreeRow } from '../collection/tree-model.js';
import type { OverlayOptions } from '../overlay/overlay.js';

export type { OptionRecord, TreeItemRecord } from '../collection/collection.js';

export const PICKER_STRINGS = {
  ...OPTION_FIELD_STRINGS,
  loading: 'Loading…',
  empty: 'No items available',
  hint: 'Choose one item',
  close: 'Close',
  done: 'Done',
  path: '{parent} / {label}',
};

/**
 * A field that opens a list or a hierarchy to choose from (APG select-only combobox): a popup
 * listbox of options, or, with `items`, a popup tree whose rows expand and collapse without
 * selecting. Single: activating a row chooses it and closes. Multiple: rows toggle at once, the
 * chosen values show in the field as `view` says (chips with "+N" by default, as on odd-combobox), and Done closes. Options
 * come from `<option>` and `<optgroup>` children, written as for a native select, or from
 * `options`; a hierarchy comes from `items`.
 *
 * @slot empty - Shown when there are no options or items and nothing is loading (default `strings.empty`).
 * @slot status - Status content such as an error and a retry button, shown in the popup.
 * @csspart field - Wrapper of label, description, control, and error.
 * @csspart label - The visible label.
 * @csspart description - Help text, referenced by `aria-describedby`.
 * @csspart control - The field box holding the trigger and, with `multiple`, the chips.
 * @csspart trigger - The `role="combobox"` element showing the chosen value or the placeholder; it keeps focus.
 * @csspart chip - Each chosen value with `multiple`.
 * @csspart chip-remove - The button that removes a chip's value.
 * @csspart more - The "+N" chip that stands for the chips not shown.
 * @csspart clear - The button that clears the value, shown while there is one.
 * @csspart popup - The popup surface holding the list or tree, the states, and the footer.
 * @csspart listbox - The `role="listbox"` element (without `items`).
 * @csspart option - Each option row.
 * @csspart group - Each group's heading.
 * @csspart tree - The `role="tree"` element (with `items`).
 * @csspart item - Each tree row (`role="treeitem"`).
 * @csspart loading - The busy row while `loading`.
 * @csspart empty - The wrapper of the empty slot.
 * @csspart footer - The popup's footer: the summary and its actions.
 * @csspart summary - "Choose one item" (`strings.hint`), or with `multiple` the count (`strings.count`).
 * @csspart clear-all - The footer's Clear button with `multiple`.
 * @csspart close - The footer's Close button, or Done with `multiple`.
 * @csspart error - The error message, referenced by `aria-describedby`.
 * @cssstate user-invalid - The field shows its error: `error` is set, or nothing is chosen while `required` after the user left the field or a validity check failed.
 * @a11y The trigger has `role="combobox"`, `aria-haspopup="tree"` with `items`, `aria-expanded`, and `aria-controls`; it keeps focus and names the active row with `aria-activedescendant`; `label` names it. Rows carry `aria-selected`; the listbox or tree has `aria-multiselectable` with `multiple`; tree rows carry `aria-level`, `aria-setsize`, `aria-posinset`, and `aria-expanded`. The active row's ring is drawn apart from the selection, which is a surface and check (options) or a bar and weight (tree rows), not colour alone. Chips are a list named by `strings.selected`, each remove button named by `strings.remove`.
 * @keyboard Tab reaches the trigger, then the footer while the popup is open. Down, Up, Enter, Space, and Alt+Down open the popup on the chosen (or first) row; Home and End open it on the first and last; typing opens it on the next row whose label starts with the typed characters. In the popup: Up, Down, Home, and End move the active row; Enter or Space chooses it (single: closes; multiple: toggles and stays open); Escape and Alt+Up close without changing the value, and focus stays on the trigger. In a tree, Right expands a closed row or moves into an open one, Left collapses an open row or moves to its parent (mirrored right to left), and `*` expands every sibling. On the closed trigger, Backspace removes the last value; with `multiple`, Left moves to the chips: Left and Right move between them, Backspace and Delete remove one, Escape returns.
 * @previewRole picker
 * @useFor Choosing from a fixed list or a hierarchy in a form: map layers, folders, categories, one or several.
 * @notFor A short list of plain options (use odd-select); a long list to search (use odd-combobox); browsing a hierarchy without a form value (use odd-tree).
 * @category Forms
 */
export class OddkinPicker extends OddkinOptionField.with({
  placeholder: prop.string({ default: '', description: 'Text shown while nothing is chosen.' }),
  items: prop.object<readonly TreeItemRecord[]>({
    description:
      'A hierarchy to choose from: when set, the popup is a tree, and `<option>` children and `options` are not shown.',
  }),
  expanded: prop.object<readonly string[]>({
    description:
      'Ids of expanded items with `items`, owned by the caller. Omit it to let the element track expansion.',
  }),
  strings: prop.object<Partial<typeof PICKER_STRINGS>>({
    description:
      'Localized string overrides; `remove` takes `{label}`, `more` and `count` take `{count}`, `path` takes `{parent}` and `{label}`.',
  }),
}) {
  static override events = {
    input: optionInputEvent,
    change: optionChangeEvent,
    'odd-toggle': treeToggleEvent,
  };
  declare readonly _events?: ElementEvents<typeof OddkinPicker>;

  readonly #model = new TreeModel({
    items: () => this.items,
    expanded: () => this.expanded,
    selected: (item) => this._selected.value.includes(item.id),
    report: (detail) => this.emit(treeToggleEvent, detail),
  });
  readonly #typeahead = new Typeahead({
    items: () => this._rowElements(),
    active: () => this._active,
    text: (row) => row.querySelector('.label, .option-text')?.textContent ?? '',
    onMatch: (index) => this._setActive(index),
  });

  /** @internal The tree's shown rows (with `items`). */
  readonly _rows: Readable<readonly TreeRow[]> = this.#model.rows;

  /** @internal Localized strings. */
  override get _strings(): typeof PICKER_STRINGS {
    return strings(PICKER_STRINGS, this.strings);
  }

  /** @internal The footer's text: the hint, or with `multiple` the count. */
  get _summary(): string {
    const strings = this._strings;
    if (!this.multiple) return strings.hint;
    const count = formatNumber(this._selected.value.length, langOf(this));
    return format(strings.count, { count });
  }

  protected override _overlayOptions(): OverlayOptions {
    const options = super._overlayOptions();
    return {
      ...options,
      // Below the field with no gap, as Figma joins them; the focus ring surrounds both.
      offset: 0,
      onPlace: ({ side, anchor }) => {
        const popup = this._popup();
        if (!popup) return;
        popup.dataset.side = side;
        popup.style.setProperty('--_anchor-block-size', `${anchor.height}px`);
      },
    };
  }

  /** @internal The chips stay on one line: Figma keeps "+N" while the popup is open. */
  protected override _collapses(): boolean {
    return true;
  }

  /** @internal The label of a value: the item's (with `items`) or the option's, else the value. */
  override _labelOf(value: string): string {
    if (!this.items) return super._labelOf(value);
    return this.#model.path(value).at(-1)?.label ?? value;
  }

  /** @internal The single value as the trigger shows it: a tree item after its parent (`strings.path`). */
  get _valueText(): string {
    const value = this.value;
    if (!value) return '';
    const path = this.items ? this.#model.path(value) : [];
    const parent = path.at(-2);
    if (!parent) return this._labelOf(value);
    return format(this._strings.path, { parent: parent.label, label: path.at(-1)!.label });
  }

  protected override _anchor(): HTMLElement | null | undefined {
    return this._entry();
  }

  /** The row at `index` as a choice: a tree item or an option. */
  #record(index: number): OptionRecord | undefined {
    if (!this.items) return this._options.peek()[index];
    const item = this._rows.peek()[index]?.item;
    return item && { value: item.id, label: item.label, disabled: !!item.disabled };
  }

  /** @internal Chooses the row at `index`: single selects and closes, multiple toggles. */
  _choose(index: number): void {
    const record = this._usable(this.#record(index));
    if (!record) return;
    this._toggle(record);
    if (!this.multiple) this._hide();
  }

  #activate(item: TreeItemRecord): void {
    this._setActive(this._rows.peek().findIndex((row) => row.item === item));
  }

  /** @internal Template handler: the trigger's keys (the active row's arrows are the controller's). */
  readonly _onKeydown = (event: KeyboardEvent): void => {
    if (event.defaultPrevented || event.isComposing || event.ctrlKey || event.metaKey) return;
    const key = event.key;
    if (this._showing) {
      const active = this._active;
      if (event.altKey) {
        if (key !== 'ArrowUp') return;
        this._hide();
      } else if (key === 'Escape') {
        this._hide();
        // Only the popup closes, not a dialog around the picker.
        event.stopPropagation();
      } else if (key === 'Enter' || (key === ' ' && !this.#typeahead.query)) {
        if (active >= 0) this._choose(active);
      } else {
        const row = this.items ? this._rows.peek()[active] : undefined;
        const rtl = getComputedStyle(this).direction === 'rtl';
        if (!row || !this.#model.key(key, row, rtl, (item) => this.#activate(item)))
          if (!this.#typeahead.type(key)) return;
      }
    } else {
      switch (key) {
        case 'ArrowDown':
        case 'ArrowUp':
        case 'Enter':
        case ' ':
          this._show('selected');
          break;
        case 'Home':
        case 'End':
          if (event.altKey) return;
          this._show(key === 'Home' ? 'first' : 'last');
          break;
        case 'Backspace': {
          const last = this._selected.peek().at(-1);
          if (last === undefined || !this._editable) return;
          this._remove(last);
          break;
        }
        case 'ArrowLeft':
        case 'ArrowRight': {
          const rtl = getComputedStyle(this).direction === 'rtl';
          if (!this.multiple || key !== (rtl ? 'ArrowRight' : 'ArrowLeft')) return;
          if (!this._focusChips()) return;
          break;
        }
        default:
          if (event.altKey || [...key].length !== 1 || !this._editable) return;
          this._show();
          this.#typeahead.type(key);
      }
    }
    event.preventDefault();
  };

  /** @internal Template handler: presses in the field keep focus on the trigger. */
  readonly _onBoxPointerdown = (event: PointerEvent): void => {
    if (event.button === 0) event.preventDefault();
  };

  /** @internal Template handler: a click in the field (not on its buttons) opens or closes the popup. */
  readonly _onBoxClick = (event: MouseEvent): void => {
    // The path as dispatched: a removed chip's button is no longer the target's ancestor.
    if (event.composedPath().some((node) => node instanceof HTMLButtonElement)) return;
    this._entry()?.focus();
    if (this._showing) this._hide();
    else this._show();
  };

  /** @internal Template handler: the label focuses the trigger, as a native label does. */
  readonly _onLabelClick = (): void => {
    this._entry()?.focus();
  };

  /** @internal Template handler: a click on a row's chevron expands or collapses it; elsewhere it chooses. */
  readonly _onPopupClick = (event: MouseEvent): void => {
    const path = event.composedPath();
    const index = this._rowElements().findIndex((row) => path.includes(row));
    if (index < 0) return;
    const row = this.items ? this._rows.peek()[index] : undefined;
    if (row && path.some((node) => (node as Element).classList?.contains('toggle'))) {
      this.#model.toggle(row.item);
      return;
    }
    this._setActive(index, { scroll: false });
    this._choose(index);
  };

  /** @internal Template handler: the footer's Clear (multiple). */
  readonly _onClearAll = (): void => {
    if (this._editable) this._clear();
  };

  /** @internal Template handler: the footer's Close or Done. */
  readonly _onDone = (): void => {
    this._hide();
    this._entry()?.focus();
  };

  protected override mounted(scope: Scope): void {
    super.mounted(scope);
    scope.use(this.#typeahead);
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'odd-picker': OddkinPicker;
  }
}
