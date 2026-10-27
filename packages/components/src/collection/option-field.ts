import { ActiveDescendant } from '@oddkin/core/controllers/active-descendant';
import { ResizeController } from '@oddkin/core/controllers/observe';
import { prop } from '@oddkin/core/element';
import { format, formatNumber, langOf, listFormat, plural } from '@oddkin/core/i18n';
import { computed, signal, type Readable } from '@oddkin/core/reactive';
import type { Scope } from '@oddkin/core/scope';
import { composedContains, Overlay, type OverlayOptions } from '../overlay/overlay.js';
import type { OptionRecord } from './collection.js';
import { OddkinOptionControl } from './option-control.js';

/** The built-in text every option field shows (each element's `strings` extends it). */
export const OPTION_FIELD_STRINGS = {
  clear: 'Clear',
  remove: 'Remove {label}',
  selected: 'Selected',
  more: '{count} more',
  count: '{count} selected',
  others: '{count} others',
  othersOne: '{count} other',
  group: '{group} · {count}',
  total: '{count} total',
  showAll: 'Show all',
  showLess: 'Show less',
  selectAll: 'Select all {count} options',
  clearAll: 'Clear all',
  selectedCount: 'Selected ({count})',
  viewMore: 'View {count} more',
};

/** How the chosen values show in a multiple field (component-contracts.md §3.3). */
export const VIEWS = [
  'chips',
  'count',
  'text',
  'auto',
  'expandable',
  'avatars',
  'grouped',
] as const;
export type OptionFieldView = (typeof VIEWS)[number];
/** `view="auto"` shows chips up to this many values, and the count from one more (Figma's collapseAt). */
export const AUTO_CHIPS = 4;

/** A run of chosen values that share an option group (`view="grouped"`). */
export interface ChosenGroup {
  readonly label: string;
  readonly count: number;
}

/**
 * What a field that chooses from a popup shares (`odd-combobox`, `odd-picker`;
 * component-contracts.md §3.3): a `role="combobox"` element (`.combobox`) in the field box
 * (`part="control"`) that keeps DOM focus while the popup's rows (`option` or `treeitem`) are
 * its active descendant; the popup (`#popup`, a manual popover placed against the box, closed by
 * Escape, a press outside, or focus leaving); with `multiple`, the chosen values as chips that
 * collapse to "+N" ( `part="more"`) when they do not fit on one line, removable by pointer and by
 * keyboard; the clear button (`part="clear"`). Over `OddkinOptionControl`'s form semantics.
 * Internal to `@oddkin/components` (import it relatively).
 */
export class OddkinOptionField extends OddkinOptionControl.with({
  view: prop.enum(VIEWS, {
    default: 'chips',
    reflect: true,
    description:
      'With `multiple`, how the chosen values show in the field: chips ("+N" for those that do not fit), a count, a sentence (`text`), chips up to four and then the count (`auto`), two rows of chips with Show all (`expandable`), initials (`avatars`), or a count per group (`grouped`).',
  }),
  selectAll: prop.boolean({
    description:
      'With `multiple` and options, a "Select all" check box above them: it chooses every usable option shown, or clears them when all are chosen.',
  }),
  review: prop.boolean({
    description:
      'With `multiple`, the open popup starts with the chosen values: "Selected (N)", a disclosure of the first three, each removable, and View N more.',
  }),
}) {
  readonly #focusWithin = signal(false);
  // `view="expandable"`: every chosen value shows below the field (Show all).
  readonly #reviewing = signal(false);
  // `review`: the popup's disclosure of the chosen values is closed; View N more is open.
  readonly #reviewClosed = signal(false);
  readonly #reviewAll = signal(false);
  readonly #overlay = new Overlay(this._overlayOptions());
  readonly #active = new ActiveDescendant({
    target: () => this._entry(),
    items: () => this._rowElements(),
    homeEnd: this._homeEnd(),
    onActiveChange: (index) => (this._activeIndex.value = index),
  });
  readonly #resize = new ResizeController(() => this.#measure(), {
    targets: () => [this._box()],
  });

  /** @internal The active row's index among the shown rows. */
  readonly _activeIndex = signal(-1);
  /** @internal Chips shown while collapsed (the rest are "+N"). */
  readonly _shown = signal(Number.POSITIVE_INFINITY);
  /** @internal Whether the popup is open, for `aria-expanded`. */
  readonly _open: Readable<boolean> = this.#overlay.open;
  /** @internal Whether focus is in the element. */
  readonly _focusWithin: Readable<boolean> = this.#focusWithin;
  /** @internal With `multiple`, the chips collapse to "+N" (by default while focus is outside). */
  readonly _collapsed: Readable<boolean> = computed(() =>
    this._view.value === 'chips' ? this._collapses() : true,
  );
  /** @internal Whether every chosen value shows below the field (`view="expandable"`). */
  readonly _reviewing: Readable<boolean> = this.#reviewing;
  /** @internal Whether the popup's review of the chosen values is open (`review`). */
  readonly _reviewOpen: Readable<boolean> = computed(() => !this.#reviewClosed.value);
  /** @internal Whether the popup's review shows every chosen value, not the first three. */
  readonly _reviewAll: Readable<boolean> = this.#reviewAll;

  /** @internal The view in effect: `auto` is chips up to `AUTO_CHIPS` values, then the count. */
  readonly _view: Readable<OptionFieldView> = computed(() => {
    const view = this.view;
    if (view !== 'auto') return view;
    return this._selected.value.length > AUTO_CHIPS ? 'count' : 'chips';
  });

  /** @internal The count (`view="count"`): "32 selected". */
  get _countText(): string {
    const count = formatNumber(this._selected.value.length, langOf(this));
    return format(this._strings.count, { count });
  }

  /** @internal The sentence (`view="text"`): "Amelia, Noah, and 30 others". */
  get _sentence(): string {
    const labels = this._selected.value.map((value) => this._labelOf(value));
    const lang = langOf(this);
    if (labels.length <= 2) return listFormat(lang, { type: 'conjunction' }).format(labels);
    const rest = labels.length - 2;
    const strings = this._strings;
    const others = format(plural(rest, { one: strings.othersOne, other: strings.others }, lang), {
      count: formatNumber(rest, lang),
    });
    return listFormat(lang, { type: 'conjunction' }).format([...labels.slice(0, 2), others]);
  }

  /** @internal The chosen values by option group, in order (`view="grouped"`). */
  get _groups(): readonly ChosenGroup[] {
    const counts = new Map<string, number>();
    for (const value of this._selected.value) {
      const group = this._groupOf(value);
      counts.set(group, (counts.get(group) ?? 0) + 1);
    }
    return [...counts].map(([label, count]) => ({ label, count }));
  }

  /** @internal The group a chosen value belongs to: its option's `group`, else its own label. */
  _groupOf(value: string): string {
    return (
      this._options.value.find((option) => option.value === value)?.group ?? this._labelOf(value)
    );
  }

  /** @internal Localized strings; an element with more text returns its own. */
  get _strings(): typeof OPTION_FIELD_STRINGS {
    return OPTION_FIELD_STRINGS;
  }

  /** @internal The popup wiring; an element may add placement hooks. */
  protected _overlayOptions(): OverlayOptions {
    return {
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
    };
  }

  /** @internal Home and End move the active row (not in a text field). */
  protected _homeEnd(): boolean {
    return true;
  }

  /** @internal Whether the chips collapse now (a reactive read). */
  protected _collapses(): boolean {
    return !this.#focusWithin.value;
  }

  /** @internal The remove button's name for a chip. */
  _removeLabel(label: string): string {
    return format(this._strings.remove, { label });
  }

  /** @internal The "+N" chip's text for assistive technology. */
  _moreLabel(count: number): string {
    return format(this._strings.more, { count: formatNumber(count, langOf(this)) });
  }

  /** @internal A string with its numbers in the page language. */
  _format(text: string, values: Record<string, string | number>): string {
    const lang = langOf(this);
    const local = Object.fromEntries(
      Object.entries(values).map(([key, value]) => [
        key,
        typeof value === 'number' ? formatNumber(value, lang) : value,
      ]),
    );
    return format(text, local);
  }

  /** @internal Template handler: Show all and Show less (`view="expandable"`). */
  readonly _onReview = (): void => {
    this.#reviewing.value = !this.#reviewing.peek();
  };

  /** @internal Template handler: the popup review's disclosure (`review`). */
  readonly _onReviewToggle = (): void => {
    this.#reviewClosed.value = !this.#reviewClosed.peek();
  };

  /** @internal Template handler: View N more and Show less in the popup review. */
  readonly _onViewMore = (): void => {
    this.#reviewAll.value = !this.#reviewAll.peek();
  };

  /** @internal Template handler: a remove button in the popup review; focus moves to the next. */
  readonly _onReviewRemove = (event: Event, value: string): void => {
    const buttons = [
      ...(this.shadowRoot?.querySelectorAll<HTMLElement>('[part~="selected-remove"]') ?? []),
    ];
    const at = buttons.indexOf(event.currentTarget as HTMLElement);
    const focused = this.shadowRoot?.activeElement === event.currentTarget;
    this._remove(value);
    if (!focused) return;
    (
      buttons[at + 1] ??
      buttons[at - 1] ??
      this.shadowRoot?.querySelector<HTMLElement>('[part~="selected-toggle"]')
    )?.focus();
  };

  /** @internal The label of `value` among all options, or the value itself. */
  _labelOf(value: string): string {
    if (!value) return '';
    return this._options.value.find((option) => option.value === value)?.label ?? value;
  }

  /** @internal The value cannot change, though it is still submitted. */
  protected _readonly(): boolean {
    return false;
  }

  /** @internal The user may change the value now. */
  get _editable(): boolean {
    return !this._readonly() && !this._formDisabled.peek();
  }

  /** @internal The user may change the value (a reactive read, for templates). */
  get _changeable(): boolean {
    return !this._readonly() && !this._formDisabled.value;
  }

  /** @internal The clear button shows while there is a value the user may clear. */
  get _clearable(): boolean {
    return this._changeable && this._selected.value.length > 0;
  }

  /** @internal The `role="combobox"` element, which keeps focus. */
  _entry(): HTMLElement | null | undefined {
    return this.shadowRoot?.querySelector<HTMLElement>('.combobox');
  }

  /** @internal The field box the popup is placed against. */
  _box(): HTMLElement | null | undefined {
    return this.shadowRoot?.querySelector<HTMLElement>('[part~="control"]');
  }

  /** @internal The popup surface. */
  _popup(): HTMLElement | null | undefined {
    return this.shadowRoot?.getElementById('popup');
  }

  /** @internal The shown rows, in order. */
  _rowElements(): HTMLElement[] {
    return [
      ...(this.shadowRoot?.querySelectorAll<HTMLElement>('[role="option"], [role="treeitem"]') ??
        []),
    ];
  }

  /** @internal The active row's index, or -1. */
  get _active(): number {
    return this.#active.activeIndex;
  }

  /** @internal Whether the popup shows now (`_open` follows at its `toggle` event). */
  get _showing(): boolean {
    return !!this._popup()?.matches(':popover-open');
  }

  /** @internal Makes the row at `index` active (-1: none). */
  _setActive(index: number, options?: { scroll?: boolean }): void {
    this.#active.setActive(index, options);
  }

  /**
   * @internal Opens the popup, with the row at `at` active: the first or last usable row, or the
   * first selected one (else the first usable).
   */
  _show(at?: 'first' | 'last' | 'selected'): void {
    if (!this._editable) return;
    this.#overlay.show();
    if (!at) return;
    const rows = this._rowElements();
    const usable = (row: HTMLElement) => row.getAttribute('aria-disabled') !== 'true';
    const selected = rows.findIndex(
      (row) => row.getAttribute('aria-selected') === 'true' && usable(row),
    );
    this.#active.setActive(
      at === 'last'
        ? rows.findLastIndex(usable)
        : at === 'selected' && selected >= 0
          ? selected
          : rows.findIndex(usable),
    );
  }

  /** @internal Closes the popup. */
  _hide(): void {
    this.#overlay.hide();
  }

  /** @internal Removes one chosen value (multiple). */
  _remove(value: string): void {
    if (!this._editable) return;
    this._commit(this._selected.peek().filter((v) => v !== value));
  }

  /** The visible remove buttons of one list of chips: the field's, or the review's. */
  #removeButtons(list: Element | null | undefined): HTMLElement[] {
    return [...(list?.querySelectorAll<HTMLElement>('[part~="chip-remove"]') ?? [])].filter(
      (button) => button.checkVisibility(),
    );
  }

  /** @internal Moves focus from the combobox to the field's last chip; false when there is none. */
  _focusChips(): boolean {
    const last = this.#removeButtons(this._box()).at(-1);
    last?.focus();
    return !!last;
  }

  /** @internal Template handler: keys on a chip's remove button. */
  readonly _onChipKeydown = (event: KeyboardEvent, value: string): void => {
    if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return;
    const button = event.currentTarget as HTMLElement;
    const buttons = this.#removeButtons(button.closest('.chips'));
    const at = buttons.indexOf(button);
    const rtl = getComputedStyle(button).direction === 'rtl';
    const entry = this._entry();
    switch (event.key) {
      case 'ArrowLeft':
      case 'ArrowRight': {
        const back = event.key === (rtl ? 'ArrowRight' : 'ArrowLeft');
        const next = buttons[at + (back ? -1 : 1)];
        if (next) next.focus();
        else if (!back) entry?.focus();
        break;
      }
      case 'Backspace':
      case 'Delete':
        this._remove(value);
        // The previous chip, or the combobox when none is left before it.
        (buttons[at - 1] ?? entry)?.focus();
        break;
      case 'Escape':
        entry?.focus();
        break;
      default:
        return;
    }
    event.preventDefault();
  };

  /** @internal Template handler: a chip's remove button. */
  readonly _onChipRemove = (value: string): void => {
    this._remove(value);
    this._entry()?.focus();
  };

  /** @internal Clears the value, as a user's clear does. */
  _clear(): void {
    this._commit([]);
  }

  /** @internal Chooses every usable option of `options`, or clears them when all are chosen. */
  _selectAll(options: readonly OptionRecord[]): void {
    if (!this._editable) return;
    const usable = options.filter((option) => !option.disabled).map((option) => option.value);
    const selected = this._selected.peek();
    const all = usable.every((value) => selected.includes(value));
    this._commit(
      all
        ? selected.filter((value) => !usable.includes(value))
        : [...new Set([...selected, ...usable])],
    );
  }

  /** @internal Template handler: the clear button. */
  readonly _onClear = (): void => {
    if (!this._editable) return;
    this._clear();
    this._entry()?.focus();
  };

  /** @internal Template handler: presses in the popup keep focus in the combobox. */
  readonly _onPopupPointerdown = (event: PointerEvent): void => {
    event.preventDefault();
  };

  /** @internal After focus left the element and the popup closed. */
  protected _onLeave(): void {}

  /**
   * The items (chips, initials, or group chips) that fit in the field box while collapsed, on one
   * row (two with `view="expandable"`); the rest become "+N". The combobox keeps its minimum width
   * on the last row.
   */
  #measure(): void {
    const box = this._box();
    const entry = this._entry();
    if (!this.multiple || !box || !entry) return;
    // Expanded, every chip shows (the template ignores `_shown`).
    if (!this._collapsed.peek()) return;
    const items = [...box.querySelectorAll<HTMLElement>('.item')];
    const more = box.querySelector<HTMLElement>('[part~="more"]');
    const list = items[0]?.parentElement;
    if (!list || !more) return;
    const boxStyle = getComputedStyle(box);
    const gap = parseFloat(getComputedStyle(list).columnGap) || 0;
    const full =
      box.clientWidth -
      (parseFloat(boxStyle.paddingInlineStart) || 0) -
      (parseFloat(boxStyle.paddingInlineEnd) || 0);
    const last =
      full -
      (parseFloat(getComputedStyle(entry).minInlineSize) || 0) -
      (parseFloat(boxStyle.columnGap) || 0);
    const plus = more.getBoundingClientRect().width + gap;
    // Each item at its full width: a chip in the flow may be cut short to the list's width, one
    // out of it is not, and the count must not depend on which it was at the last measure.
    const widths = items.map((item) => {
      const text = item.querySelector<HTMLElement>('.chip-text');
      const width = item.getBoundingClientRect().width;
      return text ? width - text.clientWidth + text.scrollWidth : width;
    });
    const rows = this._view.peek() === 'expandable' ? 2 : 1;
    let row = 1;
    let used = 0;
    let shown = 0;
    for (; shown < widths.length; shown++) {
      const width = widths[shown] ?? 0;
      // "+N" must fit after the last shown item, on the last row.
      const reserve = shown + 1 < widths.length ? plus : 0;
      const room = row === rows ? last : full;
      const next = used + (used ? gap : 0) + width;
      if (next + (row === rows ? reserve : 0) <= room) {
        used = next;
        continue;
      }
      if (row === rows || width + (row + 1 === rows ? reserve : 0) > last) break;
      row++;
      used = width;
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
      this._hide();
      this._onLeave();
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
    this.#overlay.update();
    this.#measure();
  }
}
